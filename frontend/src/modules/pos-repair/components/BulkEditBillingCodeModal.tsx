import { useEffect, useState } from "react";
import { CreditCard, X } from "lucide-react";
import { listBillingCodeOptions } from "../services/repairRecords";
import type { BillingCodeOption, RepairRecord } from "../services/repairRecords";

interface BulkEditBillingCodeModalProps {
    records: RepairRecord[];
    loading?: boolean;
    onCancel: () => void;
    onProceed: (payload: { billingCode: string; recordIds: number[] }) => void;
}

function getOperatorKey(record: RepairRecord) {
    const operatorName = (record.operator_name || "").trim().toLowerCase();
    return operatorName || (record.operator_id != null ? String(record.operator_id) : "none");
}

export default function BulkEditBillingCodeModal({
    records,
    loading = false,
    onCancel,
    onProceed,
}: BulkEditBillingCodeModalProps) {
    const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
    const [billingCode, setBillingCode] = useState("");
    const [showConfirm, setShowConfirm] = useState(false);
    const [billingCodeOptions, setBillingCodeOptions] = useState<BillingCodeOption[]>([]);

    const selectedRecords = records.filter((record) => selectedIds.has(record.id));
    const selectedOperatorKeys = Array.from(new Set(selectedRecords.map(getOperatorKey)));
    const hasMixedOperators = selectedOperatorKeys.length > 1;
    const billingCodeValue = billingCode.trim();
    const hasValidBillingCode = /[A-Za-z]/.test(billingCodeValue) && /\d/.test(billingCodeValue);
    const canProceed = selectedRecords.length > 0 && !hasMixedOperators && hasValidBillingCode;

    useEffect(() => {
        let ignore = false;

        async function loadOptions() {
            try {
                const options = await listBillingCodeOptions();
                if (!ignore) {
                    setBillingCodeOptions(options);
                }
            } catch {
                if (!ignore) {
                    setBillingCodeOptions([]);
                }
            }
        }

        loadOptions();

        return () => {
            ignore = true;
        };
    }, []);

    const toggleRecord = (id: number, checked: boolean) => {
        const next = new Set(selectedIds);
        if (checked) next.add(id);
        else next.delete(id);
        setSelectedIds(next);
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm">
            <div className="relative z-10 w-full max-w-5xl rounded-xl border border-warm bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-warm px-6 py-5">
                    <div className="flex items-center gap-3">
                        <CreditCard className="h-6 w-6 text-blue-600" />
                        <div>
                            <h2 className="text-xl font-bold text-ink">Edit Billing Codes</h2>
                            <p className="mt-1 text-sm text-ink-muted">Set one billing code for selected For Release records without releasing them.</p>
                        </div>
                    </div>
                    <button type="button" onClick={onCancel} disabled={loading} className="rounded-lg p-1.5 transition-colors hover:bg-gray-100 disabled:opacity-60">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                <div className="space-y-5 p-6">

                    <div className="flex flex-wrap items-end gap-3">
                        <div className="w-[280px]">
                            <label className="space-y-1 text-sm font-semibold text-ink-muted">
                                Billing Code <span className="text-rose-500">*</span>
                                <input
                                    value={billingCode}
                                    onChange={(e) => setBillingCode(e.target.value)}
                                    list="bulk-billing-code-options"
                                    placeholder="Enter or select billing code"
                                    className="h-10 w-full rounded-md border border-warm bg-white px-3 text-sm text-ink outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </label>
                            <datalist id="bulk-billing-code-options">
                                {billingCodeOptions.map((option) => (
                                    <option key={`${option.billing_code}-${option.operator_id ?? "none"}`} value={option.billing_code}>
                                        {option.operator_name || "Unknown operator"} - {option.pos_count} POS
                                    </option>
                                ))}
                            </datalist>
                        </div>
                        <p className="max-w-md text-xs text-ink-muted">
                            Exactly one billing code is applied to every selected record. Select records from the same operator only.
                        </p>
                    </div>

                    {hasMixedOperators && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                            Do not edit billing codes for POS from different operators in one batch. Select POS with the same operator only.
                        </div>
                    )}

                    <div className="overflow-hidden rounded-xl border border-warm">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-warm bg-cream text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                    <th className="w-12 px-3 py-3 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.size === records.length && records.length > 0}
                                            onChange={(e) => setSelectedIds(e.target.checked ? new Set(records.map((r) => r.id)) : new Set())}
                                        />
                                    </th>
                                    <th className="px-4 py-3 text-center">POS</th>
                                    <th className="px-4 py-3 text-center">Serial</th>
                                    <th className="px-4 py-3 text-center">Operator</th>
                                    <th className="px-4 py-3 text-center">Repaired By</th>
                                    <th className="px-4 py-3 text-center">Current Billing Code</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.map((record) => (
                                    <tr key={record.id} className="border-b border-warm/60 last:border-b-0">
                                        <td className="px-3 py-3 text-center">
                                            <input type="checkbox" checked={selectedIds.has(record.id)} onChange={(e) => toggleRecord(record.id, e.target.checked)} />
                                        </td>
                                        <td className="px-4 py-3 text-center font-medium text-ink">{record.device_no || "-"}</td>
                                        <td className="px-4 py-3 text-center text-ink-muted">{record.serial_number || "-"}</td>
                                        <td className="px-4 py-3 text-center text-ink-muted">{record.operator_name || "-"}</td>
                                        <td className="px-4 py-3 text-center text-ink-muted">{record.repaired_by || "-"}</td>
                                        <td className="px-4 py-3 text-center">
                                            {record.billing_code ? (
                                                <span className="text-ink-muted">{record.billing_code}</span>
                                            ) : (
                                                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600">Missing</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

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
                            {loading ? "Saving..." : "Apply"}
                        </button>
                    </div>
                </div>
            </div>

            {showConfirm && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-2xl">
                        <h3 className="mb-5 text-xl font-bold text-ink">Confirm Billing Code Update</h3>
                        <p className="mb-2 text-sm text-ink">
                            This will set the billing code <span className="font-bold">{billingCodeValue}</span> on{" "}
                            <span className="font-bold">{selectedRecords.length}</span> selected POS unit(s).
                        </p>
                        <p className="mb-5 text-sm text-ink-muted">The records will stay in For Release.</p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={() => setShowConfirm(false)} disabled={loading} className="rounded-lg bg-gray-100 px-6 py-2.5 text-sm font-semibold text-ink transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60">
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowConfirm(false);
                                    onProceed({ billingCode: billingCodeValue, recordIds: selectedRecords.map((r) => r.id) });
                                }}
                                disabled={loading}
                                className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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