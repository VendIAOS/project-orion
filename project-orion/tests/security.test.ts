import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { POST as postChat } from "../app/api/ai/chat/route";
import { getBootstrapWorkspaceContext } from "../lib/auth-workspace-context";

const originalEnv = { ...process.env };

function restoreEnvironment() {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, originalEnv);
}

test.afterEach(restoreEnvironment);

test("bootstrap context is always disabled in production", () => {
  Reflect.set(process.env, "NODE_ENV", "production");
  process.env.VENDIAOS_DEFAULT_WORKSPACE_ID = "workspace-test";
  process.env.VENDIAOS_DEFAULT_USER_ID = "user-test";
  process.env.VENDIAOS_ALLOW_BOOTSTRAP = "true";

  assert.equal(getBootstrapWorkspaceContext(), null);
});

test("OpenAI-backed chat rejects an unauthenticated request before provider use", async () => {
  Reflect.set(process.env, "NODE_ENV", "production");
  process.env.OPENAI_API_KEY = "test-key-never-sent";
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const response = await postChat(
    new Request("http://localhost/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "Crie uma campanha" }] }),
    }),
  );

  assert.equal(response.status, 401);
  assert.match(await response.text(), /Autenticacao obrigatoria/);
});

test("chat rejects oversized messages", async () => {
  delete process.env.OPENAI_API_KEY;

  const response = await postChat(
    new Request("http://localhost/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "x".repeat(12_001) }] }),
    }),
  );

  assert.equal(response.status, 400);
});

test("hardening migration removes direct membership insertion", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20261018090000_harden_workspace_membership.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /drop policy if exists "owners can create workspace membership"/i);
  assert.doesNotMatch(migration, /create policy[\s\S]+workspace_members[\s\S]+for insert/i);
});
