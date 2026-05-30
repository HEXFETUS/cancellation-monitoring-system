import { useEffect, useState } from "react";
import { AlertTriangle, Save, X } from "lucide-react";
import type { BillingCodeOption, RepairRecord } from "../services/repairRecords";
import { listBillingCodeOptions, updateRepairRecord } from "../services/repairRecords";
import type { DiagnosisItem } from "../services/diagnosisList";
import RepairConfirmationModal from "./RepairConfirmationModal";

const technicians = ["iFIX", "DIGIFIX", "SUMNI", "TANGENT", "BMC"];

interface EditModalProps {
    record: RepairRecord;
    diagnoses: DiagnosisItem[];
    onClose: () => void;
    onSave: (updatedRecord: RepairRecord) => void;
    showToast: (message: string, type: "error" | "success") => void;
}

export function EditModal({ record, diagnoses, onClose, onSave, showToast }: EditModalProps) {
    const [diagnosisId, setDiagnosisId] = useState<number | null>(record.diagnosis_id);
    const [ntc, setNtc] = useState<boolean>(record.ntc);
    const [withCharger, setWithCharger] = useState<boolean>(record.with_charger);
    const [withBox, setWithBox] = useState<boolean>(record.with_box);
    const [deliveredBy, setDeliveredBy] = useState<string>(record.delivered_by || "");
    const [saving, setSaving] = useState(false);
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConfirmSave = async () => {
        try {
            setSaving(true); setError(null);
            const updated = await updateRepairRecord(record.id, { diagnosis_id: diagnosisId, ntc, with_charger: withCharger, with_box: withBox, delivered_by: deliveredBy || null });
            onSave(updated); showToast("Repair record updated successfully!", "success");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to save changes";
            setError(message); showToast(message, "error");
        } finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm pt-16 px-4">
            <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-2xl bg-white shadow-2xl border border-warm overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-teal to-teal-dark" />
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div><h2 className="text-lg font-bold text-ink">Edit Repair Record</h2><p className="text-sm text-ink-muted mt-0.5">POS #: {record.device_no || record.id}</p></div>
                        <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors"><X className="h-5 w-5 text-gray-400" /></button>
                    </div>
                    <div className="space-y-4">
                        <div><label className="block text-sm font-semibold text-ink mb-1.5">Diagnosis <span className="text-rose-500">*</span></label>
                            <select value={diagnosisId ?? ""} onChange={(e) => setDiagnosisId(e.target.value ? Number(e.target.value) : null)} className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm">
                                <option value="">Select diagnosis...</option>{diagnoses.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div><label className="block text-sm font-semibold text-ink mb-1.5">NTC</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="ntc" checked={ntc === true} onChange={() => setNtc(true)} className="h-4 w-4 text-teal-600 focus:ring-teal-500" /><span className="text-sm text-gray-700">Yes</span></label>
                                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="ntc" checked={ntc === false} onChange={() => setNtc(false)} className="h-4 w-4 text-teal-600 focus:ring-teal-500" /><span className="text-sm text-gray-700">No</span></label>
                            </div>
                        </div>
                        <div><label className="block text-sm font-semibold text-ink mb-1.5">With Charger</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="withCharger" checked={withCharger === true} onChange={() => setWithCharger(true)} className="h-4 w-4 text-teal-600 focus:ring-teal-500" /><span className="text-sm text-gray-700">Yes</span></label>
                                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="withCharger" checked={withCharger === false} onChange={() => setWithCharger(false)} className="h-4 w-4 text-teal-600 focus:ring-teal-500" /><span className="text-sm text-gray-700">No</span></label>
                            </div>
                        </div>
                        <div><label className="block text-sm font-semibold text-ink mb-1.5">With Box</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="withBox" checked={withBox === true} onChange={() => setWithBox(true)} className="h-4 w-4 text-teal-600 focus:ring-teal-500" /><span className="text-sm text-gray-700">Yes</span></label>
                                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="withBox" checked={withBox === false} onChange={() => setWithBox(false)} className="h-4 w-4 text-teal-600 focus:ring-teal-500" /><span className="text-sm text-gray-700">No</span></label>
                            </div>
                        </div>
                        <div><label className="block text-sm font-semibold text-ink mb-1.5">Delivered By <span className="text-rose-500">*</span></label>
                            <input type="text" value={deliveredBy} onChange={(e) => setDeliveredBy(e.target.value)} placeholder="Enter name of deliverer..." className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm" />
                        </div>
                        {error && <p className="text-sm text-rose-500 flex items-center gap-1"><AlertTriangle size={14} />{error}</p>}
                    </div>
                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-warm/60">
                        <button onClick={onClose} className="rounded-xl border-2 border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98]">Cancel</button>
                        <button onClick={() => setShowSaveConfirm(true)} disabled={saving} className="rounded-xl bg-gradient-to-r from-teal to-teal-dark px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 hover:shadow-xl hover:shadow-teal/30 hover:from-teal-dark hover:to-teal transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100">
                            {saving ? <span className="inline-flex items-center gap-2"><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Saving...</span> : <span className="inline-flex items-center gap-2"><Save className="h-4 w-4" />Save Changes</span>}
                        </button>
                    </div>
                </div>
            </div>
            <RepairConfirmationModal open={showSaveConfirm} title="Save changes?" message={`This will update POS #${record.device_no || record.id}.`} confirmLabel="Save Changes" loading={saving} onCancel={() => setShowSaveConfirm(false)} onConfirm={handleConfirmSave} />
        </div>
    );
}

interface FinalDiagnosisModalProps {
    record: RepairRecord;
    diagnoses: DiagnosisItem[];
    loading: boolean;
    title?: string;
    proceedLabel?: string;
    onCancel: () => void;
    onProceed: (diagnosisId: number) => void;
}

export function FinalDiagnosisModal({ record, diagnoses, loading, title = "Final Diagnosis", proceedLabel = "Proceed", onCancel, onProceed }: FinalDiagnosisModalProps) {
    const [diagnosisId, setDiagnosisId] = useState<number | null>(record.diagnosis_id);
    const [showConfirm, setShowConfirm] = useState(false);
    const selectedDiagnosis = diagnoses.find((d) => d.id === record.diagnosis_id);
    const orderedDiagnoses = selectedDiagnosis ? [selectedDiagnosis, ...diagnoses.filter((d) => d.id !== selectedDiagnosis.id)] : diagnoses;

    const handleProceed = () => {
        if (!diagnosisId) return;
        onProceed(diagnosisId);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-warm bg-white shadow-2xl">
                <div className="h-2 bg-gradient-to-r from-teal to-teal-dark" />
                <div className="p-6">
                    <div className="mb-5 flex items-start justify-between gap-4">
                        <div><h2 className="text-lg font-bold text-ink">{title}</h2><p className="mt-0.5 text-sm text-ink-muted">POS #: {record.device_no || record.id}</p></div>
                        <button onClick={onCancel} disabled={loading} className="rounded-lg p-1.5 transition-colors hover:bg-gray-100 disabled:opacity-50"><X className="h-5 w-5 text-gray-400" /></button>
                    </div>
                    <label className="mb-1.5 block text-sm font-semibold text-ink">Diagnosis <span className="text-rose-500">*</span></label>
                    <select value={diagnosisId ?? ""} onChange={(e) => setDiagnosisId(e.target.value ? Number(e.target.value) : null)} disabled={loading} className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 disabled:cursor-not-allowed disabled:opacity-70">
                        <option value="">Select diagnosis...</option>
                        {orderedDiagnoses.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <div className="mt-6 flex justify-end gap-3 border-t border-warm/60 pt-4">
                        <button onClick={onCancel} disabled={loading} className="rounded-xl border-2 border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-600 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
                        <button onClick={() => setShowConfirm(true)} disabled={loading || !diagnosisId} className="rounded-xl bg-gradient-to-r from-teal to-teal-dark px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Proceeding..." : proceedLabel}</button>
                    </div>
                </div>
            </div>
            <RepairConfirmationModal open={showConfirm} title="Proceed with this diagnosis?" message={`This will save the selected diagnosis for POS #${record.device_no || record.id}.`} confirmLabel={proceedLabel} loading={loading} onCancel={() => setShowConfirm(false)} onConfirm={handleProceed} />
        </div>
    );
}

interface TechnicianModalProps {
    record: RepairRecord;
    loading: boolean;
    onCancel: () => void;
    onProceed: (technician: string) => void;
}

export function TechnicianModal({ record, loading, onCancel, onProceed }: TechnicianModalProps) {
    const [technician, setTechnician] = useState("");
    const [showConfirm, setShowConfirm] = useState(false);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-warm bg-white shadow-2xl">
                <div className="h-2 bg-gradient-to-r from-teal to-teal-dark" />
                <div className="p-6">
                    <div className="mb-5 flex items-start justify-between gap-4">
                        <div><h2 className="text-lg font-bold text-ink">Select Technician</h2><p className="mt-0.5 text-sm text-ink-muted">POS #: {record.device_no || record.id}</p></div>
                        <button onClick={onCancel} disabled={loading} className="rounded-lg p-1.5 transition-colors hover:bg-gray-100 disabled:opacity-50"><X className="h-5 w-5 text-gray-400" /></button>
                    </div>
                    <label className="mb-1.5 block text-sm font-semibold text-ink">Technician <span className="text-rose-500">*</span></label>
                    <select value={technician} onChange={(e) => setTechnician(e.target.value)} disabled={loading} className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 disabled:cursor-not-allowed disabled:opacity-70">
                        <option value="">Select a technician</option>
                        {technicians.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <div className="mt-6 flex justify-end gap-3 border-t border-warm/60 pt-4">
                        <button onClick={onCancel} disabled={loading} className="rounded-xl border-2 border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-600 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
                        <button onClick={() => setShowConfirm(true)} disabled={loading || !technician} className="rounded-xl bg-gradient-to-r from-teal to-teal-dark px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Proceeding..." : "Proceed"}</button>
                    </div>
                </div>
            </div>
            <RepairConfirmationModal open={showConfirm} title="Proceed with this technician?" message={`This will assign ${technician || "the selected technician"} to POS #${record.device_no || record.id}.`} confirmLabel="Proceed" loading={loading} onCancel={() => setShowConfirm(false)} onConfirm={() => onProceed(technician)} />
        </div>
    );
}

