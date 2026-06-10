/**
 * TrainHere button tests — TH-01
 * Signed-out user clicks "I trained here" → SignInModal opens with email input.
 * No crash tested implicitly (page does not navigate away).
 */
import { test, expect } from "../../fixtures/gymDetail";

test.describe("TrainHere Button", () => {
  test("TH-01: clicking 'I trained here' signed-out opens SignInModal with email input, no crash", async ({
    powerhousePage,
  }) => {
    const btn = powerhousePage.trainHereButton();
    await expect(btn).toBeVisible();

    // Confirm modal is not open yet
    expect(await powerhousePage.signInModal().count()).toBe(0);

    await btn.click();

    // Modal should appear
    await expect(powerhousePage.signInModal()).toBeVisible();

    // Email input should be visible and focusable
    const emailInput = powerhousePage.emailInput();
    await expect(emailInput).toBeVisible();

    // h1 still present — no navigation / crash
    await expect(powerhousePage.h1()).toBeVisible();
  });
});
