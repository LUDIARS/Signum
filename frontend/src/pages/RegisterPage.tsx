import { useState, type FormEvent, type JSX } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

export function RegisterPage(): JSX.Element {
    const { register } = useAuth();
    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);

    async function onSubmit(ev: FormEvent) {
        ev.preventDefault();
        setError(null);
        try {
            await register(name, email, password);
            navigate("/", { replace: true });
        } catch (err) {
            setError((err as Error).message);
        }
    }

    return (
        <div className="min-h-full flex items-center justify-center p-4">
            <form onSubmit={onSubmit}
                  className="w-full max-w-sm p-6 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-surface)]">
                <h1 className="text-lg font-semibold mb-4">アカウント作成</h1>
                <label className="block mb-3 text-xs text-[var(--text-muted)]">表示名
                    <input value={name} onChange={(e) => setName(e.target.value)} required
                           className="mt-1 block w-full bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)] px-3 py-2" />
                </label>
                <label className="block mb-3 text-xs text-[var(--text-muted)]">メール
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                           className="mt-1 block w-full bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)] px-3 py-2" />
                </label>
                <label className="block mb-4 text-xs text-[var(--text-muted)]">パスワード
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                           className="mt-1 block w-full bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)] px-3 py-2" />
                </label>
                {error && <p className="text-[var(--red)] text-xs mb-3">{error}</p>}
                <button type="submit" className="w-full bg-[var(--accent)] text-[#0b1220] font-semibold rounded-[var(--radius-sm)] py-2">
                    登録
                </button>
                <p className="mt-4 text-xs text-[var(--text-muted)]">
                    既にお持ち? <Link to="/login" className="text-[var(--accent)]">ログイン</Link>
                </p>
            </form>
        </div>
    );
}
