import { describe, it, expect } from "vitest";
import { safeHttpUrl } from "./safeUrl";

describe("safeHttpUrl", () => {
  it("accepts https URLs", () => {
    expect(safeHttpUrl("https://ok.com")).toBe("https://ok.com/");
    expect(safeHttpUrl("https://ok.com/path?q=1")).toBe("https://ok.com/path?q=1");
  });

  it("accepts http URLs", () => {
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com/");
  });

  it("prefixes bare domains with https://", () => {
    expect(safeHttpUrl("gym.com")).toBe("https://gym.com/");
    expect(safeHttpUrl("www.gym.com/about")).toBe("https://www.gym.com/about");
  });

  it("rejects javascript: URLs", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("JAVASCRIPT:alert(1)")).toBeNull();
  });

  it("rejects data: URLs", () => {
    expect(safeHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeHttpUrl("//evil.com")).toBeNull();
  });

  it("rejects empty / nullish", () => {
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl(undefined)).toBeNull();
    expect(safeHttpUrl("")).toBeNull();
    expect(safeHttpUrl("   ")).toBeNull();
  });

  it("rejects other schemes", () => {
    expect(safeHttpUrl("ftp://files.example.com")).toBeNull();
    expect(safeHttpUrl("file:///etc/passwd")).toBeNull();
  });
});
