import { useEffect, useState, type JSX } from "react";

import { useAuth } from "../auth/AuthContext";
import { request } from "../lib/api";

interface Health { ok: boolean; db?: boolean; redis?: boolean; }

export function HomePage(): JSX.Element {
    const { user, logout } = useAuth();
    const [health, setHealth] = useState<Health | null>(null);

    useEffect(() => {
        request<Health>("/api/health/ready").then(setHealth).catch(() => setHealth({ ok: false }));
    }, []);

    return (
        <div className="mx-auto max-w-3xl p-6 mobile-stack">
            <header className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">Signum</h1>
                    <p className="text-sm text-[var(--text-muted)]">ようこそ、{user?.displayName} さん</p>
                </div>
                <button onClick={logout}
                        className="border border-[var(--border)] text-[var(--text)] rounded-[var(--radius-sm)] px-3 py-2">
                    ログアウト
                </button>
            </header>

            <section className="mt-6 p-4 border border-[var(--border)] rounded-[var(--radius)] bg-[var(--bg-surface)]">
                <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">基底ヘルス</h2>
                {!health && <p className="text-[var(--text-muted)]">loading…</p>}
                {health && (
                    <ul className="mt-2 text-sm">
                        <li><StatusBadge ok={health.ok}     /> overall</li>
                        {health.db !== undefined   && <li><StatusBadge ok={!!health.db}   /> postgres</li>}
                        {health.redis !== undefined && <li><StatusBadge ok={!!health.redis} /> redis</li>}
                    </ul>
                )}
            </section>

            <section className="mt-6 text-sm text-[var(--text-muted)]">
                <p>次のステップ: <code>spec/</code> にドメイン仕様を追加、<code>src/routes/</code> 以下に機能を実装してください。</p>
            </section>
        </div>
    );
}

function StatusBadge({ ok }: { ok: boolean }): JSX.Element {
    return (
        <span aria-label={ok ? "ok" : "error"}
              style={{ color: ok ? "var(--green)" : "var(--red)", fontWeight: 600, marginRight: 6 }}>
            {ok ? "●" : "✕"}
        </span>
    );
}
