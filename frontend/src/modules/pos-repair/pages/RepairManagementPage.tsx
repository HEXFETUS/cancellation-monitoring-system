import { useState, useEffect, useMemo } from "react";
import {
    Wrench,
    ClipboardList,
    AlertTriangle,
    CheckCircle2,
    ArrowUpRight,
    Edit,
    Trash2,
    RefreshCw,
    RotateCcw,
    CreditCard,
    Minus,
    Plus,
    ListChecks,
    Printer,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { listRepairRecords, updateRepairRecord, clearRepairRecord, proceedRepairRecord, moveRepairRecordToForRelease, moveRepairRecordToUndergoingRepair, receiveRepairRecord } from "../services/repairRecords";
import type { RepairRecord } from "../services/repairRecords";
import { listDiagnoses, type DiagnosisItem } from "../services/diagnosisList";
import RepairConfirmationModal from "../components/RepairConfirmationModal";
import TransmittalModal from "../components/TransmittalModal";
import { EditModal, FinalDiagnosisModal, ReceivedModal, TechnicianModal } from "../components/RepairManagementModals";
import { BatchCheckedPosModal, BatchForRepairModal, BatchReceivedPosModal } from "../components/BatchProcessingModals";
import CsrBatchForReleaseModal from "../../csr/components/CsrBatchForReleaseModal";
import { Toast } from "../../../shared/components";

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
    "for-release": "For Release",
    "released": "Released",
};

const noActionTabs: string[] = [];

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
    if (tabId === "for-checking" || tabId === "for-release") {
        return records.filter((r) => r.status === status);
    }
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

