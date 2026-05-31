import { expect, test } from "@playwright/test";

/**
 * E2E tests for the sidebar context menu on pinned/favorite entries.
 *
 * Skip category: requires runtime favorites state.
 * These tests are conditionally skipped when no Pinned favorites exist
 * in the sidebar (Vite preview mode has no persisted favorites).
 * They pass when run against a Tauri app with user-pinned favorites.
 */

const SIDEBAR_SELECTOR = "aside.fo-sidebar";
const SIDEBAR_MENU_SELECTOR = ".fo-sidebar-context-menu";
const BACKDROP_SELECTOR = ".fo-sidebar-menu-backdrop";
const PINNED_SECTION = ".fo-sidebar-section";

test.describe("Sidebar context menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".fo-panel");
  });

  test("sidebar is visible with sections", async ({ page }) => {
    const sidebar = page.locator(SIDEBAR_SELECTOR);
    await expect(sidebar).toBeVisible();

    const sections = sidebar.locator(PINNED_SECTION);
    const count = await sections.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("right-clicking a pinned/favorite entry shows context menu with 3 items", async ({
    page,
  }) => {
    const section = page.locator(
      ".fo-sidebar-section:has(.fo-sidebar-section-title:text-is('Pinned'))",
    );
    const pinnedItems = section.locator(".fo-sidebar-item");
    const count = await pinnedItems.count();

    test.skip(
      count === 0,
      "No Pinned favorites visible — requires user-pinned entries",
    );

    await pinnedItems.first().click({ button: "right" });

    const menu = page.locator(SIDEBAR_MENU_SELECTOR);
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute("role", "menu");

    const items = menu.locator('[role="menuitem"]');
    const texts = (await items.allTextContents()).map((t) => t.trim());

    expect(texts).toContain("Rename Favorite");
    expect(texts).toContain("Remove Favorite");
    expect(texts).toContain("Reveal Path");
  });

  test("clicking Remove Favorite removes the entry", async ({ page }) => {
    const section = page.locator(
      ".fo-sidebar-section:has(.fo-sidebar-section-title:text-is('Pinned'))",
    );
    const pinnedItems = section.locator(".fo-sidebar-item");
    const initialCount = await pinnedItems.count();

    test.skip(
      initialCount === 0,
      "No Pinned favorites visible — requires user-pinned entries",
    );

    const targetItem = pinnedItems.first();
    const targetLabel = await targetItem.textContent();

    await targetItem.click({ button: "right" });

    const removeBtn = page
      .locator(SIDEBAR_MENU_SELECTOR)
      .locator('[role="menuitem"]:has-text("Remove Favorite")');
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    const menu = page.locator(SIDEBAR_MENU_SELECTOR);
    await expect(menu).toHaveCount(0);

    const pinnedItemsAfter = section.locator(".fo-sidebar-item");
    const afterCount = await pinnedItemsAfter.count();
    expect(afterCount).toBe(initialCount - 1);

    if (targetLabel) {
      const labels = (await pinnedItemsAfter.allTextContents()).map((t) =>
        t.trim(),
      );
      expect(labels).not.toContain(targetLabel.trim());
    }
  });

  test("clicking Reveal Path triggers reveal without error", async ({
    page,
  }) => {
    const section = page.locator(
      ".fo-sidebar-section:has(.fo-sidebar-section-title:text-is('Pinned'))",
    );
    const pinnedItems = section.locator(".fo-sidebar-item");
    const count = await pinnedItems.count();

    test.skip(
      count === 0,
      "No Pinned favorites visible — requires user-pinned entries",
    );

    await pinnedItems.first().click({ button: "right" });

    const revealBtn = page
      .locator(SIDEBAR_MENU_SELECTOR)
      .locator('[role="menuitem"]:has-text("Reveal Path")');
    await expect(revealBtn).toBeVisible();
    await revealBtn.click();

    const menu = page.locator(SIDEBAR_MENU_SELECTOR);
    await expect(menu).toHaveCount(0);
  });

  test("clicking outside the context menu dismisses it", async ({ page }) => {
    const section = page.locator(
      ".fo-sidebar-section:has(.fo-sidebar-section-title:text-is('Pinned'))",
    );
    const pinnedItems = section.locator(".fo-sidebar-item");
    const count = await pinnedItems.count();

    test.skip(
      count === 0,
      "No Pinned favorites visible — requires user-pinned entries",
    );

    await pinnedItems.first().click({ button: "right" });

    const menu = page.locator(SIDEBAR_MENU_SELECTOR);
    await expect(menu).toBeVisible();

    const backdrop = page.locator(BACKDROP_SELECTOR);
    await backdrop.click();

    await expect(menu).toHaveCount(0);
  });

  test("Rename Favorite shows inline text input", async ({ page }) => {
    const section = page.locator(
      ".fo-sidebar-section:has(.fo-sidebar-section-title:text-is('Pinned'))",
    );
    const pinnedItems = section.locator(".fo-sidebar-item");
    const count = await pinnedItems.count();

    test.skip(
      count === 0,
      "No Pinned favorites visible — requires user-pinned entries",
    );

    await pinnedItems.first().click({ button: "right" });

    const renameBtn = page
      .locator(SIDEBAR_MENU_SELECTOR)
      .locator('[role="menuitem"]:has-text("Rename Favorite")');
    await expect(renameBtn).toBeVisible();
    await renameBtn.click();

    const menu = page.locator(SIDEBAR_MENU_SELECTOR);
    await expect(menu).toHaveCount(0);

    const inlineInput = section.locator(".fo-sidebar-rename-input");
    await expect(inlineInput).toBeVisible();
  });
});
