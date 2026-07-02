import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Plus, Trash2, UserPlus } from "lucide-react";
import {
    createOperator,
    fetchOperators,
    updateOperatorParent,
} from "../../pos/services";
import type { OperatorInfo } from "../../pos/types";
import CreateSubOperatorUserModal from "../components/CreateSubOperatorUserModal";
import { Toast, type ToastType } from "../../../shared/components";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

interface UserSummary {
    id: number;
    name: string;
    email: string;
    operator_id: number | null;
}

/** Extract the main operator code (e.g. "HEXA-005") from the beginning of a
 *  operator string. Supports formats like "HEXA-005", "HEXA-005 (ADRIAN)",
 *  "HEXA-005 ADRIAN" etc. Returns null if no code is found. */
function extractMainCode(operator: string): string | null {
    const m = operator.trim().match(/^(HEXA-\d+)/i);
    return m ? m[1].toUpperCase() : null;
}

function cleanSubOpName(name?: string | null): string | null {
    const trimmed = name?.trim();
    if (!trimmed || trimmed.toUpperCase() === "EMPTY" || trimmed.toUpperCase() === "NULL") {
        return null;
    }
    return trimmed;
}

function isUnassignedParent(parentOperatorId: unknown): boolean {
    if (parentOperatorId == null) return true;
    if (typeof parentOperatorId === "string") {
        const value = parentOperatorId.trim().toUpperCase();
        return value === "" || value === "NULL";
    }
    return false;
}

function sameId(a: unknown, b: unknown): boolean {
    return Number(a) === Number(b);
}

/** Returns true if the operator should be considered a sub-operator
 *  (has a sub_op_name OR is assigned to a parent). Relies exclusively
 *  on database fields — never on string heuristics — so that operators
 *  whose display name happens to contain parentheses (e.g. an imported
 *  name like "HEXA-005 (ADRIAN)") are not incorrectly treated as subs. */
function isSubOperator(o: OperatorInfo): boolean {
    // Has a non-empty sub_op_name
    if (cleanSubOpName(o.sub_op_name)) return true;
    // Has a parent assigned
    if (!isUnassignedParent(o.parent_operator_id)) return true;
    return false;
}

/** Build a display name for an operator.
 *  The backend SQL already builds "ParentName (SubName)" for sub-operators
 *  when the operator column is empty.  If op.operator already ends with the
 *  sub_op_name in parentheses, return it as-is to avoid duplication like
 *  "TEST DEVICE (2) (2)".  For main operators (no sub_op_name) or operators
 *  whose raw name hasn't been pre-formatted, construct the display from
 *  the raw fields. */
function formatOperatorDisplay(op: OperatorInfo): string {
    const subOpName = cleanSubOpName(op.sub_op_name);
    if (subOpName) {
        // The backend may have already formatted the operator as "Parent (Sub)".
        // Check if op.operator already ends with "(SubName)".
        if (op.operator.trim().endsWith(`(${subOpName})`)) {
            return op.operator;
        }
        const code = extractMainCode(op.operator) ?? op.operator;
        return `${code} (${subOpName})`;
    }
    return op.operator;
}

