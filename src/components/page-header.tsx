export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
        {text}
      </div>
    </>
  );
}
