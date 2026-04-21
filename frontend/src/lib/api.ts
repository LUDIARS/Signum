/// Authenticated fetch wrapper with automatic refresh (FORMAT_AUTH.md §2.3).

import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./tokens";

export class ApiError extends Error {
    status: number;
    body:   unknown;
    constructor(message: string, status: number, body: unknown) {
        super(message);
        this.status = status;
        this.body   = body;
    }
}

async function refreshAccessToken(): Promise<boolean> {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
        const res = await fetch("/api/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) { clearTokens(); return false; }
        const data = await res.json() as { accessToken: string; refreshToken: string };
        setTokens(data.accessToken, data.refreshToken);
        return true;
    } catch {
        clearTokens();
        return false;
    }
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...((options.headers as Record<string, string> | undefined) ?? {}),
    };
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    let res = await fetch(path, { ...options, headers });

    if (res.status === 401 && getRefreshToken()) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            const fresh = getAccessToken();
            if (fresh) headers["Authorization"] = `Bearer ${fresh}`;
            res = await fetch(path, { ...options, headers });
        }
    }

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg  = (body as { error?: string })?.error ?? `HTTP ${res.status}`;
        throw new ApiError(msg, res.status, body);
    }

    // Allow 204 No Content
    if (res.status === 204) return undefined as unknown as T;
    return await res.json() as T;
}
