import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VerificationStatusBadge } from "@/components/institution/StatusBadge";

describe("VerificationStatusBadge", () => {
  it("renders the pending admin quality review label", () => {
    render(<VerificationStatusBadge status="pending_admin_quality_review" />);

    expect(screen.getByText("Pending Admin Quality Review")).toBeInTheDocument();
  });
});
