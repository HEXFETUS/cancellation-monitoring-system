import { useMemo, useState } from "react";
import { Check, List, X } from "lucide-react";
import type { RepairRecord } from "../services/repairRecords";
import type { DiagnosisItem } from "../services/diagnosisList";

const technicians = ["iFIX", "DIGIFIX", "SUMNI", "TANGENT", "BMC"];

function ModalShell({
    title,
    icon,
    children,
    onCancel,
}: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    onCancel: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
            <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-warm bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-warm px-6 py-5">
                    <div className="flex items-center gap-3">
                        {icon}
                        <h2 className="text-lg font-bold text-ink">{title}</h2>
                    </div>
                    <button onClick={onCancel} className="rounded-lg p-1.5 transition-colors hover:bg-gray-100">
                        <X className="h-5 w-5 text-gray-600" />
                    </button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
}

function Footer({ disabled, onCancel, onProceed }: { disabled: boolean; onCancel: () => void; onProceed: () => void }) {
    return (
        <div className="mt-6 flex justify-end gap-3">
            <button onClick={onCancel} className="rounded-xl border border-warm bg-white px-6 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:bg-surface">
                Cancel
            </button>
            <button onClick={onProceed} disabled={disabled} className="rounded-xl bg-teal px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-dark disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500">
                Proceed
            </button>
        </div>
    );
}