interface ReceivedModalProps {
    record: RepairRecord;
    loading: boolean;
    onCancel: () => void;
    onProceed: (payload: { billingCode: string; remarks: string; unrepairableRetired: boolean }) => void;
}

export function ReceivedModal({ record, loading, onCancel, onProceed }: ReceivedModalProps) {
    const [billingCode, setBillingCode] = useState("");
    const [billingCodeOptions, setBillingCodeOptions] = useState<BillingCodeOption[]>([]);
    const [remarks, setRemarks] = useState("");
    const [unrepairableRetired, setUnrepairableRetired] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const remarksValid = remarks.trim().length > 0;

    useEffect(() => {
        let ignore = false;

        async function loadBillingCodes() {
            try {
                const options = await listBillingCodeOptions(record.operator_id);
                if (!ignore) setBillingCodeOptions(options);
            } catch {
                if (!ignore) setBillingCodeOptions([]);
            }
        }

        loadBillingCodes();

        return () => {
            ignore = true;
        };
    }, [record.operator_id]);

    const handleProceed = () => {
        if (!remarksValid) return;
        onProceed({ billingCode, remarks, unrepairableRetired });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-warm bg-white shadow-2xl">
                <div className="h-2 bg-gradient-to-r from-teal to-teal-dark" />
                <div className="p-6">
                    <div className="mb-5 flex items-start justify-between gap-4">
                        <div><h2 className="text-lg font-bold text-ink">Receive Repair</h2><p className="mt-0.5 text-sm text-ink-muted">POS #: {record.device_no || record.id}</p></div>
                        <button onClick={onCancel} disabled={loading} className="rounded-lg p-1.5 transition-colors hover:bg-gray-100 disabled:opacity-50"><X className="h-5 w-5 text-gray-400" /></button>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-ink">Billing Code</label>
                            <input value={billingCode} onChange={(e) => setBillingCode(e.target.value)} disabled={loading} list={`billing-code-options-${record.id}`} className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 disabled:cursor-not-allowed disabled:opacity-70" placeholder="Enter or select billing code" />
                            <datalist id={`billing-code-options-${record.id}`}>
                                {billingCodeOptions.map((option) => (
                                    <option key={`${option.billing_code}-${option.operator_id ?? "none"}`} value={option.billing_code}>
                                        {option.operator_name || "Unknown operator"} - {option.pos_count} POS
                                    </option>
                                ))}
                            </datalist>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-ink">Remarks <span className="text-rose-500">*</span></label>
                            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} disabled={loading} rows={4} className="w-full resize-none rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 disabled:cursor-not-allowed disabled:opacity-70" placeholder="Enter remarks" />
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
                            <input type="checkbox" checked={unrepairableRetired} onChange={(e) => setUnrepairableRetired(e.target.checked)} disabled={loading} className="h-4 w-4 rounded accent-[#92C7CF]" />
                            Unrepairable (Retired)
                        </label>
                    </div>
                    <div className="mt-6 flex justify-end gap-3 border-t border-warm/60 pt-4">
                        <button onClick={onCancel} disabled={loading} className="rounded-xl border-2 border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-600 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
                        <button onClick={() => setShowConfirm(true)} disabled={loading || !remarksValid} className="rounded-xl bg-gradient-to-r from-teal to-teal-dark px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Proceeding..." : "Proceed"}</button>
                    </div>
                </div>
            </div>
            <RepairConfirmationModal open={showConfirm} title="Receive repair record?" message={`This will move POS #${record.device_no || record.id} to For Release.`} confirmLabel="Proceed" loading={loading} onCancel={() => setShowConfirm(false)} onConfirm={handleProceed} />
        </div>
    );
}

