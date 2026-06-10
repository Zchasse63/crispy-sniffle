/**
 * Gallery strip tests — GAL-01, GAL-02
 * GAL-01: powerhouse has gallery with >= 1 image.
 * GAL-02: amped has no gallery container but page renders correctly.
 */
import { test, expect } from "../../fixtures/gymDetail";

test.describe("Gallery Strip", () => {
  test("GAL-01: powerhouse gallery strip renders with at least one image", async ({
    powerhousePage,
  }) => {
    const container = powerhousePage.galleryContainer();
    await expect(container).toBeVisible();
    const imgCount = await powerhousePage.galleryImages().count();
    expect(imgCount).toBeGreaterThanOrEqual(1);
  });

  test("GAL-02: amped has no gallery strip; page renders without error", async ({
    ampedPage,
  }) => {
    // Gallery container should be absent
    expect(await ampedPage.galleryContainer().count()).toBe(0);

    // Page renders correctly — h1 present, no error state
    await expect(ampedPage.h1()).toBeVisible();
    expect(await ampedPage.h1().textContent()).toContain(
      "Amped Fitness Carrollwood",
    );
  });
});
