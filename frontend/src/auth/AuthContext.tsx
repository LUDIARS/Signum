/// AuthContext — FORMAT_AUTH.md §2.7 shape. Owns the "who am I?"
/// state, primes from localStorage on first mount, processes OAuth
/// callback params, refreshes via `/api/auth/me`.

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type JSX,
    type PropsWithChildren,
} from "react";

import { request } from "../lib/api";
import {
    clearTokens,
    getStoredUser,
    setStoredUser,
    setTokens,
    type StoredUser,
} from "../lib/tokens";

export interface MfaChallenge {
    mfaToken: string;
    methods:  string[];
}

export interface AuthContextType {
    user:    StoredUser | null;
    loading: boolean;
    mfaChallenge: MfaChallenge | null;

    login:    (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    logout:   () => Promise<void>;

    mfaSendCode:    (method: string) => Promise<void>;
    mfaVerify:      (method: string, code: string) => Promise<void>;
    mfaCancelChallenge: () => void;

    googleAuthUrl:  string;
    githubAuthUrl:  string;
    linkGitHubUrl:  string;
    linkGoogleUrl:  string;
}

const Ctx = createContext<AuthContextType | null>(null);

// URLs are relative — the Vite proxy / nginx forwards them to Cernere
// through the backend.
const URLS = {
    googleAuthUrl: "/auth/google/login",
    githubAuthUrl: "/auth/github/login",
    linkGitHubUrl: "/auth/link/github",
    linkGoogleUrl: "/auth/link/google",
};

interface LoginResponse {
    user?:         StoredUser;
    accessToken?:  string;
    refreshToken?: string;
    mfaRequired?:  boolean;
    mfaToken?:     string;
    mfaMethods?:   string[];
}

function consumeOauthCallback(): void {
    // FORMAT_AUTH.md §2.5 — tokens come back as URL params.
    const params = new URLSearchParams(window.location.search);
    const access  = params.get("accessToken");
    const refresh = params.get("refreshToken");
    if (access && refresh) {
        setTokens(access, refresh);
        const url = new URL(window.location.href);
        url.searchParams.delete("accessToken");
        url.searchParams.delete("refreshToken");
        window.history.replaceState({}, "", url.toString());
    }
}

export function AuthProvider({ children }: PropsWithChildren): JSX.Element {
    const [user,    setUser]    = useState<StoredUser | null>(() => getStoredUser());
    const [loading, setLoading] = useState<boolean>(true);
    const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge | null>(null);

    // Bootstrap: OAuth callback → /me → ready.
    useEffect(() => {
        consumeOauthCallback();
        (async () => {
            try {
                const me = await request<StoredUser>("/api/me");
                setStoredUser(me);
                setUser(me);
            } catch {
                setUser(null);
                clearTokens();
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleLoginResponse = useCallback((res: LoginResponse) => {
        if (res.mfaRequired) {
            setMfaChallenge({
                mfaToken: res.mfaToken ?? "",
                methods:  res.mfaMethods ?? [],
            });
            return;
        }
        if (res.accessToken && res.refreshToken && res.user) {
            setTokens(res.accessToken, res.refreshToken);
            setStoredUser(res.user);
            setUser(res.user);
            setMfaChallenge(null);
        }
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const res = await request<LoginResponse>("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });
        handleLoginResponse(res);
    }, [handleLoginResponse]);

    const register = useCallback(async (name: string, email: string, password: string) => {
        const res = await request<LoginResponse>("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({ name, email, password }),
        });
        handleLoginResponse(res);
    }, [handleLoginResponse]);

    const logout = useCallback(async () => {
        const refresh = localStorage.getItem("refreshToken");
        try {
            await request("/api/auth/logout", {
                method: "POST",
                body: JSON.stringify({ refreshToken: refresh }),
            });
        } catch { /* ignore network failure */ }
        clearTokens();
        setUser(null);
    }, []);

    const mfaSendCode = useCallback(async (method: string) => {
        if (!mfaChallenge) throw new Error("no MFA challenge in flight");
        await request("/api/auth/mfa/send-code", {
            method: "POST",
            body: JSON.stringify({ mfaToken: mfaChallenge.mfaToken, method }),
        });
    }, [mfaChallenge]);

    const mfaVerify = useCallback(async (method: string, code: string) => {
        if (!mfaChallenge) throw new Error("no MFA challenge in flight");
        const res = await request<LoginResponse>("/api/auth/mfa/verify", {
            method: "POST",
            body: JSON.stringify({ mfaToken: mfaChallenge.mfaToken, method, code }),
        });
        handleLoginResponse(res);
    }, [handleLoginResponse, mfaChallenge]);

    const mfaCancelChallenge = useCallback(() => setMfaChallenge(null), []);

    const value = useMemo<AuthContextType>(() => ({
        user,
        loading,
        mfaChallenge,
        login,
        register,
        logout,
        mfaSendCode,
        mfaVerify,
        mfaCancelChallenge,
        ...URLS,
    }), [user, loading, mfaChallenge, login, register, logout, mfaSendCode, mfaVerify, mfaCancelChallenge]);

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContextType {
    const v = useContext(Ctx);
    if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
    return v;
}
