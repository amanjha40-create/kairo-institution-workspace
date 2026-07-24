import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "institution", label: "Institution", to: "/institution/signup/institution" },
  { key: "admin", label: "Administrator", to: "/institution/signup/admin" },
  { key: "verify", label: "Verification", to: "/institution/signup/verify" },
  { key: "review", label: "Review", to: "/institution/signup/review" },
] as const;

export type SignupStepKey = (typeof STEPS)[number]["key"];

export function SignupProgress({ current }: { current: SignupStepKey }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex w-full items-center gap-2 text-xs sm:text-sm">
      {STEPS.map((step, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={step.key} className="flex flex-1 items-center gap-2">
            <Link
              to={step.to}
              className={cn(
                "flex items-center gap-2 rounded-full px-2.5 py-1 transition-colors",
                active && "bg-[color:var(--kairo-teal-soft)] text-[color:var(--kairo-navy-deep)]",
                !active && done && "text-[color:var(--kairo-navy)]",
                !active && !done && "text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "grid h-6 w-6 place-items-center rounded-full border text-[11px] font-semibold",
                  active
                    ? "border-[color:var(--kairo-navy-deep)] bg-white text-[color:var(--kairo-navy-deep)]"
                    : done
                      ? "border-[color:var(--kairo-navy)] bg-[color:var(--kairo-navy)] text-white"
                      : "border-border bg-white text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="hidden font-medium sm:inline">{step.label}</span>
            </Link>
            {i < STEPS.length - 1 && (
              <span
                className={cn("h-px flex-1", done ? "bg-[color:var(--kairo-navy)]" : "bg-border")}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
