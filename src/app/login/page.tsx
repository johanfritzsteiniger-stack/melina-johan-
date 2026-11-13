"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import { APP_NAME } from "@/lib/config";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "E-Mail oder Passwort stimmt nicht."
          : error.message,
      );
      setLoading(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
        <div>
          <h1 className="text-xl font-semibold">{APP_NAME}</h1>
          <p className="text-sm text-muted">Bitte anmelden</p>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">E-Mail</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Passwort</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent px-3 py-2 font-medium text-accent-foreground disabled:opacity-60"
        >
          {loading ? "Anmelden …" : "Anmelden"}
        </button>
      </form>
    </main>
  );
}
