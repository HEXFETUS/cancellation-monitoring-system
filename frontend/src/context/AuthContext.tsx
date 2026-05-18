import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface AuthContextValue {
    isAuthenticated: boolean;
    user: { id: number; name: string; email: string; usertype: string } | null;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

function apiUrl(path: string) {
    return `${API_BASE_URL}${path}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthContextValue["user"]>(() => {
        const stored = sessionStorage.getItem("auth_user");
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch {
                return null;
            }
        }
        return null;
    });

    const login = useCallback(async (username: string, password: string): Promise<boolean> => {
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
            const userData = { id: data.id, name: data.name, email: data.email, usertype: data.usertype };
            sessionStorage.setItem("auth_user", JSON.stringify(userData));
            setUser(userData);
            return true;
        } catch {
            return false;
        }
    }, []);

    const logout = useCallback(() => {
        sessionStorage.removeItem("auth_user");
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