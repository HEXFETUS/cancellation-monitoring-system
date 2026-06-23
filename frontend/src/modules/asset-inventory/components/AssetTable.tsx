import { useEffect, useMemo, useState } from "react";
import { Eye, Plus, Search, Wallet } from "lucide-react";
import { Pagination } from "../../../shared/components";
import TruncatedDescription from "./TruncatedDescription";

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
    /** Called when the user clicks "View Details". */
    onViewDetails?: (row: AssetRow) => void;
    /** Optional extra buttons rendered next to "Add Asset" in the header. */
    extraHeaderActions?: React.ReactNode;
    /** Override the column header label for the `department` column. */
    departmentLabel?: string;
    /** Hide the internal search/action header (when they are moved to tabs row). */
    hideHeader?: boolean;
    /** External search value to use instead of the internal search bar. Works with hideHeader. */
    externalSearch?: string;
}

const PHP = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
});

export default function AssetTable({
    rows,
    loading = false,
    error = "",
    onAdd,
    onEdit,
    onDelete,
    onViewDetails,
    extraHeaderActions,
    departmentLabel = "Department",
    hideHeader = false,
    externalSearch,
}: AssetTableProps) {
    const [internalSearch, setInternalSearch] = useState("");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    // Use external search if provided, otherwise use internal state
    const effectiveSearch = externalSearch !== undefined ? externalSearch : internalSearch;

    const showActions = Boolean(onViewDetails || onEdit || onDelete);
    // Columns: Item Description, Department, Space, Qty, Discount, Asset Value, Total Value, Actions
    const colCount = 7 + (showActions ? 1 : 0);

    const filtered = useMemo(() => {
        const q = effectiveSearch.trim().toLowerCase();
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
    }, [rows, effectiveSearch]);

    // Reset to page 1 when search changes
    useEffect(() => {
        setPage(1);
    }, [effectiveSearch]);

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
            {/* Header - only show when not hidden */}
            {!hideHeader && (
                <div className="mb-6 flex flex-col gap-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                        <div className="relative w-full sm:w-72">
                            <Search
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle dark:text-gray-500"
                                size={16}
                            />
                            <input
                                type="text"
                                value={effectiveSearch}
                                onChange={(e) => setInternalSearch(e.target.value)}
                                placeholder="Search assets..."
                                className="w-full rounded-lg border border-warm dark:border-gray-700 bg-card dark:bg-gray-800/70 pl-8 pr-2.5 py-1.5 text-xs text-ink dark:text-gray-100 placeholder:text-ink-subtle dark:placeholder:text-gray-400 focus:border-teal dark:focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal dark:focus:ring-teal/50"
                            />
                        </div>

                        {onAdd && (
                            <button
                                onClick={onAdd}
                                className="inline-flex items-center justify-center gap-1 rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-teal-dark"
                            >
                                <Plus size={16} />
                                Add Asset
                            </button>
                        )}
                        {extraHeaderActions}
                    </div>
                </div>
            )}

            {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                </div>
            )}

            {filtered.length > 0 && !loading && (
                <div className="mb-3 flex items-center justify-between rounded-lg border border-warm bg-cream px-4 py-2.5">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                        <Wallet size={14} />
                        Grand Total
                    </span>
                    <span className="text-base font-bold text-teal">{PHP.format(grandTotal)}</span>
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-warm bg-card shadow-sm">
                <table className="w-full min-w-[1000px] text-sm">
                    <thead>
                        <tr className="border-b border-warm bg-cream">
                            <Th align="left" style={{ width: "28%" }}>Item Description</Th>
                            <Th align="center" style={{ width: "14%" }}>{departmentLabel}</Th>
                            <Th align="center" style={{ width: "12%" }}>Space</Th>
                            <Th align="center" style={{ width: "8%" }}>Qty</Th>
                            <Th align="center" style={{ width: "12%" }}>Discount</Th>
                            <Th align="center" style={{ width: "13%" }}>Asset Value</Th>
                            <Th align="center" style={{ width: "13%" }}>Total Value</Th>
                            {showActions && <Th align="center" style={{ width: "160px", minWidth: "160px" }}>Actions</Th>}
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
                                        ? 'No assets yet. Click "Add Asset" to create one.'
                                        : "No assets match your search."}
                                </td>
                            </tr>
                        ) : (
                            paginated.map((r) => (
                                <tr
                                    key={r.id}
                                    className="border-b border-warm/60 transition hover:bg-cream"
                                >
                                    <Td align="left" className="font-medium text-ink" style={{ whiteSpace: "normal", overflowWrap: "break-word", verticalAlign: "top" }}>
                                        <TruncatedDescription text={r.itemDescription} />
                                    </Td>
                                    <Td>{r.department || "—"}</Td>
                                    <Td>{r.space || "—"}</Td>
                                    <Td>{r.quantity}</Td>
                                    <Td>{PHP.format(r.discount)}</Td>
                                    <Td>{PHP.format(r.assetValue)}</Td>
                                    <Td className="font-semibold text-ink">
                                        {PHP.format(r.totalValue)}
                                    </Td>
                                    {showActions && (
                                        <Td>
                                            <div className="flex justify-center gap-2">
                                                {onViewDetails && (
                                                    <button
                                                        onClick={() => onViewDetails(r)}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-teal bg-card px-2.5 py-1 text-xs font-medium text-teal-dark transition hover:bg-teal-light/40"
                                                    >
                                                        <Eye size={14} />
                                                        View Details
                                                    </button>
                                                )}
                                            </div>
                                        </Td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                <Pagination
                    currentPage={safePage}
                    totalPages={totalPages}
                    totalItems={filtered.length}
                    onPageChange={setPage}
                    pageSize={PAGE_SIZE}
                />
            </div>
        </div>
    );
}

/* ---------------- helpers ---------------- */

function Th({
    children,
    align = "center",
    style,
}: {
    children: React.ReactNode;
    align?: "left" | "right" | "center";
    style?: React.CSSProperties;
}) {
    return (
        <th
            className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted ${
                align === "right" ? "text-right" : align === "left" ? "text-left" : "text-center"
            }`}
            style={style}
        >
            {children}
        </th>
    );
}

function Td({
    children,
    align = "center",
    className = "",
    style,
}: {
    children: React.ReactNode;
    align?: "left" | "right" | "center";
    className?: string;
    style?: React.CSSProperties;
}) {
    return (
        <td
            className={`whitespace-nowrap px-4 py-3 ${
                align === "right" ? "text-right" : align === "left" ? "text-left" : "text-center"
            } ${className}`}
            style={style}
        >
            {children}
        </td>
    );
}

