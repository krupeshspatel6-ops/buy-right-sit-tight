"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setErr(data.error || "Login failed.");
        setBusy(false);
      }
    } catch {
      setErr("Network error.");
      setBusy(false);
    }
  }

  const field =
    "w-full rounded border border-wall-dark bg-white px-3 py-2 text-sm outline-none focus:border-tape";

  return (
    <main className="mx-auto flex min-h-[75vh] max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-bold">Chapter editor</h1>
      <p className="mt-1 text-sm text-ink-soft">Sign in to write and publish.</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-ink-soft">Email</label>
          <input
            type="email"
            className={field}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-ink-soft">Password</label>
          <input
            type="password"
            className={field}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {err && <p className="text-sm text-loss">{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: "#F96302" }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
