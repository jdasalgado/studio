import { prisma } from '@studio/database/prisma';
import { EmailService } from './email-service';
import type { ApprovalRequest } from '@/lib/types';
import { toJsDate } from '@/lib/utils';
import { format } from 'date-fns';
import path from 'path';
import fs from 'fs';

/**
 * Orchestrates notifications for various workflows.
 */
export class NotificationService {
    private static APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://cogapp.vercel.app';

    /**
     * Notifies relevant approvers about a new approval request.
     */
    static async notifyNewRequest(request: any) {
        try {
            const recipients = await this.resolveRecipients(request);
            if (recipients.length === 0) {
                console.warn('No recipients found for approval request:', request.id);
                return;
            }

            const { subject, html, text } = this.formatNewRequestEmail(request);

            await EmailService.sendEmail({
                to: recipients,
                subject,
                html,
                text,
            });

            console.log(`Notification sent to ${recipients.length} recipients for request ${request.id}`);
        } catch (error) {
            console.error('Failed to send new request notification:', error);
        }
    }

    /**
     * Resolves email addresses of users who should be notified.
     */
    private static async resolveRecipients(request: ApprovalRequest): Promise<string[]> {
        // 1. If it's a Room Booking pending Ministry Head approval, notify the Ministry Approver if set
        if (request.type === 'Room Booking' && request.reservationId && request.status === 'Pending Ministry Approval') {
            const booking = await prisma.booking.findUnique({
                where: { id: request.reservationId },
            });

            if (booking?.ministryId) {
                const ministry = await prisma.ministry.findUnique({
                    where: { id: booking.ministryId },
                });

                if (ministry?.approverId) {
                    const approver = await prisma.worker.findUnique({
                        where: { id: ministry.approverId },
                    });
                    if (approver?.email) {
                        return [approver.email];
                    }
                }
            }
        }

        // 2. Fallback: Notify all Admins and Approvers
        const approverRoles = await prisma.role.findMany({
            where: {
                OR: [
                    { name: 'Admin' },
                    { permissions: { has: 'manage_approvals' } },
                    { permissions: { has: 'approve_room_reservation' } },
                ],
            },
            select: { id: true },
        });

        const roleIds = approverRoles.map(r => r.id);

        const globalApprovers = await prisma.worker.findMany({
            where: {
                roleId: { in: roleIds },
                status: 'Active',
            },
            select: { email: true },
        });

        return globalApprovers.map(a => a.email).filter(Boolean) as string[];
    }

    /**
     * Formats the email content for a new approval request.
     */
    private static formatNewRequestEmail(request: ApprovalRequest) {
        const subject = `[Approval Required] New ${request.type} Request`;
        const approvalUrl = `${this.APP_URL}/approvals`; // Assuming there's an approvals page

        const html = `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #2563eb;">New Approval Request</h2>
                <p>A new <strong>${request.type}</strong> request has been submitted and requires your review.</p>
                
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Requester:</strong> ${request.requester}</p>
                    <p><strong>Date:</strong> ${toJsDate(request.date).toLocaleDateString()}</p>
                    <p><strong>Details:</strong> ${request.details}</p>
                </div>
                
                <a href="${approvalUrl}" 
                   style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Review Request
                </a>
                
                <p style="margin-top: 30px; font-size: 0.875rem; color: #6b7280;">
                    This is an automated notification from the Studio management system.
                </p>
            </div>
        `;

        const text = `
            New Approval Request
            
            A new ${request.type} request has been submitted by ${request.requester}.
            
            Details: ${request.details}
            
            Review it here: ${approvalUrl}
        `;

        return { subject, html, text };
    }

