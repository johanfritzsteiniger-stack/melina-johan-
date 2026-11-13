"use client";

import { getSupabase } from "@/lib/supabase/client";

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushState =
  | "unsupported" // Browser kann kein Push
  | "ios-browser" // iPhone, aber nicht über den Home-Bildschirm geöffnet
  | "denied" // Erlaubnis verweigert
  | "off" // möglich, aber auf diesem Gerät nicht aktiv
  | "on"; // aktiv

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export async function getPushState(): Promise<PushState> {
  if (typeof window === "undefined") return "unsupported";
  if (isIOS() && !isStandalone()) return "ios-browser";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

function base64UrlToUint8Array(s: string): Uint8Array<ArrayBuffer> {
  const padded = (s + "=".repeat((4 - (s.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iphone/i.test(ua)) return "iPhone";
  if (/ipad/i.test(ua)) return "iPad";
  if (/android/i.test(ua)) return "Android";
  if (/mac/i.test(ua)) return "Mac";
  if (/windows/i.test(ua)) return "Windows-PC";
  return "Gerät";
}

/** Muss direkt aus einem Tippen/Klick heraus aufgerufen werden (wegen iOS). */
export async function enablePush(): Promise<{ ok: boolean; error?: string }> {
  if (!VAPID_PUBLIC_KEY) return { ok: false, error: "Push ist noch nicht eingerichtet." };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, error: "Benachrichtigungen wurden nicht erlaubt." };

  const reg = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const supabase = getSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: auth.user?.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      device: deviceName(),
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, error: "Speichern hat nicht geklappt: " + error.message };
  return { ok: true };
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await getSupabase().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

/** Schickt eine Nachricht an die andere Person (Fehler werden ignoriert). */
export function notifyPartner(title: string, body?: string, url?: string) {
  if (!VAPID_PUBLIC_KEY) return;
  fetch("/api/push/notify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title, body, url }),
    keepalive: true,
  }).catch(() => {});
}

export async function sendTestPush(): Promise<string> {
  const res = await fetch("/api/push/notify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Test", body: "Push-Benachrichtigungen funktionieren 👍", url: "/einstellungen", test: true }),
  });
  const data = (await res.json()) as { sent?: number; error?: string };
  if (!res.ok) return data.error ?? "Fehler beim Senden.";
  return data.sent ? `Gesendet an ${data.sent} Gerät(e).` : "Kein aktives Gerät gefunden.";
}