export default function RepairManagementPage() {
    const { user } = useAuth();
    const [activeStatusTab, setActiveStatusTab] = useState("for-checking");
    const [darkMode, setDarkMode] = useState(() => {
        return document.documentElement.classList.contains("dark") || localStorage.getItem("theme") === "dark";
    });

    useEffect(() => {
        const syncTheme = () => {
            setDarkMode(document.documentElement.classList.contains("dark"));
        };
        const observer = new MutationObserver(syncTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        window.addEventListener("storage", syncTheme);
        syncTheme();
        return () => {
            observer.disconnect();
            window.removeEventListener("storage", syncTheme);
        };
    }, []);
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
    const [recordToTechnician, setRecordToTechnician] = useState<RepairRecord | null>(null);
    const [savingTechnician, setSavingTechnician] = useState(false);
    const [recordToForReleased, setRecordToForReleased] = useState<RepairRecord | null>(null);
    const [forwardingRelease, setForwardingRelease] = useState(false);
    const [recordToReset, setRecordToReset] = useState<RepairRecord | null>(null);
    const [resetting, setResetting] = useState(false);
    const [recordToReceive, setRecordToReceive] = useState<RepairRecord | null>(null);
    const [receiving, setReceiving] = useState(false);
    const [recordToRelease, setRecordToRelease] = useState<RepairRecord | null>(null);
    const [batchReleasePreview, setBatchReleasePreview] = useState<{
        records: RepairRecord[];
        billingCode: string;
        receivedBy: string;
    } | null>(null);
    const [showTransmittal, setShowTransmittal] = useState(false);
    const [expandedReleasedIds, setExpandedReleasedIds] = useState<Set<number>>(new Set());
    const [batchModal, setBatchModal] = useState<"for-repair" | "checked" | "received" | "release" | null>(null);
    const [batchProcessing, setBatchProcessing] = useState(false);
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastType, setToastType] = useState<"error" | "success">("error");

    const showToast = (message: string, type: "error" | "success" = "error") => {
        setToastMessage(message);
        setToastType(type);
        setToastOpen(true);
    };
    const hideToast = () => setToastOpen(false);

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
            const updated = await moveRepairRecordToForRelease(recordToForReleased.id, {
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

    const handleResetToForRepair = async () => {
        if (!recordToReset) return;
        setResetting(true);
        try {
            const updated = await updateRepairRecord(recordToReset.id, { status: "For Repair", forwarded: true });
            setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setRecordToReset(null);
            showToast("Repair record reset to For Repair successfully!", "success");
        } catch (err) {
            console.error("Failed to reset repair record:", err);
            showToast(err instanceof Error ? err.message : "Failed to reset repair record", "error");
        } finally {
            setResetting(false);
        }
    };

    const handleTechnicianProceed = async (technician: string) => {
        if (!recordToTechnician) return;
        setSavingTechnician(true);
        try {
            const updated = await moveRepairRecordToUndergoingRepair(recordToTechnician.id, {
                repaired_by: technician,
                requested_by: user?.name ?? user?.email ?? null,
            });
            setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setRecordToTechnician(null);
            showToast("Repair record moved to Undergoing Repair successfully!", "success");
        } catch (err) {
            console.error("Failed to assign technician:", err);
            showToast(err instanceof Error ? err.message : "Failed to assign technician", "error");
        } finally {
            setSavingTechnician(false);
        }
    };

    const handleReceiveProceed = async ({
        billingCode,
        remarks,
        unrepairableRetired,
    }: {
        billingCode: string;
        remarks: string;
        unrepairableRetired: boolean;
    }) => {
        if (!recordToReceive) return;
        setReceiving(true);
        try {
            const updated = await receiveRepairRecord(recordToReceive.id, {
                billing_code: billingCode,
                remarks,
                received_by: user?.name ?? user?.email ?? null,
                user_id: user?.id ?? null,
                unrepairable_retired: unrepairableRetired,
            });
            setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setRecordToReceive(null);
            showToast("Repair record received successfully!", "success");
        } catch (err) {
            console.error("Failed to receive repair record:", err);
            showToast(err instanceof Error ? err.message : "Failed to receive repair record", "error");
        } finally {
            setReceiving(false);
        }
    };

    const handleRelease = (record: RepairRecord) => setRecordToRelease(record);
    const handleTransmittalReleased = (updated: RepairRecord) => {
        setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    };

    const handleDelete = (record: RepairRecord) => setRecordToDelete(record);
    const handleConfirmDelete = async () => {
        if (!recordToDelete) return;
        setDeleting(true);
        try { const updated = await clearRepairRecord(recordToDelete.id); setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r))); setRecordToDelete(null); showToast("Repair record cleared successfully!", "success"); }
        catch (err) { console.error("Failed to clear repair record:", err); showToast(err instanceof Error ? err.message : "Failed to clear repair record", "error"); }
        finally { setDeleting(false); }
    };

    const handleBatchForRepair = async (items: Array<{ record: RepairRecord; diagnosisId: number }>) => {
        setBatchProcessing(true);
        try {
            const updatedRecords = await Promise.all(items.map((item) => proceedRepairRecord(item.record.id, item.diagnosisId)));
            setRecords((prev) => prev.map((record) => updatedRecords.find((updated) => updated.id === record.id) ?? record));
            setBatchModal(null);
            showToast("Selected POS records moved to For Repair successfully!", "success");
        } catch (err) {
            showToast(err instanceof Error ? err.message : "Failed to process selected POS records", "error");
        } finally {
            setBatchProcessing(false);
        }
    };

    const handleBatchChecked = async (technician: string, selectedRecords: RepairRecord[]) => {
        setBatchProcessing(true);
        try {
            const updatedRecords = await Promise.all(selectedRecords.map((record) => moveRepairRecordToUndergoingRepair(record.id, {
                repaired_by: technician,
                requested_by: user?.name ?? user?.email ?? null,
            })));
            setRecords((prev) => prev.map((record) => updatedRecords.find((updated) => updated.id === record.id) ?? record));
            setBatchModal(null);
            showToast("Selected POS records moved to Undergoing Repair successfully!", "success");
        } catch (err) {
            showToast(err instanceof Error ? err.message : "Failed to process selected POS records", "error");
        } finally {
            setBatchProcessing(false);
        }
    };

    const handleBatchReceived = async ({ billingCode, items }: { billingCode: string; items: Array<{ record: RepairRecord; remarks: string; unrepairableRetired: boolean }> }) => {
        setBatchProcessing(true);
        try {
            const updatedRecords = await Promise.all(items.map((item) => receiveRepairRecord(item.record.id, {
                billing_code: billingCode,
                remarks: item.remarks,
                received_by: user?.name ?? user?.email ?? null,
                user_id: user?.id ?? null,
                unrepairable_retired: item.unrepairableRetired,
            })));
            setRecords((prev) => prev.map((record) => updatedRecords.find((updated) => updated.id === record.id) ?? record));
            setBatchModal(null);
            showToast("Selected POS records received successfully!", "success");
        } catch (err) {
            showToast(err instanceof Error ? err.message : "Failed to receive selected POS records", "error");
        } finally {
            setBatchProcessing(false);
        }
    };

    const handleBatchRelease = ({
        billingCode,
        receivedBy,
        records: selectedRecords,
    }: {
        billingCode: string;
        receivedBy: string;
        records: RepairRecord[];
    }) => {
        setBatchModal(null);
        setBatchReleasePreview({ records: selectedRecords, billingCode, receivedBy });
    };

    const toggleReleasedGroup = (id: number) => {
        setExpandedReleasedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
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

    const colCount = isForChecking || isForRepair ? 7 : isUndergoingRepair ? 8 : isForRelease ? 9 : 7 + (showAccessories ? 3 : 0) + (showActions ? 1 : 0) + (showRepairedBy ? 1 : 0) + (showRemarks ? 1 : 0) + (showBillingInfo ? 2 : 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 overflow-x-auto flex-wrap" style={{ borderBottom: "1px solid rgba(146,199,207,0.25)" }}>
                <div className="flex flex-wrap gap-2">
                    {statusTabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeStatusTab === tab.id;
                        const count = filterRecordsByTab(records, tab.id).length;
                        return (
                            <button key={tab.id} onClick={() => setActiveStatusTab(tab.id)}
                                className="flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-t-xl cursor-pointer"
                                style={{ background: isActive ? "rgba(146,199,207,0.15)" : "transparent", border: isActive ? "1px solid rgba(146,199,207,0.25)" : "1px solid transparent", borderBottom: isActive ? "1px solid white" : "1px solid transparent", color: isActive ? (darkMode ? "#FFFFFF" : "#1F2937") : "#6B7280" }}
                                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(146,199,207,0.06)"; }}
                                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                            >
                                <Icon size={16} />{tab.label}
                                {count > 0 && <span className="inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold" style={{ background: "rgba(146,199,207,0.3)", color: "#1F2937" }}>{count}</span>}
                            </button>
                        );
                    })}
                </div>
                {(activeStatusTab === "for-checking" || activeStatusTab === "for-repair" || activeStatusTab === "undergoing-repair" || activeStatusTab === "for-release") && (
                    <div className="mb-2 ml-auto flex items-center gap-2">
                        {activeStatusTab === "undergoing-repair" && (
                            <button
                                onClick={() => setShowTransmittal(true)}
                                disabled={filteredRecords.length === 0}
                                className="inline-flex h-10 items-center gap-2 rounded-xl border border-warm bg-white px-4 text-sm font-semibold text-ink shadow-sm transition hover:bg-surface disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                            >
                                <Printer className="h-4 w-4" />
                                Transmittal
                            </button>
                        )}
                        <button
                            onClick={() => setBatchModal(activeStatusTab === "for-checking" ? "for-repair" : activeStatusTab === "for-repair" ? "checked" : activeStatusTab === "undergoing-repair" ? "received" : "release")}
                            disabled={filteredRecords.length === 0 || batchProcessing}
                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-dark disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
                        >
                            <ListChecks className="h-4 w-4" />
                            Process Batch
                        </button>
                    </div>
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
                            releasedGroups.map((group) => {
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
                            })
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-warm bg-cream text-left text-xs font-semibold uppercase tracking-wider text-ink-muted">
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
                                                                <button onClick={() => handleForReleased(record)} className="rounded-lg p-1.5 transition-colors hover:bg-blue-50" title="For Release" style={{ color: "#2563EB" }}><ArrowUpRight className="h-4 w-4" /></button>
                                                                <button onClick={() => handleProceed(record)} className="rounded-lg p-1.5 transition-colors hover:bg-green-50" title="For Repair" style={{ color: "#16A34A" }}><Wrench className="h-4 w-4" /></button>
                                                            </>
                                                        )}
                                                        {activeStatusTab === "for-release" && (
                                                            <button onClick={() => handleRelease(record)} className="rounded-lg p-1.5 transition-colors hover:bg-blue-50" title="Release" style={{ color: "#2563EB" }}><ArrowUpRight className="h-4 w-4" /></button>
                                                        )}
                                                        {activeStatusTab === "undergoing-repair" && (
                                                            <button onClick={() => setRecordToReceive(record)} className="rounded-lg p-1.5 transition-colors hover:bg-green-50" title="Received" style={{ color: "#16A34A" }}><CheckCircle2 className="h-4 w-4" /></button>
                                                        )}
                                                        {activeStatusTab === "for-repair" && (
                                                            <>
                                                                <button onClick={() => setRecordToReset(record)} className="rounded-lg p-1.5 transition-colors hover:bg-red-50" title="Reset" style={{ color: "#EF4444" }}><RotateCcw className="h-4 w-4" /></button>
                                                                <button onClick={() => setRecordToTechnician(record)} className="rounded-lg p-1.5 transition-colors hover:bg-green-50" title="Proceed" style={{ color: "#16A34A" }}><CheckCircle2 className="h-4 w-4" /></button>
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
                <FinalDiagnosisModal
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
                <FinalDiagnosisModal
                    record={recordToForReleased}
                    diagnoses={diagnoses}
                    loading={forwardingRelease}
                    onCancel={() => setRecordToForReleased(null)}
                    onProceed={handleConfirmForReleased}
                />
            )}
            {recordToTechnician && (
                <TechnicianModal
                    record={recordToTechnician}
                    loading={savingTechnician}
                    onCancel={() => setRecordToTechnician(null)}
                    onProceed={handleTechnicianProceed}
                />
            )}
            {recordToReceive && (
                <ReceivedModal
                    record={recordToReceive}
                    loading={receiving}
                    onCancel={() => setRecordToReceive(null)}
                    onProceed={handleReceiveProceed}
                />
            )}
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
            {showTransmittal && (
                <TransmittalModal
                    records={filterRecordsByTab(records, "undergoing-repair")}
                    onClose={() => setShowTransmittal(false)}
                />
            )}
            {batchModal === "for-repair" && (
                <BatchForRepairModal
                    records={filterRecordsByTab(records, "for-checking")}
                    diagnoses={diagnoses}
                    onCancel={() => setBatchModal(null)}
                    onProceed={handleBatchForRepair}
                />
            )}
            {batchModal === "checked" && (
                <BatchCheckedPosModal
                    records={filterRecordsByTab(records, "for-repair")}
                    onCancel={() => setBatchModal(null)}
                    onProceed={handleBatchChecked}
                />
            )}
            {batchModal === "received" && (
                <BatchReceivedPosModal
                    records={filterRecordsByTab(records, "undergoing-repair")}
                    onCancel={() => setBatchModal(null)}
                    onProceed={handleBatchReceived}
                />
            )}
            {batchModal === "release" && (
                <CsrBatchForReleaseModal
                    records={filterRecordsByTab(records, "for-release")}
                    loading={batchProcessing}
                    onCancel={() => setBatchModal(null)}
                    onProceed={handleBatchRelease}
                />
            )}

            <RepairConfirmationModal open={recordToReset !== null} title="Reset repair record?" message={recordToReset ? `This will move POS #${recordToReset.device_no || recordToReset.id} back to For Repair status.` : undefined} confirmLabel="Reset" loading={resetting} onCancel={() => setRecordToReset(null)} onConfirm={handleResetToForRepair} />
            <RepairConfirmationModal open={recordToDelete !== null} title="Delete repair record?" message="Are you sure you want to delete this repair record? This action cannot be undone." confirmLabel="Delete Record" loading={deleting} variant="delete" onCancel={() => setRecordToDelete(null)} onConfirm={handleConfirmDelete} />
        </div>
    );
}
