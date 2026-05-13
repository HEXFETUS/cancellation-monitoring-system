import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface AuthContextValue {
    isAuthenticated: boolean;
    user: string | null;
    login: (username: string, password: string) => boolean;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const MOCK_USER = "admin";
const MOCK_PASS = "admin123";

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<string | null>(() => {
        return sessionStorage.getItem("auth_user");
    });

    const login = useCallback((username: string, password: string): boolean => {
        if (username === MOCK_USER && password === MOCK_PASS) {
            sessionStorage.setItem("auth_user", username);
            setUser(username);
            return true;
        }
        return false;
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