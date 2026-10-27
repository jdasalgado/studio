import { Resend } from 'resend';
import nodemailer from 'nodemailer';

/**
 * Generic Email Service for sending notifications.
 * Supports Gmail SMTP (Nodemailer) and Resend SDK.
 */
export class EmailService {
    private static _resend: Resend | null = null;
    private static _transporter: any = null;
    private static FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    private static get smtpUser() {
        return process.env.SMTP_USER || process.env.GMAIL_USER;
    }

    private static get smtpPass() {
        return process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
    }

    private static get smtpFrom() {
        return process.env.SMTP_FROM || `"Church of God Dasmariñas" <${this.smtpUser}>`;
    }

    private static get transporter() {
        if (!this._transporter && this.smtpUser && this.smtpPass) {
            try {
                this._transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: this.smtpUser,
                        pass: this.smtpPass.replace(/\s+/g, ''),
                    },
                    connectionTimeout: 10000,
                    greetingTimeout: 10000,
                    socketTimeout: 15000,
                });
            } catch (err) {
                console.warn('[EmailService] Failed to create nodemailer transporter:', err);
            }
        }
        return this._transporter;
    }

    private static get resend() {
        if (!this._resend && process.env.RESEND_API_KEY) {
            this._resend = new Resend(process.env.RESEND_API_KEY);
        }
        return this._resend;
    }

    /**
     * Sends an email using Gmail SMTP (if configured) or Resend SDK.
     * Features automatic fallback between providers so deployment email delivery is reliable.
     */
    static async sendEmail({
        to,
        subject,
        html,
        text,
        attachments,
    }: {
        to: string | string[];
        subject: string;
        html: string;
        text?: string;
        attachments?: any[];
    }) {
        const recipients = Array.isArray(to) ? to.join(', ') : to;
        const recipientList = (Array.isArray(to) ? to : [to]).map(e => e.trim()).filter(Boolean);
        let lastError: any = null;

        // 1. Prioritize Gmail SMTP / Nodemailer if configured
        if (this.smtpUser && this.smtpPass) {
            try {
                const transporter = this.transporter;
                if (!transporter) {
                    throw new Error('SMTP transporter failed to initialize.');
                }

                const mailOptions: any = {
                    from: this.smtpFrom,
                    to: recipients,
                    subject,
                    html: html || text,
                    text: text,
                };
                if (attachments && attachments.length > 0) {
                    mailOptions.attachments = attachments;
                }

                const info = await transporter.sendMail(mailOptions);

                console.log(`[EmailService] Sent via Gmail SMTP to ${recipients}:`, info.messageId);
                return { success: true, messageId: info.messageId, provider: 'smtp' };
            } catch (error: any) {
                console.error('[EmailService] SMTP send error (attempting fallback if available):', error?.message || error);
                lastError = error;
            }
        }

        // 2. Otherwise use Resend if RESEND_API_KEY is configured (or fallback from failed SMTP)
        if (process.env.RESEND_API_KEY) {
            try {
                const resend = this.resend;
                if (!resend) {
                    throw new Error('Resend SDK failed to initialize even with API key.');
                }

                const resendPayload: any = {
                    from: this.FROM_EMAIL,
                    to: recipientList,
                    subject,
                    html: html || (text as string),
                    text: text,
                };

                if (attachments && attachments.length > 0) {
                    resendPayload.attachments = attachments.map((att: any) => ({
                        filename: att.filename,
                        content: att.content,
                    }));
                }

                const { data, error } = await resend.emails.send(resendPayload);

                if (error) {
                    throw new Error(`Resend SDK error: ${JSON.stringify(error)}`);
                }

                console.log(`[EmailService] Sent via Resend to ${recipients}:`, data?.id);
                return { ...data, provider: 'resend' };
            } catch (error: any) {
                console.error('[EmailService] Resend send error:', error?.message || error);
                lastError = error;
            }
        }

        if (lastError) {
            throw lastError;
        }

        // 3. Fallback: Mock log
        console.warn('Neither SMTP nor RESEND_API_KEY is configured. Email skipped.');
        console.log('--- Mock Email ---');
        console.log('To:', to);
        console.log('Subject:', subject);
        console.log('Body:', text || 'HTML Content');
        console.log('------------------');
        return { success: true, mock: true };
    }
}

