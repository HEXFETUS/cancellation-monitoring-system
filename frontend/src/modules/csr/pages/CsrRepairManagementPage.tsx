import { useState, useEffect, useMemo } from "react";
import {
    Wrench,
    ClipboardList,
    Clock,
    AlertTriangle,
    CheckCircle2,
    ArrowUpRight,
    Edit,
    Trash2,
    RefreshCw,
    X,
    Save,
    ListChecks,
    Printer,
    CreditCard,
    Minus,
    Plus,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { listRepairRecords, updateRepairRecord, clearRepairRecord, proceedRepairRecord } from "../services/repairRecords";
import type { RepairRecord } from "../services/repairRecords";
import { listDiagnoses, type DiagnosisItem } from "../services/diagnosisList";
import TransmittalModal from "../../pos-repair/components/TransmittalModal";
import { ConfirmationModal, Pagination, Toast } from "../../../shared/components";
import CsrBatchForRepairModal from "../components/CsrBatchForRepairModal";
import CsrBatchForReleaseModal from "../components/CsrBatchForReleaseModal";

const teal = "#92C7CF";

const statusTabs = [
    { id: "request", label: "For Request", icon: ClipboardList },
    { id: "for-repair", label: "For Repair", icon: Wrench },
    { id: "pending", label: "Pending", icon: Clock },
    { id: "undergoing-repair", label: "Undergoing Repair", icon: AlertTriangle },
    { id: "for-release", label: "For Release", icon: CheckCircle2 },
    { id: "released", label: "Released", icon: ArrowUpRight },
];

const tabStatusMap: Record<string, string> = {
    "request": "For Request",
    "for-repair": "For Repair",
    "pending": "Pending",
    "undergoing-repair": "Undergoing Repair",
    "for-release": "For Release",
    "released": "Released",
};

const noActionTabs = ["for-repair", "undergoing-repair"];

function filterRecordsByTab(records: RepairRecord[], tabId: string): RepairRecord[] {
    const status = tabStatusMap[tabId];
    if (!status) return [];

    if (tabId === "released") {
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        return records.filter((r) => {
            if (r.status !== status) return false;
            if (!r.date) return false;
            const d = new Date(r.date);
            const logStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            return logStr === todayStr;
        });
    }

    if (tabId === "request") {
        return records.filter(
            (r) =>
                r.status === status &&
                r.forwarded === false &&
                r.released === false
        );
    }

    return records.filter((r) => r.status === status);
}

function formatDate(dateStr: string): string {
    if (!dateStr) return "-";
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
    } catch { return dateStr; }
}

function formatYesNo(value: boolean): string { return value ? "Yes" : "No"; }

function isNonHexaTechnician(record: RepairRecord): boolean {
    return (record.repaired_by || "").trim().toLowerCase() !== "hexa it";
}

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
            <ConfirmationModal open={showSaveConfirm} title="Save changes?" message={`This will update POS #${record.device_no || record.id}.`} confirmLabel="Save Changes" isLoading={saving} onCancel={() => setShowSaveConfirm(false)} onConfirm={handleConfirmSave} />
        </div>
    );
}

