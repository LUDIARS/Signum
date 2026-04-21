/// Shared Redis client (ioredis). Lazy construction so test harnesses
/// can stub the URL without triggering a connection at import time.

import Redis from "ioredis";

import { env } from "../config/env.js";

let _redis: Redis | null = null;

export function getRedis(): Redis {
    if (_redis) return _redis;
    _redis = new Redis(env.redisUrl, {
        lazyConnect:  false,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
    });
    _redis.on("error", (err) => console.warn("[signum:redis]", err.message));
    return _redis;
}

export async function closeRedis(): Promise<void> {
    if (_redis) await _redis.quit();
    _redis = null;
}

export async function pingRedis(): Promise<boolean> {
    try {
        const pong = await getRedis().ping();
        return pong === "PONG";
    } catch {
        return false;
    }
}
