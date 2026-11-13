/** Wird bei jedem Seitenwechsel neu eingehängt – für einen sanften Übergang. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
