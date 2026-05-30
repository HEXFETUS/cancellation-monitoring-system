import { useState, useEffect } from "react";
import {
    Wrench,
    ClipboardList,
    AlertTriangle,
    CheckCircle2,
    ArrowUpRight,
    Edit,
    Trash2,
    RefreshCw,
    X,
    Save,
    AlertCircle,
    CheckCircle,
    RotateCcw,
    CalendarDays,
    CreditCard,
    UserRound,
    Minus,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { listRepairRecords, updateRepairRecord, clearRepairRecord, proceedRepairRecord, releaseRepairRecord, moveRepairRecordToForReleased } from "../services/repairRecords";
import type { RepairRecord } from "../services/repairRecords";
import { listDiagnoses, type DiagnosisItem } from "../services/diagnosisList";
import RepairConfirmationModal from "../components/RepairConfirmationModal";

const teal = "#92C7CF";

const statusTabs = [
    { id: "for-checking", label: "For Checking", icon: ClipboardList },
    { id: "for-repair", label: "For Repair", icon: Wrench },
    { id: "undergoing-repair", label: "Undergoing Repair", icon: AlertTriangle },
    { id: "for-release", label: "For Release", icon: CheckCircle2 },
    { id: "released", label: "Released", icon: ArrowUpRight },
];

const tabStatusMap: Record<string, string> = {
    "for-checking": "For Repair",
    "for-repair": "Pending",
    "undergoing-repair": "Undergoing Repair",
    "for-release": "For Released",
    "released": "Released",
};

const noActionTabs: string[] = [];

function filterRecordsByTab(records: RepairRecord[], tabId: string): RepairRecord[] {
    const status = tabStatusMap[tabId];
    if (!status) return [];
    return records.filter((r) => r.forwarded === true && r.status === status);
}

function formatDate(dateStr: string): string {
    if (!dateStr) return "-";
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
    } catch { return dateStr; }
}

function formatYesNo(value: boolean): string { return value ? "Yes" : "No"; }

function formatDateNumeric(dateStr: string): string {
    if (!dateStr) return "-";
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
    } catch { return dateStr; }
}

interface EditModalProps {
    record: RepairRecord;
    diagnoses: DiagnosisItem[];
    onClose: () => void;
    onSave: (updatedRecord: RepairRecord) => void;
    showToast: (message: string, type: "error" | "success") => void;
}

function EditModal({ record, diagnoses, onClose, onSave, showToast }: EditModalProps) {
    const [diagnosisId, setDiagnosisId] = useState<number | null>(record.diagnosis_id);
    const [ntc, setNtc] = useState<boolean>(record.ntc);
    const [withCharger, setWithCharger] = useState<boolean>(record.with_charger);
    const [withBox, setWithBox] = useState<boolean>(record.with_box);
    const [deliveredBy, setDeliveredBy] = useState<string>(record.delivered_by || "");
    const [saving, setSaving] = useState(false);
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSave = () => setShowSaveConfirm(true);

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
                        <button onClick={handleSave} disabled={saving} className="rounded-xl bg-gradient-to-r from-teal to-teal-dark px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 hover:shadow-xl hover:shadow-teal/30 hover:from-teal-dark hover:to-teal transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100">
                            {saving ? <span className="inline-flex items-center gap-2"><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Saving...</span> : <span className="inline-flex items-center gap-2"><Save className="h-4 w-4" />Save Changes</span>}
                        </button>
                    </div>
                </div>
            </div>
            <RepairConfirmationModal open={showSaveConfirm} title="Save changes?" message={`This will update POS #${record.device_no || record.id}.`} confirmLabel="Save Changes" loading={saving} onCancel={() => setShowSaveConfirm(false)} onConfirm={handleConfirmSave} />
        </div>
    );
}

interface ForReleasedModalProps {
    record: RepairRecord;
    diagnoses: DiagnosisItem[];
    loading: boolean;
    title?: string;
    proceedLabel?: string;
    onCancel: () => void;
    onProceed: (diagnosisId: number) => void;
}

