/**
 * api.ts - tiny fetch wrapper: timeouts, JSON errors with Thai messages, admin token.
 */

const TOKEN_KEY = 'jaew_admin_token_v2';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let memoryToken: string | null = null;

export function getAdminToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const { token, expiresAt } = JSON.parse(raw);
    if (typeof token === 'string' && typeof expiresAt === 'number' && expiresAt > Date.now()) {
      memoryToken = token;
      return token;
    }
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable (private mode) - token lives in memory only
  }
  return null;
}

export function setAdminToken(token: string | null, expiresAt?: number) {
  memoryToken = token;
  try {
    if (token && expiresAt) localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt }));
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  timeoutMs?: number;
  auth?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, timeoutMs = 15000, auth = true } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = auth ? getAdminToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: 'no-cache',
    });
  } catch (err) {
    throw new ApiError(
      0,
      (err as Error).name === 'AbortError'
        ? 'เซิร์ฟเวอร์ตอบสนองช้าเกินไป กรุณาลองใหม่อีกครั้ง'
        : 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'
    );
  } finally {
    clearTimeout(timer);
  }

  let data: any = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    if (res.status === 401 && token) setAdminToken(null);
    throw new ApiError(res.status, data?.error || `เกิดข้อผิดพลาด (รหัส ${res.status})`);
  }
  return data as T;
}
