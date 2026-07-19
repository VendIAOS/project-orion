"use client";

import { loadVendiaosSession } from "./auth-client";

export function getAuthHeaders(extraHeaders: HeadersInit = {}) {
  const session = loadVendiaosSession();
  const headers = new Headers(extraHeaders);

  if (session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  return headers;
}
