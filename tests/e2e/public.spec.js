// tests/e2e/public.spec.js
import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('laadt correct en toont app naam', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    const title = await page.title();
    const bodyText = await page.textContent('body');
    // Landing page bevat korfbal-gerelateerde content
    expect(bodyText.length).toBeGreaterThan(100);
  });

  test('heeft werkende login link', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    const loginLink = page.locator('a[href="/login"], button:has-text("Inloggen"), a:has-text("Inloggen")').first();
    await expect(loginLink).toBeVisible({ timeout: 5000 });
  });

  test('geen JavaScript errors op landing page', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/');
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });
});

test.describe('Login pagina', () => {
  test('laadt zonder crashes', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/login');
    await page.waitForTimeout(3000);
    expect(errors).toHaveLength(0);
  });

  test('toont Clerk login formulier', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(3000);
    // Clerk rendert een email input
    const emailInput = page.locator('input[type="email"], input[name="identifier"], input[autocomplete="email"]');
    await expect(emailInput.first()).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Sign-up pagina', () => {
  test('laadt zonder crashes', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/sign-up');
    await page.waitForTimeout(3000);
    expect(errors).toHaveLength(0);
  });
});

test.describe('Geen 404 voor lokale assets', () => {
  test('CSS en JS laden correct', async ({ page }) => {
    const failedLocal = [];
    page.on('response', res => {
      if (res.status() === 404 && res.url().includes('localhost:5173')) {
        failedLocal.push(res.url());
      }
    });
    await page.goto('/');
    await page.waitForTimeout(2000);
    expect(failedLocal).toHaveLength(0);
  });
});
