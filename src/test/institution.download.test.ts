import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadInstitutionFile } from "@/lib/institution/download";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("institution file downloads", () => {
  it("downloads the backend blob with the backend-provided filename", () => {
    const blob = new Blob(["Student ID,Full Name\n"], { type: "text/csv" });
    const createObjectURL = vi.fn().mockReturnValue("blob:student-template");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe("backend-student-template.csv");
      expect(this.href).toBe("blob:student-template");
    });

    downloadInstitutionFile({ blob, filename: "backend-student-template.csv" });

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:student-template");
  });
});
