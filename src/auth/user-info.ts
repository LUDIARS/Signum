/// Resolve user display data from Cernere with Redis caching. RULE.md
/// §5 bans storing name/email/role in Signum's DB, so callers that need
/// to render a user must go through `getUserInfo`.
///
/// Falls back to a deterministic placeholder when Cernere is offline
/// — the UI degrades gracefully instead of crashing.

import { getRedis } from "../db/redis.js";
import { serviceAuth } from "./cernere-client.js";
import { env } from "../config/env.js";

export interface UserInfo {
    id:          string;
    displayName: string;
    email:       string;
    role:        string;
    /** True if this record came from Cernere, false if it is a placeholder. */
    resolved:    boolean;
}

const CACHE_TTL_SECONDS = 3600;   // RULE.md §5.2 suggests ~1h.
const CACHE_PREFIX      = "signum:userinfo:";

function placeholder(id: string): UserInfo {
    return {
        id,
        displayName: `user-${id.slice(0, 8)}`,
        email:       `${id}@unknown.local`,
        role:        "general",
        resolved:    false,
    };
}

async function fetchFromCernere(id: string): Promise<UserInfo | null> {
    const auth = serviceAuth();
    if (!auth.isConfigured()) return null;
    try {
        const res = await auth.fetch(`${env.cernere.url}/api/users/${encodeURIComponent(id)}`);
        if (!res.ok) return null;
        const raw = await res.json() as { id?: string; displayName?: string; email?: string; role?: string };
        if (!raw.id) return null;
        return {
            id:          raw.id,
            displayName: raw.displayName ?? `user-${id.slice(0, 8)}`,
            email:       raw.email       ?? `${id}@unknown.local`,
            role:        raw.role        ?? "general",
            resolved:    true,
        };
    } catch {
        return null;
    }
}

export async function getUserInfo(id: string): Promise<UserInfo> {
    if (!id) return placeholder("unknown");
    const redis = getRedis();
    const key   = CACHE_PREFIX + id;
    try {
        const cached = await redis.get(key);
        if (cached) return JSON.parse(cached) as UserInfo;
    } catch { /* redis down → fall through */ }

    const resolved = await fetchFromCernere(id);
    const info     = resolved ?? placeholder(id);
    if (resolved) {
        try { await redis.set(key, JSON.stringify(info), "EX", CACHE_TTL_SECONDS); }
        catch { /* ignore cache failure */ }
    }
    return info;
}

export async function getUserInfos(ids: readonly string[]): Promise<Map<string, UserInfo>> {
    const unique = Array.from(new Set(ids));
    const results = await Promise.all(unique.map((id) => getUserInfo(id)));
    const map = new Map<string, UserInfo>();
    for (const u of results) map.set(u.id, u);
    return map;
}

export async function invalidateUserInfo(id: string): Promise<void> {
    try { await getRedis().del(CACHE_PREFIX + id); } catch { /* ignore */ }
}
