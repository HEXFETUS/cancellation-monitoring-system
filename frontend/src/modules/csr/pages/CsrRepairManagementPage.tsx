import { useState, useEffect } from "react";
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
    AlertCircle,
    CheckCircle,
} from "lucide-react";
import { listRepairRecords, updateRepairRecord, clearRepairRecord } from "../services/repairRecords";
import type { RepairRecord } from "../services/repairRecords";
import { listDiagnoses, type DiagnosisItem } from "../services/diagnosisList";
import CsrConfirmationModal from "../components/CsrConfirmationModal";

const teal = "#92C7CF";
const tealLight = "#AAD7D9";

const statusTabs = [
    { id: "request", label: "For Request", icon: ClipboardList },
    { id: "for-repair", label: "For Repair", icon: Wrench },
    { id: "pending", label: "Pending", icon: Clock },
    { id: "undergoing-repair", label: "Undergoing Repair", icon: AlertTriangle },
    { id: "for-release", label: "For Release", icon: CheckCircle2 },
    { id: "released", label: "Released", icon: ArrowUpRight },
];

// Map tab IDs to status values in the database
const tabStatusMap: Record<string, string> = {
    "request": "For Request",
    "for-repair": "For Repair",
    "pending": "Pending",
    "undergoing-repair": "Undergoing Repair",
    "for-release": "For Release",
    "released": "Released",
};

// Filter records based on tab
function filterRecordsByTab(records: RepairRecord[], tabId: string): RepairRecord[] {
    const status = tabStatusMap[tabId];
    if (!status) return [];

    if (tabId === "request") {
        // For "For Request" tab: status = "For Request" AND forwarded = false AND released = false AND re_repair = false
        return records.filter(
            (r) =>
                r.status === status &&
                r.forwarded === false &&
                r.released === false &&
                r.re_repair === false
        );
    }

    return records.filter((r) => r.status === status);
}

function formatDate(dateStr: string): string {
    if (!dateStr) return "-";
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-PH", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    } catch {
        return dateStr;
    }
}

function formatYesNo(value: boolean): string {
    return value ? "Yes" : "No";
}

