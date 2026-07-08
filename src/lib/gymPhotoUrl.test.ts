import { describe, it, expect, vi } from "vitest";

// gymPhotoUrl captures NEXT_PUBLIC_SUPABASE_URL into a module const at import
// time — set it BEFORE the import runs.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
});

import { gymPhotoUrl } from "./gymPhotoUrl";

const RENDER = "https://test.supabase.co/storage/v1/render/image/public/gym-photos";

describe("gymPhotoUrl", () => {
  it("builds a transform URL at the default width/quality when storage_path is set", () => {
    expect(gymPhotoUrl("g/abc.jpg", "https://src.example/x.jpg")).toBe(
      `${RENDER}/g/abc.jpg?width=1280&quality=75`,
    );
  });

  it("honors a per-surface width and quality", () => {
    expect(gymPhotoUrl("g/abc.jpg", null, { width: 640 })).toBe(`${RENDER}/g/abc.jpg?width=640&quality=75`);
    expect(gymPhotoUrl("g/abc.jpg", null, { width: 320, quality: 60 })).toBe(
      `${RENDER}/g/abc.jpg?width=320&quality=60`,
    );
  });

  it("keeps '/' path separators (encodeURI, not encodeURIComponent)", () => {
    expect(gymPhotoUrl("gymid/hash.webp", null)).toContain("/gym-photos/gymid/hash.webp?");
  });

  it("falls back to the source url when there is no storage_path", () => {
    expect(gymPhotoUrl(null, "https://src.example/x.jpg")).toBe("https://src.example/x.jpg");
    expect(gymPhotoUrl(undefined, "https://src.example/x.jpg")).toBe("https://src.example/x.jpg");
    expect(gymPhotoUrl("", "https://src.example/x.jpg")).toBe("https://src.example/x.jpg");
  });

  it("returns null when there is neither a storage_path nor a fallback", () => {
    expect(gymPhotoUrl(null, null)).toBeNull();
    expect(gymPhotoUrl(undefined, null)).toBeNull();
  });
});
