/* eslint-disable react-hooks/rules-of-hooks */
/**
 * Shared fixture for Journeys + Chrome tests.
 *
 * Exports a single `journeysPage` fixture that provides the raw Playwright
 * page with no pre-navigation. Each test navigates within its own test body.
 *
 * This avoids the multi-Page fixture trap documented in:
 *   specs/healing/gym-detail-healing-log.md
 *
 * POMs are instantiated inline in tests — no fixture-per-POM to avoid
 * fixture explosion across 8 different surfaces.
 */
import { test as base } from "@playwright/test";

type JourneysFixtures = {
  journeysPage: import("@playwright/test").Page;
};

export const test = base.extend<JourneysFixtures>({
  /**
   * Plain page, no navigation.
   * Tests call their own POM goto() methods.
   */
  journeysPage: async ({ page }, use) => {
    await use(page);
  },
});

export { expect } from "@playwright/test";
