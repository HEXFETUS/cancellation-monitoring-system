import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import {
    LogOut,
    Menu,
    X,
    LayoutDashboard,
    Monitor,
    Wrench,
    FileText,
    Package,
    Settings,
    User,
    Building2,
    MapPin,
    Eye,
    Code,
    ClipboardList,
    ArrowUpRight,
    Stethoscope,
    Megaphone,
    MessageSquare,
    Send,
    Notebook,
    Sun,
    Moon,
    Star,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useEffect, useRef, useState } from "react";
import { FloatingAlert } from "../../shared/components";
import hexLogo from "../../assets/HEXLOGO.png";

const teal = "#92C7CF";
const tealLight = "#AAD7D9";
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

type SidebarUser = {
    id?: number;
    name?: string;
    email?: string;
    usertype?: string;
    department?: string;
    profile_picture?: string | null;
};

import type { LucideIcon } from "lucide-react";

// Build a fully qualified URL for a stored profile picture path. The DB stores
// the relative `/uploads/...` path; the static handler lives on the same
// backend origin as the API, so we prefix with API_BASE_URL.
function resolveAvatarUrl(p?: string | null) {
    if (!p) return null;
    if (/^https?:\/\//i.test(p)) return p;
    return `${API_BASE_URL}${p}`;
}

const iconMap: Record<string, LucideIcon> = {
    Dashboard: LayoutDashboard,
    Devices: Monitor,
    "My POS": Monitor,
    Outlets: Building2,
    "My Outlets": Building2,
    "Sub-Operator": User,
    "POS Inventory": Monitor,
    "POS": Monitor,
    "POS Repair": Wrench,
    Cancellation: FileText,
    "Asset Inventory": Package,
    Summary: LayoutDashboard,
    Office: Building2,
    Payout: MapPin,
    Drawcourt: Monitor,
    OBS: Eye,
    "Asset Coding": Code,
    "Repair Request": ClipboardList,
    "Repair Management": Wrench,
    "Repair Log": FileText,
    "Released Log": ArrowUpRight,
    "Diagnosis List": Stethoscope,
    Posts: Megaphone,
    "Bulletin Board": MessageSquare,
    "Request POS": Send,
    Requests: Notebook,
    Settings: Settings,
};

export default function DashboardLayout() {
    const location = useLocation();
    const { logout, user: authUser } = useAuth();
    const navigate = useNavigate();
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [sidebarUser, setSidebarUser] = useState<SidebarUser | null>(authUser);
    const [darkMode, setDarkMode] = useState(() => {
        return localStorage.getItem("theme") === "dark";
    });
    const [bulletinUnread, setBulletinUnread] = useState(0);
    const [pendingBoothRequests, setPendingBoothRequests] = useState(0);
    const [pendingOperatorChangeCount, setPendingOperatorChangeCount] = useState(0);
    const [pendingBoothOperatorChangeCount, setPendingBoothOperatorChangeCount] = useState(0);
    const [forCheckingRepairCount, setForCheckingRepairCount] = useState(0);
    // Count of the operator's booth-change requests that have been
    // approved or rejected. These relate to the "My POS" page.
    const [operatorPosApprovedRejectedCount, setOperatorPosApprovedRejectedCount] = useState(0);
    // Count of the operator's booth-operator-change requests that have
    // been approved or rejected. These relate to the "My Outlets" page.
    const [operatorOutletApprovedRejectedCount, setOperatorOutletApprovedRejectedCount] = useState(0);
    // "Seen" markers per nav. They are stored in localStorage so the red
    // dot stays dismissed across reloads, but we ALSO track a "session
    // initialized" flag in sessionStorage so that the first load of a
    // fresh session does not surface a floating alert for requests that
    // were approved/rejected on a previous day.
    const [operatorSeenMyPos, setOperatorSeenMyPos] = useState(() => {
        try {
            return Number(localStorage.getItem(`operator_seen_mypos_${authUser?.id}`) ?? 0);
        } catch {
            return 0;
        }
    });
    const [operatorSeenMyOutlets, setOperatorSeenMyOutlets] = useState(() => {
        try {
            return Number(localStorage.getItem(`operator_seen_myoutlets_${authUser?.id}`) ?? 0);
        } catch {
            return 0;
        }
    });
    // True once we've captured the operator's request counts on the
    // current session/login. Used to suppress the floating alert for
    // pre-existing approved/rejected requests from a previous day.
    const [operatorSessionInitialized, setOperatorSessionInitialized] = useState(() => {
        try {
            return sessionStorage.getItem(`operator_session_initialized_${authUser?.id}`) === "1";
        } catch {
            return false;
        }
    });
    // Sync dark mode class on document root and on mount
    useEffect(() => {
        document.documentElement.classList.toggle("dark", darkMode);
    }, [darkMode]);

    useEffect(() => {
        setSidebarUser(authUser);

        if (!authUser?.id) return;

        let ignored = false;

        fetch(`${API_BASE_URL}/api/users/me?id=${authUser.id}`)
            .then((res) => {
                if (!res.ok) {
                    throw new Error("Failed to fetch current user");
                }

                return res.json();
            })
            .then((data: SidebarUser) => {
                if (!ignored) {
                    setSidebarUser({ ...authUser, ...data });
                }
            })
            .catch(() => { });

        return () => {
            ignored = true;
        };
    }, [authUser]);

    // Poll the bulletin board unread count so the sidebar badge stays
    // current. Cheap O(1) query on the backend; 8s cadence is enough — the
    // badge isn't time-sensitive and the chat page itself polls faster.
    useEffect(() => {
        if (!authUser?.id) {
            setBulletinUnread(0);
            return;
        }
        let cancelled = false;

        const fetchUnread = async () => {
            if (cancelled) return;
            try {
                const res = await fetch(
                    `${API_BASE_URL}/api/bulletin/unread-count?user_id=${authUser.id}`
                );
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled) setBulletinUnread(Number(data?.unread ?? 0));
            } catch {
                // Non-fatal — badge just stays at its previous value.
            }
        };

        fetchUnread();
        const interval = window.setInterval(fetchUnread, 8000);
        const onVisibility = () => {
            if (document.visibilityState === "visible") fetchUnread();
        };
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [authUser?.id, location.pathname]);

    useEffect(() => {
        if (!authUser?.id) {
            setPendingBoothRequests(0);
            return;
        }
        let cancelled = false;

        const fetchPendingBoothRequests = async () => {
            if (cancelled) return;
            try {
                const res = await fetch(`${API_BASE_URL}/api/booth-change-requests?status=pending`);
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled) {
                    setPendingBoothRequests(Array.isArray(data) ? data.length : 0);
                }
            } catch {
                // Non-fatal — badge just stays at its previous value.
            }
        };

        fetchPendingBoothRequests();
        const interval = window.setInterval(fetchPendingBoothRequests, 8000);
        const onVisibility = () => {
            if (document.visibilityState === "visible") fetchPendingBoothRequests();
        };
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [authUser?.id, location.pathname]);

    // Poll pending operator change requests (Assign POS tab)
    useEffect(() => {
        if (!authUser?.id) {
            setPendingOperatorChangeCount(0);
            return;
        }
        let cancelled = false;

        const fetchPendingOperatorChanges = async () => {
            if (cancelled) return;
            try {
                const res = await fetch(`${API_BASE_URL}/api/operator-change-requests?status=pending`);
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled) {
                    setPendingOperatorChangeCount(Array.isArray(data) ? data.length : 0);
                }
            } catch {
                // Non-fatal — badge just stays at its previous value.
            }
        };

        fetchPendingOperatorChanges();
        const interval = window.setInterval(fetchPendingOperatorChanges, 8000);
        const onVisibility = () => {
            if (document.visibilityState === "visible") fetchPendingOperatorChanges();
        };
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [authUser?.id, location.pathname]);

    // Poll pending booth operator change requests (Assign Outlet tab)
    useEffect(() => {
        if (!authUser?.id) {
            setPendingBoothOperatorChangeCount(0);
            return;
        }
        let cancelled = false;

        const fetchPendingBoothOperatorChanges = async () => {
            if (cancelled) return;
            try {
                const res = await fetch(`${API_BASE_URL}/api/booth-operator-change-requests?status=pending`);
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled) {
                    setPendingBoothOperatorChangeCount(Array.isArray(data) ? data.length : 0);
                }
            } catch {
                // Non-fatal — badge just stays at its previous value.
            }
        };

        fetchPendingBoothOperatorChanges();
        const interval = window.setInterval(fetchPendingBoothOperatorChanges, 8000);
        const onVisibility = () => {
            if (document.visibilityState === "visible") fetchPendingBoothOperatorChanges();
        };
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [authUser?.id, location.pathname]);

    useEffect(() => {
        if (!authUser?.id) {
            setForCheckingRepairCount(0);
            return;
        }
        let cancelled = false;

        const fetchForCheckingRepairCount = async () => {
            if (cancelled) return;
            try {
                const res = await fetch(`${API_BASE_URL}/api/repair-records`);
                if (!res.ok) return;
                const payload = await res.json();
                const records = Array.isArray(payload) ? payload : payload?.data ?? payload?.rows ?? [];
                if (!cancelled) {
                    setForCheckingRepairCount(
                        Array.isArray(records)
                            ? records.filter((record) => record?.status === "For Repair").length
                            : 0
                    );
                }
            } catch {
                // Non-fatal — badge just stays at its previous value.
            }
        };

        fetchForCheckingRepairCount();
        const interval = window.setInterval(fetchForCheckingRepairCount, 8000);
        const onVisibility = () => {
            if (document.visibilityState === "visible") fetchForCheckingRepairCount();
        };
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [authUser?.id, location.pathname]);

    const isAdmin = (sidebarUser?.usertype ?? authUser?.usertype) === "admin";
    const isOperator = (sidebarUser?.usertype ?? authUser?.usertype) === "operator";
    const isPurchaser = (sidebarUser?.usertype ?? authUser?.usertype) === "purchaser";
    const isCsr = (sidebarUser?.usertype ?? authUser?.usertype) === "csr";
    // The pending-requests floating alert is restricted to the IT department.
    // Department is case-insensitive and trimmed to handle small data-entry
    // variations like "it", "IT", or "It " across the system.
    const isITDepartment =
        (sidebarUser?.department ?? authUser?.department ?? "").trim().toLowerCase() === "it";

    // Poll the operator's booth-change requests ("My POS") and
    // booth-operator-change requests ("My Outlets") for approved/rejected
    // status. Each section tracks its own count so the red dot only shows
    // up on the nav where the operator actually has a freshly decided
    // request, never on both at the same time. On the first successful
    // poll of a fresh session we capture the current counts as "seen"
    // so that pre-existing approved/rejected requests from a previous
    // day do not pop a floating toast on login.
    const operatorFirstPollDoneRef = useRef(false);
    useEffect(() => {
        if (!authUser?.id || !isOperator) {
            setOperatorPosApprovedRejectedCount(0);
            setOperatorOutletApprovedRejectedCount(0);
            return;
        }
        let cancelled = false;

        const fetchOperatorRequestCounts = async () => {
            if (cancelled) return;
            try {
                const [posRes, outletRes] = await Promise.all([
                    fetch(
                        `${API_BASE_URL}/api/booth-change-requests?userId=${authUser.id}`
                    ),
                    fetch(
                        `${API_BASE_URL}/api/booth-operator-change-requests?userId=${authUser.id}`
                    ),
                ]);
                const posData = posRes.ok ? await posRes.json() : [];
                const outletData = outletRes.ok ? await outletRes.json() : [];
                if (cancelled) return;
                const posCount = Array.isArray(posData)
                    ? posData.filter(
                        (r: { status?: string }) =>
                            r.status === "approved" || r.status === "rejected"
                    ).length
                    : 0;
                const outletCount = Array.isArray(outletData)
                    ? outletData.filter(
                        (r: { status?: string }) =>
                            r.status === "approved" || r.status === "rejected"
                    ).length
                    : 0;
                setOperatorPosApprovedRejectedCount(posCount);
                setOperatorOutletApprovedRejectedCount(outletCount);

                // First successful poll of a fresh session: capture the
                // current counts as "seen" so that the operator is not
                // re-prompted for requests that were already approved or
                // rejected before they logged in. This runs exactly once
                // per mount of the operator section.
                if (!operatorFirstPollDoneRef.current) {
                    operatorFirstPollDoneRef.current = true;
                    setOperatorSeenMyPos(posCount);
                    setOperatorSeenMyOutlets(outletCount);
                    try {
                        localStorage.setItem(`operator_seen_mypos_${authUser.id}`, String(posCount));
                        localStorage.setItem(`operator_seen_myoutlets_${authUser.id}`, String(outletCount));
                        sessionStorage.setItem(`operator_session_initialized_${authUser.id}`, "1");
                    } catch { /* storage unavailable */ }
                    setOperatorSessionInitialized(true);
                }
            } catch {
                // Non-fatal — badges just stay at their previous value.
            }
        };

        fetchOperatorRequestCounts();
        const interval = window.setInterval(fetchOperatorRequestCounts, 8000);
        const onVisibility = () => {
            if (document.visibilityState === "visible") fetchOperatorRequestCounts();
        };
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [authUser?.id, isOperator, location.pathname]);

    // Red dot for each nav only triggers when the *corresponding* request
    // type has a fresh approval/rejection that the operator hasn't
    // acknowledged. Using separate counts means a decision on a "My POS"
    // request never causes the "My Outlets" entry to glow.
    const operatorMyPosHasNew =
        isOperator && operatorSessionInitialized && operatorPosApprovedRejectedCount > operatorSeenMyPos;
    const operatorMyOutletsHasNew =
        isOperator && operatorSessionInitialized && operatorOutletApprovedRejectedCount > operatorSeenMyOutlets;

    const handleMarkMyPosSeen = () => {
        const posCount = operatorPosApprovedRejectedCount;
        setOperatorSeenMyPos(posCount);
        try {
            localStorage.setItem(`operator_seen_mypos_${authUser?.id}`, String(posCount));
        } catch { /* localStorage unavailable */ }
    };

    const handleMarkMyOutletsSeen = () => {
        const outletCount = operatorOutletApprovedRejectedCount;
        setOperatorSeenMyOutlets(outletCount);
        try {
            localStorage.setItem(`operator_seen_myoutlets_${authUser?.id}`, String(outletCount));
        } catch { /* localStorage unavailable */ }
    };
    const displayName = sidebarUser?.name?.trim() || authUser?.name?.trim() || "User";
    const displayDepartment = sidebarUser?.department?.trim() || authUser?.department?.trim();
    let sidebarDisplayName = displayName;
    const displayUserType =
        sidebarUser?.usertype?.trim() || authUser?.usertype?.trim() || "Unknown role";
    const avatarUrl = resolveAvatarUrl(sidebarUser?.profile_picture ?? authUser?.profile_picture);

    const handleLogout = async () => {
        await logout();
        navigate("/");
    };

    const closeMobileSidebar = () => setMobileSidebarOpen(false);

    // Operators get a slim sidebar with only their own POS view.
    // Purchasers get one sidebar entry per asset section (instead of
    // a single "Assets" link that hid the sub-tabs inside).
    // CSR gets only Dashboard and POS Repair.
    // Admin see the full menu.
    const navItems = isOperator
        ? [
            { name: "Dashboard", path: "/app/dashboard" },
            { name: "Devices", path: "/app/my-pos" },
            { name: "Outlets", path: "/app/my-outlets" },
            { name: "Settings", path: "/app/settings" },
        ]
        : isPurchaser
            ? [
                { name: "Summary", path: "/app/asset-inventory/summary" },
                { name: "Office", path: "/app/asset-inventory/office" },
                { name: "Payout", path: "/app/asset-inventory/payout" },
                { name: "Drawcourt", path: "/app/asset-inventory/drawcourt" },
                { name: "OBS", path: "/app/asset-inventory/obs" },
                { name: "Asset Coding", path: "/app/asset-inventory/asset-coding" },
                { name: "Bulletin Board", path: "/app/bulletin-board" },
                { name: "Settings", path: "/app/settings" },
            ]
            : isCsr
                ? [
                    { name: "Dashboard", path: "/app/dashboard" },
                    { name: "POS Repair", path: "/app/csr-pos-repair" },
                    { name: "Posts", path: "/app/csr-pos-repair/posts" },
                    { name: "Bulletin Board", path: "/app/bulletin-board" },
                    { name: "Settings", path: "/app/settings" },
                ]
                : [
                    { name: "Dashboard", path: "/app/dashboard" },
                    { name: "POS", path: "/app/pos" },
                    { name: "POS Repair", path: "/app/pos-repair" },
                    { name: "Cancellation", path: "/app/cancellation" },
                    { name: "Requests", path: "/app/requests" },
                    { name: "Assets", path: "/app/asset-inventory" },
                    { name: "Bulletin Board", path: "/app/bulletin-board" },
                    { name: "Settings", path: "/app/settings" },
                ];

    const toggleTheme = () => {
        const next = !darkMode;
        setDarkMode(next);
        localStorage.setItem("theme", next ? "dark" : "light");
    };

    return (
        <>
            {/* Global dark-mode overrides for child page content */}
            <style>{`
                @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }

                .dark .main-content-area {
                    color-scheme: dark;
                }

                /* Generic text fallback — only plain elements without a Tailwind text-color class */
                .dark .main-content-area h1:not([class*="text-"]),
                .dark .main-content-area h2:not([class*="text-"]),
                .dark .main-content-area h3:not([class*="text-"]),
                .dark .main-content-area h4:not([class*="text-"]),
                .dark .main-content-area h5:not([class*="text-"]),
                .dark .main-content-area h6:not([class*="text-"]),
                .dark .main-content-area p:not([class*="text-"]),
                .dark .main-content-area span:not([class*="text-"]),
                .dark .main-content-area label:not([class*="text-"]),
                .dark .main-content-area li:not([class*="text-"]),
                .dark .main-content-area a:not([class*="text-"]),
                .dark .main-content-area div:not([class*="text-"]),
                .dark .main-content-area td:not([class*="text-"]),
                .dark .main-content-area th:not([class*="text-"]) {
                    color: #E5E7EB !important;
                }

                /* Neutral utility overrides — these are the "boring" grays */
                .dark .main-content-area .text-gray-500,
                .dark .main-content-area .text-gray-600,
                .dark .main-content-area .text-gray-700,
                .dark .main-content-area .text-gray-800,
                .dark .main-content-area .text-gray-900,
                .dark .main-content-area .text-slate-500,
                .dark .main-content-area .text-slate-600,
                .dark .main-content-area .text-slate-700,
                .dark .main-content-area .text-slate-800,
                .dark .main-content-area .text-slate-900,
                .dark .main-content-area .text-black,
                .dark .main-content-area .text-ink,
                .dark .main-content-area .text-ink-muted {
                    color: #D1D5DB !important;
                }

                /* Light text */
                .dark .main-content-area .text-gray-300,
                .dark .main-content-area .text-gray-200 {
                    color: #F3F4F6 !important;
                }

                /* White backgrounds → dark (covers bg-white, bg-white/10, bg-white/15, bg-white/20, bg-white/25, bg-white/30, bg-white/35, bg-white/40, bg-white/45, bg-white/50, etc.) */
                .dark .main-content-area [class*="bg-white"] {
                    background-color: rgba(31, 41, 55, 0.70) !important;
                    border-color: rgba(75, 85, 99, 0.40) !important;
                }
                /* Grey backgrounds (bg-gray-50, bg-gray-100, bg-gray-200, bg-slate-100, bg-slate-50, etc.) */
                .dark .main-content-area [class*="bg-gray-50"],
                .dark .main-content-area [class*="bg-gray-100"],
                .dark .main-content-area [class*="bg-gray-200"],
                .dark .main-content-area [class*="bg-slate-50"],
                .dark .main-content-area [class*="bg-slate-100"],
                .dark .main-content-area [class*="bg-slate-200"],
                .dark .main-content-area [class*="bg-neutral"],
                .dark .main-content-area [class*="bg-zinc"],
                .dark .main-content-area [class*="bg-stone"] {
                    background-color: rgba(55, 65, 81, 0.60) !important;
                    border-color: rgba(75, 85, 99, 0.40) !important;
                }
                /* Grey text on grey badges — make brighter */
                .dark .main-content-area [class*="bg-gray-50"] [class*="text-gray"],
                .dark .main-content-area [class*="bg-gray-100"] [class*="text-gray"],
                .dark .main-content-area [class*="bg-gray-200"] [class*="text-gray"],
                .dark .main-content-area [class*="bg-slate-100"] [class*="text-slate"],
                .dark .main-content-area [class*="bg-slate-50"] [class*="text-slate"],
                .dark .main-content-area [class*="rounded-full"][class*="bg-gray"],
                .dark .main-content-area [class*="rounded-md"][class*="bg-gray"],
                .dark .main-content-area [class*="rounded-lg"][class*="bg-gray"] {
                    color: #E5E7EB !important;
                }
                /* Gradient borders and backgrounds using from-white / via-white / to-white */
                .dark .main-content-area [class*="from-white"],
                .dark .main-content-area [class*="via-white"],
                .dark .main-content-area [class*="to-white"],
                .dark .main-content-area [class*="bg-linear-to-br"],
                .dark .main-content-area [class*="bg-gradient-to-br"],
                .dark .main-content-area [class*="bg-gradient-to-r"],
                .dark .main-content-area [class*="bg-gradient-to-b"] {
                    border-color: rgba(75, 85, 99, 0.40) !important;
                }
                /* Dividers using divide-white */
                .dark .main-content-area [class*="divide-white"] > * + * {
                    border-color: rgba(75, 85, 99, 0.30) !important;
                }
                .dark .main-content-area [style*="background: white"],
                .dark .main-content-area [style*="background-color: white"],
                .dark .main-content-area [style*="background-color: #fff"],
                .dark .main-content-area [style*="background-color: #ffffff"] {
                    background-color: rgba(31, 41, 55, 0.80) !important;
                    border-color: rgba(75, 85, 99, 0.40) !important;
                }

                /* Form inputs */
                .dark .main-content-area input:not([class*="text-"]),
                .dark .main-content-area select:not([class*="text-"]),
                .dark .main-content-area textarea:not([class*="text-"]) {
                    background-color: rgba(17, 24, 39, 0.80) !important;
                    border-color: rgba(75, 85, 99, 0.50) !important;
                    color: #E5E7EB !important;
                }

                /* Tables */
                .dark .main-content-area table {
                    border-color: rgba(75, 85, 99, 0.40) !important;
                }
                .dark .main-content-area thead,
                .dark .main-content-area thead th,
                .dark .main-content-area thead td {
                    background-color: rgba(31, 41, 55, 0.90) !important;
                    color: #D1D5DB !important;
                    border-color: rgba(75, 85, 99, 0.40) !important;
                }
                .dark .main-content-area tbody tr {
                    border-color: rgba(75, 85, 99, 0.30) !important;
                }
                .dark .main-content-area tbody tr:nth-child(even) {
                    background-color: rgba(31, 41, 55, 0.40) !important;
                }
                .dark .main-content-area tbody tr:nth-child(odd) {
                    background-color: rgba(31, 41, 55, 0.20) !important;
                }
                .dark .main-content-area tbody tr:hover {
                    background-color: rgba(55, 65, 81, 0.50) !important;
                }
                .dark .main-content-area td,
                .dark .main-content-area th {
                    border-color: rgba(75, 85, 99, 0.30) !important;
                }
                .dark .main-content-area td:not([class*="text-"]),
                .dark .main-content-area th:not([class*="text-"]) {
                    color: #D1D5DB !important;
                }
                .dark .main-content-area td [class*="text-gray-400"],
                .dark .main-content-area td [class*="text-gray-500"],
                .dark .main-content-area td [class*="text-gray-600"],
                .dark .main-content-area td [class*="text-gray-700"] {
                    color: #9CA3AF !important;
                }

                /* Shadows */
                .dark .main-content-area .shadow-lg,
                .dark .main-content-area .shadow-xl,
                .dark .main-content-area .shadow-2xl,
                .dark .main-content-area .shadow-md {
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.30) !important;
                }
            `}</style>
            <div
                className="flex h-screen transition-colors duration-300 dark:bg-gray-900"
                style={{
                    background: darkMode
                        ? "#111827"
                        : `
                            radial-gradient(circle at top left, rgba(146,199,207,0.35), transparent 35%),
                            radial-gradient(circle at bottom right, rgba(170,215,217,0.30), transparent 40%),
                            linear-gradient(135deg, #FBF9F1 0%, #E5E1DA 100%)
                        `,
                }}
            >
                {/* Mobile header bar */}
                <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-3 lg:hidden">
                    <button
                        onClick={() => setMobileSidebarOpen(true)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border shadow-lg backdrop-blur-xl transition-colors duration-300 dark:border-gray-700 dark:bg-gray-800/80 border-slate-200 bg-white/80"
                    >
                        <Menu className="h-5 w-5 text-slate-700 dark:text-gray-200" />
                    </button>
                </div>

                {/* Mobile sidebar overlay */}
                {mobileSidebarOpen && (
                    <div
                        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
                        onClick={closeMobileSidebar}
                    />
                )}

                {/* Sidebar */}
                <aside
                    className={`
                    fixed inset-y-0 left-0 z-50 w-72 p-3 transition-transform duration-300 lg:relative lg:translate-x-0
                    ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}
                `}
                >
                    <div
                        className="relative h-full rounded-3xl p-5 flex flex-col overflow-hidden transition-colors duration-300"
                        style={{
                            background: darkMode
                                ? "linear-gradient(160deg, rgba(31,41,55,0.98) 0%, rgba(17,24,39,0.95) 100%)"
                                : `
                                linear-gradient(
                                    160deg,
                                    rgba(255,255,255,0.98) 0%,
                                    rgba(255,255,255,0.90) 40%,
                                    rgba(251,249,241,0.95) 100%
                                )
                            `,
                            border: darkMode
                                ? "1px solid rgba(75,85,99,0.40)"
                                : "1px solid rgba(146,199,207,0.20)",
                            boxShadow: darkMode
                                ? "0 8px 32px rgba(0, 0, 0, 0.40), inset 0 1px 0 rgba(255,255,255,0.05)"
                                : `
                                0 8px 32px rgba(31, 38, 135, 0.12),
                                inset 0 1px 0 rgba(255,255,255,0.80),
                                inset 0 -1px 0 rgba(146,199,207,0.06)
                            `,
                            backdropFilter: "blur(24px)",
                            WebkitBackdropFilter: "blur(24px)",
                        }}
                    >
                        {/* Decorative top-right blob */}
                        <div
                            className="absolute -top-16 -right-16 w-36 h-36 rounded-full opacity-10 blur-3xl pointer-events-none"
                            style={{
                                background: `radial-gradient(circle, ${tealLight}, ${teal})`,
                            }}
                        />
                        {/* Decorative bottom-left blob */}
                        <div
                            className="absolute -bottom-12 -left-12 w-28 h-28 rounded-full opacity-8 blur-3xl pointer-events-none"
                            style={{
                                background: `radial-gradient(circle, ${teal}, ${tealLight})`,
                            }}
                        />

                        {/* Mobile close button */}
                        <button
                            onClick={closeMobileSidebar}
                            className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-xl border dark:border-gray-600 dark:bg-gray-700/80 dark:text-gray-400 border-slate-200 bg-white/80 lg:hidden"
                        >
                            <X className="h-4 w-4 text-slate-500 dark:text-gray-400" />
                        </button>

                        {/* ===== Logo Section ===== */}
                        <div className="relative mb-5 mt-1">
                            <button
                                type="button"
                                onClick={() => window.location.reload()}
                                className="group relative flex w-full items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all duration-300"
                                style={{
                                    background: "linear-gradient(135deg, #92C7CF 0%, #AAD7D9 100%)",
                                    boxShadow: "0 4px 20px rgba(146,199,207,0.35)",
                                }}
                            >
                                {/* Glow effect */}
                                <div
                                    className="absolute inset-0 rounded-2xl opacity-30 blur-md transition-all duration-500 group-hover:opacity-50"
                                    style={{
                                        background: "linear-gradient(135deg, #92C7CF 0%, #AAD7D9 100%)",
                                    }}
                                />
                                <div className="relative flex items-center gap-3">
                                    <img
                                        src={hexLogo}
                                        alt="Logo"
                                        className="h-8 w-8 rounded-xl object-contain"
                                    />
                                    <div>
                                        <span className="block text-white font-bold text-sm tracking-tight">
                                            Hexaprime
                                        </span>
                                        <span className="block text-white/70 text-[10px] font-medium tracking-wide">
                                            Management System
                                        </span>
                                    </div>
                                </div>
                            </button>
                        </div>

                        {/* ===== Navigation ===== */}
                        <nav className="relative flex-1 min-h-0 overflow-y-auto space-y-1">
                            {navItems.map((item) => {
                                const isActive =
                                    location.pathname === item.path ||
                                    location.pathname.startsWith(`${item.path}/`);
                                const Icon = iconMap[item.name] || LayoutDashboard;
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        onClick={() => {
                                            closeMobileSidebar();
                                            if (isOperator && item.name === "My POS") {
                                                handleMarkMyPosSeen();
                                            } else if (isOperator && item.name === "My Outlets") {
                                                handleMarkMyOutletsSeen();
                                            }
                                        }}
                                        className="group relative flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-300"
                                        style={{
                                            background: isActive
                                                ? darkMode
                                                    ? "linear-gradient(135deg, rgba(146,199,207,0.20), rgba(170,215,217,0.10))"
                                                    : `linear-gradient(135deg, rgba(146,199,207,0.18), rgba(170,215,217,0.08))`
                                                : "transparent",
                                            border: isActive
                                                ? "1px solid rgba(146,199,207,0.25)"
                                                : "1px solid transparent",
                                            boxShadow: isActive
                                                ? "0 2px 12px rgba(146,199,207,0.10), inset 0 1px 0 rgba(255,255,255,0.5)"
                                                : "none",
                                        }}
                                    >
                                        {/* Active indicator bar */}
                                        {isActive && (
                                            <span
                                                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
                                                style={{
                                                    background: `linear-gradient(180deg, ${teal}, ${tealLight})`,
                                                    boxShadow: `0 0 12px rgba(146,199,207,0.5)`,
                                                }}
                                            />
                                        )}

                                        {/* Icon container */}
                                        <div
                                            className="flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300 group-hover:scale-110"
                                            style={{
                                                background: isActive
                                                    ? `linear-gradient(135deg, ${teal}30, ${tealLight}20)`
                                                    : darkMode
                                                        ? "rgba(255,255,255,0.06)"
                                                        : "rgba(0,0,0,0.03)",
                                                color: isActive ? teal : darkMode ? "#9CA3AF" : "#6B7280",
                                            }}
                                        >
                                            <Icon className="h-4 w-4" />
                                        </div>

                                        {/* Label */}
                                        <span
                                            className="text-[13px] font-medium transition-colors duration-300"
                                            style={{
                                                color: isActive
                                                    ? darkMode ? "#E5E7EB" : "#1F2937"
                                                    : darkMode ? "#9CA3AF" : "#6B7280",
                                            }}
                                        >
                                            {item.name}
                                        </span>

                                        {/* Unread badge for the Bulletin Board entry */}
                                        {item.name === "Bulletin Board" && bulletinUnread > 0 && (
                                            <span
                                                className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
                                                style={{
                                                    background: "linear-gradient(135deg, #EF4444, #F97316)",
                                                    boxShadow: "0 2px 6px rgba(239,68,68,0.35)",
                                                }}
                                            >
                                                {bulletinUnread > 99 ? "99+" : bulletinUnread}
                                            </span>
                                        )}

                                        {item.name === "Requests" && (pendingBoothRequests > 0 || pendingOperatorChangeCount > 0 || pendingBoothOperatorChangeCount > 0) && (
                                            <span
                                                className="ml-auto h-2 w-2 rounded-full animate-pulse"
                                                style={{
                                                    background: "#EF4444",
                                                    boxShadow: "0 0 8px rgba(239,68,68,0.85)",
                                                    animation: "blink 1s ease-in-out infinite",
                                                }}
                                            />
                                        )}

                                        {item.name === "POS Repair" && forCheckingRepairCount > 0 && (
                                            <span
                                                className="ml-auto h-2 w-2 rounded-full animate-pulse"
                                                style={{
                                                    background: "#EF4444",
                                                    boxShadow: "0 0 8px rgba(239,68,68,0.85)",
                                                    animation: "blink 1s ease-in-out infinite",
                                                }}
                                            />
                                        )}

                                        {((item.name === "My POS" && operatorMyPosHasNew) || (item.name === "My Outlets" && operatorMyOutletsHasNew)) && (
                                            <span
                                                className="ml-auto h-2 w-2 rounded-full animate-pulse"
                                                style={{
                                                    background: "#EF4444",
                                                    boxShadow: "0 0 8px rgba(239,68,68,0.85)",
                                                    animation: "blink 1s ease-in-out infinite",
                                                }}
                                            />
                                        )}

                                        {/* Active dot */}
                                        {isActive &&
                                            item.name !== "Bulletin Board" &&
                                            !(item.name === "Requests" && (pendingBoothRequests > 0 || pendingOperatorChangeCount > 0 || pendingBoothOperatorChangeCount > 0)) &&
                                            !(item.name === "POS Repair" && forCheckingRepairCount > 0) &&
                                            !((item.name === "My POS" && operatorMyPosHasNew) || (item.name === "My Outlets" && operatorMyOutletsHasNew)) && (
                                                <span
                                                    className="ml-auto w-1.5 h-1.5 rounded-full"
                                                    style={{
                                                        background: teal,
                                                        boxShadow: `0 0 8px ${teal}`,
                                                    }}
                                                />
                                            )}
                                        {isActive && item.name === "Bulletin Board" && bulletinUnread === 0 && (
                                            <span
                                                className="ml-auto w-1.5 h-1.5 rounded-full"
                                                style={{
                                                    background: teal,
                                                    boxShadow: `0 0 8px ${teal}`,
                                                }}
                                            />
                                        )}
                                    </Link>
                                );
                            })}
                        </nav>

                        {/* ===== Divider ===== */}
                        <div
                            className="relative my-2 h-px rounded-full"
                            style={{
                                background: darkMode
                                    ? "linear-gradient(90deg, transparent, rgba(75,85,99,0.40), transparent)"
                                    : `linear-gradient(90deg, transparent, rgba(146,199,207,0.20), transparent)`,
                            }}
                        />

                        {/* ===== Bottom Section ===== */}
                        <div className="relative space-y-2">
                            {/* User info */}
                            <div
                                className="flex items-center gap-2.5 rounded-xl px-3 py-2 transition-all duration-300"
                                style={{
                                    background: darkMode
                                        ? "rgba(75,85,99,0.15)"
                                        : "rgba(146,199,207,0.06)",
                                    border: darkMode
                                        ? "1px solid rgba(75,85,99,0.30)"
                                        : "1px solid rgba(146,199,207,0.12)",
                                }}
                            >
                                {avatarUrl ? (
                                    <div
                                        className="h-8 w-8 rounded-xl overflow-hidden shrink-0 ring-1 ring-white/40"
                                        style={{
                                            boxShadow: `0 2px 12px rgba(146,199,207,0.30)`,
                                        }}
                                    >
                                        <img
                                            src={avatarUrl}
                                            alt={displayName}
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div
                                        className="flex h-8 w-8 items-center justify-center rounded-xl text-white text-sm font-bold shrink-0"
                                        style={{
                                            background: `linear-gradient(135deg, ${teal}, ${tealLight})`,
                                            boxShadow: `0 2px 12px rgba(146,199,207,0.30)`,
                                        }}
                                    >
                                        <User className="h-4 w-4 text-white" />
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p
                                        className="text-[13px] font-semibold truncate transition-colors duration-300"
                                        style={{ color: darkMode ? "#E5E7EB" : "#1F2937" }}
                                    >
                                        {sidebarDisplayName}
                                    </p>
                                    <p
                                        className="text-[10px] truncate uppercase transition-colors duration-300"
                                        style={{ color: darkMode ? "#6B7280" : "#9CA3AF" }}
                                    >
                                        {displayUserType}
                                    </p>
                                </div>
                                {/* Online status */}
                                <span
                                    className="inline-block w-2 h-2 rounded-full shrink-0 animate-pulse"
                                    style={{ backgroundColor: "#6BBF6B" }}
                                />
                            </div>

                            {/* Logout */}
                            <button
                                onClick={handleLogout}
                                className="group flex items-center gap-2.5 w-full px-3 py-2 rounded-xl transition-all duration-300 border border-transparent hover:border-red-200/50 dark:hover:border-red-500/30"
                                style={{
                                    color: darkMode ? "#6B7280" : "#9CA3AF",
                                    background: "transparent",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = darkMode
                                        ? "rgba(239,68,68,0.10)"
                                        : "rgba(232,180,184,0.10)";
                                    e.currentTarget.style.color = "#DC2626";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "transparent";
                                    e.currentTarget.style.color = darkMode ? "#6B7280" : "#9CA3AF";
                                }}
                            >
                                <div
                                    className="flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300 group-hover:scale-110"
                                    style={{
                                        background: darkMode
                                            ? "rgba(255,255,255,0.06)"
                                            : "rgba(0,0,0,0.03)",
                                    }}
                                >
                                    <LogOut className="h-4 w-4" />
                                </div>
                                <span className="text-[13px] font-medium">Sign Out</span>
                            </button>
                        </div>

                        {/* ===== Theme Toggle ===== */}
                        <div className="relative mt-3 flex justify-center">
                            <button
                                onClick={toggleTheme}
                                className="relative flex items-center w-16 h-8 rounded-full transition-all duration-500 overflow-hidden focus:outline-none"
                                style={{
                                    background: darkMode
                                        ? "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)"
                                        : "linear-gradient(135deg, #F97316 0%, #FB923C 50%, #FDBA74 100%)",
                                    boxShadow: darkMode
                                        ? "0 4px 20px rgba(15,52,96,0.50), inset 0 1px 0 rgba(255,255,255,0.05)"
                                        : "0 4px 20px rgba(249,115,22,0.40), inset 0 1px 0 rgba(255,255,255,0.20)",
                                }}
                            >
                                {/* Sun icon (visible in light mode) */}
                                <div
                                    className="absolute left-1.5 flex items-center justify-center transition-all duration-500"
                                    style={{
                                        opacity: darkMode ? 0 : 1,
                                        transform: darkMode ? "scale(0.5) rotate(-90deg)" : "scale(1) rotate(0deg)",
                                    }}
                                >
                                    <Sun className="h-3.5 w-3.5 text-white" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.2))" }} />
                                </div>

                                {/* Moon + Stars (visible in dark mode) */}
                                <div
                                    className="absolute left-1.5 flex items-center justify-center transition-all duration-500"
                                    style={{
                                        opacity: darkMode ? 1 : 0,
                                        transform: darkMode ? "scale(1) rotate(0deg)" : "scale(0.5) rotate(90deg)",
                                    }}
                                >
                                    <Moon className="h-3.5 w-3.5 text-white" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.4))" }} />
                                    <Star
                                        className="absolute -top-0.5 right-[-6px] h-1.5 w-1.5 text-white"
                                        fill="white"
                                        style={{ filter: "drop-shadow(0 0 2px rgba(255,255,255,0.6))" }}
                                    />
                                    <Star
                                        className="absolute top-1.5 right-[-10px] h-1 w-1 text-white"
                                        fill="white"
                                        style={{ filter: "drop-shadow(0 0 2px rgba(255,255,255,0.6))" }}
                                    />
                                </div>

                                {/* Sliding circle */}
                                <div
                                    className="absolute top-0.5 w-7 h-7 rounded-full bg-white shadow-lg transition-all duration-500 ease-in-out"
                                    style={{
                                        transform: darkMode ? "translateX(34px)" : "translateX(2px)",
                                        boxShadow: "0 1px 6px rgba(0,0,0,0.15)",
                                    }}
                                />
                            </button>
                        </div>
                    </div>
                </aside>

                {/* Global floating alert for pending repair records — restricted to admin users only */}
                {isAdmin && forCheckingRepairCount > 0 && (
                    <FloatingAlert
                        key={`repair-${forCheckingRepairCount}`}
                        message={`There ${forCheckingRepairCount === 1 ? "is" : "are"} ${forCheckingRepairCount} repair record${forCheckingRepairCount !== 1 ? "s" : ""} waiting for checking. Please review and process accordingly.`}
                    />
                )}

                {/* Global floating alert for pending requests — restricted to IT department only */}
                {isITDepartment && (pendingBoothRequests > 0 || pendingOperatorChangeCount > 0 || pendingBoothOperatorChangeCount > 0) && (
                    <FloatingAlert
                        key={`requests-${pendingBoothRequests}-${pendingOperatorChangeCount}-${pendingBoothOperatorChangeCount}`}
                        message={`There ${(pendingBoothRequests + pendingOperatorChangeCount + pendingBoothOperatorChangeCount) === 1 ? "is" : "are"} ${pendingBoothRequests + pendingOperatorChangeCount + pendingBoothOperatorChangeCount} pending request${(pendingBoothRequests + pendingOperatorChangeCount + pendingBoothOperatorChangeCount) !== 1 ? "s" : ""} awaiting your action. Please review and process accordingly.`}
                    />
                )}

                {/* Global floating alert for operator approved/rejected requests.
                    Only surfaces for requests that the operator has not yet
                    acknowledged (per-section "seen" markers), AND only after
                    the session has been initialized for this login. The
                    initialization useEffect captures the current counts as
                    "seen" on first load, so any approvals/rejections from
                    previous days are silently absorbed and do not pop a
                    toast when the operator signs in. */}
                {isOperator &&
                    operatorSessionInitialized &&
                    (operatorPosApprovedRejectedCount > operatorSeenMyPos ||
                        operatorOutletApprovedRejectedCount > operatorSeenMyOutlets) &&
                    (() => {
                        const posUnseen = Math.max(
                            0,
                            operatorPosApprovedRejectedCount - operatorSeenMyPos
                        );
                        const outletUnseen = Math.max(
                            0,
                            operatorOutletApprovedRejectedCount - operatorSeenMyOutlets
                        );
                        const totalUnseen = posUnseen + outletUnseen;
                        if (totalUnseen <= 0) return null;
                        const parts: string[] = [];
                        if (posUnseen > 0) {
                            parts.push(
                                `${posUnseen} POS booth change request${posUnseen !== 1 ? "s" : ""}`
                            );
                        }
                        if (outletUnseen > 0) {
                            parts.push(
                                `${outletUnseen} outlet request${outletUnseen !== 1 ? "s" : ""}`
                            );
                        }
                        const detail = parts.length > 1
                            ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`
                            : parts[0];
                        return (
                            <FloatingAlert
                                key={`operator-approved-${operatorPosApprovedRejectedCount}-${operatorOutletApprovedRejectedCount}`}
                                message={`You have ${detail} that ha${totalUnseen === 1 ? "s" : "ve"} been approved or rejected. Please check your request history.`}
                            />
                        );
                    })()}
                {/* Main Content */}
                <main className="flex-1 overflow-auto pt-16 lg:pt-0">
                    <div
                        className="m-3 min-h-full rounded-3xl border shadow-2xl backdrop-blur-2xl p-4 sm:p-6 lg:m-8 lg:p-10 transition-colors duration-300"
                        style={{
                            background: darkMode
                                ? "rgba(31, 41, 55, 0.60)"
                                : "rgba(255, 255, 255, 0.22)",
                            border: darkMode
                                ? "1px solid rgba(75, 85, 99, 0.40)"
                                : "1px solid rgba(255, 255, 255, 0.45)",
                            boxShadow: darkMode
                                ? "0 8px 32px rgba(0, 0, 0, 0.30), inset 0 1px 0 rgba(255,255,255,0.05)"
                                : "0 8px 32px rgba(31, 38, 135, 0.10), inset 0 1px 0 rgba(255,255,255,0.65)",
                            backdropFilter: "blur(20px)",
                            WebkitBackdropFilter: "blur(20px)",
                        }}
                    >
                        <div className="main-content-area">
                            <Outlet />
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
