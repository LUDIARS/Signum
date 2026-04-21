/// Token storage — localStorage keys match the contract in
/// FORMAT_AUTH.md §2.1 so Ars / Schedula / Cernere can cross-link
/// without bespoke migration code.

const ACCESS_KEY  = "accessToken";
const REFRESH_KEY = "refreshToken";
const USER_KEY    = "user";

export interface StoredUser {
    id:          string;
    displayName: string;
    email:       string;
    role:        string;
}

export function setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_KEY,  accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
}

export function getAccessToken():  string | null { return localStorage.getItem(ACCESS_KEY); }
export function getRefreshToken(): string | null { return localStorage.getItem(REFRESH_KEY); }

export function setStoredUser(user: StoredUser): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function getStoredUser(): StoredUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as StoredUser; } catch { return null; }
}
