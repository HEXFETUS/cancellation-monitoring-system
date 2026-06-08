import { useEffect, useMemo, useRef, useState } from "react";
import { History, Search, Send, X, XCircle } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { fetchOperators, fetchPosRecords } from "../../pos/services";
import type { OperatorInfo, PosRecord } from "../../pos/types";
import {
    cancelOperatorChangeRequest,
    createOperatorChangeRequest,
    listOperatorChangeRequests,
    type OperatorChangeRequest,
} from "../../requests/services/operatorChangeRequests";
import { Toast } from "../../../shared/components";
import ConfirmationModal from "../../pos/components/ConfirmationModal";

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const teal = "#92C7CF";
const tealLight = "#AAD7D9";

interface Me {
    id: number;
    operator_id: number | null;
    parent_operator_id: number | null;
}

export default function RequestPosPage() {
    const { user } = useAuth();
    const [darkMode, setDarkMode] = useState(() => {
        return localStorage.getItem("theme") === "dark";
    });
    const [me, setMe] = useState<Me | null>(null);
    const [allOperators, setAllOperators] = useState<OperatorInfo[]>([]);
    const [allPos, setAllPos] = useState<PosRecord[]>([]);
    const [requests, setRequests] = useState<OperatorChangeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");

    // Form 1: input field + operator detection
    const [typedQuery, setTypedQuery] = useState("");
    const [matchedRecord, setMatchedRecord] = useState<PosRecord | null>(null);
    const [matchedOperator, setMatchedOperator] = useState<OperatorInfo | null>(null);
    const [matchError, setMatchError] = useState("");
    const [reason, setReason] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // Toast state
    const [toastOpen, setToastOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastType, setToastType] = useState<"success" | "error" | "info" | "warning">("success");

    // Floating toast state (top-center) for status change notifications
    const [floatingToastOpen, setFloatingToastOpen] = useState(false);
    const [floatingToastMessage, setFloatingToastMessage] = useState("");
    const [floatingToastType, setFloatingToastType] = useState<"success" | "error" | "info" | "warning">("success");

    // Track previous request statuses to detect approved/rejected changes
    const prevRequestStatusMap = useRef<Map<number, string>>(new Map());
    const isInitialLoad = useRef(true);

    // Observe dark mode changes on <html>
    useEffect(() => {
        const handleThemeChange = () => {
            setDarkMode(localStorage.getItem("theme") === "dark");
        };
        const observer = new MutationObserver(() => {
            setDarkMode(document.documentElement.classList.contains("dark"));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        window.addEventListener("storage", handleThemeChange);
        return () => {
            observer.disconnect();
            window.removeEventListener("storage", handleThemeChange);
        };
    }, []);

    const myOperator = useMemo(() => {
        const myOpId = me?.operator_id != null ? Number(me.operator_id) : null;
        if (myOpId != null)
            return allOperators.find((o) => Number(o.id) === myOpId) ?? null;
        const myUserId = user?.id != null ? Number(user.id) : null;
        if (myUserId != null)
            return (
                allOperators.find(
                    (o) => o.user_id != null && Number(o.user_id) === myUserId
                ) ?? null
            );
        return null;
    }, [me, allOperators, user?.id]);

    const refresh = async () => {
        if (!user?.id) return;
        try {
            setLoading(true);
            setError("");

            // Capture previous statuses before fetching new data
            const prevStatuses = new Map(prevRequestStatusMap.current);

            const meRes = await fetch(
                `${API_BASE_URL}/api/users/me?id=${user.id}`
            );
            const meData = meRes.ok ? await meRes.json() : null;
            setMe(
                meData
                    ? {
                        id: meData.id,
                        operator_id: meData.operator_id ?? null,
                        parent_operator_id: meData.parent_operator_id ?? null,
                    }
                    : null
            );

            // Pull a wide pos_records set so the lookup works regardless of
            // whether the device is currently under the user. We cap to a
            // reasonable size so the page stays snappy.
            const [pos, ops, reqs] = await Promise.all([
                fetchPosRecords().catch(() => [] as PosRecord[]),
                fetchOperators().catch(() => [] as OperatorInfo[]),
                listOperatorChangeRequests({ userId: user.id }).catch(
                    () => [] as OperatorChangeRequest[]
                ),
            ]);
            setAllPos(pos);
            setAllOperators(ops);
            setRequests(reqs);

            // Detect status changes from approved/rejected perspective
            if (!isInitialLoad.current) {
                for (const req of reqs) {
                    const prevStatus = prevStatuses.get(req.id);
                    const currentStatus = (req.status || "").toLowerCase();
                    if (prevStatus === "pending" && (currentStatus === "approved" || currentStatus === "rejected")) {
                        const deviceInfo = req.device_no || `POS #${req.pos_record_id}`;
                        if (currentStatus === "approved") {
                            setFloatingToastType("success");
                            setFloatingToastMessage(`POS request for ${deviceInfo} has been approved.`);
                            setFloatingToastOpen(true);
                        } else {
                            setFloatingToastType("error");
                            setFloatingToastMessage(`POS request for ${deviceInfo} has been rejected.`);
                            setFloatingToastOpen(true);
                        }
                    }
                }
            }

            // Update the status map for next comparison
            const newStatusMap = new Map<number, string>();
            for (const req of reqs) {
                newStatusMap.set(req.id, (req.status || "").toLowerCase());
            }
            prevRequestStatusMap.current = newStatusMap;
            isInitialLoad.current = false;
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    // Look up the POS record + operator when the user finishes typing
    // a device number or serial number. Trigger on Enter or on the
    // "Look up" button.
    const lookupRecord = (raw: string) => {
        const q = raw.trim();
        if (!q) {
            setMatchedRecord(null);
            setMatchedOperator(null);
            setMatchError("");
            return;
        }
        const needle = q.toLowerCase();
        const found = allPos.find((r) => {
            const device = String(r.device_no || "").toLowerCase();
            const serial = String(
                r.serial_number || r.serial_no || ""
            ).toLowerCase();
            return device === needle || serial === needle;
        });
        if (!found) {
            setMatchedRecord(null);
            setMatchedOperator(null);
            setMatchError("No POS device found with that device number or serial number.");
            return;
        }
        const op = allOperators.find(
            (o) => Number(o.id) === Number(found.operator_id)
        );
        setMatchedRecord(found);
        setMatchedOperator(op ?? null);
        setMatchError("");
    };

    const handleLookup = () => lookupRecord(typedQuery);

    const handleSubmit = async () => {
        if (!matchedRecord || !user?.id) return;
        setSubmitting(true);
        try {
            await createOperatorChangeRequest({
                user_id: user.id,
                pos_record_id: matchedRecord.id,
                reason: reason.trim() || undefined,
            });
            setShowConfirm(false);
            setToastType("success");
            setToastMessage(
                "Request submitted. The admin will review your request shortly."
            );
            setToastOpen(true);
            setTypedQuery("");
            setMatchedRecord(null);
            setMatchedOperator(null);
            setMatchError("");
            setReason("");
            await refresh();
        } catch (e) {
            setShowConfirm(false);
            setToastType("error");
            setToastMessage(
                e instanceof Error ? e.message : "Failed to submit request"
            );
            setToastOpen(true);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancelRequest = async (id: number) => {
        if (!user?.id) return;
        try {
            await cancelOperatorChangeRequest(id, user.id);
            setToastType("info");
            setToastMessage("Request cancelled.");
            setToastOpen(true);
            await refresh();
        } catch (e) {
            setToastType("error");
            setToastMessage(
                e instanceof Error ? e.message : "Failed to cancel request"
            );
            setToastOpen(true);
        }
    };

    const isAlreadyMine =
        matchedRecord &&
        myOperator &&
        Number(matchedRecord.operator_id) === Number(myOperator.id);

    const hasPendingForDevice =
        matchedRecord != null &&
        requests.some(
            (r) =>
                r.pos_record_id === matchedRecord.id &&
                r.status.toLowerCase() === "pending"
        );

    const inputStyle = {
        background: darkMode ? "rgba(31,41,55,0.80)" : "rgba(255,255,255,0.78)",
        border: darkMode ? "1px solid rgba(75,85,99,0.55)" : "1px solid rgba(146,199,207,0.30)",
        color: darkMode ? "#F3F4F6" : "#1F2937",
        boxShadow: darkMode ? "none" : "inset 0 1px 0 rgba(255,255,255,0.55)",
        backdropFilter: "blur(8px)",
    };

    const getStatusBadgeStyle = (status: string): React.CSSProperties => {
        const normalized = status.toLowerCase();
        if (normalized === "pending") {
            return darkMode
                ? { backgroundColor: "rgba(146,64,14,0.60)", color: "#FDE68A" }
                : { backgroundColor: "#FEF3C7", color: "#B45309" };
        }
        if (normalized === "approved") {
            return darkMode
                ? { backgroundColor: "rgba(22,101,52,0.60)", color: "#BBF7D0" }
                : { backgroundColor: "#DCFCE7", color: "#15803D" };
        }
        if (normalized === "rejected") {
            return darkMode
                ? { backgroundColor: "rgba(153,27,27,0.60)", color: "#FECACA" }
                : { backgroundColor: "#FEE2E2", color: "#B91C1C" };
        }
        return darkMode
            ? { backgroundColor: "rgba(55,65,81,0.80)", color: "#D1D5DB" }
            : { backgroundColor: "#F3F4F6", color: "#4B5563" };
    };

    const filteredRequests = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return requests;
        return requests.filter(
            (r) =>
                (r.device_no || "").toLowerCase().includes(q) ||
                (r.serial_number || "").toLowerCase().includes(q) ||
                (r.from_operator || "").toLowerCase().includes(q) ||
                (r.to_operator || "").toLowerCase().includes(q)
        );
    }, [requests, search]);

    return (
        <div className="w-full max-w-full space-y-5">
            {error && (
                <div className="relative rounded-xl border border-red-200/60 bg-red-50/95 backdrop-blur-xl px-4 py-3 text-sm font-medium text-red-700 shadow-lg flex items-center gap-2">
                    <span>{error}</span>
                </div>
            )}

            {/* Floating toast (top-center) for status change notifications */}
            <Toast open={floatingToastOpen} message={floatingToastMessage} type={floatingToastType} onClose={() => setFloatingToastOpen(false)} position="top-center" />

            {/* Form 1: type POS + operator detection */}
            <div className="relative rounded-2xl border border-white/50 backdrop-blur-xl bg-white/25 shadow-lg p-5 max-w-4xl">
                <h2 className="text-sm font-semibold text-gray-800 mb-3">
                    Request to add a POS device under your operator account. An admin must approve before the change takes effect.
                </h2>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="text"
                        value={typedQuery}
                        onChange={(e) => {
                            setTypedQuery(e.target.value);
                            setMatchedRecord(null);
                            setMatchedOperator(null);
                            setMatchError("");
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                handleLookup();
                            }
                        }}
                        placeholder="Type a device number or serial number…"
                        className="h-10 flex-1 rounded-xl px-3 text-sm outline-none transition-all duration-200 focus:border-[#92C7CF]/60 focus:ring-2 focus:ring-[#92C7CF]/35 placeholder:text-gray-400 dark:placeholder:text-gray-400"
                        style={inputStyle}
                    />
                    <button
                        onClick={handleLookup}
                        disabled={!typedQuery.trim()}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                        style={{
                            background: `linear-gradient(135deg, ${teal}, ${tealLight})`,
                            boxShadow: "0 2px 8px rgba(146,199,207,0.30)",
                        }}
                    >
                        <Search size={14} />
                        Look up
                    </button>
                </div>

                {/* Match result message */}
                {matchError && (
                    <div className="mt-3 rounded-xl border border-red-200/60 bg-red-50/95 backdrop-blur-xl px-4 py-3 text-sm font-medium text-red-700">
                        {matchError}
                    </div>
                )}

                {matchedRecord && !matchError && (
                    <div className="mt-3 rounded-xl border border-white/40 bg-white/40 backdrop-blur-xl p-4">
                        <p className="text-sm text-gray-700">
                            <span className="font-semibold">Device:</span>{" "}
                            {matchedRecord.device_no}{" "}
                            <span className="text-gray-500 text-xs">
                                (SN: {matchedRecord.serial_number || matchedRecord.serial_no || "—"})
                            </span>
                        </p>
                        <p className="mt-1 text-sm text-gray-700">
                            <span className="font-semibold">Currently stored under:</span>{" "}
                            <span style={{ color: teal }} className="font-semibold">
                                {matchedOperator?.operator || "Unassigned"}
                            </span>
                        </p>
                        {myOperator && matchedOperator && (
                            <p className="mt-2 text-sm text-gray-700">
                                You are requesting this device be re-assigned under{" "}
                                <span className="font-semibold" style={{ color: teal }}>
                                    {myOperator.operator}
                                </span>
                                . Do you want to proceed?
                            </p>
                        )}
                        <div className="mt-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Reason <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Enter reason for this request…"
                                className="w-full rounded-xl px-3 py-2 text-sm outline-none transition-all duration-200 focus:border-[#92C7CF]/60 focus:ring-2 focus:ring-[#92C7CF]/35 placeholder:text-gray-400 dark:placeholder:text-gray-400"
                                style={inputStyle}
                            />
                        </div>

                        {isAlreadyMine ? (
                            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                                This POS device is already stored under you. No request needed.
                            </p>
                        ) : hasPendingForDevice ? (
                            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                                There is already a pending request for this device.
                            </p>
                        ) : (
                            <div className="mt-3 flex items-center gap-2">
                                <button
                                    onClick={() => setShowConfirm(true)}
                                    disabled={submitting || !reason.trim()}
                                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                                    style={{
                                        background: `linear-gradient(135deg, ${teal}, ${tealLight})`,
                                        boxShadow: "0 2px 8px rgba(146,199,207,0.30)",
                                    }}
                                    title={!reason.trim() ? "Please enter a reason" : ""}
                                >
                                    <Send size={14} />
                                    {submitting ? "Submitting..." : "Request"}
                                </button>
                                <button
                                    onClick={() => {
                                        setTypedQuery("");
                                        setMatchedRecord(null);
                                        setMatchedOperator(null);
                                        setMatchError("");
                                    }}
                                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium text-gray-600 dark:text-gray-400 transition-all duration-200 hover:bg-white/50 dark:hover:bg-white/10"
                                    style={{
                                        border: darkMode ? "1px solid rgba(75,85,99,0.40)" : "1px solid rgba(146,199,207,0.20)",
                                        background: darkMode ? "rgba(31,41,55,0.50)" : "rgba(255,255,255,0.25)",
                                    }}
                                >
                                    <X size={14} />
                                    Clear
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Form 2: my requests table */}
            <div className="relative rounded-2xl border border-white/50 backdrop-blur-xl bg-white/25 shadow-lg overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-white/40 px-5 py-3">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                        <History size={16} />
                        Request POS History
                    </h2>
                    <div className="relative">
                        <Search
                            size={14}
                            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                        />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search…"
                            className="h-9 w-44 rounded-xl pl-8 pr-3 text-sm outline-none transition-all duration-200 focus:border-[#92C7CF]/60 focus:ring-2 focus:ring-[#92C7CF]/35 placeholder:text-gray-400 dark:placeholder:text-gray-400"
                            style={inputStyle}
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-white/40 bg-gradient-to-r from-[#92C7CF]/10 to-[#AAD7D9]/10">
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                                    Device
                                </th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                                    From
                                </th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                                    To
                                </th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                                    Status
                                </th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                                    Submitted
                                </th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                                    Admin Note
                                </th>
                                <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-4 py-10 text-center text-gray-500"
                                    >
                                        Loading…
                                    </td>
                                </tr>
                            ) : filteredRequests.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        className="px-4 py-10 text-center text-gray-500"
                                    >
                                        No request POS history yet.
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map((r) => (
                                    <tr
                                        key={r.id}
                                        className="border-b border-white/30 transition hover:bg-[#92C7CF]/8"
                                    >
                                        <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-800">
                                            <div className="flex flex-col">
                                                <span>{r.device_no || `POS #${r.pos_record_id}`}</span>
                                                <span className="text-xs text-gray-500 font-mono">
                                                    SN: {r.serial_number || "—"}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                                            {r.from_operator || "Unassigned"}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 font-medium" style={{ color: teal }}>
                                            {r.to_operator || "—"}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3">
                                            <span
                                                className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide"
                                                style={getStatusBadgeStyle(r.status)}
                                            >
                                                {r.status}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                                            {r.created_at
                                                ? new Date(r.created_at).toLocaleString()
                                                : "—"}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-3 text-gray-500 max-w-[200px] truncate" title={r.admin_notes || ""}>{r.admin_notes || "—"}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-right">
                                            {r.status === "pending" ? (
                                                <button
                                                    onClick={() => handleCancelRequest(r.id)}
                                                    className="group inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-red-700 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
                                                    style={{
                                                        background: "rgba(232,180,184,0.40)",
                                                        border: "1px solid rgba(232,180,184,0.80)",
                                                    }}
                                                >
                                                    <XCircle size={13} />
                                                    Cancel
                                                </button>
                                            ) : (
                                                <span className="text-xs text-gray-400">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Toast
                open={toastOpen}
                message={toastMessage}
                type={toastType}
                onClose={() => setToastOpen(false)}
                position="top-center"
            />

            <ConfirmationModal
                open={showConfirm && !!matchedRecord}
                title="Confirm POS Request"
                message="Are you sure you want to request this POS device to be re-assigned under you? An admin will need to approve it before the change takes effect."
                confirmLabel="Submit Request"
                cancelLabel="Cancel"
                isLoading={submitting}
                loadingLabel="Submitting..."
                onCancel={() => {
                    if (submitting) return;
                    setShowConfirm(false);
                }}
                onConfirm={handleSubmit}
            >
                {matchedRecord && (
                    <>
                        <div className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">Device</span>
                            <span className="text-sm font-semibold text-ink">
                                {matchedRecord.device_no}
                                <span className="ml-1 text-xs font-mono font-normal text-ink-muted">
                                    (SN: {matchedRecord.serial_number || matchedRecord.serial_no || "—"})
                                </span>
                            </span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">From</span>
                            <span className="text-sm font-semibold text-ink">
                                {matchedOperator?.operator || "Unassigned"}
                            </span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-2.5">
                            <span className="text-xs font-medium text-ink-muted uppercase tracking-wider">To</span>
                            <span className="text-sm font-semibold" style={{ color: teal }}>
                                {myOperator?.operator || "—"}
                            </span>
                        </div>
                    </>
                )}
            </ConfirmationModal>
        </div>
    );
}