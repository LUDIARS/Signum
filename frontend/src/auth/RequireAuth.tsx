import { Navigate, useLocation } from "react-router-dom";
import type { JSX, PropsWithChildren } from "react";

import { useAuth } from "./AuthContext";

/** Route guard — redirects to /login on anonymous access. */
export function RequireAuth({ children }: PropsWithChildren): JSX.Element {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
                Loading…
            </div>
        );
    }
    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }
    return <>{children}</>;
}
