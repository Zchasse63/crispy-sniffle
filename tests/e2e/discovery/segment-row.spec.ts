/**
 * Segment Icon Row — P0
 * Tests: SEG-01 through SEG-05
 */
import { test, expect } from "../../fixtures/discovery";

test.describe("Segment Icon Row", () => {
  test("SEG-01: 9 segment buttons are rendered", async ({ segmentRow }) => {
    const buttons = segmentRow.allButtons();
    await expect(buttons).toHaveCount(9);
  });

  test("SEG-02: clicking a segment sets aria-pressed=true and reduces count", async ({
    discoveryPage,
    segmentRow,
  }) => {
    const countBefore = await discoveryPage.getGymCount();

    await segmentRow.click("Strength & Powerlifting");

    const pressed = await segmentRow.isPressed("Strength & Powerlifting");
    expect(pressed).toBe(true);

    const countAfter = await discoveryPage.getGymCount();
    expect(countAfter).toBeLessThanOrEqual(countBefore);
  });

  test("SEG-03: clicking a pressed segment clears the filter", async ({
    discoveryPage,
    segmentRow,
  }) => {
    // First press
    await segmentRow.click("Strength & Powerlifting");
    await expect(segmentRow.buttonByTitle("Strength & Powerlifting")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Second press (un-press)
    await segmentRow.click("Strength & Powerlifting");
    await expect(segmentRow.buttonByTitle("Strength & Powerlifting")).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    // Count should return to 35
    const countAfter = await discoveryPage.getGymCount();
    expect(countAfter).toBe(35);
  });

  test("SEG-04: each segment in isolation produces a result count", async ({
    discoveryPage,
    segmentRow,
  }) => {
    const segments = [
      "Strength & Powerlifting",
      "CrossFit",
      "Big Box",
      "Boutique Studio",
      "Yoga & Pilates",
    ];

    for (const seg of segments) {
      await segmentRow.click(seg);
      const count = await discoveryPage.getGymCount();
      // Each segment should produce a valid (possibly zero) count
      expect(count).toBeGreaterThanOrEqual(0);
      // Clear before next iteration
      const pressed = await segmentRow.isPressed(seg);
      if (pressed) {
        await segmentRow.click(seg);
      }
    }
  });

  test("SEG-05: AI search suggests a segment as soft (dashed border + ~ label)", async ({
    discoveryPage,
    segmentRow,
  }) => {
    // A yoga-specific search should cause the yoga_pilates segment to be soft-suggested
    await discoveryPage.search("yoga studio");

    // Check if any segment button has the dashed (soft) style
    const allButtons = segmentRow.allButtons();
    const count = await allButtons.count();
    let hasSoftSegment = false;

    for (let i = 0; i < count; i++) {
      const btn = allButtons.nth(i);
      const classes = await btn.getAttribute("class");
      if (classes?.includes("border-dashed")) {
        hasSoftSegment = true;
        // Also verify the label ends with " ~"
        const span = btn.locator("span");
        const labelText = (await span.textContent()) ?? "";
        expect(labelText.trim()).toMatch(/~$/);
        break;
      }
    }

    expect(hasSoftSegment).toBe(true);
  });
});