// Edit Modal Component
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

    const handleSave = () => {
        setShowSaveConfirm(true);
    };

    const handleConfirmSave = async () => {
        try {
            setSaving(true);
            setError(null);
            const updated = await updateRepairRecord(record.id, {
                diagnosis_id: diagnosisId,
                ntc,
                with_charger: withCharger,
                with_box: withBox,
                delivered_by: deliveredBy || null,
            });
            onSave(updated);
            showToast("Repair record updated successfully!", "success");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to save changes";
            setError(message);
            showToast(message, "error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />
            {/* Modal */}
            <div
                className="relative z-10 w-full max-w-lg rounded-3xl border border-white/40 backdrop-blur-xl bg-white/80 shadow-2xl p-6 mx-4"
                style={{ maxHeight: "90vh", overflow: "auto" }}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-800">
                        Edit Repair Record #{record.id}
                    </h3>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 transition-colors hover:bg-gray-100"
                        style={{ color: "#6B7280" }}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form */}
                <div className="space-y-4">
                    {/* Diagnosis */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Diagnosis
                        </label>
                        <select
                            value={diagnosisId ?? ""}
                            onChange={(e) => setDiagnosisId(e.target.value ? Number(e.target.value) : null)}
                            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                            style={{ background: "white" }}
                        >
                            <option value="">Select diagnosis...</option>
                            {diagnoses.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* NTC */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            NTC
                        </label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="ntc"
                                    checked={ntc === true}
                                    onChange={() => setNtc(true)}
                                    className="h-4 w-4 text-teal-600 focus:ring-teal-500"
                                />
                                <span className="text-sm text-gray-700">Yes</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="ntc"
                                    checked={ntc === false}
                                    onChange={() => setNtc(false)}
                                    className="h-4 w-4 text-teal-600 focus:ring-teal-500"
                                />
                                <span className="text-sm text-gray-700">No</span>
                            </label>
                        </div>
                    </div>

                    {/* With Charger */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            With Charger
                        </label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="withCharger"
                                    checked={withCharger === true}
                                    onChange={() => setWithCharger(true)}
                                    className="h-4 w-4 text-teal-600 focus:ring-teal-500"
                                />
                                <span className="text-sm text-gray-700">Yes</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="withCharger"
                                    checked={withCharger === false}
                                    onChange={() => setWithCharger(false)}
                                    className="h-4 w-4 text-teal-600 focus:ring-teal-500"
                                />
                                <span className="text-sm text-gray-700">No</span>
                            </label>
                        </div>
                    </div>

                    {/* With Box */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            With Box
                        </label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="withBox"
                                    checked={withBox === true}
                                    onChange={() => setWithBox(true)}
                                    className="h-4 w-4 text-teal-600 focus:ring-teal-500"
                                />
                                <span className="text-sm text-gray-700">Yes</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="withBox"
                                    checked={withBox === false}
                                    onChange={() => setWithBox(false)}
                                    className="h-4 w-4 text-teal-600 focus:ring-teal-500"
                                />
                                <span className="text-sm text-gray-700">No</span>
                            </label>
                        </div>
                    </div>

                    {/* Delivered By */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Delivered By
                        </label>
                        <input
                            type="text"
                            value={deliveredBy}
                            onChange={(e) => setDeliveredBy(e.target.value)}
                            placeholder="Enter name of deliverer..."
                            className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                            style={{ background: "white" }}
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-red-500">{error}</p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="rounded-xl px-4 py-2.5 text-sm font-medium transition-colors hover:bg-gray-100"
                        style={{ color: "#6B7280" }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: teal }}
                    >
                        {saving ? (
                            <>
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4" />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>

            <CsrConfirmationModal
                open={showSaveConfirm}
                title="Save changes?"
                message={`This will update Repair Record #${record.id}.`}
                confirmLabel="Save Changes"
                loading={saving}
                onCancel={() => setShowSaveConfirm(false)}
                onConfirm={handleConfirmSave}
            />
        </div>
    );
}

export default function CsrRepairManagementPage() {
    const [activeStatusTab, setActiveStatusTab] = useState("request");
    const [records, setRecords] = useState<RepairRecord[]>([]);
    const [filteredRecords, setFilteredRecords] = useState<RepairRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [diagnoses, setDiagnoses] = useState<DiagnosisItem[]>([]);
    const [editingRecord, setEditingRecord] = useState<RepairRecord | null>(null);
    const [recordToDelete, setRecordToDelete] = useState<RepairRecord | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [toast, setToast] = useState<{ show: boolean; message: string; type: "error" | "success" }>({
        show: false,
        message: "",
        type: "error",
    });

    const showToast = (message: string, type: "error" | "success" = "error") => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: "", type: "error" }), 4000);
    };

    const hideToast = () => {
        setToast({ show: false, message: "", type: "error" });
    };

    const fetchRecords = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await listRepairRecords();
            setRecords(data);
        } catch (err) {
            console.error("Failed to fetch repair records:", err);
            setError(err instanceof Error ? err.message : "Failed to load repair records");
        } finally {
            setLoading(false);
        }
    };

    const fetchDiagnoses = async () => {
        try {
            const data = await listDiagnoses();
            setDiagnoses(data);
        } catch (err) {
            console.error("Failed to fetch diagnoses:", err);
        }
    };

    useEffect(() => {
        fetchRecords();
        fetchDiagnoses();
    }, []);

    useEffect(() => {
        const filtered = filterRecordsByTab(records, activeStatusTab);
        setFilteredRecords(filtered);
    }, [records, activeStatusTab]);

    const handleEdit = (record: RepairRecord) => {
        setEditingRecord(record);
    };

    const handleEditClose = () => {
        setEditingRecord(null);
    };

    const handleEditSave = (updatedRecord: RepairRecord) => {
        // Update the record in the local state
        setRecords((prev) =>
            prev.map((r) => (r.id === updatedRecord.id ? updatedRecord : r))
        );
        setEditingRecord(null);
    };

    const handleDelete = (record: RepairRecord) => {
        setRecordToDelete(record);
    };

    const handleConfirmDelete = async () => {
        if (!recordToDelete) return;

        setDeleting(true);
        try {
            const updated = await clearRepairRecord(recordToDelete.id);
            // Update the record in the local state
            setRecords((prev) =>
                prev.map((r) => (r.id === updated.id ? updated : r))
            );
            setRecordToDelete(null);
            showToast("Repair record cleared successfully!", "success");
        } catch (err) {
            console.error("Failed to clear repair record:", err);
            showToast(err instanceof Error ? err.message : "Failed to clear repair record", "error");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Status tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 flex-wrap">
                {statusTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeStatusTab === tab.id;
                    const count = filterRecordsByTab(records, tab.id).length;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveStatusTab(tab.id)}
                            className="flex items-center gap-2 shrink-0 rounded-xl px-4 py-2.5 text-xs font-medium transition-all duration-200 sm:text-sm"
                            style={{
                                background: isActive
                                    ? `linear-gradient(135deg, ${teal}20, ${tealLight}15)`
                                    : "rgba(255,255,255,0.15)",
                                border: isActive
                                    ? `1px solid rgba(146,199,207,0.35)`
                                    : "1px solid rgba(255,255,255,0.25)",
                                color: isActive ? "#1F2937" : "#6B7280",
                                boxShadow: isActive
                                    ? `0 2px 12px rgba(146,199,207,0.15)`
                                    : "none",
                                backdropFilter: "blur(8px)",
                            }}
                            onMouseEnter={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.background = "rgba(146,199,207,0.08)";
                                    e.currentTarget.style.color = teal;
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isActive) {
                                    e.currentTarget.style.background = "rgba(255,255,255,0.15)";
                                    e.currentTarget.style.color = "#6B7280";
                                }
                            }}
                        >
                            <Icon className="h-4 w-4" />
                            {tab.label}
                            {count > 0 && (
                                <span
                                    className="ml-1 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold"
                                    style={{
                                        background: "rgba(146,199,207,0.3)",
                                        color: "#1F2937",
                                    }}
                                >
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {toast.show && (
                <div
                    className={`relative rounded-xl px-4 py-3 shadow-lg backdrop-blur-xl transition-all duration-300 flex items-center gap-3 ${toast.type === "error"
                        ? "bg-red-50/95 border border-red-200/60"
                        : "bg-green-50/95 border border-green-200/60"
                        }`}
                >
                    {toast.type === "error" ? (
                        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    ) : (
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                    )}
                    <p className={`text-sm font-medium ${toast.type === "error" ? "text-red-700" : "text-green-700"}`}>
                        {toast.message}
                    </p>
                    <button
                        onClick={hideToast}
                        className="ml-auto p-1 rounded-lg hover:bg-black/5 transition-colors"
                    >
                        <X className="h-4 w-4 text-gray-500" />
                    </button>
                </div>
            )}

            {/* Data table */}
            <div className="relative rounded-3xl border border-white/40 backdrop-blur-xl bg-white/20 shadow-lg overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <div
                                className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-t-transparent"
                                style={{ borderColor: teal, borderTopColor: "transparent" }}
                            />
                            <p className="text-gray-500">Loading records...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-center">
                            <p className="text-red-500 mb-4">{error}</p>
                            <button
                                onClick={fetchRecords}
                                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all"
                                style={{
                                    background: `rgba(146,199,207,0.2)`,
                                    color: "#1F2937",
                                }}
                            >
                                <RefreshCw className="h-4 w-4" />
                                Retry
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr
                                    className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                                    style={{ borderBottom: "1px solid rgba(146,199,207,0.15)" }}
                                >
                                    <th className="px-4 py-4">Date</th>
                                    <th className="px-4 py-4">POS No</th>
                                    <th className="px-4 py-4">Serial No</th>
                                    <th className="px-4 py-4">Area</th>
                                    <th className="px-4 py-4">Operator</th>
                                    <th className="px-4 py-4">Diagnosis</th>
                                    <th className="px-4 py-4">NTC</th>
                                    <th className="px-4 py-4">With Charger</th>
                                    <th className="px-4 py-4">With Box</th>
                                    <th className="px-4 py-4">Delivered By</th>
                                    <th className="px-4 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="px-4 py-10 text-center text-gray-400">
                                            No records found in this category.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRecords.map((record, idx) => (
                                        <tr
                                            key={record.id}
                                            className="transition-all duration-200 hover:bg-white/10"
                                            style={{
                                                borderBottom:
                                                    idx < filteredRecords.length - 1
                                                        ? "1px solid rgba(146,199,207,0.08)"
                                                        : "none",
                                            }}
                                        >
                                            <td className="px-4 py-3.5 text-gray-700">
                                                {formatDate(record.date)}
                                            </td>
                                            <td className="px-4 py-3.5 font-medium text-gray-800">
                                                {record.device_no || "-"}
                                            </td>
                                            <td className="px-4 py-3.5 text-gray-700">
                                                {record.serial_number || "-"}
                                            </td>
                                            <td className="px-4 py-3.5 text-gray-700">
                                                {record.area || "-"}
                                            </td>
                                            <td className="px-4 py-3.5 text-gray-700">
                                                {record.operator_name || "-"}
                                            </td>
                                            <td className="px-4 py-3.5 text-gray-700">
                                                {record.diagnosis_name || "-"}
                                            </td>
                                            <td className="px-4 py-3.5 text-center">
                                                <span
                                                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                                    style={{
                                                        background: record.ntc
                                                            ? "rgba(107,191,107,0.2)"
                                                            : "rgba(0,0,0,0.05)",
                                                        color: record.ntc ? "#2E7D32" : "#9CA3AF",
                                                    }}
                                                >
                                                    {formatYesNo(record.ntc)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-center">
                                                <span
                                                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                                    style={{
                                                        background: record.with_charger
                                                            ? "rgba(107,191,107,0.2)"
                                                            : "rgba(0,0,0,0.05)",
                                                        color: record.with_charger ? "#2E7D32" : "#9CA3AF",
                                                    }}
                                                >
                                                    {formatYesNo(record.with_charger)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-center">
                                                <span
                                                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                                    style={{
                                                        background: record.with_box
                                                            ? "rgba(107,191,107,0.2)"
                                                            : "rgba(0,0,0,0.05)",
                                                        color: record.with_box ? "#2E7D32" : "#9CA3AF",
                                                    }}
                                                >
                                                    {formatYesNo(record.with_box)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-gray-700">
                                                {record.delivered_by || "-"}
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => handleEdit(record)}
                                                        className="rounded-lg p-1.5 transition-colors hover:bg-amber-50"
                                                        title="Edit"
                                                        style={{ color: "#F59E0B" }}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(record)}
                                                        className="rounded-lg p-1.5 transition-colors hover:bg-red-50"
                                                        title="Clear"
                                                        style={{ color: "#EF4444" }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {editingRecord && (
                <EditModal
                    record={editingRecord}
                    diagnoses={diagnoses}
                    onClose={handleEditClose}
                    onSave={handleEditSave}
                    showToast={showToast}
                />
            )}

            <CsrConfirmationModal
                open={recordToDelete !== null}
                title="Clear repair record?"
                message={`This will clear delivered by and status for Repair Record #${recordToDelete?.id}.`}
                confirmLabel="Clear Record"
                loading={deleting}
                variant="delete"
                onCancel={() => setRecordToDelete(null)}
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
}
