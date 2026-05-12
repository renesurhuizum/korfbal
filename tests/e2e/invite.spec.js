// tests/e2e/invite.spec.js
import { test, expect } from '@playwright/test';

test.describe('Invite token localStorage flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('token wordt opgeslagen bij ?invite= parameter (niet ingelogd)', async ({ page }) => {
    await page.goto('/?invite=ABC123TEST');
    await page.waitForTimeout(2000);
    const token = await page.evaluate(() =>
      localStorage.getItem('korfbal_pending_invite')
    );
    expect(token).toBe('ABC123TEST');
  });

  test('lege invite parameter slaat niets op', async ({ page }) => {
    await page.goto('/?invite=');
    await page.waitForTimeout(1500);
    const token = await page.evaluate(() =>
      localStorage.getItem('korfbal_pending_invite')
    );
    // Lege string moet falsy zijn — geen opslag
    expect(token == null || token === '').toBeTruthy();
  });

  test('invite token overleeft navigatie naar /login', async ({ page }) => {
    await page.goto('/?invite=PERSIST_ME');
    await page.waitForTimeout(1500);
    await page.goto('/login');
    await page.waitForTimeout(1500);
    const token = await page.evaluate(() =>
      localStorage.getItem('korfbal_pending_invite')
    );
    expect(token).toBe('PERSIST_ME');
  });

  test('?invite= URL parameter wordt verwijderd na opslaan (geen refresh-loop)', async ({ page }) => {
    await page.goto('/?invite=CLEANUP_TEST');
    await page.waitForTimeout(2000);
    // URL moet niet meer ?invite= bevatten na verwerking
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('invite=CLEANUP_TEST');
  });

  test('geen crashes bij invite flow', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/?invite=NO_CRASH_TEST');
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });
});
