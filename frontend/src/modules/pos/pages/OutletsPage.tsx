import { useState, useEffect, useMemo, useRef } from "react";
import { Search, Plus, List, Edit, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import type { BoothInfo, OperatorInfo } from "../types";
import { createBoothInfo, createOperator, fetchBoothInfo, fetchOperators, updateBoothInfo } from "../services";
import { ConfirmationModal, EditModal } from "../components";
import { Toast } from "../../../shared/components";

const ROWS_PER_PAGE = 20;

function SummaryRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
    return (
        <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">{label}</span>
            <span className={`text-sm font-semibold ${valueColor || "text-ink"}`}>{value}</span>
        </div>
    );
}

export default function OutletsPage() {
    const { user } = useAuth();
    const [records, setRecords] = useState<BoothInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    const loadRecords = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchBoothInfo();
            setRecords(
                data
                    .filter((record) => record.booth_code?.trim())
                    .sort((a, b) => a.booth_code.localeCompare(b.booth_code, undefined, { numeric: true }))
            );
        } catch (err) {
            setError(err instanceof Error ? (err instanceof Error ? err.message : String(err)) : "Failed to load records");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRecords();
    }, []);

    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    const filteredRecords = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return records;

        return records.filter(record => {
            return (
                (record.operator?.toLowerCase() || "").includes(query) ||
                (record.booth_code?.toLowerCase() || "").includes(query) ||
                (record.coordinate?.toLowerCase() || "").includes(query) ||
                (record.booth_location?.toLowerCase() || "").includes(query)
            );
        });
    }, [records, searchQuery]);

    // Paginated slice
    const totalPages = Math.max(1, Math.ceil(filteredRecords.length / ROWS_PER_PAGE));
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * ROWS_PER_PAGE;
        return filteredRecords.slice(start, start + ROWS_PER_PAGE);
    }, [filteredRecords, currentPage]);

    // Pagination: show up to 10 page buttons centered around the current page
    const visiblePages = useMemo(() => {
        const MAX_VISIBLE = 10;
        let start = Math.max(1, currentPage - Math.floor(MAX_VISIBLE / 2));
        const end = Math.min(totalPages, start + MAX_VISIBLE - 1);
        if (end - start + 1 < MAX_VISIBLE) {
            start = Math.max(1, end - MAX_VISIBLE + 1);
        }
        const pages: number[] = [];
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages;
    }, [currentPage, totalPages]);

    const goFirstPage = () => {
        setCurrentPage(1);
    };

    const goLastPage = () => {
        setCurrentPage(totalPages);
    };

    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("");

    const showToast = (message: string) => {
        setToastMessage(message);
        setToastOpen(true);
    };

    // ── Edit Booth Modal state ──
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        id: 0,
        operator: "",
        operator_id: null as number | null,
        booth_code: "",
        coordinate: "",
        location: "",
    });
    const [initialEditForm, setInitialEditForm] = useState({
        operator: "",
        booth_code: "",
        coordinate: "",
        location: "",
    });
    const [showEditOperatorDropdown, setShowEditOperatorDropdown] = useState(false);
    const [isEditSaving, setIsEditSaving] = useState(false);
    const [editFormError, setEditFormError] = useState<string | null>(null);
    const [isEditConfirmModalOpen, setIsEditConfirmModalOpen] = useState(false);
    const editOperatorDropdownRef = useRef<HTMLDivElement>(null);

    const handleEdit = (record: BoothInfo) => {
        const initial = {
            operator: record.operator || "",
            booth_code: record.booth_code || "",
            coordinate: record.coordinate || "",
            location: record.booth_location || "",
        };
        setInitialEditForm(initial);
        setEditForm({
            id: record.id,
            operator: record.operator || "",
            operator_id: record.operator_id ?? null,
            booth_code: record.booth_code || "",
            coordinate: record.coordinate || "",
            location: record.booth_location || "",
        });
        setEditFormError(null);
        setShowEditOperatorDropdown(false);
        setIsEditConfirmModalOpen(false);
        setIsEditModalOpen(true);
        if (operators.length === 0) {
            loadOperators();
        }
    };

    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setIsEditConfirmModalOpen(false);
    };

    const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setEditFormError(null);
        setEditForm((prev) => ({
            ...prev,
            [name]: value,
            ...(name === "operator" ? { operator_id: null } : {}),
        }));
        if (name === "operator") {
            setShowEditOperatorDropdown(true);
        }
    };

    const handleEditOperatorSelect = (operator: OperatorInfo) => {
        setEditForm((prev) => ({
            ...prev,
            operator: operator.operator,
            operator_id: operator.id,
        }));
        setShowEditOperatorDropdown(false);
        setEditFormError(null);
    };

    const openEditConfirmModal = () => {
        setEditFormError(null);
        setIsEditConfirmModalOpen(true);
    };

    const closeEditConfirmModal = () => {
        setIsEditConfirmModalOpen(false);
    };

    const handleEditSave = async () => {
        setIsEditSaving(true);
        setEditFormError(null);
        try {
            const updatedBooth = await updateBoothInfo(editForm.id, {
                booth_code: editForm.booth_code.trim(),
                coordinate: editForm.coordinate.trim(),
                location: editForm.location.trim(),
                operator: editForm.operator.trim(),
                operator_id: editForm.operator_id,
                changed_by: user?.name,
            });
            setRecords((prev) =>
                prev
                    .map((r) => (r.id === updatedBooth.id ? updatedBooth : r))
                    .filter((record) => record.booth_code?.trim())
                    .sort((a, b) => a.booth_code.localeCompare(b.booth_code, undefined, { numeric: true }))
            );
            showToast(`Booth "${updatedBooth.booth_code}" has been updated successfully.`);
            closeEditModal();
            loadOperators();
        } catch (err) {
            setEditFormError(err instanceof Error ? err.message : "Failed to update booth");
            setIsEditConfirmModalOpen(false);
        } finally {
            setIsEditSaving(false);
        }
    };

    // ── Add Booth Modal state ──
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addForm, setAddForm] = useState({
        operator: "",
        operator_id: null as number | null,
        booth_code: "",
        coordinate: "",
        location: "",
    });
    const [operators, setOperators] = useState<OperatorInfo[]>([]);
    const [showOperatorDropdown, setShowOperatorDropdown] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const operatorDropdownRef = useRef<HTMLDivElement>(null);

    // ── Add Operator Modal state ──
    const [isAddOperatorModalOpen, setIsAddOperatorModalOpen] = useState(false);
    const [addOperatorForm, setAddOperatorForm] = useState({ operator: "" });
    const [isSavingOperator, setIsSavingOperator] = useState(false);
    const [formErrorOperator, setFormErrorOperator] = useState<string | null>(null);
    const [isConfirmOperatorModalOpen, setIsConfirmOperatorModalOpen] = useState(false);

    // ── Operator List Modal state ──
    const [isOperatorListModalOpen, setIsOperatorListModalOpen] = useState(false);
    const [operatorListPage, setOperatorListPage] = useState(1);
    const OPERATORS_PER_PAGE = 10;

    // Build combined operator list with booth counts, sorted alphabetically.
    // `operators`/`records` are state we only ever replace via setState (never
    // mutated in place), and this memo builds a fresh sorted array — so the
    // memoization is correct. React Compiler's conservative mutation analysis
    // can't prove that here, so we opt this single memo out of the rule.
    /* eslint-disable react-hooks/preserve-manual-memoization */
    const operatorsWithCounts = useMemo(() => {
        const counts = new Map<number | null, number>();
        records.forEach((r) => {
            const id = r.operator_id ?? null;
            counts.set(id, (counts.get(id) || 0) + 1);
        });
        return [...operators]
            .map((op) => ({
                ...op,
                boothCount: counts.get(op.id) || 0,
            }))
            .sort((a, b) => a.operator.localeCompare(b.operator));
    }, [operators, records]);
    /* eslint-enable react-hooks/preserve-manual-memoization */

    // Pagination for operator list
    const operatorListTotalPages = Math.max(1, Math.ceil(operatorsWithCounts.length / OPERATORS_PER_PAGE));
    const paginatedOperatorList = useMemo(() => {
        const start = (operatorListPage - 1) * OPERATORS_PER_PAGE;
        return operatorsWithCounts.slice(start, start + OPERATORS_PER_PAGE);
    }, [operatorsWithCounts, operatorListPage]);

    // Reset operator list page when modal opens
    useEffect(() => {
        if (isOperatorListModalOpen) {
            setOperatorListPage(1);
        }
    }, [isOperatorListModalOpen]);

    const filteredOperators = (() => {
        const query = addForm.operator.toLowerCase().trim();
        if (!query) return operators;
        return operators.filter((item) => item.operator.toLowerCase().includes(query));
    })();

    const filteredEditOperators = (() => {
        const query = editForm.operator.toLowerCase().trim();
        if (!query) return operators;
        return operators.filter((item) => item.operator.toLowerCase().includes(query));
    })();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (operatorDropdownRef.current && !operatorDropdownRef.current.contains(event.target as Node)) {
                setShowOperatorDropdown(false);
            }
            if (editOperatorDropdownRef.current && !editOperatorDropdownRef.current.contains(event.target as Node)) {
                setShowEditOperatorDropdown(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const loadOperators = async () => {
        try {
            const data = await fetchOperators();
            setOperators(data);
        } catch (err) {
            setFormError(err instanceof Error ? (err instanceof Error ? err.message : String(err)) : "Failed to load operators");
        }
    };

    const openAddModal = () => {
        setAddForm({ operator: "", operator_id: null, booth_code: "", coordinate: "", location: "" });
        setFormError(null);
        setShowOperatorDropdown(false);
        setIsConfirmModalOpen(false);
        setIsAddModalOpen(true);
        if (operators.length === 0) {
            loadOperators();
        }
    };

    const closeAddModal = () => {
        setIsAddModalOpen(false);
        setIsConfirmModalOpen(false);
    };

    const handleAddFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormError(null);
        setAddForm((prev) => ({
            ...prev,
            [name]: value,
            ...(name === "operator" ? { operator_id: null } : {}),
        }));
        if (name === "operator") {
            setShowOperatorDropdown(true);
        }
    };

    const handleOperatorSelect = (operator: OperatorInfo) => {
        setAddForm((prev) => ({
            ...prev,
            operator: operator.operator,
            operator_id: operator.id,
        }));
        setShowOperatorDropdown(false);
        setFormError(null);
    };

    const openConfirmModal = () => {
        setFormError(null);
        setIsConfirmModalOpen(true);
    };

    const closeConfirmModal = () => {
        setIsConfirmModalOpen(false);
    };

    const handleSave = async () => {
        setIsSaving(true);
        setFormError(null);
        try {
            const createdBooth = await createBoothInfo({
                booth_code: addForm.booth_code.trim(),
                coordinate: addForm.coordinate.trim(),
                location: addForm.location.trim(),
                operator: addForm.operator.trim(),
                operator_id: addForm.operator_id,
                changed_by: user?.name,
            });
            setRecords((prev) =>
                [...prev, createdBooth]
                    .filter((record) => record.booth_code?.trim())
                    .sort((a, b) => a.booth_code.localeCompare(b.booth_code, undefined, { numeric: true }))
            );
            showToast(`Booth "${createdBooth.booth_code}" has been saved successfully.`);
            closeAddModal();
            loadOperators();
        } catch (err) {
            setFormError(err instanceof Error ? (err instanceof Error ? err.message : String(err)) : "Failed to save booth");
            setIsConfirmModalOpen(false);
        } finally {
            setIsSaving(false);
        }
    };

    // ── Add Operator Modal handlers ──
    const openAddOperatorModal = () => {
        setAddOperatorForm({ operator: "" });
        setFormErrorOperator(null);
        setIsConfirmOperatorModalOpen(false);
        setIsAddOperatorModalOpen(true);
    };

    const closeAddOperatorModal = () => {
        setIsAddOperatorModalOpen(false);
        setIsConfirmOperatorModalOpen(false);
    };

    const handleAddOperatorFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormErrorOperator(null);
        setAddOperatorForm({ operator: e.target.value });
    };

    const openConfirmOperatorModal = () => {
        setFormErrorOperator(null);
        setIsConfirmOperatorModalOpen(true);
    };

    const closeConfirmOperatorModal = () => {
        setIsConfirmOperatorModalOpen(false);
    };

    const handleSaveOperator = async () => {
        setIsSavingOperator(true);
        setFormErrorOperator(null);
        try {
            const createdOperator = await createOperator({
                operator: addOperatorForm.operator.trim(),
            });
            showToast(`Operator "${createdOperator.operator}" has been saved successfully.`);
            closeAddOperatorModal();
            loadOperators();
        } catch (err) {
            setFormErrorOperator(err instanceof Error ? (err instanceof Error ? err.message : String(err)) : "Failed to save operator");
            setIsConfirmOperatorModalOpen(false);
        } finally {
            setIsSavingOperator(false);
        }
    };

    if (error) {
        return (
            <div className="p-6 text-center text-rose">
                <p>{error}</p>
                <button
                    onClick={loadRecords}
                    className="mt-4 px-4 py-2 rounded-lg bg-teal text-white hover:bg-teal-dark transition"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Toolbar: Toast (left) + Search & Button (right) */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                {toastOpen && (
                    <Toast open={toastOpen} message={toastMessage} type="success" onClose={() => setToastOpen(false)} />
                )}

                <div className="flex items-center gap-3 ml-auto">
                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle dark:text-gray-500 h-4 w-4" />
                        <input
                            type="text"
                            placeholder="Search outlets..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full sm:w-72 rounded-lg border border-warm dark:border-gray-700 bg-card dark:bg-gray-800/70 py-2 pl-9 pr-3 text-sm text-ink dark:text-gray-100 placeholder:text-ink-subtle dark:placeholder:text-gray-400 focus:border-teal dark:focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal dark:focus:ring-teal/50 transition-all shadow-sm"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={openAddModal}
                            className="flex items-center gap-2 rounded-xl bg-teal px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-dark focus:outline-none focus:ring-2 focus:ring-teal/50"
                        >
                            <Plus size={16} />
                            ADD BOOTH
                        </button>
                        <button
                            onClick={openAddOperatorModal}
                            className="flex items-center gap-2 rounded-xl bg-teal px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-dark focus:outline-none focus:ring-2 focus:ring-teal/50"
                        >
                            <Plus size={16} />
                            ADD OPERATOR
                        </button>
                        <button
                            onClick={() => {
                                if (operators.length === 0) loadOperators();
                                setIsOperatorListModalOpen(true);
                            }}
                            className="flex items-center gap-2 rounded-xl border border-warm bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm transition hover:bg-surface focus:outline-none focus:ring-2 focus:ring-teal/50"
                        >
                            <List size={16} />
                            OPERATOR LIST
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-warm bg-card shadow-sm">
                <table className="w-full min-w-175 text-left text-sm">
                    <thead>
                        <tr className="border-b border-warm bg-cream">
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Operator</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Booth Code</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Coordinate</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Location</th>
                            <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-warm/60">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-ink-subtle">
                                    <div className="flex items-center justify-center gap-2">
                                        <RefreshCw className="h-5 w-5 animate-spin" />
                                        <span>Loading records...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : filteredRecords.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-ink-subtle">
                                    No outlet records found matching your search.
                                </td>
                            </tr>
                        ) : (
                            paginatedRecords.map((record) => (
                                <tr key={record.id} className="transition hover:bg-cream/50">
                                    <td className="px-4 py-3 font-medium text-ink">{record.operator || "—"}</td>
                                    <td className="px-4 py-3 font-medium text-teal">{record.booth_code || "—"}</td>
                                    <td className="px-4 py-3 text-ink-muted text-xs">{record.coordinate || "—"}</td>
<td className="px-4 py-3 text-ink">{record.booth_location || "—"}</td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            onClick={() => handleEdit(record)}
                                            className="rounded-lg p-1.5 transition-colors hover:bg-amber-50"
                                            title="Edit"
                                            style={{ color: "#F59E0B" }}
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

            {/* Pagination */}
            {!loading && filteredRecords.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-xs text-ink-subtle">
                        Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}–{Math.min(currentPage * ROWS_PER_PAGE, filteredRecords.length)} of {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
                    </div>
                    <div className="flex items-center gap-1.5">
                        {/* First */}
                        <button
                            onClick={goFirstPage}
                            disabled={currentPage === 1}
                            className="inline-flex items-center justify-center rounded-lg border border-warm bg-white px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                            title="First page"
                        >
                            <ChevronsLeft size={14} />
                        </button>
                        {/* Previous */}
                        <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="inline-flex items-center gap-1 rounded-lg border border-warm bg-white px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        {/* Page numbers */}
                        <div className="flex items-center gap-0.5">
                            {visiblePages[0] > 1 && (
                                <span className="px-1 text-xs text-ink-subtle">…</span>
                            )}
                            {visiblePages.map((page) => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`min-w-8 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors shadow-sm ${page === currentPage
                                        ? 'bg-teal text-white'
                                        : 'border border-warm bg-white text-ink hover:bg-surface'
                                        }`}
                                >
                                    {page}
                                </button>
                            ))}
                            {visiblePages[visiblePages.length - 1] < totalPages && (
                                <span className="px-1 text-xs text-ink-subtle">…</span>
                            )}
                        </div>
                        {/* Next */}
                        <button
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="inline-flex items-center gap-1 rounded-lg border border-warm bg-white px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <ChevronRight size={14} />
                        </button>
                        {/* Last */}
                        <button
                            onClick={goLastPage}
                            disabled={currentPage === totalPages}
                            className="inline-flex items-center justify-center rounded-lg border border-warm bg-white px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Last page"
                        >
                            <ChevronsRight size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── CONFIRM SAVE BOOTH MODAL ── */}
            <ConfirmationModal
                open={isConfirmModalOpen}
                title="Confirm Save"
                message="Are you sure you want to save this booth?"
                onConfirm={handleSave}
                onCancel={closeConfirmModal}
                isLoading={isSaving}
                loadingLabel="Saving..."
            >
                <SummaryRow label="Operator" value={addForm.operator} />
                <SummaryRow label="Booth Code" value={addForm.booth_code} valueColor="text-teal" />
                <SummaryRow label="Coordinate" value={addForm.coordinate || "—"} />
                <SummaryRow label="Location" value={addForm.location || "—"} />
            </ConfirmationModal>

            {/* ── CONFIRM SAVE OPERATOR MODAL ── */}
            <ConfirmationModal
                open={isConfirmOperatorModalOpen}
                title="Confirm Save"
                message="Are you sure you want to save this operator?"
                onConfirm={handleSaveOperator}
                onCancel={closeConfirmOperatorModal}
                isLoading={isSavingOperator}
                loadingLabel="Saving..."
            >
                <SummaryRow label="Operator Name" value={addOperatorForm.operator} />
            </ConfirmationModal>

            {/* ── CONFIRM UPDATE BOOTH MODAL ── */}
            <ConfirmationModal
                open={isEditConfirmModalOpen}
                title="Confirm Update"
                message="Are you sure you want to update this booth?"
                onConfirm={handleEditSave}
                onCancel={closeEditConfirmModal}
                isLoading={isEditSaving}
                loadingLabel="Saving..."
            >
                <SummaryRow label="Operator" value={editForm.operator} />
                <SummaryRow label="Booth Code" value={editForm.booth_code} valueColor="text-teal" />
                <SummaryRow label="Coordinate" value={editForm.coordinate || "—"} />
                <SummaryRow label="Location" value={editForm.location || "—"} />
            </ConfirmationModal>

            {/* ── ADD BOOTH MODAL ── */}
            <EditModal
                open={isAddModalOpen}
                title="Add Booth"
                subtitle="Fill in the booth details below"
                onClose={closeAddModal}
                accentColor="teal"
            >
                <div className="flex flex-col gap-4">
                    {formError && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                            {formError}
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-semibold text-ink mb-1.5">
                            Operator <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative" ref={operatorDropdownRef}>
                            <input
                                type="text"
                                name="operator"
                                value={addForm.operator}
                                onChange={handleAddFormChange}
                                onFocus={() => setShowOperatorDropdown(true)}
                                placeholder="Enter operator name"
                                className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm"
                            />
                            {showOperatorDropdown && filteredOperators.length > 0 && (
                                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-warm bg-white shadow-xl">
                                    {filteredOperators.map((operator) => (
                                        <button
                                            key={operator.id}
                                            type="button"
                                            onClick={() => handleOperatorSelect(operator)}
                                            className="block w-full px-4 py-2.5 text-left text-sm text-ink transition hover:bg-cream focus:bg-cream focus:outline-none"
                                        >
                                            {operator.operator}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {showOperatorDropdown && filteredOperators.length === 0 && addForm.operator.trim() && (
                                <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-warm bg-white px-4 py-2.5 text-sm text-ink-muted shadow-xl">
                                    No matching operators
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-ink mb-1.5">
                            Booth Code <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                name="booth_code"
                                value={addForm.booth_code}
                                onChange={handleAddFormChange}
                                placeholder="Enter booth code"
                                className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-ink mb-1.5">Coordinate</label>
                        <div className="relative">
                            <input
                                type="text"
                                name="coordinate"
                                value={addForm.coordinate}
                                onChange={handleAddFormChange}
                                placeholder="Enter coordinate"
                                className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-ink mb-1.5">Location</label>
                        <div className="relative">
                            <input
                                type="text"
                                name="location"
                                value={addForm.location}
                                onChange={handleAddFormChange}
                                placeholder="Enter location"
                                className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-warm/60">
                    <button
                        onClick={closeAddModal}
                        className="rounded-xl border-2 border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={openConfirmModal}
                        disabled={!addForm.booth_code.trim() || !addForm.operator.trim() || isSaving}
                        className="rounded-xl bg-linear-to-r from-teal to-teal-dark px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 hover:shadow-xl hover:shadow-teal/30 hover:from-teal-dark hover:to-teal transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100"
                    >
                        Save
                    </button>
                </div>
            </EditModal>

            {/* ── ADD OPERATOR MODAL ── */}
            <EditModal
                open={isAddOperatorModalOpen}
                title="Add Operator"
                subtitle="Enter the operator name below"
                onClose={closeAddOperatorModal}
                accentColor="teal"
            >
                <div className="flex flex-col gap-4">
                    {formErrorOperator && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                            {formErrorOperator}
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-semibold text-ink mb-1.5">
                            Operator Name <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                name="operator"
                                value={addOperatorForm.operator}
                                onChange={handleAddOperatorFormChange}
                                placeholder="Enter operator name"
                                className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-warm/60">
                    <button
                        onClick={closeAddOperatorModal}
                        className="rounded-xl border-2 border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={openConfirmOperatorModal}
                        disabled={!addOperatorForm.operator.trim() || isSavingOperator}
                        className="rounded-xl bg-linear-to-r from-teal to-teal-dark px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 hover:shadow-xl hover:shadow-teal/30 hover:from-teal-dark hover:to-teal transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100"
                    >
                        Save
                    </button>
                </div>
            </EditModal>

            {/* ── OPERATOR LIST MODAL ── */}
            {isOperatorListModalOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm pt-16 px-4">
                    <div className="relative w-full max-w-lg animate-in fade-in zoom-in-95 duration-200 rounded-2xl bg-white shadow-2xl border border-warm overflow-hidden">
                        {/* Header accent bar */}
                        <div className="h-2 bg-linear-to-r from-indigo-500 to-purple-600" />

                        <div className="p-6">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-ink">Operator List</h2>
                                    <p className="text-sm text-ink-muted mt-0.5">
                                        {operatorsWithCounts.length} operator{operatorsWithCounts.length !== 1 ? 's' : ''} total
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsOperatorListModalOpen(false)}
                                    className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors"
                                >
                                    <X className="h-5 w-5 text-gray-400" />
                                </button>
                            </div>

                            {/* Table */}
                            <div className="overflow-hidden rounded-xl border border-warm bg-card shadow-sm">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-warm bg-linear-to-r from-indigo-50 to-purple-50">
                                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">#</th>
                                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Operator Name</th>
                                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted text-right">Booth Codes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-warm/60">
                                        {paginatedOperatorList.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="px-4 py-8 text-center text-ink-subtle">
                                                    No operators found.
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedOperatorList.map((op, idx) => {
                                                const rowNum = (operatorListPage - 1) * OPERATORS_PER_PAGE + idx + 1;
                                                return (
                                                    <tr key={op.id} className="transition hover:bg-cream/50">
                                                        <td className="px-4 py-3 text-xs text-ink-muted">{rowNum}</td>
                                                        <td className="px-4 py-3 font-medium text-ink">{op.operator}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            <span className={`inline-flex items-center justify-center min-w-7 rounded-full px-2.5 py-0.5 text-xs font-bold ${op.boothCount > 0
                                                                ? 'bg-teal/10 text-teal-dark ring-1 ring-teal/30'
                                                                : 'bg-gray-100 text-gray-400 ring-1 ring-gray-200'
                                                                }`}>
                                                                {op.boothCount}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {operatorsWithCounts.length > OPERATORS_PER_PAGE && (
                                <div className="flex items-center justify-between mt-4">
                                    <div className="text-xs text-ink-subtle">
                                        Showing {(operatorListPage - 1) * OPERATORS_PER_PAGE + 1}–{Math.min(operatorListPage * OPERATORS_PER_PAGE, operatorsWithCounts.length)} of {operatorsWithCounts.length}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => setOperatorListPage((p) => Math.max(1, p - 1))}
                                            disabled={operatorListPage === 1}
                                            className="inline-flex items-center justify-center rounded-lg border border-warm bg-white px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            <ChevronLeft size={14} />
                                        </button>
                                        <span className="px-2 text-xs font-medium text-ink-muted">
                                            {operatorListPage} / {operatorListTotalPages}
                                        </span>
                                        <button
                                            onClick={() => setOperatorListPage((p) => Math.min(operatorListTotalPages, p + 1))}
                                            disabled={operatorListPage === operatorListTotalPages}
                                            className="inline-flex items-center justify-center rounded-lg border border-warm bg-white px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-surface transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── EDIT BOOTH MODAL ── */}
            <EditModal
                open={isEditModalOpen}
                title="Edit Booth"
                subtitle="Update the booth details below"
                onClose={closeEditModal}
                accentColor="blue"
            >
                <div className="flex flex-col gap-4">
                    {editFormError && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                            {editFormError}
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-semibold text-ink mb-1.5">
                            Operator <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative" ref={editOperatorDropdownRef}>
                            <input
                                type="text"
                                name="operator"
                                value={editForm.operator}
                                onChange={handleEditFormChange}
                                onFocus={() => setShowEditOperatorDropdown(true)}
                                placeholder="Enter operator name"
                                className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm"
                            />
                            {showEditOperatorDropdown && filteredEditOperators.length > 0 && (
                                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-warm bg-white shadow-xl">
                                    {filteredEditOperators.map((operator) => (
                                        <button
                                            key={operator.id}
                                            type="button"
                                            onClick={() => handleEditOperatorSelect(operator)}
                                            className="block w-full px-4 py-2.5 text-left text-sm text-ink transition hover:bg-cream focus:bg-cream focus:outline-none"
                                        >
                                            {operator.operator}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {showEditOperatorDropdown && filteredEditOperators.length === 0 && editForm.operator.trim() && (
                                <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-warm bg-white px-4 py-2.5 text-sm text-ink-muted shadow-xl">
                                    No matching operators
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-ink mb-1.5">
                            Booth Code <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                name="booth_code"
                                value={editForm.booth_code}
                                onChange={handleEditFormChange}
                                placeholder="Enter booth code"
                                className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-ink mb-1.5">Coordinate</label>
                        <div className="relative">
                            <input
                                type="text"
                                name="coordinate"
                                value={editForm.coordinate}
                                onChange={handleEditFormChange}
                                placeholder="Enter coordinate"
                                className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-ink mb-1.5">Location</label>
                        <div className="relative">
                            <input
                                type="text"
                                name="location"
                                value={editForm.location}
                                onChange={handleEditFormChange}
                                placeholder="Enter location"
                                className="w-full rounded-xl border border-warm bg-card px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 transition-all shadow-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-warm/60">
                    <button
                        onClick={closeEditModal}
                        className="rounded-xl border-2 border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={openEditConfirmModal}
                        disabled={!editForm.booth_code.trim() || !editForm.operator.trim() || isEditSaving || (
                            editForm.operator === initialEditForm.operator &&
                            editForm.booth_code === initialEditForm.booth_code &&
                            editForm.coordinate === initialEditForm.coordinate &&
                            editForm.location === initialEditForm.location
                        )}
                        className="rounded-xl bg-linear-to-r from-teal to-teal-dark px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal/25 hover:shadow-xl hover:shadow-teal/30 hover:from-teal-dark hover:to-teal transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100"
                    >
                        Save
                    </button>
                </div>
            </EditModal>
        </div>
    );
}
