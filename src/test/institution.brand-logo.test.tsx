import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KairoLogo } from "@/components/institution/Logo";

describe("KairoID branding", () => {
  it("renders the canonical horizontal logo", () => {
    render(<KairoLogo />);

    expect(screen.getByRole("img", { name: "KairoID" })).toHaveAttribute(
      "src",
      expect.stringContaining("kairoid-logo-primary"),
    );
  });
});
