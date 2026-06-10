/**
 * Map View — P1
 * Tests: MAP-01 through MAP-07
 */
import { test, expect } from "../../fixtures/discovery";

test.describe("Map View", () => {
  test("MAP-01: clicking Map button switches view and shows canvas", async ({
    discoveryPage,
    mapView,
  }) => {
    await discoveryPage.switchToMapView();

    await expect(discoveryPage.mapButton).toHaveAttribute("aria-pressed", "true");
    await mapView.waitForCanvas();
    await expect(mapView.canvas).toBeVisible();
  });

  test("MAP-02: clicking List button returns to list view", async ({
    discoveryPage,
    mapView,
  }) => {
    await discoveryPage.switchToMapView();
    await mapView.waitForCanvas();

    await discoveryPage.switchToListView();

    await expect(discoveryPage.listButton).toHaveAttribute("aria-pressed", "true");
    await expect(discoveryPage.gymCards.first()).toBeVisible();
  });

  test("MAP-03: pin count equals gym count in unfiltered state", async ({
    discoveryPage,
    mapView,
  }) => {
    await discoveryPage.switchToMapView();
    await mapView.waitForCanvas();

    // Wait for pins to render
    await mapView.allPins().first().waitFor({ state: "visible" });

    const gymCount = await discoveryPage.getGymCount();
    const pinCount = await mapView.pinCount();

    // Pins = gyms with non-null lat/lng; must be <= total count, > 0
    expect(pinCount).toBeGreaterThan(0);
    expect(pinCount).toBeLessThanOrEqual(gymCount);
    // For the unfiltered state, all 35 gyms should be pinned (assuming all have coords)
    expect(pinCount).toBe(gymCount);
  });

  test("MAP-04: applying a segment filter reduces pin count", async ({
    discoveryPage,
    segmentRow,
    mapView,
  }) => {
    await discoveryPage.switchToMapView();
    await mapView.waitForCanvas();
    await mapView.allPins().first().waitFor({ state: "visible" });

    const pinsBefore = await mapView.pinCount();

    // Apply a segment filter that should narrow results
    await segmentRow.click("Strength & Powerlifting");

    // Wait for re-render
    await discoveryPage.page.waitForFunction((before: number) => {
      const pins = document.querySelectorAll(".scout-pin");
      return pins.length !== before;
    }, pinsBefore);

    const pinsAfter = await mapView.pinCount();
    expect(pinsAfter).toBeLessThan(pinsBefore);
  });

  test("MAP-05: clicking a pin opens a popup with gym name", async ({
    discoveryPage,
    mapView,
  }) => {
    await discoveryPage.switchToMapView();
    await mapView.waitForCanvas();
    await mapView.allPins().first().waitFor({ state: "visible" });

    await mapView.clickFirstPin();

    await expect(mapView.popup).toBeVisible();
    const popupText = await mapView.popupText();
    expect(popupText.trim().length).toBeGreaterThan(0);
  });

  test("MAP-06: popup contains View gym → link", async ({ discoveryPage, mapView }) => {
    await discoveryPage.switchToMapView();
    await mapView.waitForCanvas();
    await mapView.allPins().first().waitFor({ state: "visible" });

    await mapView.clickFirstPin();

    await expect(mapView.viewGymLink()).toBeVisible();
    const href = await mapView.viewGymLink().getAttribute("href");
    expect(href).toMatch(/^\/gym\//);
  });

  test("MAP-07: popup shows parking line when gym has parking data", async ({
    discoveryPage,
    mapView,
  }) => {
    await discoveryPage.switchToMapView();
    await mapView.waitForCanvas();
    await mapView.allPins().first().waitFor({ state: "visible" });

    const pinCount = await mapView.pinCount();

    // Iterate through a sample of pins to find one with parking
    let foundParking = false;
    for (let i = 0; i < Math.min(pinCount, 10); i++) {
      // Close any open popup first
      const closeBtn = discoveryPage.page.locator(".mapboxgl-popup-close-button");
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      }

      await mapView.clickPin(i);
      const hasParking = await mapView.popupHasParking();
      if (hasParking) {
        foundParking = true;
        // Verify the format
        const popupText = await mapView.popupText();
        expect(popupText).toContain("P · ");
        break;
      }
    }

    // At least one gym among the first 10 pins should have parking data
    expect(foundParking).toBe(true);
  });
});
