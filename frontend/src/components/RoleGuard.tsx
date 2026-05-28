import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface RoleGuardProps {
    /** Roles that ARE allowed in. Anyone else is redirected. */
    allow: Array<"admin" | "csr" | "operator" | "purchaser">;
    children: React.ReactNode;
    /** Where to send unauthorized users. Default: dashboard. */
    fallback?: string;
}

/**
 * Routes wrapped in a RoleGuard let only the listed roles through.
 * Frontend-only — pair with backend enforcement for real security.
 */
export default function RoleGuard({ allow, children, fallback = "/app/dashboard" }: RoleGuardProps) {
    const { user } = useAuth();
    const role = user?.usertype as RoleGuardProps["allow"][number] | undefined;

    if (!role || !allow.includes(role)) {
        return <Navigate to={fallback} replace />;
    }
    return <>{children}</>;
}
