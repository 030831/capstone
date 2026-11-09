import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: ['--disable-gpu'],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
for (const route of ['', 'focus', 'bridge', 'life', 'records', 'about']) {
  await page.goto('http://127.0.0.1:4173/#/' + route);
  await page.waitForTimeout(350);
  await page.screenshot({
    path: `research/2026-11-03/screenshots/${route || 'home'}-desktop.png`,
    fullPage: true,
  });
  console.log(
    route || 'home',
    await page.title(),
    await page.locator('h1').allTextContents(),
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
  );
}
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://127.0.0.1:4173/#/');
await page.screenshot({ path: 'research/2026-11-03/screenshots/home-mobile.png', fullPage: true });
console.log('errors', errors);
await browser.close();
