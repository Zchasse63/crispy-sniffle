/* eslint-disable react-hooks/rules-of-hooks */
/**
 * Shared fixtures for Gym Detail tests.
 *
 * Each fixture navigates to a specific gym slug so any test can use it
 * independently without managing navigation.
 *
 * Gyms covered:
 *   powerhousePage — rich data: equipment, gallery, parking, transit, monthly + day pass
 *   kodawariPage   — studio: recovery amenities, classes, day pass
 *   ampedPage      — new listing: 24h, womens_area, no day-pass price, no gallery, no parking
 */
import { test as base } from "@playwright/test";
import { GymDetailPage } from "../pages/GymDetailPage";

type GymDetailFixtures = {
  powerhousePage: GymDetailPage;
  kodawariPage: GymDetailPage;
  ampedPage: GymDetailPage;
};

export const test = base.extend<GymDetailFixtures>({
  powerhousePage: async ({ page }, use) => {
    const p = new GymDetailPage(page, "powerhouse-gym-athletic-club");
    await p.goto();
    await use(p);
  },

  kodawariPage: async ({ page }, use) => {
    const p = new GymDetailPage(page, "kodawari-studios");
    await p.goto();
    await use(p);
  },

  ampedPage: async ({ page }, use) => {
    const p = new GymDetailPage(page, "amped-fitness-carrollwood");
    await p.goto();
    await use(p);
  },
});

export { expect } from "@playwright/test";
