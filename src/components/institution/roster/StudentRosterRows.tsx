import { AlertCircle } from "lucide-react";
import {
  StudentRosterApplicationBadge,
  StudentRosterDispositionBadge,
} from "./StudentRosterBadges";
import { rosterStudentName, rosterValue } from "@/lib/institution/roster";
import type { StudentRosterImportRow } from "@/lib/institution/types";

function RowIssues({ row }: { row: StudentRosterImportRow }) {
  const issues = [...row.validationErrors, ...row.applicationErrors];
  if (issues.length === 0) return null;

  return (
    <details className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
      <summary className="cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {issues.length} {issues.length === 1 ? "issue" : "issues"}
      </summary>
      <ul className="mt-2 space-y-1">
        {issues.map((issue, index) => (
          <li key={`${issue.code}-${index}`} className="flex gap-2">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              {issue.field ? `${issue.field}: ` : ""}
              {issue.message}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function StudentRosterRows({
  rows,
  terminal,
}: {
  rows: StudentRosterImportRow[];
  terminal: boolean;
}) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-white lg:block">
        <table className="min-w-[1080px] w-full text-sm">
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">
                Row
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Student
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Student ID
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Roll Number
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Institution Email
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Program / Degree
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Department
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Enrollment
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Import Result
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.rowNumber} className="align-top">
                <td className="px-4 py-3 text-muted-foreground">{row.rowNumber}</td>
                <td className="min-w-52 px-4 py-3">
                  <div className="font-medium text-foreground">{rosterStudentName(row)}</div>
                  <RowIssues row={row} />
                </td>
                <td className="px-4 py-3">{rosterValue(row.normalizedValues, "student_id")}</td>
                <td className="px-4 py-3">{rosterValue(row.normalizedValues, "roll_number")}</td>
                <td className="px-4 py-3 break-all">
                  {rosterValue(row.normalizedValues, "institutional_email")}
                </td>
                <td className="px-4 py-3">
                  <div>{rosterValue(row.normalizedValues, "program")}</div>
                  <div className="text-xs text-muted-foreground">
                    {rosterValue(row.normalizedValues, "degree")}
                  </div>
                </td>
                <td className="px-4 py-3">{rosterValue(row.normalizedValues, "department")}</td>
                <td className="px-4 py-3">
                  {rosterValue(row.normalizedValues, "enrollment_status")}
                </td>
                <td className="px-4 py-3">
                  {terminal ? (
                    <StudentRosterApplicationBadge status={row.applicationStatus} />
                  ) : (
                    <StudentRosterDispositionBadge disposition={row.disposition} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 lg:hidden">
        {rows.map((row) => (
          <article key={row.rowNumber} className="rounded-lg border border-border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Row {row.rowNumber}</div>
                <h3 className="font-semibold text-foreground">{rosterStudentName(row)}</h3>
              </div>
              {terminal ? (
                <StudentRosterApplicationBadge status={row.applicationStatus} />
              ) : (
                <StudentRosterDispositionBadge disposition={row.disposition} />
              )}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Student ID</dt>
                <dd>{rosterValue(row.normalizedValues, "student_id")}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Roll Number</dt>
                <dd>{rosterValue(row.normalizedValues, "roll_number")}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">Institution Email</dt>
                <dd className="break-all">
                  {rosterValue(row.normalizedValues, "institutional_email")}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Program</dt>
                <dd>{rosterValue(row.normalizedValues, "program")}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Department</dt>
                <dd>{rosterValue(row.normalizedValues, "department")}</dd>
              </div>
            </dl>
            <RowIssues row={row} />
          </article>
        ))}
      </div>
    </>
  );
}
