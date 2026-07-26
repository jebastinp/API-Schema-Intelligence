"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type CachedResponseEntry = {
  expiresAt: number;
  data: unknown;
};

type SessionCache = {
  accessToken: string | null;
  expiresAt: number;
  promise: Promise<string | null> | null;
};

const GET_CACHE_TTLS: Array<{ pattern: RegExp; ttlMs: number }> = [
  { pattern: /^\/connections(?:\?|$)/, ttlMs: 5_000 },
  { pattern: /^\/scanner\/jobs(?:\?|$)/, ttlMs: 1_500 },
  { pattern: /^\/scanner\/notifications(?:\?|$)/, ttlMs: 5_000 },
  { pattern: /^\/scanner\/history(?:\?|$)/, ttlMs: 5_000 },
  { pattern: /^\/scanner\/exports(?:\?|$)/, ttlMs: 10_000 },
  { pattern: /^\/scanner\/connections\/[^/]+\/schema\/versions(?:\?|$)/, ttlMs: 10_000 },
  { pattern: /^\/scanner\/connections\/[^/]+\/schema\/latest(?:\?|$)/, ttlMs: 10_000 },
  { pattern: /^\/scanner\/connections\/[^/]+\/schema\/[^/]+(?:\?|$)/, ttlMs: 15_000 },
];

const DEFAULT_GET_TTL_MS = 750;
const SESSION_CACHE_TTL_MS = 30_000;

const responseCache = new Map<string, CachedResponseEntry>();
const inflightRequests = new Map<string, Promise<unknown>>();
const sessionCache: SessionCache = {
  accessToken: null,
  expiresAt: 0,
  promise: null,
};

function getSupabaseClient() {
  return createSupabaseBrowserClient();
}

function cloneData<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function getGetCacheTtl(path: string): number {
  const matched = GET_CACHE_TTLS.find((entry) => entry.pattern.test(path));
  return matched?.ttlMs ?? DEFAULT_GET_TTL_MS;
}

function requestMethod(init?: RequestInit): string {
  return (init?.method ?? "GET").toUpperCase();
}

function requestKey(path: string, init?: RequestInit): string {
  const method = requestMethod(init);
  const body =
    typeof init?.body === "string"
      ? init.body
      : init?.body instanceof URLSearchParams
        ? init.body.toString()
        : "";
  return `${method}:${path}:${body}`;
}

export function invalidateApiCache(pathPrefix?: string): void {
  if (!pathPrefix) {
    responseCache.clear();
    inflightRequests.clear();
    return;
  }

  for (const key of responseCache.keys()) {
    if (key.includes(`:${pathPrefix}`)) {
      responseCache.delete(key);
    }
  }
  for (const key of inflightRequests.keys()) {
    if (key.includes(`:${pathPrefix}`)) {
      inflightRequests.delete(key);
    }
  }
}

export async function getAccessToken(): Promise<string | null> {
  const now = Date.now();
  if (sessionCache.accessToken && sessionCache.expiresAt > now) {
    return sessionCache.accessToken;
  }

  if (sessionCache.promise) {
    return sessionCache.promise;
  }

  sessionCache.promise = (async () => {
    const supabase = getSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const accessToken = session?.access_token ?? null;
    sessionCache.accessToken = accessToken;
    sessionCache.expiresAt = Date.now() + SESSION_CACHE_TTL_MS;
    sessionCache.promise = null;
    return accessToken;
  })().catch((error) => {
    sessionCache.promise = null;
    sessionCache.accessToken = null;
    sessionCache.expiresAt = 0;
    throw error;
  });

  return sessionCache.promise;
}

async function authHeaders(headers?: HeadersInit): Promise<Headers> {
  const accessToken = await getAccessToken();

  const resolvedHeaders = new Headers(headers);
  return accessToken
    ? new Headers([...resolvedHeaders.entries(), ["Authorization", `Bearer ${accessToken}`]])
    : resolvedHeaders;
}

function apiUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/api${path}`;
    }
    return `/api${path}`;
  }
  return `${baseUrl}/api${path}`;
}

async function parseApiError(response: Response): Promise<Error> {
  let message = `Request failed with status ${response.status}`;
  try {
    const payload = (await response.json()) as { detail?: unknown; message?: unknown };
    const detail = payload.detail ?? payload.message;
    if (typeof detail === "string" && detail.trim()) {
      message = detail;
    } else if (Array.isArray(detail) && detail.length > 0) {
      message = detail
        .map((entry) => {
          if (typeof entry === "string") {
            return entry;
          }
          if (entry && typeof entry === "object") {
            const field = Array.isArray((entry as { loc?: unknown }).loc)
              ? (entry as { loc: unknown[] }).loc.join(".")
              : null;
            const reason =
              typeof (entry as { msg?: unknown }).msg === "string" ? (entry as { msg: string }).msg : null;
            return field && reason ? `${field}: ${reason}` : JSON.stringify(entry);
          }
          return String(entry);
        })
        .join("; ");
    } else if (detail && typeof detail === "object") {
      message = JSON.stringify(detail);
    }
  } catch {
    // Ignore parse failures and keep the default message.
  }
  return new Error(message);
}

function normalizeRequestError(error: unknown, path: string): Error {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (
      message === "Load failed" ||
      message === "Failed to fetch" ||
      message === "NetworkError when attempting to fetch resource."
    ) {
      return new Error(
        `Unable to reach the Schema Studio API for ${path}. Check the backend connection and refresh.`,
      );
    }
    return error;
  }

  return new Error(`Unable to reach the Schema Studio API for ${path}. Check the backend connection and refresh.`);
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = requestMethod(init);
  const key = requestKey(path, init);
  const shouldCache = method === "GET";

  if (!shouldCache) {
    invalidateApiCache();
  }

  if (shouldCache) {
    const cached = responseCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cloneData(cached.data as T);
    }

    const inflight = inflightRequests.get(key);
    if (inflight) {
      return (await inflight) as T;
    }
  }

  const requestPromise = (async () => {
    const headers = await authHeaders(init?.headers);
    if (method !== "GET" && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    let response: Response;
    try {
      response = await fetch(apiUrl(path), {
        ...init,
        cache: init?.cache ?? (shouldCache ? "default" : "no-store"),
        headers,
      });
    } catch (error) {
      throw normalizeRequestError(error, path);
    }

    if (!response.ok) {
      throw await parseApiError(response);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const data = (await response.json()) as T;

    if (shouldCache) {
      responseCache.set(key, {
        data: cloneData(data),
        expiresAt: Date.now() + getGetCacheTtl(path),
      });
    }

    return data;
  })();

  if (shouldCache) {
    inflightRequests.set(key, requestPromise as Promise<unknown>);
  }

  try {
    return await requestPromise;
  } finally {
    inflightRequests.delete(key);
  }
}

export async function apiDownload(path: string, fileName?: string): Promise<void> {
  const headers = await authHeaders();
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method: "GET",
      cache: "no-store",
      headers,
    });
  } catch (error) {
    throw normalizeRequestError(error, path);
  }

  if (!response.ok) {
    throw await parseApiError(response);
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download =
    fileName ??
    response.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1] ??
    "download";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}
