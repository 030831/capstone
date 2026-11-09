import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: ['--disable-gpu'],
});
const context = await browser.newContext();
const page = await context.newPage();
const failures = [];
page.on('pageerror', (e) => failures.push(e.message));
page.on('response', (r) => {
  if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
});
// Run against `npm run preview -- --port 4173` (base './' works from any subdirectory).
const base = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
for (const route of ['', 'design', 'about']) {
  await page.goto(base + '#/' + route);
  await page.locator('h1').first().waitFor();
  await page.reload();
  await page.locator('h1').first().waitFor();
  console.log('static route + reload:', route || 'home');
}
await browser.close();
if (failures.length) {
  console.error(failures);
  process.exit(1);
}
console.log('Static subdirectory passed; no runtime or HTTP errors.');
