import { format } from "date-fns";
import { getServiceSchedule, getWorshipSlots } from "@/actions/schedule";
import { getMinistries } from "@/actions/db";
import { notFound } from "next/navigation";

export default async function PrintSchedulePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const [schedule, ministries, worshipSlots] = await Promise.all([
        getServiceSchedule(id),
        getMinistries(),
        getWorshipSlots(id),
    ]);

    if (!schedule) notFound();

    const getMinistryName = (mid: string) => {
        const name = (ministries as any[]).find((m: any) => m.id === mid)?.name || mid;
        return name.replace(/^[A-Z]-/i, '');
    };

    const byMinistry: Record<string, typeof schedule.assignments> = {};
    for (const a of schedule.assignments) {
        if (!byMinistry[a.ministryId]) byMinistry[a.ministryId] = [];
        byMinistry[a.ministryId].push(a);
    }
    const sortedMinistryIds = Object.keys(byMinistry).sort((a, b) =>
        getMinistryName(a).localeCompare(getMinistryName(b))
    );

    const groupByRole = (assignments: typeof schedule.assignments) =>
        assignments.reduce<Record<string, typeof assignments>>((acc, a) => {
            if (!acc[a.roleName]) acc[a.roleName] = [];
            acc[a.roleName].push(a);
            return acc;
        }, {});

    const filled = schedule.assignments.filter(a => a.workerId).length;
    const total = schedule.assignments.length;

    const css = `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; padding: 32px; max-width: 820px; margin: 0 auto; background: #fff; }
        h1 { font-size: 24px; font-weight: 800; margin-bottom: 6px; color: #0f172a; letter-spacing: -0.02em; }
        .meta { font-size: 13px; color: #475569; margin-bottom: 4px; font-weight: 500; }
        .status-badge { display: inline-block; font-size: 11px; font-weight: 700;
            padding: 3px 10px; border-radius: 6px; background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; margin-top: 6px; margin-bottom: 24px; }
        .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase;
            letter-spacing: 0.08em; color: #0f172a; margin: 24px 0 12px;
            border-bottom: 2px solid #0f172a; padding-bottom: 4px; }
        .ministry { margin-bottom: 20px; break-inside: avoid; }
        .ministry-name { font-size: 13px; font-weight: 800; text-transform: uppercase;
            letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px; color: #1e3a8a; }
        .role-name { font-size: 11px; font-weight: 700; color: #64748b; margin: 8px 0 3px;
            text-transform: uppercase; letter-spacing: 0.04em; }
        .slot { display: flex; align-items: center; gap: 8px; padding: 5px 0;
            border-bottom: 1px dotted #e2e8f0; font-size: 13px; }
        .slot-name { flex: 1; font-weight: 600; color: #1e293b; }
        .slot-empty { color: #94a3b8; font-style: italic; }
        .confirmed { font-size: 11px; color: #16a34a; font-weight: 700; }
        .not-attending { font-size: 11px; color: #dc2626; font-weight: 700; }
        .pending { font-size: 11px; color: #d97706; font-weight: 700; }
        .slot-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; break-inside: avoid; background: #f8fafc; }
        .slot-card-title { font-size: 13px; font-weight: 800; margin-bottom: 8px; color: #0f172a; text-transform: uppercase; }
        .print-btn { margin-bottom: 24px; padding: 10px 22px; cursor: pointer;
            background: #0f172a; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 700; }
        @media print {
            @page { size: portrait; margin: 12mm; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { padding: 0; }
            .print-btn { display: none !important; }
            .slot-card { background: transparent !important; }
        }
    `;

    return (
        <html lang="en">
            <head>
                <title>{schedule.title} — {format(new Date(schedule.date), "MMMM d, yyyy")}</title>
                <meta charSet="utf-8" />
                <style dangerouslySetInnerHTML={{ __html: css }} />
            </head>
            <body>
                <button id="printBtn" className="print-btn">
                    🖨 Print / Save as PDF
                </button>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `document.getElementById('printBtn')?.addEventListener('click', () => window.print());`,
                    }}
                />

                <h1>{schedule.title}</h1>
                <div className="meta">{format(new Date(schedule.date), "EEEE, MMMM d, yyyy")}</div>
                <div className="meta">{filled}/{total} slots filled</div>
                <div className="status-badge">{schedule.status}</div>

                {/* Ministry Assignments */}
                <div className="section-title">Ministry Assignments</div>

                {sortedMinistryIds.length === 0 && (
                    <p style={{ fontSize: 13, color: '#888', fontStyle: 'italic' }}>No assignments yet.</p>
                )}

                {sortedMinistryIds.map(ministryId => {
                    const assignments = byMinistry[ministryId];
                    const byRole = groupByRole(assignments);
                    return (
                        <div key={ministryId} className="ministry">
                            <div className="ministry-name">{getMinistryName(ministryId)}</div>
                            {Object.entries(byRole).map(([roleName, slots]) => (
                                <div key={roleName}>
                                    <div className="role-name">{roleName}</div>
                                    {slots.map(slot => (
                                        <div key={slot.id} className="slot">
                                            {slot.workerName ? (
                                                <>
                                                    <span className="slot-name">{slot.workerName}</span>
                                                    {(slot as any).attendanceStatus === 'Confirmed' && <span className="confirmed">✓ Confirmed</span>}
                                                    {(slot as any).attendanceStatus === 'Not Attending' && <span className="not-attending">✗ Not Attending</span>}
                                                    {(slot as any).attendanceStatus === 'Pending' && <span className="pending">⏳ Pending</span>}
                                                </>
                                            ) : (
                                                <span className="slot-empty">— Unassigned —</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    );
                })}

                {/* Worship / Service Slots */}
                {worshipSlots.length > 0 && (
                    <>
                        <div className="section-title">Service Slots</div>
                        {worshipSlots.map((slot: any) => {
                            const bySlotRole: Record<string, any[]> = {};
                            for (const sw of slot.workers) {
                                const key = sw.role || '(No Role)';
                                if (!bySlotRole[key]) bySlotRole[key] = [];
                                bySlotRole[key].push(sw);
                            }
                            return (
                                <div key={slot.id} className="slot-card">
                                    <div className="slot-card-title">{slot.slotName}</div>
                                    {Object.entries(bySlotRole).map(([roleName, workers]) => (
                                        <div key={roleName}>
                                            <div className="role-name">{roleName}</div>
                                            {(workers as any[]).map((sw: any) => (
                                                <div key={sw.id} className="slot">
                                                    <span className="slot-name">{sw.workerName}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                    {slot.workers.length === 0 && (
                                        <span className="slot-empty">No workers assigned</span>
                                    )}
                                </div>
                            );
                        })}
                    </>
                )}

                {schedule.notes && (
                    <div style={{ marginTop: 24, fontSize: 12, color: '#555', borderTop: '1px solid #ccc', paddingTop: 12 }}>
                        <strong>Notes:</strong> {schedule.notes}
                    </div>
                )}
            </body>
        </html>
    );
}
