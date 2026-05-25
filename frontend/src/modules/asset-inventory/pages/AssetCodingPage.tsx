import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, QrCode, RefreshCw, Search, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
    type AssetCode,
    type AssetCodeInput,
    createAssetCode,
    deleteAssetCode,
    listAssetCodes,
    regenerateQr,
    updateAssetCode,
} from "../services/assetCodes";
import AssetCodeFormModal from "../components/AssetCodeFormModal";
import QrPreviewModal from "../components/QrPreviewModal";

export default function AssetCodingPage() {
    const [items, setItems] = useState<AssetCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<AssetCode | null>(null);
    const [qrOpen, setQrOpen] = useState(false);
    const [qrCode, setQrCode] = useState<AssetCode | null>(null);

    const refresh = async () => {
        try {
            setLoading(true);
            setError("");
            setItems(await listAssetCodes());
        } catch (e: any) {
            setError(e.message || "Could not load asset codes");
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
            [it.itemCode, it.description, it.type, it.department, it.careOf, it.space, it.qrPayload]
                .join(" ")
                .toLowerCase()
                .includes(q)
        );
    }, [items, search]);

    const handleAdd = () => {
        setEditing(null);
        setFormOpen(true);
    };
    const handleEdit = (row: AssetCode) => {
        setEditing(row);
        setFormOpen(true);
    };
    const handleDelete = async (row: AssetCode) => {
        if (!confirm(`Delete asset code "${row.itemCode}"? This cannot be undone.`)) return;
        try {
            await deleteAssetCode(row.id);
            await refresh();
        } catch (e: any) {
            alert(e.message);
        }
    };
    const handleRegenerate = async (row: AssetCode) => {
        if (!confirm(`Regenerate QR for "${row.itemCode}"? The old QR will stop working.`)) return;
        try {
            await regenerateQr(row.id);
            await refresh();
        } catch (e: any) {
            alert(e.message);
        }
    };
    const handleSubmit = async (input: AssetCodeInput) => {
        if (editing) await updateAssetCode(editing.id, input);
        else await createAssetCode(input);
        await refresh();
    };
    const handleViewQr = (row: AssetCode) => {
        setQrCode(row);
        setQrOpen(true);
    };

    return (
        <div>
            {/* Header */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-ink">Asset Coding</h1>
                    <p className="mt-1 text-sm text-ink-muted">
                        Master list of asset codes. Each row gets its own QR code.
                    </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative w-full sm:w-72">
                        <Search
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
                            size={16}
                        />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search asset codes..."
                            className="w-full rounded-lg border border-warm bg-card pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                        />
                    </div>
                    <button
                        onClick={handleAdd}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-teal-dark"
                    >
                        <Plus size={16} />
                        Add Asset Code
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
                            <Th>QR</Th>
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
                                <td colSpan={8} className="px-4 py-10 text-center text-ink-subtle">
                                    Loading asset codes...
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-10 text-center text-ink-subtle">
                                    {items.length === 0
                                        ? "No asset codes yet. Click \"Add Asset Code\" to create one."
                                        : "No asset codes match your search."}
                                </td>
                            </tr>
                        ) : (
                            filtered.map((row) => (
                                <tr
                                    key={row.id}
                                    className="border-b border-warm/60 transition hover:bg-cream"
                                >
                                    <Td>
                                        <button
                                            onClick={() => handleViewQr(row)}
                                            className="inline-block rounded-lg border border-warm bg-white p-1 transition hover:border-teal"
                                            title="View QR"
                                        >
                                            <QRCodeSVG value={row.qrPayload} size={48} level="M" marginSize={1} />
                                        </button>
                                    </Td>
                                    <Td className="font-medium text-ink">{row.itemCode}</Td>
                                    <Td>{row.description}</Td>
                                    <Td>
                                        {row.type ? (
                                            <span className="inline-block rounded-full border border-teal/30 bg-teal-light/40 px-2.5 py-0.5 text-xs font-medium text-ink">
                                                {row.type}
                                            </span>
                                        ) : (
                                            <span className="text-ink-subtle">—</span>
                                        )}
                                    </Td>
                                    <Td className="text-ink-muted">{row.department || "—"}</Td>
                                    <Td className="text-ink-muted">{row.careOf || "—"}</Td>
                                    <Td className="text-ink-muted">{row.space || "—"}</Td>
                                    <Td align="right">
                                        <div className="flex justify-end gap-1.5">
                                            <button
                                                onClick={() => handleViewQr(row)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-warm bg-card px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-warm/40"
                                                title="View QR code"
                                            >
                                                <QrCode size={14} />
                                                QR
                                            </button>
                                            <button
                                                onClick={() => handleEdit(row)}
                                                className="inline-flex items-center gap-1 rounded-lg bg-teal px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-teal-dark"
                                            >
                                                <Pencil size={14} />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleRegenerate(row)}
                                                className="inline-flex items-center gap-1 rounded-lg bg-peach px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-peach-dark"
                                                title="Regenerate QR payload"
                                            >
                                                <RefreshCw size={14} />
                                                Regen
                                            </button>
                                            <button
                                                onClick={() => handleDelete(row)}
                                                className="inline-flex items-center gap-1 rounded-lg bg-rose px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-rose-dark"
                                            >
                                                <Trash2 size={14} />
                                                Delete
                                            </button>
                                        </div>
                                    </Td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <p className="mt-3 text-xs text-ink-subtle">
                Showing {filtered.length} of {items.length} asset codes
            </p>

            <AssetCodeFormModal
                open={formOpen}
                initial={editing}
                onClose={() => setFormOpen(false)}
                onSubmit={handleSubmit}
            />

            <QrPreviewModal
                open={qrOpen}
                code={qrCode}
                onClose={() => setQrOpen(false)}
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
