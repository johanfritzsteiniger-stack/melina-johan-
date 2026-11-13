/**
 * Supabase-Zugangsdaten. Akzeptiert sowohl die Namen aus unserer README
 * als auch die, die die Supabase-Integration von Vercel automatisch anlegt.
 * Hinweis: NEXT_PUBLIC_-Variablen müssen direkt ausgeschrieben werden,
 * damit Next.js sie beim Build einsetzen kann.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

export const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_KEY);