export function BatchForRepairModal({
    records,
    diagnoses,
    onCancel,
    onProceed,
}: {
    records: RepairRecord[];
    diagnoses: DiagnosisItem[];
    onCancel: () => void;
    onProceed: (items: Array<{ record: RepairRecord; diagnosisId: number }>) => void;
}) {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set(records.map((r) => r.id)));
    const [diagnosisById, setDiagnosisById] = useState<Record<number, number | "">>(() =>
        Object.fromEntries(records.map((r) => [r.id, r.diagnosis_id ?? ""]))
    );
    const selectedItems = records.filter((r) => selectedIds.has(r.id));
    const canProceed = selectedItems.length > 0 && selectedItems.every((r) => diagnosisById[r.id]);

    return (
        <ModalShell title="For Repair" icon={<List className="h-5 w-5 text-green-600" />} onCancel={onCancel}>
            <div className="overflow-hidden rounded-xl border border-warm">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-warm bg-cream text-xs font-semibold uppercase tracking-wider text-ink-muted">
                            <th className="w-16 px-4 py-3 text-center"><input type="checkbox" checked={selectedIds.size === records.length && records.length > 0} onChange={(e) => setSelectedIds(e.target.checked ? new Set(records.map((r) => r.id)) : new Set())} /></th>
                            <th className="px-4 py-3">POS</th>
                            <th className="px-4 py-3">Serial</th>
                            <th className="px-4 py-3">Diagnosis</th>
                        </tr>
                    </thead>
                    <tbody>
                        {records.map((record) => (
                            <tr key={record.id} className="border-b border-warm/60 last:border-b-0">
                                <td className="px-4 py-2 text-center"><input type="checkbox" checked={selectedIds.has(record.id)} onChange={(e) => setSelectedIds((prev) => { const next = new Set(prev); if (e.target.checked) next.add(record.id); else next.delete(record.id); return next; })} /></td>
                                <td className="px-4 py-2 text-center font-medium text-ink">{record.device_no || "-"}</td>
                                <td className="px-4 py-2 text-center text-ink-muted">{record.serial_number || "-"}</td>
                                <td className="px-4 py-2">
                                    <select value={diagnosisById[record.id] ?? ""} onChange={(e) => setDiagnosisById((prev) => ({ ...prev, [record.id]: e.target.value ? Number(e.target.value) : "" }))} className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm">
                                        <option value="">Select diagnosis</option>
                                        {diagnoses.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Footer disabled={!canProceed} onCancel={onCancel} onProceed={() => onProceed(selectedItems.map((record) => ({ record, diagnosisId: Number(diagnosisById[record.id]) })))} />
        </ModalShell>
    );
}

export function BatchCheckedPosModal({
    records,
    onCancel,
    onProceed,
}: {
    records: RepairRecord[];
    onCancel: () => void;
    onProceed: (technician: string, records: RepairRecord[]) => void;
}) {
    const [technician, setTechnician] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set(records.map((r) => r.id)));
    const selectedRecords = records.filter((r) => selectedIds.has(r.id));

    return (
        <ModalShell title="Checked POS" icon={<Check className="h-5 w-5 text-blue-600" />} onCancel={onCancel}>
            <div className="mb-6 flex items-center gap-3">
                <label className="text-sm font-semibold text-ink">Repaired By <span className="text-rose-500">*</span></label>
                <select value={technician} onChange={(e) => setTechnician(e.target.value)} className="rounded-lg border border-warm bg-card px-3 py-2 text-sm">
                    <option value="">Select</option>
                    {technicians.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
            </div>
            <div className="overflow-hidden rounded-xl border border-warm">
                <table className="w-full text-sm">
                    <thead><tr className="border-b border-warm bg-cream text-xs font-semibold uppercase tracking-wider text-ink-muted"><th className="w-16 px-4 py-3 text-center"><input type="checkbox" checked={selectedIds.size === records.length && records.length > 0} onChange={(e) => setSelectedIds(e.target.checked ? new Set(records.map((r) => r.id)) : new Set())} /></th><th className="px-4 py-3">POS</th><th className="px-4 py-3">Serial</th><th className="px-4 py-3">Diagnosis</th></tr></thead>
                    <tbody>{records.map((record) => <tr key={record.id} className="border-b border-warm/60 last:border-b-0"><td className="px-4 py-2 text-center"><input type="checkbox" checked={selectedIds.has(record.id)} onChange={(e) => setSelectedIds((prev) => { const next = new Set(prev); if (e.target.checked) next.add(record.id); else next.delete(record.id); return next; })} /></td><td className="px-4 py-2 text-center font-medium">{record.device_no || "-"}</td><td className="px-4 py-2 text-center text-ink-muted">{record.serial_number || "-"}</td><td className="px-4 py-2 text-center">{record.diagnosis_name || "-"}</td></tr>)}</tbody>
                </table>
            </div>
            <Footer disabled={!technician || selectedRecords.length === 0} onCancel={onCancel} onProceed={() => onProceed(technician, selectedRecords)} />
        </ModalShell>
    );
}

export function BatchReceivedPosModal({
    records,
    onCancel,
    onProceed,
}: {
    records: RepairRecord[];
    onCancel: () => void;
    onProceed: (payload: { billingCode: string; items: Array<{ record: RepairRecord; remarks: string; unrepairableRetired: boolean }> }) => void;
}) {
    const operators = useMemo(() => Array.from(new Set(records.map((r) => r.operator_name).filter(Boolean))), [records]);
    const [operator, setOperator] = useState("");
    const [billingCode, setBillingCode] = useState("");
    const visibleRecords = operator ? records.filter((r) => r.operator_name === operator) : records;
    const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set(records.map((r) => r.id)));
    const [remarksById, setRemarksById] = useState<Record<number, string>>({});
    const [retiredById, setRetiredById] = useState<Record<number, boolean>>({});
    const selectedRecords = visibleRecords.filter((r) => selectedIds.has(r.id));
    const selectedOperators = Array.from(new Set(selectedRecords.map((r) => r.operator_name || "")));
    const hasDifferentOperators = selectedOperators.length > 1;
    const canProceed = selectedRecords.length > 0 && !hasDifferentOperators && selectedRecords.every((r) => (remarksById[r.id] || "").trim());

    return (
        <ModalShell title="Received POS" icon={<List className="h-5 w-5 text-amber-600" />} onCancel={onCancel}>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3"><label className="text-sm font-semibold text-ink">Filter by Operator:</label><select value={operator} onChange={(e) => setOperator(e.target.value)} className="rounded-lg border border-warm bg-card px-3 py-2 text-sm"><option value="">All</option>{operators.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                <div className="flex items-center gap-3"><label className="text-sm font-semibold text-ink">Billing Code:</label><input value={billingCode} onChange={(e) => setBillingCode(e.target.value)} placeholder="Enter billing code" className="rounded-lg border border-warm bg-card px-3 py-2 text-sm" /></div>
            </div>
            <div className="overflow-hidden rounded-xl border border-warm">
                <table className="w-full text-sm">
                    <thead><tr className="border-b border-warm bg-cream text-xs font-semibold uppercase tracking-wider text-ink-muted"><th className="w-16 px-4 py-3 text-center"><input type="checkbox" checked={selectedRecords.length === visibleRecords.length && visibleRecords.length > 0} onChange={(e) => setSelectedIds(e.target.checked ? new Set(visibleRecords.map((r) => r.id)) : new Set())} /></th><th className="px-4 py-3">POS</th><th className="px-4 py-3">Serial</th><th className="px-4 py-3">Operator</th><th className="px-4 py-3">Remarks</th><th className="px-4 py-3 text-center">Unrepairable</th></tr></thead>
                    <tbody>{visibleRecords.map((record) => <tr key={record.id} className="border-b border-warm/60 last:border-b-0"><td className="px-4 py-2 text-center"><input type="checkbox" checked={selectedIds.has(record.id)} onChange={(e) => setSelectedIds((prev) => { const next = new Set(prev); if (e.target.checked) next.add(record.id); else next.delete(record.id); return next; })} /></td><td className="px-4 py-2 text-center font-medium">{record.device_no || "-"}</td><td className="px-4 py-2 text-center text-ink-muted">{record.serial_number || "-"}</td><td className="px-4 py-2 text-center">{record.operator_name || "-"}</td><td className="px-4 py-2"><input value={remarksById[record.id] || ""} onChange={(e) => setRemarksById((prev) => ({ ...prev, [record.id]: e.target.value }))} placeholder="Enter remarks" className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm" /></td><td className="px-4 py-2 text-center"><input type="checkbox" checked={retiredById[record.id] || false} onChange={(e) => setRetiredById((prev) => ({ ...prev, [record.id]: e.target.checked }))} /></td></tr>)}</tbody>
                </table>
            </div>
            {hasDifferentOperators && (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    Do not process POS from different operators in one batch. Select POS with the same operator only.
                </div>
            )}
            <Footer disabled={!canProceed} onCancel={onCancel} onProceed={() => onProceed({ billingCode, items: selectedRecords.map((record) => ({ record, remarks: remarksById[record.id] || "", unrepairableRetired: retiredById[record.id] || false })) })} />
        </ModalShell>
    );
}
