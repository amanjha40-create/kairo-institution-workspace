import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConfirmDialog } from "@/components/institution/ResponseDialogs";

describe("institution response dialogs", () => {
  it("provides a dialog description for confirmation accessibility", () => {
    render(
      <ConfirmDialog
        open
        claim={{
          candidateName: "Amina Rahman",
          studentId: "NB-2020-014",
          institutionName: "Northbridge University",
          degree: "Bachelor of Science",
          programme: "Computer Science",
          department: "Engineering",
          admissionYear: "2020",
          graduationYear: "2024",
          completionStatus: "Completed",
        }}
        onOpenChange={() => {}}
        onSubmit={() => {}}
      />,
    );

    expect(screen.getByText("Confirm education record")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Confirm only when the candidate-submitted claim matches the institution's records.",
      ),
    ).toBeInTheDocument();
  });
});
