"use client";

// Kaffee-Geräusch aus public/sounds/kaffee.mp3

let audio: HTMLAudioElement | null = null;

/** Lädt den Ton schon vor, damit er beim Tippen ohne Verzögerung startet. */
export function preloadCoffeeSound() {
  if (typeof window === "undefined" || audio) return;
  audio = new Audio("/sounds/kaffee.mp3");
  audio.preload = "auto";
}

/** Muss direkt aus einem Klick heraus aufgerufen werden (sonst blockt iOS den Ton). */
export function playCoffeeSound() {
  try {
    preloadCoffeeSound();
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  } catch {
    // Ton ist nur Zusatz
  }
}
