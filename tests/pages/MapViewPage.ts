import type { Locator, Page } from "@playwright/test";

/**
 * POM for the Map view.
 * Covers: canvas presence, scout-pin count, popup interactions.
 *
 * Note: Mapbox GL renders to a <canvas> and creates DOM markers outside the
 * React tree. Pins are `.scout-pin` divs created by createWaypointPinElement().
 */
export class MapViewPage {
  readonly page: Page;

  readonly canvas: Locator;
  readonly popup: Locator;

  constructor(page: Page) {
    this.page = page;
    this.canvas = page.locator(".mapboxgl-canvas");
    this.popup = page.locator(".mapboxgl-popup-content");
  }

  /** All scout pins currently rendered in the DOM. */
  allPins(): Locator {
    return this.page.locator(".scout-pin");
  }

  /** Wait for the Mapbox canvas to appear (map has initialised). */
  async waitForCanvas(timeout = 15_000): Promise<void> {
    await this.canvas.waitFor({ state: "visible", timeout });
  }

  /** Count of currently rendered scout pins. */
  async pinCount(): Promise<number> {
    return this.allPins().count();
  }

  /** Click the first scout pin and wait for the popup to appear. */
  async clickFirstPin(): Promise<void> {
    const firstPin = this.allPins().first();
    await firstPin.click();
    await this.popup.waitFor({ state: "visible" });
  }

  /** Click a pin by index (0-based) and wait for popup. */
  async clickPin(index: number): Promise<void> {
    await this.allPins().nth(index).click();
    await this.popup.waitFor({ state: "visible" });
  }

  /** Text content of the popup. */
  async popupText(): Promise<string> {
    return (await this.popup.textContent()) ?? "";
  }

  /** The "View gym →" link inside the popup. */
  viewGymLink(): Locator {
    return this.popup.getByRole("link", { name: "View gym →" });
  }

  /** Check whether the parking line ("P · ...") is present in the popup. */
  async popupHasParking(): Promise<boolean> {
    const text = await this.popupText();
    return text.includes("P · ");
  }
}