export default function CsrRepairManagementPage() {
    const { user } = useAuth();
    const [activeStatusTab, setActiveStatusTab] = useState("request");
    const [records, setRecords] = useState<RepairRecord[]>([]);
    const [filteredRecords, setFilteredRecords] = useState<RepairRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [diagnoses, setDiagnoses] = useState<DiagnosisItem[]>([]);
    const [editingRecord, setEditingRecord] = useState<RepairRecord | null>(null);
    const [recordToDelete, setRecordToDelete] = useState<RepairRecord | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [recordToProceed, setRecordToProceed] = useState<RepairRecord | null>(null);
    const [proceeding, setProceeding] = useState(false);
    const [recordToRelease, setRecordToRelease] = useState<RepairRecord | null>(null);
    const [batchReleasePreview, setBatchReleasePreview] = useState<{
        records: RepairRecord[];
        billingCode: string;
        receivedBy: string;
    } | null>(null);
    const [showBatchForRepair, setShowBatchForRepair] = useState(false);
    const [showBatchForRelease, setShowBatchForRelease] = useState(false);
    const [showRepairTransmittal, setShowRepairTransmittal] = useState(false);
    const [expandedReleasedIds, setExpandedReleasedIds] = useState<Set<number>>(new Set());
    const [batchProcessing, setBatchProcessing] = useState(false);
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastType, setToastType] = useState<"error" | "success">("error");
    const [page, setPage] = useState(1);
    const pageSize = 20;

    const showToast = (message: string, type: "error" | "success" = "error") => {
        setToastMessage(message);
        setToastType(type);
        setToastOpen(true);
    };
    const hideToast = () => setToastOpen(false);

    const showActions = !noActionTabs.includes(activeStatusTab);
    const showAccessories = activeStatusTab === "request";
    const showRepairedBy = activeStatusTab === "for-repair" || activeStatusTab === "undergoing-repair" || activeStatusTab === "for-release" || activeStatusTab === "released";
    const showRemarks = activeStatusTab === "for-release" || activeStatusTab === "released";
    const showBillingInfo = activeStatusTab === "released";
    const isReleased = activeStatusTab === "released";

    const fetchRecords = async () => {
        try { setLoading(true); setError(null); const data = await listRepairRecords(); setRecords(data); }
        catch (err) { console.error("Failed to fetch repair records:", err); setError(err instanceof Error ? err.message : "Failed to load repair records"); }
        finally { setLoading(false); }
    };

    const fetchDiagnoses = async () => { try { const data = await listDiagnoses(); setDiagnoses(data); } catch (err) { console.error("Failed to fetch diagnoses:", err); } };

    useEffect(() => { fetchRecords(); fetchDiagnoses(); }, []);
    useEffect(() => { setFilteredRecords(filterRecordsByTab(records, activeStatusTab)); }, [records, activeStatusTab]);
    useEffect(() => { setPage(1); }, [activeStatusTab]);

    const handleEdit = (record: RepairRecord) => setEditingRecord(record);
    const handleEditClose = () => setEditingRecord(null);
    const handleEditSave = (updatedRecord: RepairRecord) => { setRecords((prev) => prev.map((r) => (r.id === updatedRecord.id ? updatedRecord : r))); setEditingRecord(null); };

    const handleProceed = (record: RepairRecord) => setRecordToProceed(record);
    const handleConfirmProceed = async () => {
        if (!recordToProceed) return;
        setProceeding(true);
        try { const updated = await proceedRepairRecord(recordToProceed.id); setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r))); setRecordToProceed(null); showToast("Repair record forwarded to For Repair successfully!", "success"); }
        catch (err) { console.error("Failed to proceed repair record:", err); showToast(err instanceof Error ? err.message : "Failed to proceed repair record", "error"); }
        finally { setProceeding(false); }
    };

    const handleBatchForRepair = async () => {
        setBatchProcessing(true);
        try {
            const updatedRecords = await Promise.all(filteredRecords.map((record) => proceedRepairRecord(record.id)));
            const updatedById = new Map(updatedRecords.map((record) => [record.id, record]));
            setRecords((prev) => prev.map((record) => updatedById.get(record.id) ?? record));
            setShowBatchForRepair(false);
            showToast("Repair requests forwarded to For Repair successfully!", "success");
        } catch (err) {
            console.error("Failed to batch proceed repair records:", err);
            showToast(err instanceof Error ? err.message : "Failed to process repair requests", "error");
        } finally {
            setBatchProcessing(false);
        }
    };

    const handleRelease = (record: RepairRecord) => setRecordToRelease(record);
    const handleTransmittalReleased = (updated: RepairRecord) => {
        setRecords((prev) => prev.map((record) => (record.id === updated.id ? updated : record)));
    };

    const handleBatchForRelease = async ({
        billingCode,
        receivedBy,
        records: selectedRecords,
    }: {
        billingCode: string;
        receivedBy: string;
        records: RepairRecord[];
    }) => {
        setShowBatchForRelease(false);
        setBatchReleasePreview({ records: selectedRecords, billingCode, receivedBy });
    };

    const handleDelete = (record: RepairRecord) => setRecordToDelete(record);
    const handleConfirmDelete = async () => {
        if (!recordToDelete) return;
        setDeleting(true);
        try { const updated = await clearRepairRecord(recordToDelete.id); setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r))); setRecordToDelete(null); showToast("Repair record cleared successfully!", "success"); }
        catch (err) { console.error("Failed to clear repair record:", err); showToast(err instanceof Error ? err.message : "Failed to clear repair record", "error"); }
        finally { setDeleting(false); }
    };

    const toggleReleasedGroup = (id: number) => {
        setExpandedReleasedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const releasedGroups = useMemo(() => {
        const groups = new Map<string, RepairRecord[]>();

        filteredRecords.forEach((record) => {
            const key = record.billing_code || `no-billing-${record.id}`;
            groups.set(key, [...(groups.get(key) ?? []), record]);
        });

        return Array.from(groups.entries()).map(([billingCode, items]) => {
            const latestRecord = items.reduce((latest, item) => (new Date(item.date).getTime() > new Date(latest.date).getTime() ? item : latest), items[0]);
            return {
                billingCode,
                records: items,
                latestRecord,
            };
        });
    }, [filteredRecords]);

    const standardTotalPages = Math.ceil(filteredRecords.length / pageSize);
    const pagedRecords = filteredRecords.slice((page - 1) * pageSize, page * pageSize);

    const groupTotalPages = Math.ceil(releasedGroups.length / pageSize);
    const pagedGroups = releasedGroups.slice((page - 1) * pageSize, page * pageSize);

    const colCount = 7 + (showAccessories ? 3 : 0) + (showActions ? 1 : 0) + (showRepairedBy ? 1 : 0) + (showRemarks ? 1 : 0) + (showBillingInfo ? 2 : 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: "1px solid rgba(146,199,207,0.25)" }}>
                <div className="flex flex-wrap gap-2 overflow-x-auto">
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
                {activeStatusTab === "request" && (
                    <button
                        type="button"
                        onClick={() => setShowBatchForRepair(true)}
                        disabled={filteredRecords.length === 0 || batchProcessing}
                        className="mb-2 inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                        style={{
                            background: "linear-gradient(to right, #92C7CF, #AAD7D9)",
                            boxShadow: "0 4px 16px rgba(146,199,207,0.25)",
                        }}
                    >
                        <ListChecks className="h-4 w-4" />
                        Process Batch
                    </button>
                )}
                {activeStatusTab === "for-repair" && (
                    <button
                        type="button"
                        onClick={() => setShowRepairTransmittal(true)}
                        disabled={filteredRecords.length === 0}
                        className="mb-2 inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                        style={{
                            background: "linear-gradient(to right, #2563EB, #3B82F6)",
                            boxShadow: "0 4px 16px rgba(37,99,235,0.25)",
                        }}
                    >
                        <Printer className="h-4 w-4" />
                        Print Repair Transmittal
                    </button>
                )}
                {activeStatusTab === "for-release" && (
                    <button
                        type="button"
                        onClick={() => setShowBatchForRelease(true)}
                        disabled={filteredRecords.filter(isNonHexaTechnician).length === 0 || batchProcessing}
                        className="mb-2 inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                        style={{
                            background: "linear-gradient(to right, #92C7CF, #AAD7D9)",
                            boxShadow: "0 4px 16px rgba(146,199,207,0.25)",
                        }}
                    >
                        <ListChecks className="h-4 w-4" />
                        Process Batch
                    </button>
                )}
            </div>

            <Toast open={toastOpen} message={toastMessage} type={toastType} onClose={hideToast} />

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
                            <>
                                {pagedGroups.map((group) => {
                                    const firstRecord = group.records[0];
                                    const isExpanded = expandedReleasedIds.has(firstRecord.id);
                                    return (
                                        <div key={group.billingCode} className="overflow-hidden rounded-xl border border-warm bg-card shadow-sm">
                                            <button
                                                type="button"
                                                onClick={() => toggleReleasedGroup(firstRecord.id)}
                                                className="flex w-full flex-wrap items-center gap-x-8 gap-y-2 bg-card px-5 py-3 text-left text-sm font-bold text-ink transition-colors hover:bg-surface"
                                            >
                                                <span className="inline-flex items-center gap-2">
                                                    <CreditCard className="h-4 w-4 text-[#3B82A0]" />
                                                    Billing Code: {firstRecord.billing_code || "-"}
                                                </span>
                                                <span className="inline-flex items-center rounded-full bg-[#92C7CF]/20 px-2 py-0.5 text-xs font-bold text-[#1F2937]">
                                                    {group.records.length} POS
                                                </span>
                                                {isExpanded ? (
                                                    <Minus className="ml-auto h-5 w-5 text-[#3B82A0]" />
                                                ) : (
                                                    <Plus className="ml-auto h-5 w-5 text-[#3B82A0]" />
                                                )}
                                            </button>
                                            {isExpanded && (
                                                <div className="overflow-x-auto border-t border-warm">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="border-b border-warm bg-cream text-left text-xs font-bold uppercase text-ink-muted">
                                                                <th className="whitespace-nowrap px-4 py-3">Date Released</th>
                                                                <th className="whitespace-nowrap px-4 py-3">POS No</th>
                                                                <th className="whitespace-nowrap px-4 py-3">Serial No</th>
                                                                <th className="whitespace-nowrap px-4 py-3">Area</th>
                                                                <th className="whitespace-nowrap px-4 py-3">Operator</th>
                                                                <th className="whitespace-nowrap px-4 py-3">Diagnosis</th>
                                                                <th className="whitespace-nowrap px-4 py-3">Repaired By</th>
                                                                <th className="whitespace-nowrap px-4 py-3">Remarks</th>
                                                                <th className="whitespace-nowrap px-4 py-3">Received By</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {group.records.map((record) => (
                                                                <tr key={record.id} className="text-ink transition hover:bg-cream/50">
                                                                    <td className="px-4 py-3.5">{formatDateNumeric(record.date)}</td>
                                                                    <td className="px-4 py-3.5 font-medium">{record.device_no || "-"}</td>
                                                                    <td className="px-4 py-3.5">{record.serial_number || "-"}</td>
                                                                    <td className="px-4 py-3.5">{record.area || "-"}</td>
                                                                    <td className="px-4 py-3.5">{record.operator_name || "-"}</td>
                                                                    <td className="px-4 py-3.5">{record.diagnosis_name || "-"}</td>
                                                                    <td className="px-4 py-3.5">{record.repaired_by || "-"}</td>
                                                                    <td className="px-4 py-3.5">{record.remarks || "-"}</td>
                                                                    <td className="px-4 py-3.5">{record.received_by || "-"}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                <Pagination currentPage={page} totalPages={groupTotalPages} totalItems={filteredRecords.length} onPageChange={setPage} pageSize={pageSize} />
                            </>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500" style={{ borderBottom: "1px solid rgba(146,199,207,0.15)" }}>
                                    {showBillingInfo && <th className="px-4 py-4">Billing Code</th>}
                                    <th className="px-4 py-4">Date</th>
                                    <th className="px-4 py-4">POS No</th>
                                    <th className="px-4 py-4">Serial No</th>
                                    <th className="px-4 py-4">Area</th>
                                    <th className="px-4 py-4">Operator</th>
                                    <th className="px-4 py-4">Diagnosis</th>
                                    {showAccessories && <><th className="px-4 py-4">NTC</th><th className="px-4 py-4">With Charger</th><th className="px-4 py-4">With Box</th></>}
                                    <th className="px-4 py-4">Delivered By</th>
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
                                    pagedRecords.map((record, idx) => (
                                        <tr key={record.id} className="transition-all duration-200 hover:bg-white/10" style={{ borderBottom: idx < pagedRecords.length - 1 ? "1px solid rgba(146,199,207,0.08)" : "none" }}>
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
                                            <td className="px-4 py-3.5 text-gray-700">{record.delivered_by || "-"}</td>
                                            {showRepairedBy && <td className="px-4 py-3.5 text-gray-700">{record.repaired_by || "-"}</td>}
                                            {showRemarks && <td className="px-4 py-3.5 text-gray-700">{record.remarks || "-"}</td>}
                                            {showBillingInfo && <td className="px-4 py-3.5 text-gray-700">{record.received_by || "-"}</td>}
                                            {showActions && (
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {activeStatusTab === "request" && (
                                                            <button onClick={() => handleProceed(record)} className="rounded-lg p-1.5 transition-colors hover:bg-green-50" title="Proceed" style={{ color: "#16A34A" }}><CheckCircle2 className="h-4 w-4" /></button>
                                                        )}
                                                        {activeStatusTab === "for-release" && (
                                                            <button onClick={() => handleRelease(record)} className="rounded-lg p-1.5 transition-colors hover:bg-blue-50" title="Release" style={{ color: "#2563EB" }}><ArrowUpRight className="h-4 w-4" /></button>
                                                        )}
                                                        {activeStatusTab !== "for-release" && (
                                                            <>
                                                                <button onClick={() => handleEdit(record)} className="rounded-lg p-1.5 transition-colors hover:bg-amber-50" title="Edit" style={{ color: "#F59E0B" }}><Edit className="h-4 w-4" /></button>
                                                                <button onClick={() => handleDelete(record)} className="rounded-lg p-1.5 transition-colors hover:bg-red-50" title="Delete" style={{ color: "#EF4444" }}><Trash2 className="h-4 w-4" /></button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        {filteredRecords.length > 0 && (
                            <Pagination currentPage={page} totalPages={standardTotalPages} totalItems={filteredRecords.length} onPageChange={setPage} pageSize={pageSize} />
                        )}
                    </div>
                )}
            </div>

            {editingRecord && <EditModal record={editingRecord} diagnoses={diagnoses} onClose={handleEditClose} onSave={handleEditSave} showToast={showToast} />}

            <ConfirmationModal open={recordToProceed !== null} title="Proceed with repair request?" message={recordToProceed ? `This will forward POS #${recordToProceed.device_no || recordToProceed.id} to "For Repair" status.` : undefined} confirmLabel="Proceed" isLoading={proceeding} onCancel={() => setRecordToProceed(null)} onConfirm={handleConfirmProceed} />
            <ConfirmationModal open={recordToDelete !== null} title="Delete repair record?" message="Are you sure you want to delete this repair record? This action cannot be undone." confirmLabel="Delete Record" isLoading={deleting} variant="delete" onCancel={() => setRecordToDelete(null)} onConfirm={handleConfirmDelete} />
            {recordToRelease && (
                <TransmittalModal
                    mode="release"
                    record={recordToRelease}
                    userId={user?.id ?? null}
                    issuedBy={user?.name ?? user?.email ?? ""}
                    onReleased={handleTransmittalReleased}
                    showToast={showToast}
                    onClose={() => setRecordToRelease(null)}
                />
            )}
            {batchReleasePreview && (
                <TransmittalModal
                    mode="release"
                    records={batchReleasePreview.records}
                    userId={user?.id ?? null}
                    issuedBy={user?.name ?? user?.email ?? ""}
                    initialBillingCode={batchReleasePreview.billingCode}
                    initialReceivedBy={batchReleasePreview.receivedBy}
                    initialPreview
                    onReleased={handleTransmittalReleased}
                    showToast={showToast}
                    onClose={() => setBatchReleasePreview(null)}
                />
            )}
            {showBatchForRepair && (
                <CsrBatchForRepairModal
                    records={filteredRecords}
                    loading={batchProcessing}
                    onCancel={() => setShowBatchForRepair(false)}
                    onProceed={handleBatchForRepair}
                />
            )}
            {showBatchForRelease && (
                <CsrBatchForReleaseModal
                    records={filteredRecords.filter(isNonHexaTechnician)}
                    loading={batchProcessing}
                    onCancel={() => setShowBatchForRelease(false)}
                    onProceed={handleBatchForRelease}
                />
            )}
            {showRepairTransmittal && (
                <TransmittalModal
                    records={filteredRecords}
                    userId={user?.id ?? null}
                    issuedBy={user?.name ?? user?.email ?? ""}
                    onClose={() => setShowRepairTransmittal(false)}
                    showToast={showToast}
                />
            )}
        </div>
    );
}
