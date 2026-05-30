import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, UserPlus } from "lucide-react";
import {
    assignSubOperators,
    createOperator,
    fetchOperators,
} from "../../pos/services";
import type { OperatorInfo } from "../../pos/types";
import CreateSubOperatorUserModal from "../components/CreateSubOperatorUserModal";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

interface UserSummary {
    id: number;
    name: string;
    email: string;
    operator_id: number | null;
}

export default function OperatorProfilesPage() {
    const [operators, setOperators] = useState<OperatorInfo[]>([]);
    const [users, setUsers] = useState<UserSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

    // Main-picker controls which main we're managing.
    const [activeMainId, setActiveMainId] = useState<number | null>(null);

    // Single sub-add form
    const [singleName, setSingleName] = useState("");
    const [creatingSingle, setCreatingSingle] = useState(false);

    // Bulk sub-add textarea
    const [bulkText, setBulkText] = useState("");
    const [creatingBulk, setCreatingBulk] = useState(false);

    // Stand-alone "create main" form (collapsed by default to keep focus on subs)
    const [showMainForm, setShowMainForm] = useState(false);
    const [mainName, setMainName] = useState("");
    const [creatingMain, setCreatingMain] = useState(false);


    // Bulk-assign existing operators as subs of the active main
    const [assignSelection, setAssignSelection] = useState<Set<number>>(new Set());
    const [assigning, setAssigning] = useState(false);

    // Create-user modal target. The page can host a single modal at a time;
    // we track the sub-operator we're creating an account for.
    const [creatingUserFor, setCreatingUserFor] = useState<OperatorInfo | null>(null);

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
        () => operators.filter((o) => !o.parent_operator_id),
        [operators]
    );

    const subsOfActive = useMemo(() => {
        if (!activeMainId) return [] as OperatorInfo[];
        return operators.filter((o) => o.parent_operator_id === activeMainId);
    }, [operators, activeMainId]);

    /**
     * Operators the admin could currently assign as subs of the active main:
     *   - not the active main itself
     *   - not already a sub of the active main
     *   - has no subs of its own (one-level nesting rule)
     * Includes any operator that's currently a main with no children OR a sub
     * of a different main (re-parenting).
     */
    const assignableOperators = useMemo(() => {
        if (!activeMainId) return [] as OperatorInfo[];
        const haveChildren = new Set(
            operators
                .filter((o) => o.parent_operator_id !== null)
                .map((o) => o.parent_operator_id as number)
        );
        return operators.filter(
            (o) =>
                o.id !== activeMainId &&
                o.parent_operator_id === null &&
                !haveChildren.has(o.id)
        );
    }, [operators, activeMainId]);

    const usersByOperatorId = useMemo(() => {
        const map = new Map<number, UserSummary>();
        for (const u of users) {
            if (u.operator_id) map.set(u.operator_id, u);
        }
        return map;
    }, [users]);

    // Default to the first main operator when the list loads
    useEffect(() => {
        if (activeMainId === null && mainOperators.length > 0) {
            setActiveMainId(mainOperators[0].id);
        }
    }, [mainOperators, activeMainId]);

    // Clear the "assign as subs" selection whenever the active main changes
    useEffect(() => {
        setAssignSelection(new Set());
    }, [activeMainId]);

    const showOk = (text: string) => setMsg({ kind: "ok", text });
    const showErr = (text: string) => setMsg({ kind: "err", text });

    const handleCreateMain = async () => {
        if (!mainName.trim()) return showErr("Main operator name is required.");
        setCreatingMain(true);
        setMsg(null);
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

    const handleCreateSingleSub = async () => {
        if (!activeMainId) return showErr("Pick a main operator first.");
        if (!singleName.trim()) return showErr("Sub-operator name is required.");
        setCreatingSingle(true);
        setMsg(null);
        try {
            await createOperator({
                operator: singleName.trim(),
                parent_operator_id: activeMainId,
            });
            setSingleName("");
            await refresh();
            showOk("Sub-operator added.");
        } catch (e) {
            showErr(e instanceof Error ? (e instanceof Error ? e.message : String(e)) : "Failed to add sub-operator");
        } finally {
            setCreatingSingle(false);
        }
    };

    const handleCreateBulkSubs = async () => {
        if (!activeMainId) return showErr("Pick a main operator first.");
        const lines = bulkText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
        if (lines.length === 0) return showErr("Add at least one name (one per line).");

        setCreatingBulk(true);
        setMsg(null);
        const errors: string[] = [];
        for (const name of lines) {
            try {
                await createOperator({ operator: name, parent_operator_id: activeMainId });
            } catch (e) {
                errors.push(`${name}: ${(e instanceof Error ? e.message : String(e)) ?? "failed"}`);
            }
        }
        await refresh();
        setBulkText("");
        setCreatingBulk(false);

        const okCount = lines.length - errors.length;
        if (errors.length === 0) {
            showOk(`Added ${okCount} sub-operator${okCount === 1 ? "" : "s"}.`);
        } else {
            showErr(
                `Added ${okCount} of ${lines.length}. Errors:\n${errors.join("\n")}`
            );
        }
    };

    const toggleAssign = (id: number) => {
        setAssignSelection((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleAssignSelected = async () => {
        if (!activeMainId || assignSelection.size === 0) return;
        setAssigning(true);
        setMsg(null);

        const ids = Array.from(assignSelection);

        try {
            const result = await assignSubOperators(activeMainId, ids);
            setOperators(result.operators);
            setAssignSelection(new Set());

            const okCount = result.assigned;
            const errCount = result.errors.length;
            const reparented = result.reparentedGrandchildren.length;

            const parts: string[] = [];
            parts.push(`Assigned ${okCount} operator${okCount === 1 ? "" : "s"} as sub.`);
            if (reparented > 0) {
                parts.push(
                    `${reparented} sub-of-sub${reparented === 1 ? " was" : "s were"} re-parented to the main.`
                );
            }
            if (errCount > 0) {
                parts.push(
                    `${errCount} could not be assigned:\n${result.errors
                        .map((e) => `  • id ${e.id}: ${e.error}`)
                        .join("\n")}`
                );
                showErr(parts.join("\n"));
            } else {
                showOk(parts.join(" "));
            }
        } catch (e) {
            showErr(e instanceof Error ? (e instanceof Error ? e.message : String(e)) : "Failed to assign sub-operators");
        } finally {
            setAssigning(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-ink">Operator Profiles</h2>
                    <p className="text-sm text-ink-muted">
                        Pick a main operator, then add sub-operators under it.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={refresh}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-warm bg-card px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-cream disabled:opacity-50"
                >
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                    Refresh
                </button>
            </div>

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                </div>
            )}
            {msg && (
                <div
                    className={`whitespace-pre-line rounded-lg border px-3 py-2 text-sm ${msg.kind === "ok"
                        ? "border-teal/30 bg-teal/10 text-ink"
                        : "border-red-200 bg-red-50 text-red-600"
                        }`}
                >
                    {msg.text}
                </div>
            )}

            {/* Main picker + create-main toggle */}
            <section className="rounded-2xl border border-warm bg-card p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                            Manage subs of
                        </label>
                        <select
                            value={activeMainId ?? ""}
                            onChange={(e) =>
                                setActiveMainId(e.target.value === "" ? null : Number(e.target.value))
                            }
                            className="w-full rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                        >
                            <option value="">— pick an operator —</option>
                            {mainOperators.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.operator}
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
                <section className="rounded-2xl border border-warm bg-card p-5 shadow-sm">
                    <h3 className="mb-1 text-sm font-semibold text-ink">
                        Add sub-operators under{" "}
                        <span className="text-teal">
                            {operators.find((m) => m.id === activeMainId)?.operator}
                        </span>
                    </h3>
                    {(() => {
                        const picked = operators.find((m) => m.id === activeMainId);
                        if (picked?.parent_operator_id) {
                            const currentParent = operators.find(
                                (o) => o.id === picked.parent_operator_id
                            );
                            return (
                                <p className="mb-3 rounded-lg border border-peach/40 bg-peach/15 px-3 py-2 text-xs text-ink">
                                    Heads up: this is currently a sub of{" "}
                                    <span className="font-semibold">
                                        {currentParent?.operator ?? "another operator"}
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
                                <input
                                    type="text"
                                    value={singleName}
                                    onChange={(e) => setSingleName(e.target.value)}
                                    placeholder="Sub-operator name"
                                    className="flex-1 rounded-lg border border-warm bg-card px-3 py-2 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                                />
                                <button
                                    type="button"
                                    onClick={handleCreateSingleSub}
                                    disabled={creatingSingle || !singleName.trim()}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-teal-dark disabled:opacity-50"
                                >
                                    <Plus size={14} />
                                    {creatingSingle ? "Adding..." : "Add"}
                                </button>
                            </div>
                        </div>

                        {/* Bulk add */}
                        <div className="rounded-lg border border-warm bg-cream/40 p-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                Add many — one name per line
                            </p>
                            <textarea
                                value={bulkText}
                                onChange={(e) => setBulkText(e.target.value)}
                                rows={4}
                                placeholder={"Branch A\nBranch B\nBranch C"}
                                className="w-full rounded-lg border border-warm bg-card px-3 py-2 font-mono text-xs text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal"
                            />
                            <button
                                type="button"
                                onClick={handleCreateBulkSubs}
                                disabled={creatingBulk || !bulkText.trim()}
                                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-teal-dark disabled:opacity-50"
                            >
                                <Plus size={14} />
                                {creatingBulk ? "Adding..." : "Add all"}
                            </button>
                        </div>
                    </div>

                    {/* Assign existing operators as subs */}
                    {assignableOperators.length > 0 && (
                        <div className="mt-4 rounded-lg border border-warm bg-cream/40 p-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                                Or assign existing operators as subs
                            </p>
                            <div className="max-h-48 overflow-y-auto rounded-lg border border-warm bg-card">
                                <ul className="divide-y divide-warm/60">
                                    {assignableOperators.map((op) => {
                                        const checked = assignSelection.has(op.id);
                                        return (
                                            <li
                                                key={op.id}
                                                className="flex items-center gap-2 px-3 py-1.5 text-sm transition hover:bg-cream"
                                            >
                                                <label className="flex flex-1 cursor-pointer items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleAssign(op.id)}
                                                        className="h-4 w-4 cursor-pointer accent-teal"
                                                    />
                                                    <span className="text-ink">{op.operator}</span>
                                                    <span className="text-xs text-ink-subtle">
                                                        currently main
                                                    </span>
                                                </label>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                            <div className="mt-2 flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleAssignSelected}
                                    disabled={assigning || assignSelection.size === 0}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-ink transition hover:bg-teal-dark disabled:opacity-50"
                                >
                                    <Plus size={14} />
                                    {assigning
                                        ? "Assigning..."
                                        : `Assign ${assignSelection.size || ""} as sub${assignSelection.size === 1 ? "" : "s"}`}
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            )}

            {/* Sub-operators of the active main */}
            {activeMainId && (
                <section className="rounded-2xl border border-warm bg-card p-5 shadow-sm">
                    <h3 className="mb-3 text-sm font-semibold text-ink">
                        Sub-operators ({subsOfActive.length})
                    </h3>

                    {subsOfActive.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-warm bg-cream/50 px-3 py-4 text-center text-sm text-ink-subtle">
                            No sub-operators under this main yet. Add some above.
                        </p>
                    ) : (
                        <ul className="divide-y divide-warm/60 rounded-lg border border-warm">
                            {subsOfActive.map((sub) => {
                                const linkedUser = usersByOperatorId.get(sub.id);
                                return (
                                    <li
                                        key={sub.id}
                                        className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="min-w-0">
                                            <span className="font-medium text-ink">
                                                {sub.operator}
                                            </span>
                                            {linkedUser ? (
                                                <span className="ml-2 rounded-full bg-teal-light/30 px-2 py-0.5 text-xs font-medium text-ink">
                                                    user: {linkedUser.email}
                                                </span>
                                            ) : (
                                                <span className="ml-2 rounded-full bg-peach/40 px-2 py-0.5 text-xs font-medium text-ink">
                                                    no user yet
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {!linkedUser && (
                                                <button
                                                    type="button"
                                                    onClick={() => setCreatingUserFor(sub)}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-warm bg-card px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-cream"
                                                    title="Create a login account for this sub-operator"
                                                >
                                                    <UserPlus size={12} />
                                                    Create user
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            )}

            {creatingUserFor && (
                <CreateSubOperatorUserModal
                    subOperator={creatingUserFor}
                    parentOperator={
                        operators.find(
                            (o) => o.id === creatingUserFor.parent_operator_id
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
