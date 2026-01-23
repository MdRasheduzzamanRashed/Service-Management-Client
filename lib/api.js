"use client";

import axios from "axios";

// ✅ Set a safe default backend for production (optional but recommended)
const DEFAULT_PROD_API = "https://service-management-server.onrender.com";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:8000"
    : DEFAULT_PROD_API);

export const API_FALLBACK_BASE =
  process.env.NEXT_PUBLIC_API_FALLBACK_BASE ||
  (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "");

// If you mount backend routes under /api (you do), keep this
const API_PREFIX = process.env.NEXT_PUBLIC_API_PREFIX ?? "/api";

function normalizePrefix(prefix) {
  if (!prefix) return "";
  const trimmed = String(prefix).replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}` : "";
}

function normalizeBase(base) {
  return base ? String(base).replace(/\/+$/, "") : "";
}

function buildUrl(base, path) {
  const safeBase = normalizeBase(base);
  const prefix = normalizePrefix(API_PREFIX);
  const suffix = path ? `/${String(path).replace(/^\/+/, "")}` : "";

  // ✅ if base is empty, it becomes relative URL (bad in prod)
  if (!safeBase) return `${prefix}${suffix}` || "/";
  return `${safeBase}${prefix}${suffix}`;
}

export function apiUrl(path, baseOverride) {
  return buildUrl(baseOverride ?? API_BASE, path);
}

function shouldFallback(err) {
  if (!API_FALLBACK_BASE || API_FALLBACK_BASE === API_BASE) return false;
  if (!err?.response) return true;
  return err.response.status >= 500 || err.response.status === 404;
}

async function requestWithBase(base, method, path, config) {
  const url = buildUrl(base, path);

  // ✅ Helpful runtime check
  if (
    process.env.NODE_ENV !== "development" &&
    (!base || String(base).trim() === "")
  ) {
    throw new Error(
      `API_BASE is empty in production. Set NEXT_PUBLIC_API_BASE in Vercel. Tried URL: ${url}`,
    );
  }

  return axios({
    method,
    url,
    withCredentials: false,
    timeout: 20000,
    ...config,
  });
}

export async function apiRequest(method, path, config = {}) {
  try {
    return await requestWithBase(API_BASE, method, path, config);
  } catch (err) {
    if (!shouldFallback(err)) throw err;
    return await requestWithBase(API_FALLBACK_BASE, method, path, config);
  }
}

export function apiGet(path, config) {
  return apiRequest("get", path, config);
}

export function apiPost(path, data, config) {
  return apiRequest("post", path, { ...config, data });
}

export function apiPut(path, data, config) {
  return apiRequest("put", path, { ...config, data });
}

export function apiPatch(path, data, config) {
  return apiRequest("patch", path, { ...config, data });
}

export function apiDelete(path, config) {
  return apiRequest("delete", path, config);
}
