import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getInstitutionStudentRosterErrorReport } from "@/lib/institution/api";
import { getInstitutionErrorMessage } from "@/lib/institution/errors";
import { toast } from "sonner";

export function StudentRosterErrorReportButton({
  organizationId,
  importId,
}: {
  organizationId: string;
  importId: string;
}) {
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const report = await getInstitutionStudentRosterErrorReport(organizationId, importId);
      const url = URL.createObjectURL(report.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = report.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(getInstitutionErrorMessage(error));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Button variant="outline" onClick={download} disabled={downloading}>
      <Download className="h-4 w-4" aria-hidden="true" />
      {downloading ? "Preparing report…" : "Download Error Report"}
    </Button>
  );
}
