import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

type AuthUser = {
    id: number;
    name: string;
    email: string;
    usertype: string;
    position: string;
    department: string;
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
}

const AuthContext = createContext<AuthContextValue | null>(null);

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const AUTH_STORAGE_KEY = "auth_session";
const REMEMBERED_EXPIRY_MS = 24 * 60 * 60 * 1000;
let expiredAuthToRecord: StoredAuth | null = null;

function apiUrl(path: string) {
    return `${API_BASE_URL}${path}`;
}

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
            const userData = { id: data.id, name: data.name, email: data.email, usertype: data.usertype, position: data.position ?? "", department: data.department ?? "" };
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

    const isAuthenticated = user !== null;

    return (
        <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return ctx;
}