interface ReleaseModalProps {
    record: RepairRecord;
    loading: boolean;
    onCancel: () => void;
    onProceed: (receivedBy: string) => void;
}

export function ReleaseModal({ record, loading, onCancel, onProceed }: ReleaseModalProps) {
    const [receivedBy, setReceivedBy] = useState("");
    const [showConfirm, setShowConfirm] = useState(false);
    const canProceed = receivedBy.trim().length > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-warm bg-white shadow-2xl">
                <div className="h-2 bg-gradient-to-r from-teal to-teal-dark" />
                <div className="p-6">
                    <div className="mb-5 flex items-start justify-between gap-4">
                        <div><h2 className="text-lg font-bold text-ink">Release POS</h2><p className="mt-0.5 text-sm text-ink-muted">Confirm release details</p></div>
                        <button onClick={onCancel} disabled={loading} className="rounded-lg p-1.5 transition-colors hover:bg-gray-100 disabled:opacity-50"><X className="h-5 w-5 text-gray-400" /></button>
                    </div>
                    <div className="mb-4 rounded-xl border border-warm bg-card/60 p-4 text-sm text-ink">
                        <div className="flex justify-between gap-4"><span className="font-semibold">Device No</span><span>{record.device_no || "-"}</span></div>
                        <div className="mt-2 flex justify-between gap-4"><span className="font-semibold">Serial No</span><span>{record.serial_number || "-"}</span></div>
                    </div>
                    <label className="mb-1.5 block text-sm font-semibold text-ink">Received By <span className="text-rose-500">*</span></label>
                    <input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} disabled={loading} className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 disabled:cursor-not-allowed disabled:opacity-70" placeholder="Enter receiver name" />
                    <div className="mt-6 flex justify-end gap-3 border-t border-warm/60 pt-4">
                        <button onClick={onCancel} disabled={loading} className="rounded-xl border-2 border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-600 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
                        <button onClick={() => setShowConfirm(true)} disabled={loading || !canProceed} className="rounded-xl bg-gradient-to-r from-teal to-teal-dark px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Releasing..." : "Proceed"}</button>
                    </div>
                </div>
            </div>
            <RepairConfirmationModal open={showConfirm} title="Release this POS?" message={`This will mark POS #${record.device_no || record.id} as Released.`} confirmLabel="Release" loading={loading} onCancel={() => setShowConfirm(false)} onConfirm={() => onProceed(receivedBy)} />
        </div>
    );
}
