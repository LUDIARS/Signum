/// Cernere Tool Client auth (FORMAT_AUTH.md §1.5).
///
/// Used when Signum needs to call another LUDIARS service on behalf of
/// itself (e.g. resolve a user profile for rendering). Access tokens
/// are cached in-process and refreshed 5 minutes before expiry.

import { env } from "../config/env.js";

interface TokenResponse {
    tokenType:   string;
    accessToken: string;
    expiresIn:   number;
    client?:     unknown;
}

export class ServiceAuth {
    private accessToken: string | null = null;
    private expiresAt:   number        = 0;

    constructor(
        private readonly cernereUrl: string,
        private readonly clientId:   string,
        private readonly clientSecret: string,
    ) {}

    isConfigured(): boolean {
        return this.clientId.length > 0 && this.clientSecret.length > 0;
    }

    async getToken(): Promise<string> {
        if (!this.isConfigured()) {
            throw new Error("ServiceAuth: TOOL_CLIENT_ID/SECRET are not configured");
        }
        // Refresh 5 minutes ahead of expiry.
        if (this.accessToken && Date.now() < this.expiresAt - 300_000) {
            return this.accessToken;
        }

        const res = await fetch(`${this.cernereUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                grant_type:    "client_credentials",
                client_id:     this.clientId,
                client_secret: this.clientSecret,
            }),
        });
        if (!res.ok) throw new Error(`Cernere auth failed: ${res.status}`);
        const data = await res.json() as TokenResponse;
        this.accessToken = data.accessToken;
        this.expiresAt   = Date.now() + data.expiresIn * 1000;
        return this.accessToken!;
    }

    async fetch(url: string, options: RequestInit = {}): Promise<Response> {
        const token = await this.getToken();
        return fetch(url, {
            ...options,
            headers: {
                ...(options.headers ?? {}),
                Authorization: `Bearer ${token}`,
            },
        });
    }
}

let _singleton: ServiceAuth | null = null;
export function serviceAuth(): ServiceAuth {
    if (_singleton) return _singleton;
    _singleton = new ServiceAuth(
        env.cernere.url,
        env.cernere.toolClientId,
        env.cernere.toolClientSecret,
    );
    return _singleton;
}
