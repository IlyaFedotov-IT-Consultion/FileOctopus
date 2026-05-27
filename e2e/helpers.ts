/**
 * Shared E2E test helpers for FileOctopus.
 *
 * Use the exported `test` fixture instead of `@playwright/test`'s `test`
 * to automatically handle first-run overlay dismissal and shell readiness.
 */
import { test as base, expect } from "@playwright/test";

/**
 * Dismiss the first-run overlay if it appears.
 * Sets localStorage before navigation so the overlay never renders.
 */
export async function dismissFirstRunOverlay(
  page: import("@playwright/test").Page,
) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("fileoctopus.firstRunDismissed", "true");
    } catch {
      // ignore
    }
  });
}

/**
 * Extended test fixture that auto-dismisses first-run overlay and waits
 * for the shell to be ready before each test.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await dismissFirstRunOverlay(page);
    await use(page);
  },
});

export { expect };
