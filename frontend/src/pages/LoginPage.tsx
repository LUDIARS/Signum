import { useState, type FormEvent, type JSX } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

export function LoginPage(): JSX.Element {
    const { login, googleAuthUrl, githubAuthUrl, mfaChallenge, mfaVerify, mfaCancelChallenge } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const dest = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);

    async function onSubmit(ev: FormEvent) {
        ev.preventDefault();
        setError(null);
        try {
            await login(email, password);
            navigate(dest, { replace: true });
        } catch (err) {
            setError((err as Error).message);
        }
    }

    if (mfaChallenge) {
        return <MfaForm onVerify={async (m, c) => { await mfaVerify(m, c); navigate(dest, { replace: true }); }}
                        onCancel={mfaCancelChallenge}
                        methods={mfaChallenge.methods} />;
    }

    return (
        <div className="min-h-full flex items-center justify-center p-4">
            <form onSubmit={onSubmit}
                  className="w-full max-w-sm p-6 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-surface)]"
                  aria-label="ログインフォーム">
                <h1 className="text-lg font-semibold mb-4">Signum にサインイン</h1>

                <label className="block mb-3 text-xs text-[var(--text-muted)]">メール
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                           className="mt-1 block w-full bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)] px-3 py-2 text-[var(--text)]" />
                </label>
                <label className="block mb-4 text-xs text-[var(--text-muted)]">パスワード
                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                           className="mt-1 block w-full bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)] px-3 py-2 text-[var(--text)]" />
                </label>

                {error && <p className="text-[var(--red)] text-xs mb-3">{error}</p>}

                <button type="submit"
                        className="w-full bg-[var(--accent)] text-[#0b1220] font-semibold rounded-[var(--radius-sm)] px-3 py-2 hover:brightness-110">
                    サインイン
                </button>

                <div className="mt-4 flex gap-2">
                    <a href={googleAuthUrl} className="btn flex-1 text-center border border-[var(--border)] rounded-[var(--radius-sm)] py-2">Google</a>
                    <a href={githubAuthUrl} className="btn flex-1 text-center border border-[var(--border)] rounded-[var(--radius-sm)] py-2">GitHub</a>
                </div>

                <p className="mt-4 text-xs text-[var(--text-muted)]">
                    アカウント未作成? <Link to="/register" className="text-[var(--accent)]">登録</Link>
                </p>
            </form>
        </div>
    );
}

function MfaForm({
    methods, onVerify, onCancel,
}: {
    methods: string[];
    onVerify: (method: string, code: string) => Promise<void>;
    onCancel: () => void;
}): JSX.Element {
    const [method, setMethod] = useState<string>(methods[0] ?? "totp");
    const [code, setCode] = useState<string>("");
    const [error, setError] = useState<string | null>(null);

    async function submit(ev: FormEvent) {
        ev.preventDefault();
        setError(null);
        try { await onVerify(method, code); }
        catch (err) { setError((err as Error).message); }
    }

    return (
        <div className="min-h-full flex items-center justify-center p-4">
            <form onSubmit={submit}
                  className="w-full max-w-sm p-6 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-surface)]">
                <h1 className="text-lg font-semibold mb-4">MFA 認証</h1>
                <label className="block mb-3 text-xs text-[var(--text-muted)]">方式
                    <select value={method} onChange={(e) => setMethod(e.target.value)}
                            className="mt-1 block w-full bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)] px-3 py-2">
                        {methods.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                </label>
                <label className="block mb-4 text-xs text-[var(--text-muted)]">コード
                    <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric"
                           className="mt-1 block w-full bg-[var(--bg)] border border-[var(--border)] rounded-[var(--radius-sm)] px-3 py-2" />
                </label>
                {error && <p className="text-[var(--red)] text-xs mb-3">{error}</p>}
                <div className="flex gap-2">
                    <button type="submit" className="flex-1 bg-[var(--accent)] text-[#0b1220] font-semibold rounded-[var(--radius-sm)] py-2">
                        検証
                    </button>
                    <button type="button" onClick={onCancel}
                            className="flex-1 border border-[var(--border)] rounded-[var(--radius-sm)] py-2">
                        キャンセル
                    </button>
                </div>
            </form>
        </div>
    );
}
