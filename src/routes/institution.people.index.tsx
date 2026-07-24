import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { getInstitutionPeople } from "@/lib/institution/api";
import { ProfessionalInfoValue } from "@/components/institution/ProfessionalInfoValue";
import { isInstitutionError } from "@/lib/institution/errors";
import { institutionQueryKeys } from "@/lib/institution/query-keys";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InstitutionStatusBadge,
  PassportStatusBadge,
  TrustStatusBadge,
} from "@/components/institution/StatusBadge";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  ServiceUnavailableState,
} from "@/components/institution/PageStates";

export const Route = createFileRoute("/institution/people/")({
  component: PeoplePage,
});

function PeoplePage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: institutionQueryKeys.people(),
    queryFn: getInstitutionPeople,
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [trustFilter, setTrustFilter] = useState("all");
  const [passportFilter, setPassportFilter] = useState("all");
  const [professionFilter, setProfessionFilter] = useState("all");

  const professions = useMemo(() => {
    const s = new Set<string>();
    (data ?? []).forEach((p) => {
      if (p.sharedProfile.consented && p.sharedProfile.currentTitle)
        s.add(p.sharedProfile.currentTitle);
      (p.sharedProfile.credentials ?? []).forEach((c) => s.add(c.name));
    });
    return Array.from(s);
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((p) => {
      if (statusFilter !== "all" && p.institutionStatus !== statusFilter) return false;
      if (trustFilter !== "all" && p.trustStatus !== trustFilter) return false;
      if (passportFilter !== "all" && p.passportStatus !== passportFilter) return false;
      if (professionFilter !== "all") {
        const t = p.sharedProfile.currentTitle;
        const creds = (p.sharedProfile.credentials ?? []).map((c) => c.name);
        if (t !== professionFilter && !creds.includes(professionFilter)) return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.relationship.studentId.toLowerCase().includes(q) ||
        p.degree.toLowerCase().includes(q) ||
        (p.sharedProfile.currentCompany ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, query, statusFilter, trustFilter, passportFilter, professionFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">People</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View students and alumni connected to your institution.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, student ID, degree, company…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="current_student">Current Student</SelectItem>
              <SelectItem value="alumni">Alumni</SelectItem>
              <SelectItem value="withdrawn">Withdrawn</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={trustFilter} onValueChange={setTrustFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Trust" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All trust</SelectItem>
              <SelectItem value="institution_verified">Institution Verified</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="disputed">Disputed</SelectItem>
              <SelectItem value="revoked">Revoked</SelectItem>
            </SelectContent>
          </Select>
          <Select value={passportFilter} onValueChange={setPassportFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Passport" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All passports</SelectItem>
              <SelectItem value="connected">Connected</SelectItem>
              <SelectItem value="not_connected">Not Connected</SelectItem>
              <SelectItem value="sharing_limited">Sharing Limited</SelectItem>
            </SelectContent>
          </Select>
          <Select value={professionFilter} onValueChange={setProfessionFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Profession" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any profession</SelectItem>
              {professions.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError && isInstitutionError(error) && error.status === 503 ? (
        <ServiceUnavailableState title="People are unavailable" description={error.uiMessage} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={query ? "No matching people" : "No connected people"}
          description={
            query
              ? "Try adjusting your search or filters."
              : "Students and alumni linked to your institution will appear here."
          }
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-border bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Person</th>
                  <th className="px-4 py-2 font-medium">Institution Status</th>
                  <th className="px-4 py-2 font-medium">Degree</th>
                  <th className="px-4 py-2 font-medium">Graduation</th>
                  <th className="px-4 py-2 font-medium">Current Title</th>
                  <th className="px-4 py-2 font-medium">Company</th>
                  <th className="px-4 py-2 font-medium">Trust</th>
                  <th className="px-4 py-2 font-medium">Passport</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-secondary/40">
                    <td className="px-4 py-3">
                      <Link
                        to="/institution/people/$personId"
                        params={{ personId: p.id }}
                        className="font-medium text-foreground hover:text-[color:var(--kairo-navy)]"
                      >
                        {p.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {p.relationship.studentId}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <InstitutionStatusBadge status={p.institutionStatus} />
                    </td>
                    <td className="px-4 py-3">{p.degree}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.graduationYear}</td>
                    <td className="px-4 py-3">
                      <ProfessionalInfoValue
                        consented={p.sharedProfile.consented}
                        value={p.sharedProfile.currentTitle}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <ProfessionalInfoValue
                        consented={p.sharedProfile.consented}
                        value={p.sharedProfile.currentCompany}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <TrustStatusBadge status={p.trustStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <PassportStatusBadge status={p.passportStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {filtered.map((p) => (
              <Link
                key={p.id}
                to="/institution/people/$personId"
                params={{ personId: p.id }}
                className="block rounded-lg border border-border bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.relationship.studentId}</div>
                  </div>
                  <TrustStatusBadge status={p.trustStatus} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Degree</div>
                    <div>{p.degree}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Graduation</div>
                    <div>{p.graduationYear}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Current title</div>
                    <div>
                      <ProfessionalInfoValue
                        consented={p.sharedProfile.consented}
                        value={p.sharedProfile.currentTitle}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Company</div>
                    <div>
                      <ProfessionalInfoValue
                        consented={p.sharedProfile.consented}
                        value={p.sharedProfile.currentCompany}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <InstitutionStatusBadge status={p.institutionStatus} />
                  <PassportStatusBadge status={p.passportStatus} />
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
