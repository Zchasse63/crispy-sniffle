/**
 * SEO tests — SEO-01
 * script[type="application/ld+json"] must exist, parse as valid JSON,
 * have @type ExerciseGym, and name matching the gym name.
 *
 * Navigates within the test body to avoid the shared-page fixture trap.
 */
import { test, expect } from "../../fixtures/gymDetail";
import { GymDetailPage } from "../../pages/GymDetailPage";

const CASES = [
  {
    slug: "powerhouse-gym-athletic-club",
    expectedName: "Powerhouse Gym Athletic Club",
  },
  { slug: "kodawari-studios", expectedName: "Kodawari Studios" },
  {
    slug: "amped-fitness-carrollwood",
    expectedName: "Amped Fitness Carrollwood",
  },
] as const;

test.describe("SEO — JSON-LD Structured Data", () => {
  test("SEO-01: JSON-LD script exists, parses cleanly, and has ExerciseGym @type with correct name", async ({
    powerhousePage,
  }) => {
    for (const { slug, expectedName } of CASES) {
      const gymPage = new GymDetailPage(powerhousePage.page, slug);
      await gymPage.goto();

      const script = gymPage.jsonLdScript();
      expect(await script.count()).toBe(1);

      const raw = await script.textContent();
      expect(raw).not.toBeNull();

      // Must parse without throwing
      const parsed: Record<string, unknown> = JSON.parse(raw as string);

      expect(parsed["@type"]).toBe("ExerciseGym");
      expect(parsed["name"]).toBe(expectedName);
    }
  });
});
