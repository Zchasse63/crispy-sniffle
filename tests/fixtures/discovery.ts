/* eslint-disable react-hooks/rules-of-hooks */
/**
 * Shared fixtures for Discovery Core tests.
 * Note: the eslint-disable above suppresses the react-hooks/rules-of-hooks false-positive
 * that fires on Playwright's `use` fixture injection callbacks.
 *
 * Every fixture navigates to "/" and waits for hydration, so any test can
 * use any fixture independently (or in combination) without worrying about
 * which fixture triggers navigation.
 */
import { test as base } from "@playwright/test";
import { DiscoveryPage } from "../pages/DiscoveryPage";
import { SegmentIconRowPage } from "../pages/SegmentIconRowPage";
import { FilterRailPage } from "../pages/FilterRailPage";
import { MapViewPage } from "../pages/MapViewPage";

type DiscoveryFixtures = {
  discoveryPage: DiscoveryPage;
  segmentRow: SegmentIconRowPage;
  filterRail: FilterRailPage;
  mapView: MapViewPage;
};

/** Navigate to "/" and wait for the search input to confirm hydration. */
async function navigateToDiscovery(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/");
  await page.locator('input[aria-label="Describe your ideal gym"]').waitFor({ state: "visible" });
}

export const test = base.extend<DiscoveryFixtures>({
  discoveryPage: async ({ page }, use) => {
    const dp = new DiscoveryPage(page);
    await dp.goto();
    await use(dp);
  },

  segmentRow: async ({ page }, use) => {
    await navigateToDiscovery(page);
    await use(new SegmentIconRowPage(page));
  },

  filterRail: async ({ page }, use) => {
    await navigateToDiscovery(page);
    await use(new FilterRailPage(page));
  },

  mapView: async ({ page }, use) => {
    await navigateToDiscovery(page);
    await use(new MapViewPage(page));
  },
});

export { expect } from "@playwright/test";
