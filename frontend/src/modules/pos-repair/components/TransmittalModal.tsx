import { useMemo, useState } from "react";
import { X } from "lucide-react";
import logoOnly from "../../../assets/LogoOnly.webp";
import logoWithName from "../../../assets/LogoWithName.webp";
import type { RepairRecord } from "../services/repairRecords";

interface TransmittalModalProps {
    record?: RepairRecord;
    records?: RepairRecord[];
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

export default function TransmittalModal({ record, records: recordsProp, onClose }: TransmittalModalProps) {
    const [filterBy, setFilterBy] = useState<"device" | "serial" | "operator" | "issue">("device");
    const [query, setQuery] = useState("");
    const [forwardedTo, setForwardedTo] = useState("");
    const records = useMemo(() => recordsProp ?? (record ? [record] : []), [record, recordsProp]);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set(records.map((item) => item.id)));
    const filteredRecords = records.filter((item) => {
        const search = query.trim().toLowerCase();
        if (!search) return true;
        const value =
            filterBy === "device"
                ? item.device_no
                : filterBy === "serial"
                    ? item.serial_number
                    : filterBy === "operator"
                        ? item.operator_name
                        : item.diagnosis_name;
        return (value || "").toLowerCase().includes(search);
    });
    const selectedRecords = filteredRecords.filter((item) => selectedIds.has(item.id));

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

