/** Platzhalter, solange Daten laden. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-2xl ${className}`} aria-hidden />;
}

export function SkeletonList({ rows = 3, className = "h-16" }: { rows?: number; className?: string }) {
  return (
    <div className="space-y-3" aria-label="Lädt" role="status">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={className} />
      ))}
    </div>
  );
}
