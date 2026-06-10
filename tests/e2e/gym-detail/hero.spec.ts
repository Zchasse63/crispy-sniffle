/**
 * Hero section tests — HERO-01 through HERO-08
 * Covers: h1 name, segment chip, neighborhood, day-pass chip, Directions,
 *         Call, Website, Back to Explore.
 *
 * Multi-gym tests navigate within the test body using a single fixture page
 * to avoid the shared-page fixture trap (all fixtures share one Playwright
 * page object per test; the last goto() wins).
 */
import { test, expect } from "../../fixtures/gymDetail";
import { GymDetailPage } from "../../pages/GymDetailPage";

const GYMS = [
  {
    slug: "powerhouse-gym-athletic-club",
    name: "Powerhouse Gym Athletic Club",
    segment: "Strength & Powerlifting",
    neighborhood: "Carrollwood",
    hasPhone: true,
    hasDayPass: true,
  },
  {
    slug: "kodawari-studios",
    name: "Kodawari Studios",
    segment: "Yoga & Pilates",
    neighborhood: "South Tampa",
    hasPhone: true,
    hasDayPass: true,
  },
  {
    slug: "amped-fitness-carrollwood",
    name: "Amped Fitness Carrollwood",
    segment: "Big Box",
    neighborhood: "Carrollwood",
    hasPhone: false,
    hasDayPass: false,
  },
] as const;

test.describe("Hero Section", () => {
  test("HERO-01: h1 shows gym name on all three gyms", async ({
    powerhousePage,
  }) => {
    // Navigate through each gym on the single shared page
    for (const gym of GYMS) {
      const gymPage = new GymDetailPage(powerhousePage.page, gym.slug);
      await gymPage.goto();
      const h1Text = await gymPage.h1().textContent();
      expect(h1Text).toContain(gym.name);
    }
  });

  test("HERO-02: segment chip shows correct label on all three gyms", async ({
    powerhousePage,
  }) => {
    for (const gym of GYMS) {
      const gymPage = new GymDetailPage(powerhousePage.page, gym.slug);
      await gymPage.goto();
      const chipText = await gymPage.segmentChip().textContent();
      expect(chipText).toContain(gym.segment);
    }
  });

  test("HERO-03: neighborhood text rendered in hero meta paragraph", async ({
    powerhousePage,
  }) => {
    for (const gym of GYMS) {
      const gymPage = new GymDetailPage(powerhousePage.page, gym.slug);
      await gymPage.goto();
      const lineText = await gymPage.neighborhoodLine().textContent();
      expect(lineText).toContain(gym.neighborhood);
    }
  });

  test("HERO-04: day-pass chip present on powerhouse and kodawari; absent on amped", async ({
    powerhousePage,
  }) => {
    for (const gym of GYMS) {
      const gymPage = new GymDetailPage(powerhousePage.page, gym.slug);
      await gymPage.goto();

      if (gym.hasDayPass) {
        await expect(gymPage.dayPassChip()).toBeVisible();
        const chipText = await gymPage.dayPassChip().textContent();
        expect(chipText).toMatch(/Day pass \$\d+/);
      } else {
        expect(await gymPage.dayPassChip().count()).toBe(0);
      }
    }
  });

  test("HERO-05: Directions link has Google Maps href and target=_blank on all gyms", async ({
    powerhousePage,
  }) => {
    for (const gym of GYMS) {
      const gymPage = new GymDetailPage(powerhousePage.page, gym.slug);
      await gymPage.goto();
      const link = gymPage.directionsLink();
      await expect(link).toBeVisible();
      const href = await link.getAttribute("href");
      expect(href).toMatch(/google\.com\/maps/);
      const target = await link.getAttribute("target");
      expect(target).toBe("_blank");
    }
  });

  test("HERO-06: Call link (tel:) present on powerhouse and kodawari; absent on amped", async ({
    powerhousePage,
  }) => {
    for (const gym of GYMS) {
      const gymPage = new GymDetailPage(powerhousePage.page, gym.slug);
      await gymPage.goto();

      if (gym.hasPhone) {
        await expect(gymPage.callLink()).toBeVisible();
        const href = await gymPage.callLink().getAttribute("href");
        expect(href).toMatch(/^tel:/);
      } else {
        expect(await gymPage.callLink().count()).toBe(0);
      }
    }
  });

  test("HERO-07: Website link has target=_blank and valid http href", async ({
    powerhousePage,
  }) => {
    for (const gym of GYMS) {
      const gymPage = new GymDetailPage(powerhousePage.page, gym.slug);
      await gymPage.goto();
      const link = gymPage.websiteLink();
      await expect(link).toBeVisible();
      const target = await link.getAttribute("target");
      expect(target).toBe("_blank");
      const href = await link.getAttribute("href");
      expect(href).toMatch(/^https?:\/\//);
    }
  });

  test("HERO-08: Back to Explore link has href='/'", async ({
    powerhousePage,
  }) => {
    for (const gym of GYMS) {
      const gymPage = new GymDetailPage(powerhousePage.page, gym.slug);
      await gymPage.goto();
      const link = gymPage.backLink();
      await expect(link).toBeVisible();
      const href = await link.getAttribute("href");
      expect(href).toBe("/");
    }
  });
});
