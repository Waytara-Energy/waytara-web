"use client";

import { createClient } from "@waytara/supabase/client";
import { hubMessage } from "@/lib/ev-control";

/** The WayTara service that talks to the charger. */
const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "https://hub.waytaraenergy.com";

export type HubResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

async function request(method: "GET" | "POST", path: string, body?: unknown): Promise<Response | { status: number; message: string }> {
  const token = (await createClient().auth.getSession()).data.session?.access_token;
  if (!token) return { status: 401, message: hubMessage(401) };
  try {
    return await fetch(`${GATEWAY_URL.replace(/\/+$/, "")}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    });
  } catch {
    return { status: 0, message: hubMessage(0) };
  }
}

async function said(res: Response): Promise<string | null> {
  try {
    const j = (await res.json()) as { error?: { message?: string } };
    return typeof j.error?.message === "string" ? j.error.message : null;
  } catch {
    return null;
  }
}

/** A call to the service with the signed-in person's pass; the answer as data, or the service's plain reason. */
export async function hubJson<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<HubResult<T>> {
  const res = await request(method, path, body);
  if (!(res instanceof Response)) return { ok: false, ...res };
  if (!res.ok) return { ok: false, status: res.status, message: hubMessage(res.status, await said(res)) };
  try {
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: res.status, message: "The service answered in a way this page cannot read." };
  }
}

/** Fetches a file from the service with the pass and saves it under `filename`. */
export async function hubDownload(path: string, filename: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await request("GET", path);
  if (!(res instanceof Response)) return { ok: false, message: res.message };
  if (!res.ok) return { ok: false, message: hubMessage(res.status, await said(res)) };
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { ok: true };
}
