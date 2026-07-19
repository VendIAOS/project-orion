import { getSupabaseServerConfig } from "./supabase-config";

interface SupabaseRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: string;
  prefer?: string;
}

export class SupabaseConfigError extends Error {
  constructor() {
    super("Supabase ainda nao esta configurado.");
  }
}

export async function supabaseRest<T>(table: string, options: SupabaseRequestOptions = {}) {
  const config = getSupabaseServerConfig();

  if (!config) {
    throw new SupabaseConfigError();
  }

  const query = options.query ? `?${options.query}` : "";
  const response = await fetch(`${config.url}/rest/v1/${table}${query}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: options.prefer ?? "return=representation",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : (null as T);

  if (!response.ok) {
    return {
      data: null,
      error: data,
      status: response.status,
    };
  }

  return {
    data,
    error: null,
    status: response.status,
  };
}