    const handlePrint = () => {
        const rows = (selectedRecords.length > 0 ? selectedRecords : filteredRecords)
            .map((item) => `
                <tr>
                    <td>${escapeHtml(item.device_no || "-")}</td>
                    <td>${escapeHtml(item.serial_number || "-")}</td>
                    <td>${item.with_box ? "Yes" : "No"}</td>
                    <td>${escapeHtml(item.operator_name || "-")}</td>
                    <td>${escapeHtml(item.diagnosis_name || "-")}</td>
                </tr>
            `)
            .join("");

        const printWindow = window.open("", "_blank", "width=980,height=800");
        if (!printWindow) return;

        printWindow.document.write(`
            <!doctype html>
            <html>
                <head>
                    <title>Repair Transmittal</title>
                    <style>
                        * { box-sizing: border-box; }
                        body {
                            margin: 0;
                            background: #e5e7eb;
                            color: #000;
                            font-family: Arial, Helvetica, sans-serif;
                            font-size: 12px;
                        }
                        .preview-toolbar {
                            position: sticky;
                            top: 0;
                            z-index: 10;
                            display: flex;
                            justify-content: flex-end;
                            gap: 10px;
                            padding: 12px 18px;
                            background: #111827;
                            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
                        }
                        .preview-toolbar button {
                            min-width: 92px;
                            border: 0;
                            border-radius: 6px;
                            padding: 9px 14px;
                            font: 700 13px Arial, Helvetica, sans-serif;
                            cursor: pointer;
                        }
                        .preview-toolbar .close-btn {
                            background: #e5e7eb;
                            color: #111827;
                        }
                        .preview-toolbar .print-btn {
                            background: #16a34a;
                            color: #fff;
                        }
                        .page {
                            position: relative;
                            width: 8.5in;
                            min-height: 13in;
                            margin: 18px auto;
                            padding: 28px 52px;
                            overflow: hidden;
                            background: #fff;
                            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
                        }
                        .watermark {
                            position: absolute;
                            inset: 20px 0 0;
                            margin: auto;
                            width: 390px;
                            height: 390px;
                            object-fit: contain;
                            opacity: 0.11;
                            z-index: 0;
                        }
                        .content { position: relative; z-index: 1; }
                        .logo {
                            display: block;
                            height: 78px;
                            object-fit: contain;
                            margin: 0 auto 16px;
                        }
                        .rule {
                            border-top: 1px solid #000;
                            margin: 0 0 12px;
                        }
                        h1 {
                            text-align: center;
                            font-size: 16px;
                            margin: 10px 0 14px;
                            letter-spacing: 0.2px;
                        }
                        .meta {
                            display: grid;
                            grid-template-columns: 1fr 1fr 1fr;
                            align-items: center;
                            margin-bottom: 10px;
                            font-size: 13px;
                        }
                        .meta div:nth-child(2) { text-align: center; }
                        .meta div:nth-child(3) { text-align: right; }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            font-size: 12px;
                        }
                        th, td {
                            border: 1px solid #000;
                            padding: 7px 8px;
                            text-align: center;
                        }
                        th {
                            background: #f5f5f5;
                            font-weight: 700;
                        }
                        .footer-rule {
                            border-top: 1px solid #000;
                            margin-top: 8px;
                        }
                        .address {
                            margin-top: 10px;
                            text-align: center;
                            line-height: 1.35;
                            font-size: 12px;
                        }
                        @media print {
                            @page {
                                size: 8.5in 13in;
                                margin: 0.35in;
                            }
                            body { background: #fff; }
                            .preview-toolbar { display: none; }
                            .page {
                                width: auto;
                                min-height: auto;
                                margin: 0;
                                padding: 0;
                                box-shadow: none;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="preview-toolbar">
                        <button type="button" class="close-btn" onclick="window.close()">Close Preview</button>
                        <button type="button" class="print-btn" onclick="window.print()">Print</button>
                    </div>
                    <div class="page">
                        <img class="watermark" src="${logoOnly}" />
                        <div class="content">
                            <img class="logo" src="${logoWithName}" />
                            <div class="rule"></div>
                            <h1>POS REPAIR FORM / REPLACEMENT</h1>
                            <div class="meta">
                                <div>Date Forwarded: ${escapeHtml(formatDateNumeric(records[0]?.date || ""))}</div>
                                <div>Total of POS: ${selectedRecords.length || filteredRecords.length}</div>
                                <div>Forwarded to: ${escapeHtml(forwardedTo || "---")}</div>
                            </div>
                            <table>
                                <thead>
                                    <tr>
                                        <th>POS No.</th>
                                        <th>Serial Number</th>
                                        <th>Included with Box</th>
                                        <th>Operator</th>
                                        <th>Issue</th>
                                    </tr>
                                </thead>
                                <tbody>${rows}</tbody>
                            </table>
                            <div class="footer-rule"></div>
                            <div class="address">
                                3F, VLC Tower 1, Business Park Pueblo de Oro<br />
                                Carmen, Cagayan de Oro City, 9000<br />
                                hexaprimeinc@gmail.com
                            </div>
                        </div>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
            <div className="w-full max-w-3xl overflow-hidden rounded-md border border-warm bg-white shadow-2xl">
                <div className="flex items-center justify-between px-6 py-5">
                    <h2 className="text-lg font-bold text-ink">Repair Transmittal - Forwarded</h2>
                    <button onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-gray-100">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>
                <div className="space-y-4 px-6 pb-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <p className="text-sm font-semibold text-ink-muted">Total POS: {selectedRecords.length}</p>
                        <label className="flex items-center gap-3 text-sm font-semibold text-ink-muted">
                            Forwarded to:
                            <select value={forwardedTo} onChange={(e) => setForwardedTo(e.target.value)} className="rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink">
                                <option value="">Select a technician</option>
                                <option value="iFIX">iFIX</option>
                                <option value="DIGIFIX">DIGIFIX</option>
                                <option value="SUMNI">SUMNI</option>
                                <option value="TANGENT">TANGENT</option>
                                <option value="BMC">BMC</option>
                            </select>
                        </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink-muted">Filter by:</span>
                        <select value={filterBy} onChange={(e) => setFilterBy(e.target.value as typeof filterBy)} className="rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink">
                            <option value="device">POS No.</option>
                            <option value="serial">Serial Number</option>
                            <option value="operator">Operator</option>
                            <option value="issue">Issue</option>
                        </select>
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Enter search..." className="rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink" />
                    </div>

                    <div className="overflow-hidden rounded-lg border border-warm">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-warm bg-cream text-xs font-bold uppercase tracking-wider text-ink">
                                    <th className="w-12 px-3 py-3 text-center">
                                        <input type="checkbox" checked={filteredRecords.length > 0 && selectedRecords.length === filteredRecords.length} onChange={(e) => toggleAll(e.target.checked)} />
                                    </th>
                                    <th className="px-4 py-3">Device No.</th>
                                    <th className="px-4 py-3">Serial Number</th>
                                    <th className="px-4 py-3">Included (with box)</th>
                                    <th className="px-4 py-3">Operator</th>
                                    <th className="px-4 py-3">Issue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecords.map((item) => (
                                    <tr key={item.id} className="border-b border-warm/70 last:border-b-0">
                                        <td className="px-3 py-3 text-center">
                                            <input type="checkbox" checked={selectedIds.has(item.id)} onChange={(e) => toggleRecord(item.id, e.target.checked)} />
                                        </td>
                                        <td className="px-4 py-3 text-center">{item.device_no || "-"}</td>
                                        <td className="px-4 py-3 text-center">{item.serial_number || "-"}</td>
                                        <td className="px-4 py-3 text-center">{item.with_box ? "Yes" : "No"}</td>
                                        <td className="px-4 py-3 text-center">{item.operator_name || "-"}</td>
                                        <td className="px-4 py-3 text-center">{item.diagnosis_name || "-"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end gap-3 pt-1">
                        <button onClick={onClose} className="rounded-lg bg-gray-200 px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-gray-300">
                            Close
                        </button>
                        <button onClick={handlePrint} disabled={selectedRecords.length === 0} className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500">
                            Print Transmittal
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
