import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Printer, X } from "lucide-react";
import logoOnly from "../../../assets/LogoOnly.webp";
import logoWithName from "../../../assets/LogoWithName.webp";
import { listReceivedByOptions, listRepairRecordsByBillingCode, releaseRepairRecord } from "../services/repairRecords";
import type { BillingCodeRepairRecord, ReceivedByOption, RepairRecord } from "../services/repairRecords";

interface TransmittalModalProps {
    record?: RepairRecord;
    records?: RepairRecord[];
    mode?: "forwarded" | "release";
    userId?: number | null;
    issuedBy?: string;
    initialPreview?: boolean;
    initialBillingCode?: string;
    initialReceivedBy?: string;
    onReleased?: (record: RepairRecord) => void;
    showToast?: (message: string, type?: "error" | "success") => void;
    onClose: () => void;
}

function formatDateNumeric(dateStr: string): string {
    if (!dateStr) return "-";
    try {
        return new Date(dateStr).toLocaleDateString("en-US", {
            month: "numeric",
            day: "numeric",
            year: "numeric",
        });
    } catch {
        return dateStr;
    }
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getOperatorKey(value: number | string | null | undefined) {
    return value == null ? "none" : String(value);
}

export default function TransmittalModal({
    record,
    records: recordsProp,
    mode = "forwarded",
    userId,
    issuedBy,
    initialPreview = false,
    initialBillingCode,
    initialReceivedBy,
    onReleased,
    showToast,
    onClose,
}: TransmittalModalProps) {
    const [operatorFilter, setOperatorFilter] = useState("");
    const initialReleaseRecord = record ?? recordsProp?.[0];
    const [receivedBy, setReceivedBy] = useState(initialReceivedBy ?? initialReleaseRecord?.received_by ?? "");
    const [showConfirm, setShowConfirm] = useState(false);
    const [showReleasePreview, setShowReleasePreview] = useState(initialPreview);
    const [savingRelease, setSavingRelease] = useState(false);
    const [savedRelease, setSavedRelease] = useState(false);
    const [releasedRecord, setReleasedRecord] = useState<RepairRecord | null>(null);
    const [releaseBillingCode, setReleaseBillingCode] = useState(initialBillingCode ?? initialReleaseRecord?.billing_code ?? "");
    const [billingCodeRecords, setBillingCodeRecords] = useState<BillingCodeRepairRecord[]>([]);
    const [receivedByOptions, setReceivedByOptions] = useState<ReceivedByOption[]>([]);
    const [checkingBillingCode, setCheckingBillingCode] = useState(false);
    const [billingCodeLookupError, setBillingCodeLookupError] = useState("");
    const records = useMemo(() => recordsProp ?? (record ? [record] : []), [record, recordsProp]);
    const operatorOptions = useMemo(() => {
        const unique = new Set(records.map((item) => item.operator_name || "").filter(Boolean));
        return ["All", ...Array.from(unique).sort()];
    }, [records]);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
    const filteredRecords = records.filter((item) => {
        if (!operatorFilter || operatorFilter === "All") return true;
        return (item.operator_name || "").trim() === operatorFilter.trim();
    });
    const selectedRecords = filteredRecords.filter((item) => selectedIds.has(item.id));
    const selectedOperatorNames = selectedRecords.map((item) => (item.operator_name || "").trim()).filter(Boolean);
    const selectedOperatorConflict = new Set(selectedOperatorNames).size > 1;
    const canPrint = selectedRecords.length > 0 && !selectedOperatorConflict;

    const toggleAll = (checked: boolean) => {
        setSelectedIds(checked ? new Set(filteredRecords.map((item) => item.id)) : new Set());
    };

    const toggleRecord = (id: number, checked: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const releaseRecord = releasedRecord ?? record ?? records[0];
    const releaseRecords = releasedRecord ? [releasedRecord] : records;
    const billingCode = releaseBillingCode.trim();
    const isHexaItRepair = (releaseRecord?.repaired_by || "").trim().toLowerCase() === "hexa it";
    const hasBillingCodeLetter = /[A-Za-z]/.test(billingCode);
    const hasBillingCodeNumber = /\d/.test(billingCode);
    const isBillingCodeValid = Boolean(billingCode && hasBillingCodeLetter && hasBillingCodeNumber);
    const isBillingCodeAllowed = isHexaItRepair ? !billingCode || isBillingCodeValid : isBillingCodeValid;
    const billingCodeMatches = billingCodeRecords.filter((item) => item.id !== releaseRecord?.id);
    const hasBillingCodeOperatorConflict = Boolean(billingCode) && billingCodeMatches.some((item) => getOperatorKey(item.operator_id) !== getOperatorKey(releaseRecord?.operator_id));
    const canProceedRelease = Boolean(isBillingCodeAllowed && !hasBillingCodeOperatorConflict && receivedBy.trim() && releaseRecord);
    const releaseDate = formatDateNumeric(new Date().toISOString());
    const releaseIssuedBy = "AVEGAIL P. HORMOSISIMA";

    useEffect(() => {
        if (mode !== "release") return;

        let ignore = false;

        async function loadReceivedByOptions() {
            try {
                const options = await listReceivedByOptions();
                if (!ignore) setReceivedByOptions(options);
            } catch {
                if (!ignore) setReceivedByOptions([]);
            }
        }

        loadReceivedByOptions();

        return () => {
            ignore = true;
        };
    }, [mode]);

    useEffect(() => {
        if (mode !== "release" || !billingCode || !isBillingCodeValid) {
            setBillingCodeRecords([]);
            setBillingCodeLookupError("");
            setCheckingBillingCode(false);
            return;
        }

        let ignore = false;
        const timeout = window.setTimeout(async () => {
            setCheckingBillingCode(true);
            setBillingCodeLookupError("");
            try {
                const matches = await listRepairRecordsByBillingCode(billingCode);
                if (!ignore) setBillingCodeRecords(matches);
            } catch (err) {
                if (!ignore) {
                    setBillingCodeRecords([]);
                    setBillingCodeLookupError(err instanceof Error ? err.message : "Failed to check billing code");
                }
            } finally {
                if (!ignore) setCheckingBillingCode(false);
            }
        }, 300);

        return () => {
            ignore = true;
            window.clearTimeout(timeout);
        };
    }, [billingCode, isBillingCodeValid, mode]);

    const handleConfirmRelease = () => {
        if (!canProceedRelease) return;
        setShowConfirm(false);
        setShowReleasePreview(true);
    };

    const handleSaveRelease = async () => {
        if (!canProceedRelease || !releaseRecord) return;
        setSavingRelease(true);
        try {
            const updatedRecords = await Promise.all(releaseRecords.map((item) => releaseRepairRecord(item.id, {
                billing_code: billingCode,
                received_by: receivedBy.trim(),
                user_id: userId ?? null,
            })));
            const updated = updatedRecords[0];
            setReleasedRecord(updatedRecords.length === 1 ? updated ?? null : null);
            setReleaseBillingCode(updated?.billing_code || billingCode);
            setSavedRelease(true);
            updatedRecords.forEach((item) => onReleased?.(item));
            showToast?.("Saved / Ready to Print You may now reprint anytime", "success");
        } catch (err) {
            showToast?.(err instanceof Error ? err.message : "Failed to release POS record", "error");
        } finally {
            setSavingRelease(false);
        }
    };

    const printReleasePreview = () => {
        window.print();
    };

    const handleClose = () => {
        setSelectedIds(new Set());
        onClose();
    };

    const handlePrint = () => {
        if (!canPrint) return;

        const printOperator = selectedRecords[0]?.operator_name || operatorFilter || "-";
        const printDateReceived = formatDateNumeric(selectedRecords[0]?.date || records[0]?.date || "");
        const printDeliveredBy = selectedRecords[0]?.delivered_by || "-";
        const printReceivedBy = issuedBy || "-";

        const rows = selectedRecords
            .map((item) => `
                <tr>
                    <td>${escapeHtml(item.device_no || "-")}</td>
                    <td>${escapeHtml(item.serial_number || "-")}</td>
                    <td>${escapeHtml(item.area || "-")}</td>
                    <td>${escapeHtml(item.diagnosis_name || "-")}</td>
                </tr>
            `)
            .join("");

        const printWindow = window.open("", "_blank", "width=900,height=600");
        if (!printWindow) return;

        printWindow.document.write(`
            <!doctype html>
            <html>
                <head>
                    <title>POS Repair Form / Replacement</title>
                    <style>
                        * { box-sizing: border-box; }
                        html, body { margin: 0; padding: 0; }
                        body {
                            background: #f3f4f6;
                            color: #111827;
                            font-family: Arial, Helvetica, sans-serif;
                            font-size: 12px;
                        }
                        .toolbar {
                            position: fixed;
                            top: 0;
                            left: 0;
                            right: 0;
                            z-index: 100;
                            display: flex;
                            justify-content: flex-end;
                            gap: 10px;
                            padding: 10px 18px;
                            background: #111827;
                            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
                        }
                        .toolbar button {
                            min-width: 92px;
                            border: 0;
                            border-radius: 6px;
                            padding: 9px 14px;
                            font: 700 13px Arial, Helvetica, sans-serif;
                            cursor: pointer;
                        }
                        .toolbar .close-btn {
                            background: #e5e7eb;
                            color: #111827;
                        }
                        .toolbar .print-btn {
                            background: #16a34a;
                            color: #fff;
                        }
                        .page {
                            position: relative;
                            width: 8.27in;
                            min-height: 5.83in;
                            margin: 20px auto;
                            padding: 30px 40px;
                            background: #fff;
                            border: 1px solid #d1d5db;
                            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
                            overflow: hidden;
                        }
                        .bg-watermark {
                            position: fixed;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            width: 450px;
                            height: 450px;
                            object-fit: contain;
                            opacity: 0.06;
                            z-index: 0;
                            pointer-events: none;
                        }
                        .logo-header {
                            text-align: center;
                            margin-bottom: 8px;
                            padding-bottom: 10px;
                            border-bottom: 2px solid #111827;
                            position: relative;
                            z-index: 1;
                        }
                        .logo-header img {
                            height: 56px;
                        }
                        .title {
                            text-align: center;
                            font-size: 16px;
                            font-weight: 700;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                            margin: 0 0 12px 0;
                            position: relative;
                            z-index: 1;
                        }
                        .info-row {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            margin-bottom: 12px;
                            font-size: 12px;
                            position: relative;
                            z-index: 1;
                        }
                        .info-row span {
                            font-weight: 400;
                        }
                        .info-row .label {
                            font-weight: 700;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            font-size: 11px;
                            margin-bottom: 12px;
                        }
                        th, td {
                            border: 1px solid #111827;
                            padding: 8px 10px;
                            text-align: center;
                            vertical-align: middle;
                        }
                        th {
                            background: #f8fafc;
                            font-weight: 700;
                        }
                        .address {
                            text-align: center;
                            line-height: 1.6;
                            font-size: 11px;
                            color: #374151;
                            padding-top: 10px;
                            border-top: 2px solid #111827;
                            margin-top: 12px;
                            position: relative;
                            z-index: 1;
                        }
                        @media print {
                            @page {
                                size: A4 landscape;
                                margin: 0.3in;
                            }
                            body { background: #fff; }
                            .toolbar { display: none !important; }
                            .page {
                                width: auto;
                                min-height: auto;
                                margin: 0;
                                padding: 12px;
                                border: none;
                                box-shadow: none;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="toolbar" id="toolbar">
                        <button type="button" class="close-btn" onclick="window.close()">Close</button>
                        <button type="button" class="print-btn" onclick="window.print()">Print</button>
                    </div>
                    <div class="page">
                        <img class="bg-watermark" src="${logoOnly}" />
                        <div class="logo-header">
                            <img src="${logoWithName}" />
                        </div>
                        <h2 class="title">Repair Transmittal Form</h2>
                        <div class="info-row">
                            <span><span class="label">Operator:</span> ${escapeHtml(printOperator)}</span>
                            <span><span class="label">Delivered By:</span> ${escapeHtml(printDeliveredBy)}</span>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>POS No</th>
                                    <th>Serial</th>
                                    <th>Area</th>
                                    <th>Issue</th>
                                </tr>
                            </thead>
                            <tbody>${rows}</tbody>
                        </table>
                        <div class="info-row" style="margin-top:12px;margin-bottom:0;">
                            <span><span class="label">Date Received:</span> ${escapeHtml(printDateReceived)}</span>
                            <span><span class="label">Received By:</span> ${escapeHtml(printReceivedBy)}</span>
                        </div>
                        <div class="address">
                            3F, VLC Tower 1, Business Park Pueblo de Oro<br />
                            Carmen, Cagayan de Oro City, 9000<br />
                            hexaprimeinc@gmail.com
                        </div>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
    };

    if (mode === "release") {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
                <div className="w-full max-w-5xl overflow-hidden rounded-xl border border-warm bg-white shadow-2xl">
                    <div className="flex flex-wrap items-center justify-between gap-4 px-8 py-6">
                        <h2 className="text-xl font-bold text-ink">POS Transmittal - For Release</h2>
                        <button onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-gray-100">
                            <X className="h-5 w-5 text-gray-500" />
                        </button>
                    </div>

                    <div className="space-y-5 px-8 pb-8">
                        <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
                            <label className="space-y-1 text-sm font-semibold text-ink-muted">
                                Billing Code {!isHexaItRepair && <span className="text-red-500">*</span>}
                                <input value={releaseBillingCode} onChange={(e) => setReleaseBillingCode(e.target.value)} placeholder={isHexaItRepair ? "Auto-generated for Hexa IT" : "BC-123"} className="h-11 w-full rounded-md border border-warm bg-white px-3 text-sm text-ink outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                                {isHexaItRepair && !billingCode && (
                                    <span className="block text-xs font-medium text-ink-muted">Leave blank to auto-generate a HEXA billing code.</span>
                                )}
                                {billingCode && !isBillingCodeValid && (
                                    <span className="block text-xs font-medium text-red-600">Billing Code must contain letters and numbers.</span>
                                )}
                                {checkingBillingCode && (
                                    <span className="block text-xs font-medium text-ink-muted">Checking billing code...</span>
                                )}
                                {billingCodeLookupError && (
                                    <span className="block text-xs font-medium text-red-600">{billingCodeLookupError}</span>
                                )}
                                {!checkingBillingCode && billingCodeMatches.length > 0 && (
                                    <div className={`mt-2 rounded-md border px-3 py-2 text-xs ${hasBillingCodeOperatorConflict ? "border-red-200 bg-red-50 text-red-700" : "border-blue-100 bg-blue-50 text-blue-800"}`}>
                                        <p className="font-bold">Existing POS under {billingCode}</p>
                                        <div className="mt-1 space-y-1 font-medium">
                                            {billingCodeMatches.map((item) => (
                                                <p key={item.id}>
                                                    POS {item.device_no || "-"} / {item.serial_number || "-"} - {item.operator_name || "Unknown operator"}
                                                </p>
                                            ))}
                                        </div>
                                        {hasBillingCodeOperatorConflict && (
                                            <p className="mt-1 font-semibold">This billing code is assigned to a different operator.</p>
                                        )}
                                    </div>
                                )}
                            </label>
                            <label className="space-y-1 text-sm font-semibold text-ink-muted">
                                Received By <span className="text-red-500">*</span>
                                <input value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} list="release-received-by-options" placeholder="Name" className="h-11 w-full rounded-md border border-warm bg-white px-3 text-sm text-ink outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                                <datalist id="release-received-by-options">
                                    {receivedByOptions.map((option) => (
                                        <option key={option.received_by} value={option.received_by}>
                                            Used {option.usage_count} time{option.usage_count === 1 ? "" : "s"}
                                        </option>
                                    ))}
                                </datalist>
                            </label>
                        </div>

                        <div className="overflow-hidden rounded-lg border border-warm">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-warm bg-gray-100 text-xs font-bold uppercase tracking-wider text-ink">
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3">POS</th>
                                        <th className="px-4 py-3">Serial</th>
                                        <th className="px-4 py-3">Area</th>
                                        <th className="px-4 py-3">Operator</th>
                                        <th className="px-4 py-3">Repaired By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {releaseRecords.map((item) => (
                                        <tr key={item.id} className="border-b border-warm/70 last:border-b-0">
                                            <td className="px-4 py-3 text-center">{formatDateNumeric(item.date)}</td>
                                            <td className="px-4 py-3 text-center font-medium">{item.device_no || "-"}</td>
                                            <td className="px-4 py-3 text-center">{item.serial_number || "-"}</td>
                                            <td className="px-4 py-3 text-center">{item.area || "-"}</td>
                                            <td className="px-4 py-3 text-center">{item.operator_name || "-"}</td>
                                            <td className="px-4 py-3 text-center">{item.repaired_by || "-"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                            <p className="text-sm font-medium text-ink-muted">Selected: {releaseRecords.length}</p>
                            <div className="flex gap-3">
                                <button onClick={onClose} className="rounded-lg bg-gray-100 px-6 py-2.5 text-sm font-semibold text-ink transition hover:bg-gray-200">
                                    Cancel
                                </button>
                                <button onClick={() => setShowConfirm(true)} disabled={!canProceedRelease} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300">
                                    <ChevronDown className="h-4 w-4" />
                                    Print Transmittal
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {showConfirm && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
                        <div className="w-full max-w-lg rounded-xl bg-white p-8 shadow-2xl">
                            <h3 className="mb-5 text-xl font-bold text-ink">Confirm POS Transmittal</h3>
                            <div className="mb-5 overflow-hidden rounded-lg border border-warm">
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
                                        {releaseRecords.map((item) => (
                                            <tr key={item.id}>
                                                <td className="px-4 py-3">{item.device_no || "-"}</td>
                                                <td className="px-4 py-3">{item.serial_number || "-"}</td>
                                                <td className="px-4 py-3">{item.area || "-"}</td>
                                                <td className="px-4 py-3">{item.operator_name || "-"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="space-y-2 text-sm text-ink">
                                <p><span className="font-bold">Received By:</span> {receivedBy}</p>
                                <p><span className="font-bold">Billing Code:</span> {billingCode}</p>
                            </div>
                            <div className="mt-6 flex justify-end gap-3">
                                <button onClick={() => setShowConfirm(false)} className="rounded-lg bg-gray-100 px-6 py-2.5 text-sm font-semibold text-ink transition hover:bg-gray-200">Cancel</button>
                                <button onClick={handleConfirmRelease} className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">Confirm</button>
                            </div>
                        </div>
                    </div>
                )}

                {showReleasePreview && releaseRecord && (
                    <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/45 px-4 py-8 backdrop-blur-sm">
                        <style>{`
                            @media print {
                                body * { visibility: hidden; }
                                #release-transmittal-print, #release-transmittal-print * { visibility: visible; }
                                #release-transmittal-print {
                                    position: absolute;
                                    left: 0;
                                    right: 0;
                                    top: 0;
                                    width: 7.25in;
                                    margin: 0 auto;
                                    transform: none;
                                    box-shadow: none !important;
                                }
                                .release-copy {
                                    height: 5.13in !important;
                                    min-height: 5.13in !important;
                                    border: 1px solid #111827 !important;
                                    page-break-inside: avoid;
                                    overflow: hidden;
                                }
                                .release-copy + .release-copy { margin-top: 0.04in; }
                                .release-copy-content {
                                    height: 5.13in !important;
                                    min-height: 5.13in !important;
                                }
                                .release-copy table th,
                                .release-copy table td {
                                    border-color: #9ca3af !important;
                                }
                                .release-print-actions { display: none !important; }
                                @page { size: A4; margin: 0.3in; }
                            }
                        `}</style>
                        <div className="mx-auto max-w-[8.27in] bg-white p-3 shadow-2xl">
                            <div id="release-transmittal-print" className="mx-auto w-[7.25in] bg-white text-black">
                                {["ORIGINAL COPY", "COPY OF ORIGINAL"].map((copyLabel) => (
                                    <div key={copyLabel} className="release-copy relative flex min-h-[5.13in] flex-col border border-gray-400 bg-white">
                                        <img src={logoOnly} className="pointer-events-none absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2 object-contain opacity-10" />
                                        <div className="release-copy-content relative z-10 flex min-h-[5.13in] flex-col">
                                            <p className="px-2 pt-1 text-sm">{copyLabel}</p>
                                            <div className="flex items-center justify-center gap-3 border-b border-gray-400 pb-2 pt-2">
                                                <img src={logoOnly} className="h-6 w-6 object-contain" />
                                                <h1 className="text-lg font-bold">HEXAPRIME INC.</h1>
                                            </div>
                                            <div className="py-2 text-center">
                                                <h2 className="text-base font-bold">POS TRANSMITTAL FORM</h2>
                                                <p className="text-xs italic">(Repaired POS Released)</p>
                                            </div>
                                            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-8 px-2 pb-3 text-xs">
                                                <div className="min-w-0">
                                                    <p><span className="font-bold">OPERATORS CODE:</span> {releaseRecord.operator_name || "-"}</p>
                                                    <p><span className="font-bold">AREA:</span> {releaseRecord.area || "-"}</p>
                                                </div>
                                                <div className="w-[2.35in] justify-self-end pr-2 text-left">
                                                    <p className="break-words"><span className="font-bold">BILLING CODE:</span> {billingCode}</p>
                                                    <p className="break-words"><span className="font-bold">TOTAL # OF POS RELEASED:</span> {releaseRecords.length} Unit/s</p>
                                                </div>
                                            </div>
                                            <table className="w-full border-collapse text-xs">
                                                <thead>
                                                    <tr>
                                                        <th className="border border-gray-300 px-2 py-1.5">BILLING #</th>
                                                        <th className="border border-gray-300 px-2 py-1.5">SERIAL NO.</th>
                                                        <th className="border border-gray-300 px-2 py-1.5">POS NO.</th>
                                                        <th className="border border-gray-300 px-2 py-1.5">REMARKS</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {releaseRecords.map((item) => (
                                                        <tr key={`${copyLabel}-${item.id}`}>
                                                            <td className="border border-gray-300 px-2 py-1.5 text-center">{billingCode}</td>
                                                            <td className="border border-gray-300 px-2 py-1.5 text-center">{item.serial_number || "-"}</td>
                                                            <td className="border border-gray-300 px-2 py-1.5 text-center">{item.device_no || "-"}</td>
                                                            <td className="border border-gray-300 px-2 py-1.5 text-center">{item.remarks || "-"}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            <div className="mt-auto grid grid-cols-2 gap-16 px-16 pb-4 pt-4 text-xs">
                                                <div className="mx-auto w-full max-w-[2.6in]">
                                                    <div className="grid grid-cols-[max-content_minmax(0,1fr)] items-end gap-x-2 gap-y-0">
                                                        <span>Issued by:</span>
                                                        <span className="block h-px border-t border-black" />
                                                        <span />
                                                        <div className="text-center font-bold uppercase leading-tight">{releaseIssuedBy}</div>
                                                        <span />
                                                        <p className="-mt-0.5 text-center leading-tight">Date Released: {releaseDate}</p>
                                                    </div>
                                                </div>
                                                <div className="mx-auto w-full max-w-[2.6in]">
                                                    <div className="grid grid-cols-[max-content_minmax(0,1fr)] items-end gap-x-2 gap-y-0">
                                                        <span>Received by:</span>
                                                        <span className="block h-px border-t border-black" />
                                                        <span />
                                                        <div className="text-center font-bold uppercase leading-tight break-words">{receivedBy}</div>
                                                        <span />
                                                        <p className="-mt-0.5 text-center leading-tight">Date Received: {releaseDate}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="border-t border-black py-2 text-center text-[11px] leading-snug text-slate-700">
                                                3F VLC Tower 1 Pueblo de Oro Business Park,<br />
                                                Upper Carmen, Cagayan de Oro 9000<br />
                                                hexaprimeinc@gmail.com
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="release-print-actions mt-6 flex justify-end gap-3">
                                <button onClick={onClose} className="rounded-md bg-gray-200 px-5 py-2.5 font-semibold text-ink transition hover:bg-gray-300">Close</button>
                                {savedRelease ? (
                                    <button onClick={printReleasePreview} className="inline-flex items-center gap-2 rounded-md bg-green-600 px-5 py-2.5 font-semibold text-white transition hover:bg-green-700">
                                        <Printer className="h-4 w-4" />
                                        Print
                                    </button>
                                ) : (
                                    <button onClick={handleSaveRelease} disabled={savingRelease} className="rounded-md bg-green-600 px-5 py-2.5 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300">
                                        {savingRelease ? "Saving..." : "Save"}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
            <div className="w-full max-w-3xl overflow-hidden rounded-md border border-warm bg-white shadow-2xl">
                <div className="flex items-center justify-between px-6 py-5">
                    <h2 className="text-lg font-bold text-ink">Repair Transmittal - For Repair</h2>
                    <button onClick={handleClose} className="rounded-lg p-1.5 transition-colors hover:bg-gray-100">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>
                <div className="space-y-4 px-6 pb-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <p className="text-sm font-semibold text-ink-muted">Total POS: {selectedRecords.length}</p>
                        <label className="flex items-center gap-3 text-sm font-semibold text-ink-muted">
                            Operator:
                            <select value={operatorFilter || "All"} onChange={(e) => setOperatorFilter(e.target.value)} className="rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink">
                                {operatorOptions.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-warm">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-warm bg-cream text-xs font-bold uppercase tracking-wider text-ink">
                                    <th className="w-12 px-3 py-3 text-center">
                                        <input type="checkbox" checked={filteredRecords.length > 0 && selectedRecords.length === filteredRecords.length} onChange={(e) => toggleAll(e.target.checked)} />
                                    </th>
                                    <th className="px-4 py-3">Date Received</th>
                                    <th className="px-4 py-3">Operator</th>
                                    <th className="px-4 py-3">POS No.</th>
                                    <th className="px-4 py-3">Serial</th>
                                    <th className="px-4 py-3">Area</th>
                                    <th className="px-4 py-3">Issue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecords.map((item) => (
                                    <tr key={item.id} className="border-b border-warm/70 last:border-b-0">
                                        <td className="px-3 py-3 text-center">
                                            <input type="checkbox" checked={selectedIds.has(item.id)} onChange={(e) => toggleRecord(item.id, e.target.checked)} />
                                        </td>
                                        <td className="px-4 py-3 text-center">{formatDateNumeric(item.date)}</td>
                                        <td className="px-4 py-3 text-center">{item.operator_name || "-"}</td>
                                        <td className="px-4 py-3 text-center">{item.device_no || "-"}</td>
                                        <td className="px-4 py-3 text-center">{item.serial_number || "-"}</td>
                                        <td className="px-4 py-3 text-center">{item.area || "-"}</td>
                                        <td className="px-4 py-3 text-center">{item.diagnosis_name || "-"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {selectedOperatorConflict && (
                        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            Selected records must all belong to the same operator.
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-1">
                        <button onClick={handleClose} className="rounded-lg bg-gray-200 px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-gray-300">
                            Close
                        </button>
                        <button onClick={handlePrint} disabled={!canPrint} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500">
                            Print Repair Transmittal
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
