import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";

export interface AssetRow {
    id: number | string;
    itemDescription: string;
    type: string;
    serialNumber: string;
    department: string;
    space: string;
    datePurchase: string;       // ISO date "YYYY-MM-DD"
    vendor: string;
    purchasePrice: number;      // per item
    warrantyDate: string;       // ISO date "YYYY-MM-DD"
    quantity: number;
    discount: number;           // amount, not percentage
    assetValue: number;         // per item, after discount
    totalValue: number;         // assetValue * quantity
    color: string;
    remarks?: string;
    payoutStationId?: number | null;
    officeDepartmentId?: number | null;
}

interface AssetTableProps {
    title: string;
    description?: string;
    rows: AssetRow[];
    loading?: boolean;
    error?: string;
    onAdd?: () => void;
    onEdit?: (row: AssetRow) => void;
    onDelete?: (row: AssetRow) => void;
    /** Optional extra buttons rendered next to "Add Asset" in the header. */
    extraHeaderActions?: React.ReactNode;
    /** Override the column header label for the `department` column. */
    departmentLabel?: string;
}

const PHP = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
});

function formatDate(iso: string) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
    });
}

export default function AssetTable({
    title,
    description,
    rows,
    loading = false,
    error = "",
    onAdd,
    onEdit,
    onDelete,
    extraHeaderActions,
    departmentLabel = "Department",
}: AssetTableProps) {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    const showActions = Boolean(onEdit || onDelete);
    const colCount = 15 + (showActions ? 1 : 0);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((r) =>
            [
                r.itemDescription,
                r.type,
                r.serialNumber,
                r.department,
                r.space,
                r.vendor,
                r.color,
                r.remarks ?? "",
            ]
                .join(" ")
                .toLowerCase()
                .includes(q)
        );
    }, [rows, search]);

    // Reset to page 1 when search changes
    useEffect(() => {
        setPage(1);
    }, [search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginated = useMemo(
        () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
        [filtered, safePage]
    );

    const grandTotal = useMemo(
        () => filtered.reduce((sum, r) => sum + (r.totalValue || 0), 0),
        [filtered]
    );

    return (
        <div>
            {/* Header */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-ink">{title}</h1>
                    {description && (
                        <p className="mt-1 text-sm text-ink-muted">{description}</p>
                    )}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative w-full sm:w-72">
                        <Search
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle dark:text-gray-500"
                            size={16}
                        />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search assets..."
                            className="w-full rounded-lg border border-warm dark:border-gray-700 bg-card dark:bg-gray-800/70 pl-9 pr-3 py-2 text-sm text-ink dark:text-gray-100 placeholder:text-ink-subtle dark:placeholder:text-gray-400 focus:border-teal dark:focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal dark:focus:ring-teal/50"
                        />
                    </div>

                    {onAdd && (
                        <button
                            onClick={onAdd}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-teal-dark"
                        >
                            <Plus size={16} />
                            Add Asset
                        </button>
                    )}
                    {extraHeaderActions}
                </div>
            </div>

            {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-warm bg-card shadow-sm">
<table className="w-full min-w-450 text-left text-sm">
                    <thead>
                        <tr className="border-b border-warm bg-cream">
                            <Th>Item Description</Th>
                            <Th>Type</Th>
                            <Th>Serial No.</Th>
                            <Th>{departmentLabel}</Th>
                            <Th>Space</Th>
                            <Th>Date Purchased</Th>
                            <Th>Vendor</Th>
                            <Th align="right">Purchase Price</Th>
                            <Th>Warranty Date</Th>
                            <Th align="right">Qty</Th>
                            <Th align="right">Discount</Th>
                            <Th align="right">Asset Value</Th>
                            <Th align="right">Total Value</Th>
                            <Th>Color</Th>
                            <Th>Remarks</Th>
                            {showActions && <Th align="right">Actions</Th>}
                        </tr>
                    </thead>

                    <tbody>
                        {loading ? (
                            <tr>
                                <td
                                    colSpan={colCount}
                                    className="px-4 py-10 text-center text-ink-subtle"
                                >
                                    Loading assets...
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={colCount}
                                    className="px-4 py-10 text-center text-ink-subtle"
                                >
                                    {rows.length === 0
                                        ? "No assets yet. Click \"Add Asset\" to create one."
                                        : "No assets match your search."}
                                </td>
                            </tr>
                        ) : (
                            paginated.map((r) => (
                                <tr
                                    key={r.id}
                                    className="border-b border-warm/60 transition hover:bg-cream"
                                >
                                    <Td className="font-medium text-ink">{r.itemDescription}</Td>
                                    <Td>
                                        {r.type ? (
                                            <span className="inline-block rounded-full border border-teal/30 bg-teal-light/40 px-2.5 py-0.5 text-xs font-medium text-ink">
                                                {r.type}
                                            </span>
                                        ) : (
                                            <span className="text-ink-subtle">—</span>
                                        )}
                                    </Td>
                                    <Td className="font-mono text-xs text-ink-muted">
                                        {r.serialNumber || "—"}
                                    </Td>
                                    <Td>{r.department || "—"}</Td>
                                    <Td>{r.space || "—"}</Td>
                                    <Td>{formatDate(r.datePurchase)}</Td>
                                    <Td>{r.vendor || "—"}</Td>
                                    <Td align="right">{PHP.format(r.purchasePrice)}</Td>
                                    <Td>{formatDate(r.warrantyDate)}</Td>
                                    <Td align="right">{r.quantity}</Td>
                                    <Td align="right">{PHP.format(r.discount)}</Td>
                                    <Td align="right">{PHP.format(r.assetValue)}</Td>
                                    <Td align="right" className="font-semibold text-ink">
                                        {PHP.format(r.totalValue)}
                                    </Td>
                                    <Td>
                                        {r.color ? <ColorChip color={r.color} /> : <span className="text-ink-subtle">—</span>}
                                    </Td>
                                    <Td className="text-ink-muted">{r.remarks || "—"}</Td>
                                    {showActions && (
                                        <Td align="right">
                                            <div className="flex justify-end gap-2">
                                                {onEdit && (
                                                    <button
                                                        onClick={() => onEdit(r)}
                                                        className="inline-flex items-center gap-1 rounded-lg bg-teal px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-teal-dark"
                                                    >
                                                        <Pencil size={14} />
                                                        Edit
                                                    </button>
                                                )}
                                                {onDelete && (
                                                    <button
                                                        onClick={() => onDelete(r)}
                                                        className="inline-flex items-center gap-1 rounded-lg bg-rose px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-rose-dark"
                                                    >
                                                        <Trash2 size={14} />
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </Td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>

                    {filtered.length > 0 && !loading && (
                        <tfoot>
                            <tr className="border-t-2 border-warm bg-cream">
                                <td
                                    colSpan={12}
                                    className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-muted"
                                >
                                    Grand Total
                                </td>
                                <td className="px-4 py-3 text-right text-base font-bold text-teal">
                                    {PHP.format(grandTotal)}
                                </td>
                                <td colSpan={showActions ? 3 : 2} />
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {/* Pagination Controls */}
            {filtered.length > 0 && !loading && (
                <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-xs text-ink-subtle">
                        Page {safePage} of {totalPages} &middot; {filtered.length} result{filtered.length === 1 ? "" : "s"}
                    </p>

                    <div className="flex items-center gap-1">
                        <button
                            disabled={safePage <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            className="rounded-lg border border-warm bg-card px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-warm/40 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Prev
                        </button>
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            const start = Math.max(1, safePage - 2);
                            const pageNum = start + i;
                            if (pageNum > totalPages) return null;
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => setPage(pageNum)}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${pageNum === safePage
                                        ? "bg-teal text-ink"
                                        : "border border-warm bg-card text-ink hover:bg-warm/40"
                                    }`}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                        <button
                            disabled={safePage >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            className="rounded-lg border border-warm bg-card px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-warm/40 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ---------------- helpers ---------------- */

function Th({
    children,
    align = "left",
}: {
    children: React.ReactNode;
    align?: "left" | "right";
}) {
    return (
        <th
            className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted ${align === "right" ? "text-right" : ""
                }`}
        >
            {children}
        </th>
    );
}

function Td({
    children,
    align = "left",
    className = "",
}: {
    children: React.ReactNode;
    align?: "left" | "right";
    className?: string;
}) {
    return (
        <td
            className={`whitespace-nowrap px-4 py-3 ${align === "right" ? "text-right" : ""
                } ${className}`}
        >
            {children}
        </td>
    );
}

function ColorChip({ color }: { color: string }) {
    return (
        <span className="inline-flex items-center gap-2">
            <span
                className="inline-block h-3.5 w-3.5 rounded-full border border-warm"
                style={{ backgroundColor: color }}
                aria-hidden
            />
            <span className="text-xs text-ink-muted">{color}</span>
        </span>
    );
}
