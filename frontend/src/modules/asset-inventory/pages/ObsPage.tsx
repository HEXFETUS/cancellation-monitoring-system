import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
    type AssetCode,
    type AssetCodeInput,
    createAssetCode,
    deleteAssetCode,
    listAssetCodes,
    updateAssetCode,
} from "../services/assetCodes";
import SimpleAssetCodeFormModal from "../components/SimpleAssetCodeFormModal";
import ConfirmationModal from "../../../shared/components/ConfirmationModal";
import { useCanDelete } from "../hooks/useCanDelete";

export default function ObsPage() {
    const [items, setItems] = useState<AssetCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<AssetCode | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<AssetCode | null>(null);
    const [deleting, setDeleting] = useState(false);
    const canDelete = useCanDelete();

    const refresh = async () => {
        try {
            setLoading(true);
            setError("");
            const codes = await listAssetCodes("OBS");
            setItems(codes);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not load OBS asset codes");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return items;
        return items.filter((it) =>
            [it.itemCode, it.description, it.type, it.department, it.careOf, it.space]
                .join(" ")
                .toLowerCase()
                .includes(q)
        );
    }, [items, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginated = useMemo(
        () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
        [filtered, safePage]
    );

    const handleAdd = () => {
        setEditing(null);
        setFormOpen(true);
    };
    const handleEdit = (row: AssetCode) => {
        setEditing(row);
        setFormOpen(true);
    };
    const handleDeleteClick = (row: AssetCode) => {
        setDeleteTarget(row);
    };
    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await deleteAssetCode(deleteTarget.id);
            setDeleteTarget(null);
            await refresh();
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e));
        } finally {
            setDeleting(false);
        }
    };
    const handleSubmit = async (input: AssetCodeInput) => {
        if (editing) await updateAssetCode(editing.id, input);
        else await createAssetCode(input);
        await refresh();
    };

    return (
        <div>
            {/* Header */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
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
                            placeholder="Search OBS asset codes..."
                            className="w-full rounded-lg border border-warm dark:border-gray-700 bg-card dark:bg-gray-800/70 pl-9 pr-3 py-2 text-sm text-ink dark:text-gray-100 placeholder:text-ink-subtle dark:placeholder:text-gray-400 focus:border-teal dark:focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal dark:focus:ring-teal/50"
                        />
                    </div>
                    <button
                        onClick={handleAdd}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-teal-dark"
                    >
                        <Plus size={16} />
                        Add Asset
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-warm bg-card shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-warm bg-cream">
                            <Th>Item Code</Th>
                            <Th>Description</Th>
                            <Th>Type</Th>
                            <Th>Department</Th>
                            <Th>Care Of</Th>
                            <Th>Space</Th>
                            <Th align="right">Actions</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-10 text-center text-ink-subtle">
                                    Loading OBS asset codes...
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-10 text-center text-ink-subtle">
                                    {items.length === 0
                                        ? 'No OBS asset codes found. Asset codes with "OBS" in the department field will appear here.'
                                        : "No OBS asset codes match your search."}
                                </td>
                            </tr>
                        ) : (
                            paginated.map((row) => (
                                <tr
                                    key={row.id}
                                    className="border-b border-warm/60 transition hover:bg-cream"
                                >
                                    <Td className="font-medium text-ink">{row.itemCode}</Td>
                                    <Td className="whitespace-normal max-w-xs">{row.description}</Td>
                                    <Td>
                                        {row.type ? (
                                            <span className="inline-block rounded-full border border-teal/30 bg-teal-light/40 px-2.5 py-0.5 text-xs font-medium text-ink">
                                                {row.type}
                                            </span>
                                        ) : (
                                            <span className="text-ink-subtle">&mdash;</span>
                                        )}
                                    </Td>
                                    <Td className="text-ink-muted">{row.department || "—"}</Td>
                                    <Td className="text-ink-muted">{row.careOf || "—"}</Td>
                                    <Td className="text-ink-muted">{row.space || "—"}</Td>
                                    <Td align="right">
                                        <div className="flex justify-end gap-1.5">
                                            <button
                                                onClick={() => handleEdit(row)}
                                                className="inline-flex items-center gap-1 rounded-lg bg-teal px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-teal-dark"
                                            >
                                                <Pencil size={14} />
                                                Edit
                                            </button>
                                            {canDelete && (
                                            <button
                                                onClick={() => handleDeleteClick(row)}
                                                className="inline-flex items-center gap-1 rounded-lg bg-rose px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-rose-dark"
                                            >
                                                    <Trash2 size={14} />
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </Td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

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

            <SimpleAssetCodeFormModal
                open={formOpen}
                initial={editing}
                onClose={() => setFormOpen(false)}
                onSubmit={handleSubmit}
            />

            <ConfirmationModal
                open={!!deleteTarget}
                variant="delete"
                title="Delete Asset Code"
                message={`Are you sure you want to delete "${deleteTarget?.itemCode}"? This cannot be undone.`}
                confirmLabel="Yes, Delete"
                cancelLabel="Cancel"
                isLoading={deleting}
                loadingLabel="Deleting..."
                onCancel={() => setDeleteTarget(null)}
                onConfirm={handleDeleteConfirm}
            />
        </div>
    );
}

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
            className={`whitespace-nowrap px-4 py-3 ${align === "right" ? "text-right" : ""} ${className}`}
        >
            {children}
        </td>
    );
}