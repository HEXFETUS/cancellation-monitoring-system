import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

type AuthUser = {
    id: number;
    name: string;
    email: string;
    usertype: string;
    position: string;
    department: string;
    profile_picture?: string | null;
};

type StoredAuth = {
    user: AuthUser;
    logId: string;
    remembered: boolean;
    lastOpenedAt: number;
};

interface AuthContextValue {
    isAuthenticated: boolean;
    user: AuthUser | null;
    login: (username: string, password: string, rememberMe?: boolean) => Promise<boolean>;
    logout: () => Promise<void>;
    updateUser: (patch: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const AUTH_STORAGE_KEY = "auth_session";
const REMEMBERED_EXPIRY_MS = 24 * 60 * 60 * 1000;
let expiredAuthToRecord: StoredAuth | null = null;

function apiUrl(path: string) {
    return `${API_BASE_URL}${path}`;
}

// ─── Global fetch interceptor ───────────────────────────────────────────
// Auto-attaches the signed-in user's id to every same-origin /api/ request
// as `x-user-id`. The backend uses this header to attribute activity-log
// rows to the actor. Without it, admin actions like creating/editing users
// or assets get logged with user_id=NULL and show as "Unknown user" in the
// admin Activity Logs view. Installs once per browser session at module
// load. Skips requests that already supply x-user-id so explicit overrides
// (e.g. tests) still win.
let fetchInterceptorInstalled = false;
function installFetchInterceptor() {
    if (fetchInterceptorInstalled || typeof window === "undefined") return;
    fetchInterceptorInstalled = true;

    const originalFetch = window.fetch.bind(window);

    window.fetch = (input, init) => {
        try {
            const url =
                typeof input === "string"
                    ? input
                    : input instanceof URL
                        ? input.toString()
                        : (input as Request).url;

            // Only inject for backend API calls. Profile-picture uploads,
            // asset media uploads, etc. all hit /api/* so this catches them.
            if (!/\/api\//.test(url)) {
                return originalFetch(input, init);
            }

            // Read auth fresh on each request so we pick up post-login state
            // without re-installing the interceptor.
            const stored = readStoredAuth();
            const userId = stored?.user?.id;
            if (!userId) {
                return originalFetch(input, init);
            }

            // Build a Headers object that carries through whatever the caller
            // passed in (whether init.headers or Request.headers), then add
            // x-user-id only if it isn't already set.
            const baseHeaders = new Headers(
                init?.headers ??
                    (typeof input !== "string" && !(input instanceof URL)
                        ? (input as Request).headers
                        : undefined)
            );
            if (!baseHeaders.has("x-user-id")) {
                baseHeaders.set("x-user-id", String(userId));
            }

            return originalFetch(input, { ...init, headers: baseHeaders });
        } catch {
            // Belt and braces: never let the interceptor's bookkeeping break a
            // real request. Fall through to the original fetch.
            return originalFetch(input, init);
        }
    };
}

installFetchInterceptor();

function readStoredAuth(): StoredAuth | null {
    const sessionStored = sessionStorage.getItem(AUTH_STORAGE_KEY);
    const localStored = localStorage.getItem(AUTH_STORAGE_KEY);
    const stored = sessionStored || localStored;

    if (!stored) return null;

    try {
        const parsed = JSON.parse(stored) as StoredAuth;

        if (parsed.remembered && Date.now() - parsed.lastOpenedAt > REMEMBERED_EXPIRY_MS) {
            expiredAuthToRecord = parsed;
            localStorage.removeItem(AUTH_STORAGE_KEY);
            sessionStorage.removeItem(AUTH_STORAGE_KEY);
            return null;
        }

        if (parsed.remembered) {
            const refreshed = { ...parsed, lastOpenedAt: Date.now() };
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(refreshed));
            return refreshed;
        }

        return parsed;
    } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
        return null;
    }
}

async function recordLogout(storedAuth: StoredAuth | null) {
    if (!storedAuth?.user?.id || !storedAuth.logId) return;

    await fetch(apiUrl("/api/auth/logout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: storedAuth.user.id, logId: storedAuth.logId }),
    });
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthContextValue["user"]>(() => readStoredAuth()?.user ?? null);

    useEffect(() => {
        if (!expiredAuthToRecord) return;

        const authToRecord = expiredAuthToRecord;
        expiredAuthToRecord = null;
        recordLogout(authToRecord).catch(() => {});
    }, []);

    const login = useCallback(async (username: string, password: string, rememberMe = false): Promise<boolean> => {
        try {
            const res = await fetch(apiUrl("/api/auth/login"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: username.trim(), password }),
            });

            if (!res.ok) {
                return false;
            }

            const data = await res.json();
            const userData = { id: data.id, name: data.name, email: data.email, usertype: data.usertype, position: data.position ?? "", department: data.department ?? "", profile_picture: data.profile_picture ?? null };
            const storedAuth: StoredAuth = {
                user: userData,
                logId: String(data.user_log_id),
                remembered: rememberMe,
                lastOpenedAt: Date.now(),
            };

            localStorage.removeItem(AUTH_STORAGE_KEY);
            sessionStorage.removeItem(AUTH_STORAGE_KEY);

            if (rememberMe) {
                localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(storedAuth));
            } else {
                sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(storedAuth));
            }

            setUser(userData);
            return true;
        } catch {
            return false;
        }
    }, []);

    const logout = useCallback(async () => {
        const storedAuth = readStoredAuth();

        try {
            await recordLogout(storedAuth);
        } catch {
            // Keep logout available even if recording the log fails.
        }

        localStorage.removeItem(AUTH_STORAGE_KEY);
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
        setUser(null);
    }, []);

    // Merge a partial update into the current auth user and persist it back
    // to whichever storage holds the active session. Used after profile edits
    // (e.g. uploading a profile picture) so the new value is visible without
    // forcing a re-login.
    const updateUser = useCallback((patch: Partial<AuthUser>) => {
        setUser((prev) => {
            if (!prev) return prev;
            const next = { ...prev, ...patch };

            const persist = (key: "localStorage" | "sessionStorage") => {
                const raw =
                    key === "localStorage"
                        ? localStorage.getItem(AUTH_STORAGE_KEY)
                        : sessionStorage.getItem(AUTH_STORAGE_KEY);
                if (!raw) return;
                try {
                    const parsed = JSON.parse(raw) as StoredAuth;
                    parsed.user = { ...parsed.user, ...patch };
                    const serialized = JSON.stringify(parsed);
                    if (key === "localStorage") {
                        localStorage.setItem(AUTH_STORAGE_KEY, serialized);
                    } else {
                        sessionStorage.setItem(AUTH_STORAGE_KEY, serialized);
                    }
                } catch {
                    // Ignore malformed storage; in-memory state still updates.
                }
            };
            persist("localStorage");
            persist("sessionStorage");

            return next;
        });
    }, []);

    const isAuthenticated = user !== null;

    return (
        <AuthContext.Provider value={{ isAuthenticated, user, login, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return ctx;
}