    /**
     * Sends the official final approval email to the worker for an approved Room Reservation.
     * ONLY triggered after System Admin final approval.
     */
    static async notifyRoomReservationApproved(approvalId?: string, reservationId?: string) {
        let approval: any = null;
        let booking: any = null;

        if (approvalId) {
            approval = await prisma.approvalRequest.findUnique({
                where: { id: approvalId },
                include: { worker: true },
            }).catch(err => {
                console.error('[NotificationService] Error querying approval request:', err);
                return null;
            });
        }

        const effectiveBookingId = reservationId || approval?.reservationId;
        if (effectiveBookingId) {
            booking = await prisma.booking.findUnique({
                where: { id: effectiveBookingId },
                include: {
                    room: true,
                    worker: true,
                },
            }).catch(err => {
                console.error('[NotificationService] Error querying booking by id:', err);
                return null;
            });
        }

        // Secondary lookup: find booking by requestId if not found by ID
        if (!booking && approval?.requestId) {
            booking = await prisma.booking.findFirst({
                where: { requestId: approval.requestId },
                include: {
                    room: true,
                    worker: true,
                },
            }).catch(err => {
                console.error('[NotificationService] Error querying booking by requestId:', err);
                return null;
            });
        }

        // Secondary lookup: find approval by reservationId if not found by approvalId
        if (!approval && effectiveBookingId) {
            approval = await prisma.approvalRequest.findFirst({
                where: { reservationId: effectiveBookingId },
                include: { worker: true },
            }).catch(err => {
                console.error('[NotificationService] Error querying approval by reservationId:', err);
                return null;
            });
        }

        // 1. Resolve Worker and Email recipient
        let worker = booking?.worker || approval?.worker;
        if (!worker && approval?.workerId) {
            worker = await prisma.worker.findUnique({
                where: { id: approval.workerId },
            }).catch(() => null);
        }
        if (!worker && booking?.workerProfileId) {
            worker = await prisma.worker.findUnique({
                where: { id: booking.workerProfileId },
            }).catch(() => null);
        }

        let recipientEmail = worker?.email || booking?.email || booking?.requesterEmail;
        if (!recipientEmail && approval?.requester && approval.requester.includes('@')) {
            recipientEmail = approval.requester;
        }
        if (!recipientEmail && (approval?.requester || booking?.name)) {
            const nameSearch = (approval?.requester || booking?.name || '').trim();
            const parts = nameSearch.split(/\s+/);
            if (parts.length >= 2) {
                const found = await prisma.worker.findFirst({
                    where: {
                        firstName: { equals: parts[0], mode: 'insensitive' },
                        lastName: { equals: parts.slice(1).join(' '), mode: 'insensitive' },
                    },
                    select: { email: true }
                }).catch(() => null);
                if (found?.email) {
                    recipientEmail = found.email;
                }
            }
        }
        if (recipientEmail) {
            recipientEmail = recipientEmail.trim();
        }

        if (!recipientEmail) {
            console.warn('[NotificationService] No recipient email found for approved room reservation:', {
                approvalId,
                reservationId,
                approvalWorkerId: approval?.workerId,
                bookingWorkerProfileId: booking?.workerProfileId,
                bookingEmail: booking?.email,
                approvalRequester: approval?.requester,
            });
            return { success: false, error: 'No recipient email found for worker.' };
        }

        // 2. Resolve Worker Name
        const workerName = worker
            ? `${worker.firstName} ${worker.lastName}`.trim()
            : (booking?.name || approval?.requester || 'Worker');

        // 3. Resolve Room Name
        let roomName = booking?.room?.name;
        if (!roomName && (approval?.roomId || booking?.roomId)) {
            const r = await prisma.room.findUnique({
                where: { id: approval?.roomId || booking?.roomId },
            }).catch(() => null);
            roomName = r?.name;
        }
        roomName = roomName || 'Reserved Room';

        // 4. Resolve Request ID
        const rawReqId = booking?.requestId || approval?.requestId;
        const fallbackId = (approval?.id || booking?.id || '').slice(-4).toUpperCase();
        const requestId = rawReqId || (fallbackId ? `REQ-${fallbackId}` : 'N/A');

        // 5. Resolve Dates & Times
        const startDate = booking?.start ? new Date(booking.start) : (approval?.date ? new Date(approval.date) : null);
        const endDate = booking?.end ? new Date(booking.end) : null;

        const reservationDate = startDate ? format(startDate, 'MMMM d, yyyy') : 'N/A';
        const startTimeStr = startDate ? format(startDate, 'h:mm a') : 'N/A';
        const endTimeStr = endDate ? format(endDate, 'h:mm a') : 'N/A';
        const timeStr = `${startTimeStr} – ${endTimeStr}`;

        // 6. Resolve Ministry Name & Department
        let ministryName = 'General';
        let departmentName = 'General';
        const minId = booking?.ministryId || worker?.majorMinistryId || approval?.newMajorId || approval?.oldMajorId;
        if (minId) {
            const ministry = await prisma.ministry.findUnique({
                where: { id: minId },
                include: { department: true },
            }).catch(() => null);
            if (ministry) {
                ministryName = ministry.name;
                departmentName = ministry.department?.name || 'General';
            }
        }
        if (departmentName === 'General') {
            if ((worker as any)?.department) {
                departmentName = (worker as any).department;
            } else if ((worker as any)?.departmentCode) {
                const codeMap: Record<string, string> = {
                    W: 'Worship',
                    O: 'Outreach',
                    R: 'Relationship',
                    D: 'Discipleship',
                    A: 'Administration',
                };
                departmentName = codeMap[(worker as any).departmentCode.toUpperCase()] || 'General';
            }
        }

        // 7. Resolve Purpose
        const purpose = booking?.purpose || booking?.title || approval?.details?.replace(/^"|"$/g, '') || 'Room Reservation';

        // Resolve logo web URL and attachment safely
        const logoUrl = `${this.APP_URL}/church-logo.png`;
        let attachments: any[] | undefined = undefined;
        try {
            const possibleLogoPaths = [
                path.resolve(process.cwd(), 'public/church-logo.png'),
                path.resolve(process.cwd(), 'public/cog-logo.png'),
                path.resolve(process.cwd(), 'apps/web/public/church-logo.png'),
                path.resolve(process.cwd(), 'apps/web/public/cog-logo.png'),
            ];
            const logoPath = possibleLogoPaths.find((p) => fs.existsSync(p));
            if (logoPath) {
                attachments = [{
                    filename: 'church-logo.png',
                    content: fs.readFileSync(logoPath),
                    contentType: 'image/png',
                    cid: 'coglogo',
                    contentDisposition: 'inline',
                }];
            }
        } catch (e) {
            console.warn('[NotificationService] Could not read local logo attachment (will use web URL):', e);
        }

        // 8. Construct Subject & Body
        const subject = `Room Reservation Approved – ${roomName}`;

        const text = `
Room Reservation Approved

Hello ${workerName},

Your room reservation request has been reviewed and has received final approval from the System Administrator.

Reservation Details

Request ID: ${requestId}
Room: ${roomName}
Date: ${reservationDate}
Time: ${timeStr}
Ministry: ${ministryName}
Department: ${departmentName}
Purpose: ${purpose}
Status: APPROVED

You may now use the reserved room on the approved date and time.

Thank you,
Church of God Dasmariñas
`.trim();

        const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
                <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #f1f5f9;">
                    <div style="margin-bottom: 12px;">
                        <img src="${logoUrl}" alt="COG Logo" width="64" height="64" style="display: inline-block; border-radius: 50%; background-color: #ffffff; padding: 2px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);" />
                    </div>
                    <h1 style="color: #0f172a; font-size: 22px; font-weight: 800; margin: 0 0 6px 0;">Room Reservation Approved</h1>
                    <p style="color: #64748b; font-size: 13px; margin: 0;">Church of God Dasmariñas</p>
                </div>

                <div style="padding: 24px 0;">
                    <p style="font-size: 15px; line-height: 1.6; margin: 0 0 14px 0;">
                        Hello <strong>${workerName}</strong>,
                    </p>
                    <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px 0; color: #334155;">
                        Your room reservation request has been reviewed and has received <strong>final approval</strong> from the System Administrator.
                    </p>

                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                        <h2 style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin: 0 0 14px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                            Reservation Details
                        </h2>
                        
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <tr>
                                <td style="padding: 8px 12px 8px 0; color: #64748b; font-weight: 500; width: 120px; white-space: nowrap; vertical-align: middle;">Request ID:</td>
                                <td style="padding: 8px 0; color: #0f172a; font-weight: 700; font-family: monospace; vertical-align: middle;">${requestId}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 12px 8px 0; color: #64748b; font-weight: 500; width: 120px; white-space: nowrap; vertical-align: middle;">Room:</td>
                                <td style="padding: 8px 0; color: #0f172a; font-weight: 700; vertical-align: middle;">${roomName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 12px 8px 0; color: #64748b; font-weight: 500; width: 120px; white-space: nowrap; vertical-align: middle;">Date:</td>
                                <td style="padding: 8px 0; color: #0f172a; font-weight: 600; vertical-align: middle;">${reservationDate}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 12px 8px 0; color: #64748b; font-weight: 500; width: 120px; white-space: nowrap; vertical-align: middle;">Time:</td>
                                <td style="padding: 8px 0; color: #0f172a; font-weight: 600; vertical-align: middle;">${timeStr}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 12px 8px 0; color: #64748b; font-weight: 500; width: 120px; white-space: nowrap; vertical-align: middle;">Ministry:</td>
                                <td style="padding: 8px 0; color: #0f172a; font-weight: 600; vertical-align: middle;">${ministryName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 12px 8px 0; color: #64748b; font-weight: 500; width: 120px; white-space: nowrap; vertical-align: middle;">Department:</td>
                                <td style="padding: 8px 0; color: #0f172a; font-weight: 600; vertical-align: middle;">${departmentName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 12px 8px 0; color: #64748b; font-weight: 500; width: 120px; white-space: nowrap; vertical-align: middle;">Purpose:</td>
                                <td style="padding: 8px 0; color: #0f172a; font-weight: 600; vertical-align: middle;">${purpose}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 12px 8px 0; color: #64748b; font-weight: 500; width: 120px; white-space: nowrap; vertical-align: middle;">Status:</td>
                                <td style="padding: 8px 0; vertical-align: middle;">
                                    <span style="display: inline-block; background-color: #dcfce7; color: #15803d; font-weight: 800; font-size: 11px; padding: 2px 8px; border-radius: 6px; border: 1px solid #86efac; text-transform: uppercase;">
                                        APPROVED
                                    </span>
                                </td>
                            </tr>
                        </table>
                    </div>

                    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px; margin-bottom: 24px;">
                        <p style="margin: 0; font-size: 13px; color: #166534; font-weight: 600;">
                            You may now use the reserved room on the approved date and time.
                        </p>
                    </div>

                    <p style="font-size: 14px; line-height: 1.5; color: #475569; margin: 0;">
                        Thank you,<br />
                        <strong>Church of God Dasmariñas</strong>
                    </p>
                </div>
            </div>
        `;

        try {
            await EmailService.sendEmail({
                to: recipientEmail,
                subject,
                html,
                text,
                attachments,
            });
            console.log(`[NotificationService] Room reservation final approval email sent to worker ${recipientEmail} for room "${roomName}" (Request ID: ${requestId})`);
            return { success: true };
        } catch (sendErr: any) {
            console.error(`[NotificationService] Failed to send approval email to ${recipientEmail}:`, sendErr);
            return { success: false, error: sendErr?.message || String(sendErr) };
        }
    }

    /**
     * Sends the rejection notification email to the worker for a rejected Room Reservation.
     */
    static async notifyRoomReservationRejected(approvalId?: string, reservationId?: string, reason?: string) {
        let approval: any = null;
        let booking: any = null;

        if (approvalId) {
            approval = await prisma.approvalRequest.findUnique({
                where: { id: approvalId },
                include: { worker: true },
            }).catch(err => {
                console.error('[NotificationService] Error querying approval request:', err);
                return null;
            });
        }

        const effectiveBookingId = reservationId || approval?.reservationId;
        if (effectiveBookingId) {
            booking = await prisma.booking.findUnique({
                where: { id: effectiveBookingId },
                include: {
                    room: true,
                    worker: true,
                },
            }).catch(err => {
                console.error('[NotificationService] Error querying booking by id:', err);
                return null;
            });
        }

        // Secondary lookup: find booking by requestId
        if (!booking && approval?.requestId) {
            booking = await prisma.booking.findFirst({
                where: { requestId: approval.requestId },
                include: {
                    room: true,
                    worker: true,
                },
            }).catch(err => {
                console.error('[NotificationService] Error querying booking by requestId:', err);
                return null;
            });
        }

        // Secondary lookup: find approval by reservationId
        if (!approval && effectiveBookingId) {
            approval = await prisma.approvalRequest.findFirst({
                where: { reservationId: effectiveBookingId },
                include: { worker: true },
            }).catch(err => {
                console.error('[NotificationService] Error querying approval by reservationId:', err);
                return null;
            });
        }

        let worker = booking?.worker || approval?.worker;
        if (!worker && approval?.workerId) {
            worker = await prisma.worker.findUnique({
                where: { id: approval.workerId },
            }).catch(() => null);
        }
        if (!worker && booking?.workerProfileId) {
            worker = await prisma.worker.findUnique({
                where: { id: booking.workerProfileId },
            }).catch(() => null);
        }

        let recipientEmail = worker?.email || booking?.email || booking?.requesterEmail;
        if (!recipientEmail && approval?.requester && approval.requester.includes('@')) {
            recipientEmail = approval.requester;
        }
        if (recipientEmail) {
            recipientEmail = recipientEmail.trim();
        }

        if (!recipientEmail) {
            console.warn('[NotificationService] No recipient email found for rejected room reservation:', {
                approvalId,
                reservationId,
                approvalWorkerId: approval?.workerId,
                bookingWorkerProfileId: booking?.workerProfileId,
                bookingEmail: booking?.email,
                approvalRequester: approval?.requester,
            });
            return { success: false, error: 'No recipient email found for worker.' };
        }

        const workerName = worker
            ? `${worker.firstName} ${worker.lastName}`.trim()
            : (booking?.name || approval?.requester || 'Worker');

        let roomName = booking?.room?.name;
        if (!roomName && (approval?.roomId || booking?.roomId)) {
            const r = await prisma.room.findUnique({
                where: { id: approval?.roomId || booking?.roomId },
            }).catch(() => null);
            roomName = r?.name;
        }
        roomName = roomName || 'Reserved Room';

        const rawReqId = booking?.requestId || approval?.requestId;
        const fallbackId = (approval?.id || booking?.id || '').slice(-4).toUpperCase();
        const requestId = rawReqId || (fallbackId ? `REQ-${fallbackId}` : 'N/A');

        const startDate = booking?.start ? new Date(booking.start) : (approval?.date ? new Date(approval.date) : null);
        const endDate = booking?.end ? new Date(booking.end) : null;

        const reservationDate = startDate ? format(startDate, 'MMMM d, yyyy') : 'N/A';
        const startTimeStr = startDate ? format(startDate, 'h:mm a') : 'N/A';
        const endTimeStr = endDate ? format(endDate, 'h:mm a') : 'N/A';
        const timeStr = `${startTimeStr} – ${endTimeStr}`;

        let ministryName = 'General';
        let departmentName = 'General';
        const minId = booking?.ministryId || worker?.majorMinistryId || approval?.newMajorId || approval?.oldMajorId;
        if (minId) {
            const ministry = await prisma.ministry.findUnique({
                where: { id: minId },
                include: { department: true },
            }).catch(() => null);
            if (ministry) {
                ministryName = ministry.name;
                departmentName = ministry.department?.name || 'General';
            }
        }
        if (departmentName === 'General') {
            if ((worker as any)?.department) {
                departmentName = (worker as any).department;
            } else if ((worker as any)?.departmentCode) {
                const codeMap: Record<string, string> = {
                    W: 'Worship',
                    O: 'Outreach',
                    R: 'Relationship',
                    D: 'Discipleship',
                    A: 'Administration',
                };
                departmentName = codeMap[(worker as any).departmentCode.toUpperCase()] || 'General';
            }
        }

        const purpose = booking?.purpose || booking?.title || approval?.details?.replace(/^"|"$/g, '') || 'Room Reservation';
        const rejectionReason = reason?.trim() || 'No specific reason provided.';

        const logoUrl = `${this.APP_URL}/church-logo.png`;
        let attachments: any[] | undefined = undefined;
        try {
            const possibleLogoPaths = [
                path.resolve(process.cwd(), 'public/church-logo.png'),
                path.resolve(process.cwd(), 'public/cog-logo.png'),
                path.resolve(process.cwd(), 'apps/web/public/church-logo.png'),
                path.resolve(process.cwd(), 'apps/web/public/cog-logo.png'),
            ];
            const logoPath = possibleLogoPaths.find((p) => fs.existsSync(p));
            if (logoPath) {
                attachments = [{
                    filename: 'church-logo.png',
                    content: fs.readFileSync(logoPath),
                    contentType: 'image/png',
                    cid: 'coglogo',
                    contentDisposition: 'inline',
                }];
            }
        } catch (e) {
            console.warn('[NotificationService] Could not read local logo attachment (will use web URL):', e);
        }

        const subject = `Room Reservation Rejected – ${roomName}`;

        const text = `
Room Reservation Rejected

Hello ${workerName},

Your room reservation request for ${roomName} has been rejected.

Reason for Rejection:
${rejectionReason}

Reservation Details

Request ID: ${requestId}
Room: ${roomName}
Date: ${reservationDate}
Time: ${timeStr}
Ministry: ${ministryName}
Department: ${departmentName}
Purpose: ${purpose}
Status: REJECTED

Thank you,
Church of God Dasmariñas
`.trim();

        const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
                <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #f1f5f9;">
                    <div style="margin-bottom: 12px;">
                        <img src="${logoUrl}" alt="COG Logo" width="64" height="64" style="display: inline-block; border-radius: 50%; background-color: #ffffff; padding: 2px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);" />
                    </div>
                    <h1 style="color: #0f172a; font-size: 22px; font-weight: 800; margin: 0 0 6px 0;">Room Reservation Rejected</h1>
                    <p style="color: #64748b; font-size: 13px; margin: 0;">Church of God Dasmariñas</p>
                </div>

                <div style="padding: 24px 0;">
                    <p style="font-size: 15px; line-height: 1.6; margin: 0 0 14px 0;">
                        Hello <strong>${workerName}</strong>,
                    </p>
                    <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px 0; color: #334155;">
                        Your room reservation request for <strong>${roomName}</strong> was rejected.
                    </p>

                    <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                        <h3 style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #9f1239; margin: 0 0 6px 0;">
                            Reason for Rejection
                        </h3>
                        <p style="margin: 0; font-size: 14px; color: #881337; line-height: 1.5; font-weight: 500;">
                            ${rejectionReason}
                        </p>
                    </div>

                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                        <h2 style="font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin: 0 0 14px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                            Reservation Details
                        </h2>
                        
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <tr>
                                <td style="padding: 8px 12px 8px 0; color: #64748b; font-weight: 500; width: 120px; white-space: nowrap; vertical-align: middle;">Request ID:</td>
                                <td style="padding: 8px 0; color: #0f172a; font-weight: 700; font-family: monospace; vertical-align: middle;">${requestId}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 12px 8px 0; color: #64748b; font-weight: 500; width: 120px; white-space: nowrap; vertical-align: middle;">Room:</td>
                                <td style="padding: 8px 0; color: #0f172a; font-weight: 700; vertical-align: middle;">${roomName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 12px 8px 0; color: #64748b; font-weight: 500; width: 120px; white-space: nowrap; vertical-align: middle;">Date:</td>
                                <td style="padding: 8px 0; color: #0f172a; font-weight: 600; vertical-align: middle;">${reservationDate}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 12px 8px 0; color: #64748b; font-weight: 500; width: 120px; white-space: nowrap; vertical-align: middle;">Time:</td>
                                <td style="padding: 8px 0; color: #0f172a; font-weight: 600; vertical-align: middle;">${timeStr}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 12px 8px 0; color: #64748b; font-weight: 500; width: 120px; white-space: nowrap; vertical-align: middle;">Ministry:</td>
                                <td style="padding: 8px 0; color: #0f172a; font-weight: 600; vertical-align: middle;">${ministryName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 12px 8px 0; color: #64748b; font-weight: 500; width: 120px; white-space: nowrap; vertical-align: middle;">Department:</td>
                                <td style="padding: 8px 0; color: #0f172a; font-weight: 600; vertical-align: middle;">${departmentName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 12px 8px 0; color: #64748b; font-weight: 500; width: 120px; white-space: nowrap; vertical-align: middle;">Purpose:</td>
                                <td style="padding: 8px 0; color: #0f172a; font-weight: 600; vertical-align: middle;">${purpose}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 12px 8px 0; color: #64748b; font-weight: 500; width: 120px; white-space: nowrap; vertical-align: middle;">Status:</td>
                                <td style="padding: 8px 0; vertical-align: middle;">
                                    <span style="display: inline-block; background-color: #ffe4e6; color: #e11d48; font-weight: 800; font-size: 11px; padding: 2px 8px; border-radius: 6px; border: 1px solid #fda4af; text-transform: uppercase;">
                                        REJECTED
                                    </span>
                                </td>
                            </tr>
                        </table>
                    </div>

                    <p style="font-size: 14px; line-height: 1.5; color: #475569; margin: 0;">
                        Thank you,<br />
                        <strong>Church of God Dasmariñas</strong>
                    </p>
                </div>
            </div>
        `;

        try {
            await EmailService.sendEmail({
                to: recipientEmail,
                subject,
                html,
                text,
                attachments,
            });
            console.log(`[NotificationService] Room reservation rejection email sent to worker ${recipientEmail} for room "${roomName}" (Request ID: ${requestId})`);
            return { success: true };
        } catch (sendErr: any) {
            console.error(`[NotificationService] Failed to send rejection email to ${recipientEmail}:`, sendErr);
            return { success: false, error: sendErr?.message || String(sendErr) };
        }
    }

    /**
     * Sends a password reset email using Church of God branding and Gmail SMTP.
     */
    static async sendPasswordResetEmail(email: string, resetLink: string, workerName?: string) {
        try {
            const timeStr = new Date().toLocaleTimeString('en-US', {
                timeZone: 'Asia/Manila',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            });
            const reqRef = Math.random().toString(36).substring(2, 8).toUpperCase();
            const subject = `Reset Your Password - Church of God Dasmariñas (${timeStr})`;
            const displayName = workerName || 'Worker';

            // Resolve logo attachment
            const possibleLogoPaths = [
                path.resolve(process.cwd(), 'public/church-logo.png'),
                path.resolve(process.cwd(), 'public/cog-logo.png'),
                path.resolve(process.cwd(), 'apps/web/public/church-logo.png'),
                path.resolve(process.cwd(), 'apps/web/public/cog-logo.png'),
            ];
            const logoPath = possibleLogoPaths.find((p) => fs.existsSync(p));
            const attachments = logoPath
                ? [{
                    filename: 'church-logo.png',
                    content: fs.readFileSync(logoPath),
                    contentType: 'image/png',
                    cid: 'coglogo',
                    contentDisposition: 'inline',
                }]
                : undefined;

            const html = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
                    <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #f1f5f9;">
                        ${logoPath ? `
                        <div style="margin-bottom: 12px;">
                            <img src="cid:coglogo" alt="COG Logo" width="64" height="64" style="display: inline-block; border-radius: 50%; background-color: #ffffff; padding: 2px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);" />
                        </div>` : ''}
                        <h1 style="color: #0f172a; font-size: 22px; font-weight: 800; margin: 0 0 6px 0;">Password Reset Request</h1>
                        <p style="color: #64748b; font-size: 13px; margin: 0;">Church of God Dasmariñas • COG App</p>
                    </div>

                    <div style="padding: 24px 0; text-align: center;">
                        <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px 0; color: #1e293b;">
                            Hello <strong>${displayName}</strong>,
                        </p>
                        <p style="font-size: 15px; line-height: 1.6; margin: 0 auto 32px auto; color: #475569; max-width: 480px;">
                            We received a request to reset the password for your COG App account. Click the button below to choose a new password.
                        </p>

                        <div style="margin: 0 0 32px 0;">
                            <a href="${resetLink}" 
                               style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25); transition: background-color 0.2s;">
                                Reset Password
                            </a>
                        </div>

                        <p style="font-size: 13px; color: #64748b; margin: 0 auto 12px auto; max-width: 480px; line-height: 1.5;">
                            If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
                        </p>

                        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #f1f5f9;">
                            <p style="font-size: 14px; line-height: 1.5; color: #475569; margin: 0;">
                                Thank you,<br />
                                <strong>Church of God Dasmariñas</strong><br />
                                <span style="font-size: 12px; color: #94a3b8;">COG App Management</span>
                            </p>
                            <p style="font-size: 11px; color: #94a3b8; margin: 8px 0 0 0;">
                                Request Ref: #${reqRef} • ${timeStr}
                            </p>
                        </div>
                    </div>
                </div>
            `;

            const text = `
Password Reset Request

Hello ${displayName},

We received a request to reset the password for your COG App account.
Click the link below to set a new password:

${resetLink}

Reference: #${reqRef} • ${timeStr}
This link will expire for your security.
If you did not request a password reset, you can safely ignore this email.

Thank you,
Church of God Dasmariñas
COG App
            `.trim();

            await EmailService.sendEmail({
                to: email,
                subject,
                html,
                text,
                attachments,
            });

            console.log(`[NotificationService] Password reset email sent to ${email} via Gmail SMTP`);
            return { success: true };
        } catch (error) {
            console.error('Failed to send password reset email:', error);
            throw error;
        }
    }
}