function ForReleasedModal({ record, diagnoses, loading, title = "Final Diagnosis", proceedLabel = "Proceed", onCancel, onProceed }: ForReleasedModalProps) {
    const [diagnosisId, setDiagnosisId] = useState<number | null>(record.diagnosis_id);
    const selectedDiagnosis = diagnoses.find((d) => d.id === record.diagnosis_id);
    const orderedDiagnoses = selectedDiagnosis
        ? [selectedDiagnosis, ...diagnoses.filter((d) => d.id !== selectedDiagnosis.id)]
        : diagnoses;

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
                        <div>
                            <h2 className="text-lg font-bold text-ink">{title}</h2>
                            <p className="mt-0.5 text-sm text-ink-muted">POS #: {record.device_no || record.id}</p>
                        </div>
                        <button onClick={onCancel} disabled={loading} className="rounded-lg p-1.5 transition-colors hover:bg-gray-100 disabled:opacity-50">
                            <X className="h-5 w-5 text-gray-400" />
                        </button>
                    </div>

                    <label className="mb-1.5 block text-sm font-semibold text-ink">
                        Diagnosis <span className="text-rose-500">*</span>
                    </label>
                    <select
                        value={diagnosisId ?? ""}
                        onChange={(e) => setDiagnosisId(e.target.value ? Number(e.target.value) : null)}
                        disabled={loading}
                        className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        <option value="">Select diagnosis...</option>
                        {orderedDiagnoses.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>

                    <div className="mt-6 flex justify-end gap-3 border-t border-warm/60 pt-4">
                        <button onClick={onCancel} disabled={loading} className="rounded-xl border-2 border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-600 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50">
                            Cancel
                        </button>
                        <button onClick={handleProceed} disabled={loading || !diagnosisId} className="rounded-xl bg-gradient-to-r from-teal to-teal-dark px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50">
                            {loading ? "Proceeding..." : proceedLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function RepairManagementPage() {
    const { user } = useAuth();
    const [activeStatusTab, setActiveStatusTab] = useState("for-checking");
    const [records, setRecords] = useState<RepairRecord[]>([]);
    const [filteredRecords, setFilteredRecords] = useState<RepairRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [diagnoses, setDiagnoses] = useState<DiagnosisItem[]>([]);
    const [editingRecord, setEditingRecord] = useState<RepairRecord | null>(null);
    const [recordToDelete, setRecordToDelete] = useState<RepairRecord | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [proceeding, setProceeding] = useState(false);
    const [recordToForRepair, setRecordToForRepair] = useState<RepairRecord | null>(null);
    const [recordToForReleased, setRecordToForReleased] = useState<RepairRecord | null>(null);
    const [forwardingRelease, setForwardingRelease] = useState(false);
    const [recordToRelease, setRecordToRelease] = useState<RepairRecord | null>(null);
    const [releasing, setReleasing] = useState(false);
    const [toast, setToast] = useState<{ show: boolean; message: string; type: "error" | "success" }>({ show: false, message: "", type: "error" });

    const showToast = (message: string, type: "error" | "success" = "error") => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: "", type: "error" }), 4000);
    };
    const hideToast = () => setToast({ show: false, message: "", type: "error" });

    const showActions = !noActionTabs.includes(activeStatusTab);
    const isForChecking = activeStatusTab === "for-checking";
    const isForRepair = activeStatusTab === "for-repair";
    const isUndergoingRepair = activeStatusTab === "undergoing-repair";
    const isForRelease = activeStatusTab === "for-release";
    const isReleased = activeStatusTab === "released";
    const showAccessories = false;
    const showRepairedBy = activeStatusTab === "undergoing-repair" || activeStatusTab === "for-release" || activeStatusTab === "released";
    const showRemarks = activeStatusTab === "for-release" || activeStatusTab === "released";
    const showBillingInfo = activeStatusTab === "released";

    const fetchRecords = async () => {
        try { setLoading(true); setError(null); const data = await listRepairRecords(); setRecords(data); }
        catch (err) { console.error("Failed to fetch repair records:", err); setError(err instanceof Error ? err.message : "Failed to load repair records"); }
        finally { setLoading(false); }
    };

    const fetchDiagnoses = async () => { try { const data = await listDiagnoses(); setDiagnoses(data); } catch (err) { console.error("Failed to fetch diagnoses:", err); } };

    useEffect(() => { fetchRecords(); fetchDiagnoses(); }, []);
    useEffect(() => { setFilteredRecords(filterRecordsByTab(records, activeStatusTab)); }, [records, activeStatusTab]);

    const handleEdit = (record: RepairRecord) => setEditingRecord(record);
    const handleEditClose = () => setEditingRecord(null);
    const handleEditSave = (updatedRecord: RepairRecord) => { setRecords((prev) => prev.map((r) => (r.id === updatedRecord.id ? updatedRecord : r))); setEditingRecord(null); };

    const handleProceed = (record: RepairRecord) => setRecordToForRepair(record);
    const handleConfirmProceed = async (diagnosisId: number) => {
        if (!recordToForRepair) return;
        setProceeding(true);
        try { const updated = await proceedRepairRecord(recordToForRepair.id, diagnosisId); setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r))); setRecordToForRepair(null); showToast("Repair record moved to For Repair successfully!", "success"); }
        catch (err) { console.error("Failed to proceed repair record:", err); showToast(err instanceof Error ? err.message : "Failed to proceed repair record", "error"); }
        finally { setProceeding(false); }
    };

    const handleForReleased = (record: RepairRecord) => setRecordToForReleased(record);
    const handleConfirmForReleased = async (diagnosisId: number) => {
        if (!recordToForReleased) return;
        setForwardingRelease(true);
        try {
            const updated = await moveRepairRecordToForReleased(recordToForReleased.id, {
                diagnosis_id: diagnosisId,
                requested_by: user?.name ?? user?.email ?? null,
            });
            setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setRecordToForReleased(null);
            showToast("Repair record moved to For Release successfully!", "success");
        } catch (err) {
            console.error("Failed to move repair record to For Release:", err);
            showToast(err instanceof Error ? err.message : "Failed to move repair record to For Release", "error");
        } finally {
            setForwardingRelease(false);
        }
    };

    const handleRelease = (record: RepairRecord) => setRecordToRelease(record);
    const handleConfirmRelease = async () => {
        if (!recordToRelease) return;
        setReleasing(true);
        try { const updated = await releaseRepairRecord(recordToRelease.id); setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r))); setRecordToRelease(null); showToast("Repair record released successfully!", "success"); }
        catch (err) { console.error("Failed to release repair record:", err); showToast(err instanceof Error ? err.message : "Failed to release repair record", "error"); }
        finally { setReleasing(false); }
    };

    const handleDelete = (record: RepairRecord) => setRecordToDelete(record);
    const handleConfirmDelete = async () => {
        if (!recordToDelete) return;
        setDeleting(true);
        try { const updated = await clearRepairRecord(recordToDelete.id); setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r))); setRecordToDelete(null); showToast("Repair record cleared successfully!", "success"); }
        catch (err) { console.error("Failed to clear repair record:", err); showToast(err instanceof Error ? err.message : "Failed to clear repair record", "error"); }
        finally { setDeleting(false); }
    };

    const colCount = isForChecking || isForRepair ? 7 : isUndergoingRepair ? 8 : isForRelease ? 9 : 7 + (showAccessories ? 3 : 0) + (showActions ? 1 : 0) + (showRepairedBy ? 1 : 0) + (showRemarks ? 1 : 0) + (showBillingInfo ? 2 : 0);

    return (
        <div className="space-y-6">
            <div className="flex gap-2 overflow-x-auto flex-wrap" style={{ borderBottom: "1px solid rgba(146,199,207,0.25)" }}>
                {statusTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeStatusTab === tab.id;
                    const count = filterRecordsByTab(records, tab.id).length;
                    return (
                        <button key={tab.id} onClick={() => setActiveStatusTab(tab.id)}
                            className="flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-t-xl cursor-pointer"
                            style={{ background: isActive ? "rgba(146,199,207,0.15)" : "transparent", border: isActive ? "1px solid rgba(146,199,207,0.25)" : "1px solid transparent", borderBottom: isActive ? "1px solid white" : "1px solid transparent", color: isActive ? "#1F2937" : "#6B7280" }}
                            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(146,199,207,0.06)"; }}
                            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                        >
                            <Icon size={16} />{tab.label}
                            {count > 0 && <span className="inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold" style={{ background: "rgba(146,199,207,0.3)", color: "#1F2937" }}>{count}</span>}
                        </button>
                    );
                })}
            </div>

            {toast.show && (
                <div className={`relative rounded-xl px-4 py-3 shadow-lg backdrop-blur-xl transition-all duration-300 flex items-center gap-3 ${toast.type === "error" ? "bg-red-50/95 border border-red-200/60" : "bg-green-50/95 border border-green-200/60"}`}>
                    {toast.type === "error" ? <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" /> : <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />}
                    <p className={`text-sm font-medium ${toast.type === "error" ? "text-red-700" : "text-green-700"}`}>{toast.message}</p>
                    <button onClick={hideToast} className="ml-auto p-1 rounded-lg hover:bg-black/5 transition-colors"><X className="h-4 w-4 text-gray-500" /></button>
                </div>
            )}

            <div className="relative rounded-3xl border border-white/40 backdrop-blur-xl bg-white/20 shadow-lg overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center"><div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: teal, borderTopColor: "transparent" }} /><p className="text-gray-500">Loading records...</p></div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center"><p className="text-red-500 mb-4">{error}</p>
                            <button onClick={fetchRecords} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all" style={{ background: `rgba(146,199,207,0.2)`, color: "#1F2937" }}><RefreshCw className="h-4 w-4" />Retry</button>
                        </div>
                    </div>
                ) : isReleased ? (
                    <div className="space-y-4 p-3">
                        {filteredRecords.length === 0 ? (
                            <div className="px-4 py-10 text-center text-gray-400">No records found in this category.</div>
                        ) : (
                            filteredRecords.map((record) => (
                                <div key={record.id} className="overflow-hidden rounded-sm border border-slate-100 bg-white/70 shadow-sm">
                                    <div className="flex flex-wrap items-center gap-x-8 gap-y-2 bg-slate-50 px-5 py-3 text-sm font-bold text-slate-700">
                                        <span className="inline-flex items-center gap-2">
                                            <CalendarDays className="h-4 w-4 text-indigo-500" />
                                            Date Released: {formatDateNumeric(record.date)}
                                        </span>
                                        <span className="inline-flex items-center gap-2">
                                            <CreditCard className="h-4 w-4 text-sky-500" />
                                            Billing Code: {record.billing_code || "-"}
                                        </span>
                                        <span className="inline-flex items-center gap-2">
                                            <UserRound className="h-4 w-4 text-violet-600" />
                                            Received By: {record.received_by || "-"}
                                        </span>
                                        <Minus className="ml-auto h-5 w-5 text-violet-500" />
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-white text-left text-xs font-bold uppercase text-black">
                                                    <th className="px-4 py-3">POS No</th>
                                                    <th className="px-4 py-3">Serial No</th>
                                                    <th className="px-4 py-3">Area</th>
                                                    <th className="px-4 py-3">Operator</th>
                                                    <th className="px-4 py-3">Diagnosis</th>
                                                    <th className="px-4 py-3">Repaired By</th>
                                                    <th className="px-4 py-3">Remarks</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="bg-rose-50/80 text-gray-800">
                                                    <td className="px-4 py-3.5 font-medium">{record.device_no || "-"}</td>
                                                    <td className="px-4 py-3.5">{record.serial_number || "-"}</td>
                                                    <td className="px-4 py-3.5">{record.area || "-"}</td>
                                                    <td className="px-4 py-3.5">{record.operator_name || "-"}</td>
                                                    <td className="px-4 py-3.5">{record.diagnosis_name || "-"}</td>
                                                    <td className="px-4 py-3.5">{record.repaired_by || "-"}</td>
                                                    <td className="px-4 py-3.5">{record.remarks || "-"}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500" style={{ borderBottom: "1px solid rgba(146,199,207,0.15)" }}>
                                    {showBillingInfo && <th className="px-4 py-4">Billing Code</th>}
                                    <th className="px-4 py-4">{isForChecking ? "Date Requested" : isForRepair ? "Date Checked" : isUndergoingRepair ? "Date Forwarded" : isForRelease ? "Date Received" : "Date"}</th>
                                    <th className="px-4 py-4">POS No</th>
                                    <th className="px-4 py-4">Serial No</th>
                                    <th className="px-4 py-4">Area</th>
                                    <th className="px-4 py-4">Operator</th>
                                    <th className="px-4 py-4">Diagnosis</th>
                                    {showAccessories && <><th className="px-4 py-4">NTC</th><th className="px-4 py-4">With Charger</th><th className="px-4 py-4">With Box</th></>}
                                    {!isForChecking && !isForRepair && !isUndergoingRepair && !isForRelease && <th className="px-4 py-4">Delivered By</th>}
                                    {showRepairedBy && <th className="px-4 py-4">Repaired By</th>}
                                    {showRemarks && <th className="px-4 py-4">Remarks</th>}
                                    {showBillingInfo && <th className="px-4 py-4">Received By</th>}
                                    {showActions && <th className="px-4 py-4 text-center">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecords.length === 0 ? (
                                    <tr><td colSpan={colCount} className="px-4 py-10 text-center text-gray-400">No records found in this category.</td></tr>
                                ) : (
                                    filteredRecords.map((record, idx) => (
                                        <tr key={record.id} className="transition-all duration-200 hover:bg-white/10" style={{ borderBottom: idx < filteredRecords.length - 1 ? "1px solid rgba(146,199,207,0.08)" : "none" }}>
                                            {showBillingInfo && <td className="px-4 py-3.5 font-medium text-gray-800">{record.billing_code || "-"}</td>}
                                            <td className="px-4 py-3.5 text-gray-700">{formatDate(record.date)}</td>
                                            <td className="px-4 py-3.5 font-medium text-gray-800">{record.device_no || "-"}</td>
                                            <td className="px-4 py-3.5 text-gray-700">{record.serial_number || "-"}</td>
                                            <td className="px-4 py-3.5 text-gray-700">{record.area || "-"}</td>
                                            <td className="px-4 py-3.5 text-gray-700">{record.operator_name || "-"}</td>
                                            <td className="px-4 py-3.5 text-gray-700">{record.diagnosis_name || "-"}</td>
                                            {showAccessories && (
                                                <>
                                                    <td className="px-4 py-3.5 text-center"><span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: record.ntc ? "rgba(107,191,107,0.2)" : "rgba(0,0,0,0.05)", color: record.ntc ? "#2E7D32" : "#9CA3AF" }}>{formatYesNo(record.ntc)}</span></td>
                                                    <td className="px-4 py-3.5 text-center"><span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: record.with_charger ? "rgba(107,191,107,0.2)" : "rgba(0,0,0,0.05)", color: record.with_charger ? "#2E7D32" : "#9CA3AF" }}>{formatYesNo(record.with_charger)}</span></td>
                                                    <td className="px-4 py-3.5 text-center"><span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: record.with_box ? "rgba(107,191,107,0.2)" : "rgba(0,0,0,0.05)", color: record.with_box ? "#2E7D32" : "#9CA3AF" }}>{formatYesNo(record.with_box)}</span></td>
                                                </>
                                            )}
                                            {!isForChecking && !isForRepair && !isUndergoingRepair && !isForRelease && <td className="px-4 py-3.5 text-gray-700">{record.delivered_by || "-"}</td>}
                                            {showRepairedBy && <td className="px-4 py-3.5 text-gray-700">{record.repaired_by || "-"}</td>}
                                            {showRemarks && <td className="px-4 py-3.5 text-gray-700">{record.remarks || "-"}</td>}
                                            {showBillingInfo && <td className="px-4 py-3.5 text-gray-700">{record.received_by || "-"}</td>}
                                            {showActions && (
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {activeStatusTab === "for-checking" && (
                                                            <>
                                                                <button onClick={() => handleForReleased(record)} className="rounded-lg p-1.5 transition-colors hover:bg-blue-50" title="For Released" style={{ color: "#2563EB" }}><ArrowUpRight className="h-4 w-4" /></button>
                                                                <button onClick={() => handleProceed(record)} className="rounded-lg p-1.5 transition-colors hover:bg-green-50" title="For Repair" style={{ color: "#16A34A" }}><Wrench className="h-4 w-4" /></button>
                                                            </>
                                                        )}
                                                        {activeStatusTab === "for-release" && (
                                                            <button onClick={() => handleRelease(record)} className="rounded-lg p-1.5 transition-colors hover:bg-blue-50" title="Release" style={{ color: "#2563EB" }}><ArrowUpRight className="h-4 w-4" /></button>
                                                        )}
                                                        {activeStatusTab === "undergoing-repair" && (
                                                            <button onClick={() => handleForReleased(record)} className="rounded-lg p-1.5 transition-colors hover:bg-green-50" title="Received" style={{ color: "#16A34A" }}><CheckCircle2 className="h-4 w-4" /></button>
                                                        )}
                                                        {activeStatusTab === "for-repair" && (
                                                            <>
                                                                <button onClick={() => handleDelete(record)} className="rounded-lg p-1.5 transition-colors hover:bg-red-50" title="Reset" style={{ color: "#EF4444" }}><RotateCcw className="h-4 w-4" /></button>
                                                                <button onClick={() => handleForReleased(record)} className="rounded-lg p-1.5 transition-colors hover:bg-green-50" title="Proceed" style={{ color: "#16A34A" }}><CheckCircle2 className="h-4 w-4" /></button>
                                                            </>
                                                        )}
                                                        {!isForChecking && !isForRepair && !isUndergoingRepair && !isForRelease && <button onClick={() => handleEdit(record)} className="rounded-lg p-1.5 transition-colors hover:bg-amber-50" title="Edit" style={{ color: "#F59E0B" }}><Edit className="h-4 w-4" /></button>}
                                                        {!isForRepair && !isUndergoingRepair && !isForRelease && <button onClick={() => handleDelete(record)} className="rounded-lg p-1.5 transition-colors hover:bg-red-50" title="Delete" style={{ color: "#EF4444" }}><Trash2 className="h-4 w-4" /></button>}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {editingRecord && <EditModal record={editingRecord} diagnoses={diagnoses} onClose={handleEditClose} onSave={handleEditSave} showToast={showToast} />}
            {recordToForRepair && (
                <ForReleasedModal
                    record={recordToForRepair}
                    diagnoses={diagnoses}
                    loading={proceeding}
                    title="Final Diagnosis"
                    proceedLabel="Proceed"
                    onCancel={() => setRecordToForRepair(null)}
                    onProceed={handleConfirmProceed}
                />
            )}
            {recordToForReleased && (
                <ForReleasedModal
                    record={recordToForReleased}
                    diagnoses={diagnoses}
                    loading={forwardingRelease}
                    onCancel={() => setRecordToForReleased(null)}
                    onProceed={handleConfirmForReleased}
                />
            )}

            <RepairConfirmationModal open={recordToRelease !== null} title="Release repair record?" message={recordToRelease ? `This will mark POS #${recordToRelease.device_no || recordToRelease.id} as "Released".` : undefined} confirmLabel="Release" loading={releasing} onCancel={() => setRecordToRelease(null)} onConfirm={handleConfirmRelease} />
            <RepairConfirmationModal open={recordToDelete !== null} title="Delete repair record?" message="Are you sure you want to delete this repair record? This action cannot be undone." confirmLabel="Delete Record" loading={deleting} variant="delete" onCancel={() => setRecordToDelete(null)} onConfirm={handleConfirmDelete} />
        </div>
    );
}
