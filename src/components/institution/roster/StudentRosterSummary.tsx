import type { StudentRosterImportCounts } from "@/lib/institution/types";

export function StudentRosterPreviewSummary({ counts }: { counts: StudentRosterImportCounts }) {
  const cards = [
    ["New", counts.validNew],
    ["Updates", counts.validUpdate],
    ["Duplicates", counts.duplicate],
    ["Invalid", counts.invalid],
    ["Skipped", counts.skipped],
  ] as const;

  return (
    <section aria-labelledby="import-summary-heading" className="space-y-3">
      <h2 id="import-summary-heading" className="text-lg font-semibold">
        Preview summary
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-white p-4 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function StudentRosterResultSummary({ counts }: { counts: StudentRosterImportCounts }) {
  const needsAttention = counts.invalid + counts.duplicate + counts.skipped + counts.failed;
  const cards = [
    ["Added", counts.created],
    ["Updated", counts.updated],
    ["Needs attention", needsAttention],
  ] as const;

  return (
    <div className="grid gap-3 sm:grid-cols-3" aria-label="Import result summary">
      {cards.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-border bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
        </div>
      ))}
    </div>
  );
}
