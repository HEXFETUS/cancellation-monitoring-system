import { useEffect, useMemo, useState, forwardRef, useImperativeHandle } from "react";
import { Pencil, Trash2 } from "lucide-react";
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
import { Pagination } from "../../../shared/components";

const PAGE_SIZE = 20;

const ObsPage = forwardRef<{ refresh: () => void; handleAdd: () => void }, { externalSearch?: string }>(
    function ObsPage({ externalSearch = "" }, ref) {
        const [items, setItems] = useState<AssetCode[]>([]);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState("");
        const [page, setPage] = useState(1);

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

        useImperativeHandle(ref, () => ({ refresh, handleAdd }));

        const handleAdd = () => {
            setEditing(null);
            setFormOpen(true);
        };

        // Reset page when search changes
        useEffect(() => { setPage(1); }, [externalSearch]);

        const filtered = useMemo(() => {
            const q = externalSearch.trim().toLowerCase();
            if (!q) return items;
            return items.filter((it) =>
                [it.itemCode, it.description, it.type, it.department, it.careOf, it.space]
                    .join(" ")
                    .toLowerCase()
                    .includes(q)
            );
        }, [items, externalSearch]);

        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        const safePage = Math.min(page, totalPages);
        const paginated = useMemo(
            () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
            [filtered, safePage]
        );

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
                                                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-3 py-2 text-sm font-medium text-white transition hover:bg-teal-dark"
                                                    title="Edit asset code"
                                                >
                                                    <Pencil size={16} />
                                                    Edit
                                                </button>
                                                {canDelete && (
                                                    <button
                                                        onClick={() => handleDeleteClick(row)}
                                                        className="inline-flex items-center gap-1.5 rounded-lg bg-rose px-3 py-2 text-sm font-medium text-white transition hover:bg-rose-dark"
                                                        title="Delete asset code"
                                                    >
                                                        <Trash2 size={16} />
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

                    <Pagination
                        currentPage={safePage}
                        totalPages={totalPages}
                        totalItems={filtered.length}
                        onPageChange={setPage}
                        pageSize={PAGE_SIZE}
                    />
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
);

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

export default ObsPage;