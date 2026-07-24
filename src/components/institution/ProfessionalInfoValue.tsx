export function ProfessionalInfoValue({
  consented,
  value,
}: {
  consented: boolean;
  value?: string;
}) {
  if (!consented) {
    return <span className="text-xs text-muted-foreground italic">Not shared</span>;
  }

  if (!value) {
    return <span className="text-xs text-muted-foreground">Not available</span>;
  }

  return <span>{value}</span>;
}
