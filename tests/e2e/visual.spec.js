// tests/e2e/visual.spec.js
import { test, expect } from '@playwright/test';
import { mkdir } from 'fs/promises';

test.describe('Visuele smoke tests', () => {
  test.beforeAll(async () => {
    await mkdir('test-results/screenshots', { recursive: true }).catch(() => {});
  });

  test('Landing page — desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: 'test-results/screenshots/landing-desktop.png',
      fullPage: true,
    });
    const bodyText = await page.textContent('body');
    expect(bodyText.length).toBeGreaterThan(100);
  });

  test('Landing page — mobile (iPhone 14)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: 'test-results/screenshots/landing-mobile.png',
      fullPage: true,
    });
    const bodyText = await page.textContent('body');
    expect(bodyText.length).toBeGreaterThan(100);
  });

  test('Login pagina — desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/login');
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: 'test-results/screenshots/login-desktop.png',
      fullPage: true,
    });
    const bodyText = await page.textContent('body');
    expect(bodyText.length).toBeGreaterThan(50);
  });

  test('Login pagina — mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: 'test-results/screenshots/login-mobile.png',
      fullPage: true,
    });
    const bodyText = await page.textContent('body');
    expect(bodyText.length).toBeGreaterThan(50);
  });
});