function ConfirmAddSubModal({
    mainOpName,
    type,
    names,
    onConfirm,
    onCancel,
}: {
    mainOpName: string;
    type: "single" | "bulk";
    names: string[];
    onConfirm: () => void;
    onCancel: () => void;
}) {
    const displayNames = names.length <= 5
        ? names
        : [...names.slice(0, 4), `... and ${names.length - 4} more`];

    return (
        <div className="fixed inset-0 z-60 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm pt-24 px-4">
            <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-2xl bg-white shadow-2xl border border-warm overflow-hidden">
                <div className="h-2 bg-linear-to-r from-teal to-teal-dark" />

                <div className="p-6">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal/10 ring-4 ring-teal/20">
                            <CheckCircle2 className="h-7 w-7 text-teal" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-ink">
                                {type === "single" ? "Add Sub-Operator" : "Add Sub-Operators"}
                            </h3>
                            <p className="text-sm text-ink-muted mt-1">
                                This will add the following sub-operator{names.length !== 1 ? "s" : ""} under{" "}
                                <span className="font-semibold text-ink">{mainOpName}</span>:
                            </p>
                            <div className="mt-3 w-full rounded-xl bg-linear-to-br from-cream to-teal-50/50 border border-warm/70 px-4 py-3 text-left">
                                {displayNames.map((name) => (
                                    <p key={name} className="text-sm font-medium text-ink leading-relaxed">
                                        {mainOpName} ({name})
                                    </p>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={onCancel}
                            className="flex-1 rounded-xl border-2 border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98] cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            autoFocus
                            className="flex-1 rounded-xl bg-linear-to-r from-teal to-teal-dark py-3 text-sm font-semibold text-white shadow-lg shadow-teal/25 hover:shadow-xl hover:shadow-teal/30 hover:from-teal-dark hover:to-teal transition-all active:scale-[0.98] cursor-pointer"
                        >
                            {type === "single" ? "Add" : `Add all (${names.length})`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ConfirmRemoveModal({
    subOperator,
    onConfirm,
    onCancel,
}: {
    subOperator: OperatorInfo;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    return (
        <div className="fixed inset-0 z-60 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm pt-24 px-4">
            <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200 rounded-2xl bg-white shadow-2xl border border-warm overflow-hidden">
                <div className="h-2 bg-linear-to-r from-amber-400 to-orange-500" />

                <div className="p-6">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 ring-4 ring-amber-50">
                            <AlertTriangle className="h-7 w-7 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-ink">Remove Sub-Operator</h3>
                            <p className="text-sm text-ink-muted mt-1">
                                This will unlink this sub-operator from its current main operator.
                            </p>
                            <div className="mt-3 w-full rounded-xl bg-linear-to-br from-cream to-amber-50/50 border border-warm/70 px-4 py-3">
                                <p className="text-base font-bold text-ink">{formatOperatorDisplay(subOperator)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={onCancel}
                            className="flex-1 rounded-xl border-2 border-gray-200 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.98] cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 rounded-xl bg-linear-to-r from-rose to-rose-dark py-3 text-sm font-semibold text-white shadow-lg shadow-rose/25 hover:shadow-xl hover:shadow-rose/30 hover:from-rose-dark hover:to-rose transition-all active:scale-[0.98] cursor-pointer"
                        >
                            Remove
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function OperatorProfilesPage() {
    const [operators, setOperators] = useState<OperatorInfo[]>([]);
    const [users, setUsers] = useState<UserSummary[]>([]);
    const [, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastType, setToastType] = useState<ToastType>("error");

    // Main-picker controls which main we're managing.
    const [activeMainId, setActiveMainId] = useState<number | null>(null);

    // Single sub-add form
    const [singleName, setSingleName] = useState("");
    const [singleNameError, setSingleNameError] = useState("");
    const [creatingSingle, setCreatingSingle] = useState(false);

    // Bulk sub-add textarea
    const [bulkText, setBulkText] = useState("");
    const [bulkTextError, setBulkTextError] = useState("");
    const [creatingBulk, setCreatingBulk] = useState(false);

    // Stand-alone "create main" form (collapsed by default to keep focus on subs)
    const [showMainForm, setShowMainForm] = useState(false);
    const [mainName, setMainName] = useState("");
    const [creatingMain, setCreatingMain] = useState(false);

    // Create-user modal target. The page can host a single modal at a time;
    // we track the sub-operator we're creating an account for.
    const [creatingUserFor, setCreatingUserFor] = useState<OperatorInfo | null>(null);

    // Confirmation modal for removing a sub-operator
    const [removingSub, setRemovingSub] = useState<OperatorInfo | null>(null);
    const [deletingSubId, setDeletingSubId] = useState<number | null>(null);

    // Confirmation modal for adding sub-operator(s)
    const [confirmAddData, setConfirmAddData] = useState<{
        type: "single" | "bulk";
        mainOpName: string;
        names: string[];
    } | null>(null);

    const refresh = async () => {
        try {
            setLoading(true);
            setError("");
            const [opsRes, usersRes] = await Promise.all([
                fetchOperators(),
                fetch(`${API_BASE_URL}/api/users`).then((r) => (r.ok ? r.json() : [])),
            ]);
            setOperators(opsRes);
            setUsers(usersRes);
        } catch (e) {
            setError(e instanceof Error ? (e instanceof Error ? e.message : String(e)) : "Failed to load");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    const mainOperators = useMemo(
        () => operators.filter((o) => !isSubOperator(o)),
        [operators]
    );

    const subsOfActive = useMemo(() => {
        if (!activeMainId) return [] as OperatorInfo[];
        return operators.filter((o) => sameId(o.parent_operator_id, activeMainId));
    }, [operators, activeMainId]);

    const activeMainOperator = useMemo(
        () => operators.find((o) => sameId(o.id, activeMainId)) ?? null,
        [operators, activeMainId]
    );

    const usersByOperatorId = useMemo(() => {
        const map = new Map<number, UserSummary>();
        for (const u of users) {
            if (u.operator_id) map.set(u.operator_id, u);
        }
        return map;
    }, [users]);

    const showOk = (text: string) => {
        setToastMessage(text);
        setToastType("success");
        setToastOpen(true);
    };
    const showErr = (text: string) => {
        setToastMessage(text);
        setToastType("error");
        setToastOpen(true);
    };

    const handleCreateMain = async () => {
        if (!mainName.trim()) return showErr("Main operator name is required.");
        setCreatingMain(true);
        setToastOpen(false);
        try {
            const created = await createOperator({
                operator: mainName.trim(),
                parent_operator_id: null,
            });
            setMainName("");
            setShowMainForm(false);
            await refresh();
            setActiveMainId(created.id);
            showOk(`Main operator "${created.operator}" created.`);
        } catch (e) {
            showErr(e instanceof Error ? (e instanceof Error ? e.message : String(e)) : "Failed to create main operator");
        } finally {
            setCreatingMain(false);
        }
    };

    /** Validate that the user's input doesn't contain the main operator prefix */
    const validateSingleName = (value: string): string => {
        if (!activeMainId || !value.trim()) return "";
        const mainOp = operators.find((o) => sameId(o.id, activeMainId));
        if (!mainOp) return "";
        const mainPrefix = extractMainCode(mainOp.operator) ?? mainOp.operator;
        if (value.trim().toUpperCase().startsWith(mainPrefix.toUpperCase())) {
            return `Just type the sub-operator's name, no need to include "${mainPrefix}". Only type the name (e.g., Stef).`;
        }
        return "";
    };

    const handleSingleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSingleName(value);
        setSingleNameError(validateSingleName(value));
    };

    const handleCreateSingleSub = () => {
        if (!activeMainId) return showErr("Pick a main operator first.");
        if (!singleName.trim()) return showErr("Sub-operator name is required.");

        const mainOp = operators.find((o) => sameId(o.id, activeMainId));
        if (!mainOp) return showErr("Main operator not found.");

        const mainPrefix = extractMainCode(mainOp.operator) ?? mainOp.operator;
        if (singleName.trim().toUpperCase().startsWith(mainPrefix.toUpperCase())) {
            return showErr("Just type the sub-operator's name, no need to include the main operator.");
        }

        // Show confirmation modal instead of saving directly
        setConfirmAddData({
            type: "single",
            mainOpName: operatorDisplay(mainOp),
            names: [singleName.trim()],
        });
    };

    /** Actually saves the sub-operator(s) after confirmation */
    const handleConfirmAddSub = async () => {
        if (!confirmAddData) return;
        const { type, names } = confirmAddData;
        setConfirmAddData(null);

        if (type === "single") {
            setCreatingSingle(true);
            setToastOpen(false);
            try {
                const subName = names[0];
                await createOperator({
                    operator: "",
                    parent_operator_id: activeMainId,
                    sub_op_name: subName,
                });
                setSingleName("");
                setSingleNameError("");
                await refresh();
                showOk("Sub-operator added.");
            } catch (e) {
                showErr(e instanceof Error ? (e instanceof Error ? e.message : String(e)) : "Failed to add sub-operator");
            } finally {
                setCreatingSingle(false);
            }
        } else {
            setCreatingBulk(true);
            setToastOpen(false);
            const errors: string[] = [];
            for (const name of names) {
                try {
                    await createOperator({ operator: "", parent_operator_id: activeMainId, sub_op_name: name });
                } catch (e) {
                    errors.push(`${name}: ${(e instanceof Error ? e.message : String(e)) ?? "failed"}`);
                }
            }
            await refresh();
            setBulkText("");
            setBulkTextError("");
            setCreatingBulk(false);

            const okCount = names.length - errors.length;
            if (errors.length === 0) {
                showOk(`Added ${okCount} sub-operator${okCount === 1 ? "" : "s"}.`);
            } else {
                showErr(`Added ${okCount} of ${names.length}. Errors:\n${errors.join("\n")}`);
            }
        }
    };

    const handleRemoveSub = async () => {
        if (!removingSub) return;
        const subId = removingSub.id;
        setDeletingSubId(subId);
        setRemovingSub(null);
        setToastOpen(false);
        try {
            await updateOperatorParent(subId, null);
            await refresh();
            showOk("Sub-operator removed from this main.");
        } catch (e) {
            showErr(e instanceof Error ? (e instanceof Error ? e.message : String(e)) : "Failed to remove sub-operator");
        } finally {
            setDeletingSubId(null);
        }
    };

    /** Validate bulk text lines: returns an array of error messages, one per line with issues */
    const validateBulkText = (text: string): string => {
        if (!activeMainId || !text.trim()) return "";
        const mainOp = operators.find((o) => sameId(o.id, activeMainId));
        if (!mainOp) return "";
        const mainPrefix = extractMainCode(mainOp.operator) ?? mainOp.operator;
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
        const badLines = lines.filter((l) => l.toUpperCase().startsWith(mainPrefix.toUpperCase()));
        if (badLines.length > 0) {
            const listed = badLines.slice(0, 3).map((l) => `"${l}"`).join(", ");
            const suffix = badLines.length > 3 ? ` and ${badLines.length - 3} more` : "";
            return `Don't include the main operator code. Just type names (e.g., Stef). Problematic: ${listed}${suffix}`;
        }
        return "";
    };

    const handleBulkTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setBulkText(value);
        setBulkTextError(validateBulkText(value));
    };

    const handleCreateBulkSubs = () => {
        if (!activeMainId) return showErr("Pick a main operator first.");
        const lines = bulkText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
        if (lines.length === 0) return showErr("Add at least one name (one per line).");

        const mainOp = operators.find((o) => sameId(o.id, activeMainId));
        if (!mainOp) return showErr("Main operator not found.");

        // Show confirmation modal instead of saving directly
        setConfirmAddData({
            type: "bulk",
            mainOpName: operatorDisplay(mainOp),
            names: lines,
        });
    };

    const operatorDisplay = (op: OperatorInfo) => formatOperatorDisplay(op);

    return (
        <div className="space-y-6">
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                </div>
            )}

            <Toast open={toastOpen} message={toastMessage} type={toastType} onClose={() => setToastOpen(false)} />

            {/* Main picker + create-main toggle */}
            <section className="max-w-3xl rounded-2xl border border-warm bg-card p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            MANAGE SUB-OPERATORS OF MAIN OPERATOR:
                        </label>
                        <select
                            value={activeMainId ?? ""}
                            onChange={(e) =>
                                setActiveMainId(e.target.value === "" ? null : Number(e.target.value))
                            }
                            className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                        >
                            <option value="">Select Operator</option>
                            {mainOperators.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {operatorDisplay(m)}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowMainForm((v) => !v)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-warm bg-card px-4 py-2 text-sm font-medium text-ink transition hover:bg-warm/40"
                    >
                        <Plus size={14} />
                        {showMainForm ? "Cancel" : "New main operator"}
                    </button>
                </div>

                {showMainForm && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                        <input
                            type="text"
                            value={mainName}
                            onChange={(e) => setMainName(e.target.value)}
                            placeholder="Main operator name"
                            className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                        />
                        <button
                            type="button"
                            onClick={handleCreateMain}
                            disabled={creatingMain || !mainName.trim()}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-teal-dark disabled:opacity-50"
                        >
                            <Plus size={14} />
                            {creatingMain ? "Creating..." : "Create main"}
                        </button>
                    </div>
                )}
            </section>

            {/* Add subs to active main */}
            {activeMainId && (
                <section className="max-w-3xl rounded-2xl border border-warm bg-card p-5 shadow-sm">
                    {(() => {
                        const picked = operators.find((m) => sameId(m.id, activeMainId));
                        if (picked?.parent_operator_id) {
                            const currentParent = operators.find(
                                (o) => sameId(o.id, picked.parent_operator_id)
                            );
                            return (
                                <p className="mb-3 rounded-lg border border-peach/40 bg-peach/15 px-3 py-2 text-xs text-ink">
                                    Heads up: this is currently a sub of{" "}
                                    <span className="font-semibold">
                                        {operatorDisplay(currentParent!)}
                                    </span>
                                    . When you save assignments below, it will be promoted to a
                                    main operator first so it can have its own subs.
                                </p>
                            );
                        }
                        return null;
                    })()}

                    <div className="grid gap-4 lg:grid-cols-2">
                        {/* Single add */}
                        <div className="rounded-lg border border-warm bg-cream/40 p-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                Add one
                            </p>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        value={singleName}
                                        onChange={handleSingleNameChange}
                                        placeholder="Sub-operator name"
                                        className={`w-full rounded-lg border px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 ${singleNameError
                                            ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-200"
                                            : "border-warm bg-card focus:border-teal focus:ring-teal"
                                            }`}
                                    />
                                    {singleNameError && (
                                        <p className="mt-1 text-xs text-red-500">{singleNameError}</p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCreateSingleSub}
                                    disabled={creatingSingle || !singleName.trim() || !!singleNameError}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-teal-dark disabled:opacity-50"
                                >
                                    <Plus size={14} />
                                    {creatingSingle ? "Adding..." : "Add"}
                                </button>
                            </div>
                            {activeMainOperator && singleName.trim() && !singleNameError && (
                                <p className="mt-1.5 text-xs text-ink-muted">
                                    Will be saved as: <span className="font-medium">{operatorDisplay(activeMainOperator)} ({singleName.trim()})</span>
                                </p>
                            )}
                        </div>

                        {/* Bulk add */}
                        <div className="rounded-lg border border-warm bg-cream/40 p-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                Add many — one name per line
                            </p>
                            <textarea
                                value={bulkText}
                                onChange={handleBulkTextChange}
                                rows={4}
                                placeholder={"Name 1\nName 2\nName 3"}
                                className={`w-full rounded-lg border px-3 py-2 font-mono text-xs text-ink focus:outline-none focus:ring-2 ${bulkTextError
                                    ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-200"
                                    : "border-warm bg-card focus:border-teal focus:ring-teal"
                                    }`}
                            />
                            {bulkTextError && (
                                <p className="mt-1 text-xs text-red-500">{bulkTextError}</p>
                            )}
                            {activeMainOperator && bulkText.trim() && !bulkTextError && (
                                <p className="mt-1 text-xs text-ink-muted">
                                    Each line will be saved as:{" "}
                                    {bulkText.split("\n").filter(Boolean).slice(0, 2).map((l) => (
                                        <span key={l} className="font-medium">{operatorDisplay(activeMainOperator)} ({l.trim()}) </span>
                                    ))}
                                    {bulkText.split("\n").filter(Boolean).length > 2 ? "..." : ""}
                                </p>
                            )}
                            <button
                                type="button"
                                onClick={handleCreateBulkSubs}
                                disabled={creatingBulk || !bulkText.trim() || !!bulkTextError}
                                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-teal-dark disabled:opacity-50"
                            >
                                <Plus size={14} />
                                {creatingBulk ? "Adding..." : "Add all"}
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {/* Sub-operators of the active main */}
            {activeMainId && (
                <section className="max-w-3xl rounded-2xl border border-warm bg-card p-5 shadow-sm">
                    <h3 className="mb-3 text-sm font-semibold text-ink">
                        SUB-OPERATORS ({subsOfActive.length})
                    </h3>

                    {subsOfActive.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-warm bg-cream/50 px-3 py-4 text-center text-sm text-ink-subtle">
                            No sub-operators under this main yet. Add some above.
                        </p>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-warm">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-cream border-b border-warm">
                                        <th className="px-3 py-2 text-xs font-semibold text-ink-muted uppercase tracking-wider">Name</th>
                                        <th className="px-3 py-2 text-xs font-semibold text-ink-muted uppercase tracking-wider">User</th>
                                        <th className="px-3 py-2 text-xs font-semibold text-ink-muted uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-warm/60">
                                    {subsOfActive.map((sub) => {
                                        const linkedUser = usersByOperatorId.get(sub.id);
                                        return (
                                            <tr key={sub.id} className="hover:bg-cream transition">
                                                <td className="px-3 py-2 text-sm font-medium text-ink">
                                                    {operatorDisplay(sub)}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {linkedUser ? (
                                                        <span className="inline-block rounded-full bg-teal-light/30 px-2 py-0.5 text-xs font-medium text-ink">
                                                            {linkedUser.email}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-block rounded-full bg-peach/40 px-2 py-0.5 text-xs font-medium text-ink">
                                                            No User Account
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {!linkedUser && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setCreatingUserFor(sub)}
                                                                className="inline-flex items-center gap-1 rounded-lg border border-warm bg-card px-2 py-1 text-xs font-medium text-ink transition hover:bg-cream"
                                                                title="Create a login account for this sub-operator"
                                                            >
                                                                <UserPlus size={12} />
                                                                Create user
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => setRemovingSub(sub)}
                                                            disabled={deletingSubId === sub.id}
                                                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-card px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                                                            title="Remove this sub-operator (make it standalone)"
                                                        >
                                                            <Trash2 size={12} />
                                                            {deletingSubId === sub.id ? "Removing..." : "Remove"}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            )}

            {confirmAddData && (
                <ConfirmAddSubModal
                    mainOpName={confirmAddData.mainOpName}
                    type={confirmAddData.type}
                    names={confirmAddData.names}
                    onConfirm={handleConfirmAddSub}
                    onCancel={() => setConfirmAddData(null)}
                />
            )}

            {removingSub && (
                <ConfirmRemoveModal
                    subOperator={removingSub}
                    onConfirm={handleRemoveSub}
                    onCancel={() => setRemovingSub(null)}
                />
            )}

            {creatingUserFor && (
                <CreateSubOperatorUserModal
                    subOperator={creatingUserFor}
                    parentOperator={
                        operators.find(
                            (o) => sameId(o.id, creatingUserFor.parent_operator_id)
                        ) ?? null
                    }
                    onClose={() => setCreatingUserFor(null)}
                    onCreated={async (text) => {
                        setCreatingUserFor(null);
                        await refresh();
                        showOk(text);
                    }}
                />
            )}
        </div>
    );
}
