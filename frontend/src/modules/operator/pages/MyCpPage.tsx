import { useEffect, useMemo, useState } from "react";
import { Edit } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { Pagination } from "../../../shared/components";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

interface CellphoneRecord {
    id: number;
    brand: string;
    model: string;
    specs: string;
    serial_number: string;
    imei1: string | null;
    imei2: string | null;
    control_no: string;
    operator_id: number | null;
    added_by_user_id: number | null;
    created_at: string;
    updated_at: string;
}

interface Me {
    id: number;
    operator_id: number | null;
    parent_operator_id: number | null;
}

interface MyCpPageProps {
    searchQuery?: string;
    refreshKey?: number;
}

const PAGE_SIZE = 20;

export default function MyCpPage({ searchQuery: externalSearch = "", refreshKey = 0 }: MyCpPageProps = {}) {
    const { user } = useAuth();
    const [me, setMe] = useState<Me | null>(null);
    const [records, setRecords] = useState<CellphoneRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);

    const searchQuery = externalSearch;

    // Reset to page 1 when search changes
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPage(1);
    }, [searchQuery]);

    // Fetch user info
    useEffect(() => {
        if (!user?.id) return;
        fetch(`${API_BASE_URL}/api/users/me?id=${user.id}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                setMe(data ? { id: data.id, operator_id: data.operator_id ?? null, parent_operator_id: data.parent_operator_id ?? null } : null);
            })
            .catch(() => setMe(null));
    }, [user]);

    // Fetch cellphone records
    useEffect(() => {
        if (!me?.operator_id) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLoading(false);
            return;
        }
        let cancelled = false;
        const load = async () => {
            try {
                setLoading(true);
                setError("");
                const res = await fetch(`${API_BASE_URL}/api/cellphones?operator_id=${me.operator_id}`);
                if (!res.ok) throw new Error("Failed to fetch cellphones");
                const data = await res.json();
                if (!cancelled) setRecords(data);
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [me, refreshKey]);

    const filteredRecords = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return records;
        return records.filter(
            (r) =>
                (r.brand || "").toLowerCase().includes(q) ||
                (r.model || "").toLowerCase().includes(q) ||
                (r.serial_number || "").toLowerCase().includes(q) ||
                (r.control_no || "").toLowerCase().includes(q) ||
                (r.imei1 || "").toLowerCase().includes(q) ||
                (r.imei2 || "").toLowerCase().includes(q)
        );
    }, [records, searchQuery]);

    // Pagination computations
    const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginatedRecords = filteredRecords.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    return (
        <div className="w-full max-w-full space-y-5">
            {error && (
                <div className="relative rounded-xl border border-red-200/60 bg-red-50/95 backdrop-blur-xl px-4 py-3 text-sm font-medium text-red-700 shadow-lg">
                    {error}
                </div>
            )}

            {/* Table Card */}
            <div className="relative rounded-2xl border border-white/50 backdrop-blur-xl bg-white/25 shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
<tr className="border-b border-white/40 bg-linear-to-r from-teal/10 to-teal-light/10">
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Brand</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Model</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Specs</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Serial No.</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">IMEI1</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">IMEI2</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Control No.</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Date Added</th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-500">Loading...</td></tr>
                            ) : filteredRecords.length === 0 ? (
                                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                                    {records.length === 0 ? "No cellphone records yet." : "No records match your search."}
                                </td></tr>
                            ) : (
                                paginatedRecords.map((rec) => (
                                    <tr key={rec.id} className="border-b border-white/30 transition hover:bg-teal/8">
                                        <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-800">{rec.brand}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">{rec.model}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-gray-500">{rec.specs}</td>
                                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-500">{rec.serial_number}</td>
                                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-500">{rec.imei1 || "—"}</td>
                                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-500">{rec.imei2 || "—"}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">{rec.control_no}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                                            {new Date(rec.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3">
                                            <button
                                                title="Edit"
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-all duration-200 hover:bg-teal/20 hover:text-teal"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && filteredRecords.length > 0 && (
                    <Pagination
                        currentPage={safePage}
                        totalPages={totalPages}
                        totalItems={filteredRecords.length}
                        onPageChange={setPage}
                        pageSize={PAGE_SIZE}
                    />
                )}
            </div>
        </div>
    );
}