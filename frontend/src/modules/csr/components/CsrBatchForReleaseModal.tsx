import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { listBillingCodeOptions, listReceivedByOptions } from "../services/repairRecords";
import type { BillingCodeOption, ReceivedByOption, RepairRecord } from "../services/repairRecords";

interface CsrBatchForReleaseModalProps {
    records: RepairRecord[];
    loading?: boolean;
    onCancel: () => void;
    onProceed: (payload: { billingCode: string; receivedBy: string; records: RepairRecord[] }) => void;
}

function isNonHexaTechnician(record: RepairRecord) {
    return (record.repaired_by || "").trim().toLowerCase() !== "hexa it";
}

function getSavedBillingCodes(records: RepairRecord[]) {
    return Array.from(new Set(records.map((record) => (record.billing_code || "").trim()).filter(Boolean)));
}

function getOperatorKey(record: RepairRecord) {
    const operatorName = (record.operator_name || "").trim().toLowerCase();
    return operatorName || (record.operator_id != null ? String(record.operator_id) : "none");
}

export default function CsrBatchForReleaseModal({
    records,
    loading = false,
    onCancel,
    onProceed,
}: CsrBatchForReleaseModalProps) {
    const eligibleRecords = useMemo(() => records.filter(isNonHexaTechnician), [records]);
    const initialSavedBillingCodes = getSavedBillingCodes(eligibleRecords);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
    const [billingCode, setBillingCode] = useState("");
    const [receivedBy, setReceivedBy] = useState("");
    const [filterBy, setFilterBy] = useState<"billing" | "operator">("billing");
    const [filterValue, setFilterValue] = useState("");
    const [billingCodeOptions, setBillingCodeOptions] = useState<BillingCodeOption[]>([]);
    const [receivedByOptions, setReceivedByOptions] = useState<ReceivedByOption[]>([]);
    const [showConfirm, setShowConfirm] = useState(false);

    const filteredRecords = eligibleRecords.filter((record) => {
        if (!filterValue) return true;
        const value = filterBy === "billing" ? record.billing_code || "" : record.operator_name || "";
        return value === filterValue;
    });
    const selectedRecords = eligibleRecords.filter((record) => selectedIds.has(record.id));
    const selectedSavedBillingCodes = getSavedBillingCodes(selectedRecords);
    const selectedOperatorKeys = Array.from(new Set(selectedRecords.map(getOperatorKey)));
    const hasMixedOperators = selectedOperatorKeys.length > 1;
    const selectedOperatorId = selectedRecords.length > 0 && !hasMixedOperators ? selectedRecords[0].operator_id : null;
    const billingCodeValue = billingCode.trim();
    const hasValidBillingCode = /[A-Za-z]/.test(billingCodeValue) && /\d/.test(billingCodeValue);
    const canProceed = selectedRecords.length > 0 && !hasMixedOperators && hasValidBillingCode && Boolean(receivedBy.trim());
    const mergedBillingCodeOptions = [
        ...selectedSavedBillingCodes.map((code) => ({
            billing_code: code,
            operator_id: selectedOperatorId,
            operator_name: selectedRecords.find((record) => (record.billing_code || "").trim() === code)?.operator_name ?? null,
            pos_count: selectedRecords.filter((record) => (record.billing_code || "").trim() === code).length,
        })),
        ...billingCodeOptions.filter((option) => !selectedSavedBillingCodes.some((code) => code.toLowerCase() === option.billing_code.toLowerCase())),
    ];
    const filterOptions = Array.from(new Set(
        eligibleRecords
            .map((record) => filterBy === "billing" ? record.billing_code || "" : record.operator_name || "")
            .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b));

    const syncBillingCodeForSelection = (nextSelectedIds: Set<number>) => {
        const nextSelectedRecords = eligibleRecords.filter((record) => nextSelectedIds.has(record.id));
        const nextSavedBillingCodes = getSavedBillingCodes(nextSelectedRecords);

        if (nextSelectedRecords.length === 0) {
            setBillingCode("");
        } else if (nextSavedBillingCodes.length === 1) {
            setBillingCode(nextSavedBillingCodes[0]);
        } else if (nextSavedBillingCodes.length > 1) {
            setBillingCode("");
        }
    };

    useEffect(() => {
        let ignore = false;

        async function loadOptions() {
            try {
                const [billingOptions, receiverOptions] = await Promise.all([
                    listBillingCodeOptions(selectedOperatorId),
                    listReceivedByOptions(),
                ]);
                if (!ignore) {
                    setBillingCodeOptions(billingOptions);
                    setReceivedByOptions(receiverOptions);
                }
            } catch {
                if (!ignore) {
                    setBillingCodeOptions([]);
                    setReceivedByOptions([]);
                }
            }
        }

        loadOptions();

        return () => {
            ignore = true;
        };
    }, [selectedOperatorId]);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm">
            <div className="relative z-10 w-full max-w-5xl rounded-xl border border-warm bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-warm px-6 py-5">
                    <div>
                        <h2 className="text-xl font-bold text-ink">For Release</h2>
                        <p className="mt-1 text-sm text-ink-muted">Batch release POS repaired by non-HEXA technicians.</p>
                    </div>
                    <button type="button" onClick={onCancel} disabled={loading} className="rounded-lg p-1.5 transition-colors hover:bg-gray-100 disabled:opacity-60">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                <div className="space-y-5 p-6">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="w-[150px]">
                            <label className="space-y-1 text-sm font-semibold text-ink-muted">
                                Filter By
                                <select
                                    value={filterBy}
                                    onChange={(event) => {
                                        setFilterBy(event.target.value as "billing" | "operator");
                                        setFilterValue("");
                                    }}
                                    className="h-10 w-full rounded-md border border-warm bg-white px-3 text-sm text-ink outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                >
                                    <option value="billing">Billing Code</option>
                                    <option value="operator">Operator</option>
                                </select>
                            </label>
                        </div>
                        <div className="w-[180px]">
                            <label className="space-y-1 text-sm font-semibold text-ink-muted">
                                {filterBy === "billing" ? "Billing Code" : "Operator"}
                                <select
                                    value={filterValue}
                                    onChange={(event) => setFilterValue(event.target.value)}
                                    className="h-10 w-full rounded-md border border-warm bg-white px-3 text-sm text-ink outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                >
                                    <option value="">All</option>
                                    {filterOptions.map((option) => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div className="ml-auto w-[220px]">
                            <label className="space-y-1 text-sm font-semibold text-ink-muted">
                                Billing Code <span className="text-red-500">*</span>
                                <input
                                    value={billingCode}
                                    onChange={(event) => setBillingCode(event.target.value)}
                                    list="csr-batch-release-billing-code-options"
                                    placeholder="BC-123"
                                    className="h-10 w-full rounded-md border border-warm bg-white px-3 text-sm text-ink outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                                <datalist id="csr-batch-release-billing-code-options">
                                    {mergedBillingCodeOptions.map((option) => (
                                        <option key={`${option.billing_code}-${option.operator_id ?? "none"}`} value={option.billing_code}>
                                            {option.operator_name || "Unknown operator"} - {option.pos_count} POS
                                        </option>
                                    ))}
                                </datalist>
                                {billingCodeValue && !hasValidBillingCode && (
                                    <span className="block text-xs font-medium text-red-600">Billing Code must contain letters and numbers.</span>
                                )}
                            </label>
                        </div>
                        <div className="w-[220px]">
                            <label className="space-y-1 text-sm font-semibold text-ink-muted">
                                Received By <span className="text-red-500">*</span>
                                <input
                                    value={receivedBy}
                                    onChange={(event) => setReceivedBy(event.target.value)}
                                    list="csr-batch-release-received-by-options"
                                    placeholder="Name"
                                    className="h-10 w-full rounded-md border border-warm bg-white px-3 text-sm text-ink outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                                <datalist id="csr-batch-release-received-by-options">
                                    {receivedByOptions.map((option) => (
                                        <option key={option.received_by} value={option.received_by}>
                                            Used {option.usage_count} time{option.usage_count === 1 ? "" : "s"}
                                        </option>
                                    ))}
                                </datalist>
                            </label>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-warm">
                        <table className="w-full min-w-[760px] text-sm">
                            <thead>
                                <tr className="border-b border-warm bg-cream text-left text-xs font-bold uppercase tracking-wider text-ink-muted">
                                    <th className="w-12 px-3 py-3 text-center">
                                        <input
                                            type="checkbox"
                                            checked={filteredRecords.length > 0 && filteredRecords.every((record) => selectedIds.has(record.id))}
                                            onChange={(event) => {
                                                const nextSelectedIds = new Set(selectedIds);
                                                filteredRecords.forEach((record) => {
                                                    if (event.target.checked) nextSelectedIds.add(record.id);
                                                    else nextSelectedIds.delete(record.id);
                                                });
                                                setSelectedIds(nextSelectedIds);
                                                syncBillingCodeForSelection(nextSelectedIds);
                                            }}
                                        />
                                    </th>
                                    <th className="px-4 py-3">POS No</th>
                                    <th className="px-4 py-3">Serial No</th>
                                    <th className="px-4 py-3">Billing Code</th>
                                    <th className="px-4 py-3">Operator</th>
                                    <th className="px-4 py-3">Repaired By</th>
                                    <th className="px-4 py-3">Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                                            No matching non-HEXA technician records available for batch release.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRecords.map((record) => (
                                        <tr key={record.id} className="border-b border-warm/60 last:border-b-0">
                                            <td className="px-3 py-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(record.id)}
                                                    onChange={(event) => {
                                                        const next = new Set(selectedIds);
                                                        if (event.target.checked) next.add(record.id);
                                                        else next.delete(record.id);
                                                        setSelectedIds(next);
                                                        syncBillingCodeForSelection(next);
                                                    }}
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-center font-medium text-ink">{record.device_no || "-"}</td>
                                            <td className="px-4 py-3 text-center text-ink-muted">{record.serial_number || "-"}</td>
                                            <td className="px-4 py-3 text-center text-ink-muted">{record.billing_code || "-"}</td>
                                            <td className="px-4 py-3 text-center text-ink-muted">{record.operator_name || "-"}</td>
                                            <td className="px-4 py-3 text-center text-ink-muted">{record.repaired_by || "-"}</td>
                                            <td className="px-4 py-3 text-center text-ink-muted">{record.remarks || "-"}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {hasMixedOperators && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                            Do not release POS from different operators in one batch. Select POS with the same operator only.
                        </div>
                    )}

                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={onCancel} disabled={loading} className="rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60">
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowConfirm(true)}
                            disabled={loading || !canProceed}
                            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
                            style={{
                                background: "linear-gradient(to right, #92C7CF, #AAD7D9)",
                                boxShadow: "0 4px 16px rgba(146,199,207,0.25)",
                            }}
                        >
                            {loading ? "Processing..." : "Print Transmittal"}
                        </button>
                    </div>
                </div>
            </div>
            {showConfirm && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-2xl">
                        <h3 className="mb-5 text-xl font-bold text-ink">Confirm POS Transmittal</h3>
                        <div className="mb-5 max-h-72 overflow-auto rounded-lg border border-warm">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-100 text-left text-xs font-bold uppercase text-ink">
                                        <th className="px-4 py-3">Device</th>
                                        <th className="px-4 py-3">Serial</th>
                                        <th className="px-4 py-3">Area</th>
                                        <th className="px-4 py-3">Operator</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedRecords.map((record) => (
                                        <tr key={record.id}>
                                            <td className="px-4 py-3">{record.device_no || "-"}</td>
                                            <td className="px-4 py-3">{record.serial_number || "-"}</td>
                                            <td className="px-4 py-3">{record.area || "-"}</td>
                                            <td className="px-4 py-3">{record.operator_name || "-"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="space-y-2 text-sm text-ink">
                            <p><span className="font-bold">Received By:</span> {receivedBy.trim()}</p>
                            <p><span className="font-bold">Billing Code:</span> {billingCodeValue}</p>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowConfirm(false)}
                                disabled={loading}
                                className="rounded-lg bg-gray-100 px-6 py-2.5 text-sm font-semibold text-ink transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowConfirm(false);
                                    onProceed({ billingCode: billingCodeValue, receivedBy: receivedBy.trim(), records: selectedRecords });
                                }}
                                disabled={loading}
                                className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
