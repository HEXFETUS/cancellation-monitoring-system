import { useEffect, useMemo, useState } from "react";
import { Plus, QrCode, ScanLine, Search } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
    type AssetCode,
    type AssetCodeInput,
    createAssetCode,
    listAssetCodes,
    updateAssetCode,
} from "../services/assetCodes";
import AssetCodeFormModal from "../components/AssetCodeFormModal";
import QrPreviewModal from "../components/QrPreviewModal";
import QrScannerModal from "../components/QrScannerModal";
import { listAllAssets, type AssetLocation } from "../services";
import {
    listPayoutStations,
    type PayoutStation,
} from "../services/payoutStations";
import {
    listOfficeDepartments,
    type OfficeDepartment,
} from "../services/officeDepartments";
import { useAuth } from "../../../context/AuthContext";
import type { AssetRow } from "../components/AssetTable";

type AssetWithLocation = AssetRow & { location: AssetLocation };

export default function AssetCodingPage() {
    const [items, setItems] = useState<AssetCode[]>([]);
    const [assets, setAssets] = useState<AssetWithLocation[]>([]);
    const [stations, setStations] = useState<PayoutStation[]>([]);
    const [departments, setDepartments] = useState<OfficeDepartment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 20;

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<AssetCode | null>(null);
    const [qrOpen, setQrOpen] = useState(false);
    const [qrCode, setQrCode] = useState<AssetCode | null>(null);
    const [scannerOpen, setScannerOpen] = useState(false);
    const { user } = useAuth();
    // Purchasers explicitly need the scanner; admins get it too so they can
    // verify printed stickers without leaving the page.
    const canScan = user?.usertype === "purchaser" || user?.usertype === "admin";

    const refresh = async () => {
        try {
            setLoading(true);
            setError("");
            const [codes, allAssets, allStations, allDepartments] = await Promise.all([
                listAssetCodes(),
                listAllAssets(),
                listPayoutStations(),
                listOfficeDepartments(),
            ]);
            setItems(codes);
            setAssets(allAssets);
            setStations(allStations);
            setDepartments(allDepartments);
        } catch (e) {
            setError(e instanceof Error ? (e instanceof Error ? e.message : String(e)) : "Could not load asset codes");
        } finally {
            setLoading(false);
        }
    };

    /**
     * Department column on the Asset Coding table.
     * Shows the friendly name (e.g. "Information Technology", "Nazareth Outlet")
     * looked up from the asset's linked department/station so it stays in sync
     * with the Office and Payout asset tables.
     */
    const departmentLabel = (row: AssetCode): string => {
        return departmentInfo(row).name;
    };

    /**
     * Same lookup as departmentLabel but also returns a "kind" tag so the cell
     * can show a badge ("Department" / "Station") next to the name.
     */
    const departmentInfo = (
        row: AssetCode
    ): { name: string; kind: "department" | "station" | "" } => {
        const linked = row.assetId ? assets.find((a) => a.id === row.assetId) : null;

        if (linked?.location === "payout") {
            const station = stations.find((s) => s.id === linked.payoutStationId);
            const name =
                station?.name || linked.space?.trim() || row.space?.trim() || "";
            return { name: name || "—", kind: name ? "station" : "" };
        }

        if (linked?.location === "office") {
            const dept = departments.find((d) => d.id === linked.officeDepartmentId);
            const name = dept?.name || linked.department?.trim() || "";
            return { name: name || "—", kind: name ? "department" : "" };
        }

        const fallback = (linked?.department || row.department || "").trim();
        return { name: fallback || "—", kind: "" };
    };

    useEffect(() => {
        refresh();
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return items;
        return items.filter((it) =>
            [
                it.itemCode,
                it.description,
                it.type,
                it.careOf,
                it.space,
                it.qrPayload,
                departmentLabel(it),
            ]
                .join(" ")
                .toLowerCase()
                .includes(q)
        );
        // departmentLabel depends on `assets`, which is captured in closure.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, search, assets]);

    // Reset to page 1 whenever the search or items change
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
                            placeholder="Search asset codes..."
                            className="w-full rounded-lg border border-warm dark:border-gray-700 bg-card dark:bg-gray-800/70 pl-9 pr-3 py-2 text-sm text-ink dark:text-gray-100 placeholder:text-ink-subtle dark:placeholder:text-gray-400 focus:border-teal dark:focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal dark:focus:ring-teal/50"
                        />
                    </div>
                    {canScan && (
                        <button
                            onClick={() => setScannerOpen(true)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-teal bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-teal/10"
                            title="Scan an asset's QR code with the camera"
                        >
                            <ScanLine size={16} />
                            Scan QR
                        </button>
                    )}
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
                            <Th>Department / Station</Th>
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
                                        ? `No asset codes yet. Click "Add Asset Code" to create one.`
                                        : "No asset codes match your search."}
                                </td>
                            </tr>
                        ) : (
                            paginated.map((row) => (
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
                                    <Td className="text-ink-muted">
                                        {(() => {
                                            const info = departmentInfo(row);
                                            if (!info.kind) return info.name;
                                            return (
                                                <span className="text-ink">
                                                    {info.name} -{" "}
                                                    <span className="text-ink-muted">
                                                        {info.kind === "station" ? "Station" : "Department"}
                                                    </span>
                                                </span>
                                            );
                                        })()}
                                    </Td>
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
                        // Show pages around the current page
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

            <QrScannerModal
                open={scannerOpen}
                onClose={() => setScannerOpen(false)}
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