"use client";

import { useRef, useState } from "react";
import { Check, RotateCcw, Trash2 } from "lucide-react";

const THRESHOLD = 80;

/**
 * Listeneintrag mit Wischgesten:
 * nach rechts = abhaken (bzw. wieder öffnen), nach links = löschen.
 */
export function SwipeRow({
  children,
  onSwipeRight,
  onSwipeLeft,
  rightLabel = "Erledigt",
  rightIsUndo = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  rightLabel?: string;
  rightIsUndo?: boolean;
  disabled?: boolean;
}) {
  const [dx, setDx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const horizontal = useRef<boolean | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    if (disabled || e.pointerType === "mouse") return; // Gesten nur für Touch
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    horizontal.current = null;
    setAnimating(false);
  }

  function onPointerMove(e: React.PointerEvent) {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (horizontal.current === null) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      horizontal.current = Math.abs(mx) > Math.abs(my);
      if (horizontal.current) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (!horizontal.current) return;
    // Widerstand hinter der Schwelle
    const damp = (v: number) => (Math.abs(v) > THRESHOLD ? Math.sign(v) * (THRESHOLD + (Math.abs(v) - THRESHOLD) * 0.3) : v);
    setDx(damp(mx));
  }

  function finish() {
    const value = dx;
    start.current = null;
    horizontal.current = null;
    setAnimating(true);
    if (value >= THRESHOLD) {
      setDx(0);
      navigator.vibrate?.(10);
      onSwipeRight();
    } else if (value <= -THRESHOLD) {
      setDx(-window.innerWidth);
      navigator.vibrate?.(10);
      setTimeout(onSwipeLeft, 150);
    } else {
      setDx(0);
    }
  }

  const reached = Math.abs(dx) >= THRESHOLD;

  return (
    <div className="relative overflow-hidden">
      {/* Hintergrund rechts wischen */}
      {dx > 0 && (
        <div className={`absolute inset-0 flex items-center gap-2 px-5 text-sm font-medium text-white ${reached ? "bg-accent" : "bg-accent/60"}`}>
          {rightIsUndo ? <RotateCcw size={18} /> : <Check size={18} />}
          {rightLabel}
        </div>
      )}
      {/* Hintergrund links wischen */}
      {dx < 0 && (
        <div className={`absolute inset-0 flex items-center justify-end gap-2 px-5 text-sm font-medium text-white ${reached ? "bg-red-600" : "bg-red-500/60"}`}>
          Löschen
          <Trash2 size={18} />
        </div>
      )}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        style={{
          transform: dx ? `translateX(${dx}px)` : undefined,
          transition: animating ? "transform 150ms ease-out" : undefined,
          touchAction: "pan-y",
        }}
        className="relative bg-card"
      >
        {children}
      </div>
    </div>
  );
}
