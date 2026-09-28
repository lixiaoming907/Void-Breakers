import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setState('active-play'));

  async function fireWeapon(weapon) {
    await page.evaluate((w) => window.__THREE_GAME_TEST_HOOKS__?.setState(`give:${w}`), weapon);
    await page.mouse.move(640, 280);
    await page.mouse.down();
    await page.waitForTimeout(400);
    const d = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
    await page.mouse.up();
    await page.waitForTimeout(150);
    await page.screenshot({ path: `artifacts/weapons-${weapon}.png` });
    return { weapon: d.weapon, bullets: d.bullets };
  }

  const results = [];
  for (const w of ['lance', 'railgun', 'swarm', 'scatter', 'homing']) {
    results.push(await fireWeapon(w));
  }

  console.log(JSON.stringify({ results, errors }, null, 2));
  await browser.close();
  if (errors.length) process.exitCode = 1;
  for (const r of results) {
    if ((r.bullets ?? 0) < 1) {
      console.error('no bullets for', r.weapon);
      process.exitCode = 1;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
