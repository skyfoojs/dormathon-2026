export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl leading-tight font-bold tracking-tight">
          {title}
        </h1>
        {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-3">{actions}</div>
      ) : null}
    </div>
  );
}
