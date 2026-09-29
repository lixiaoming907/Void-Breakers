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
    await page.waitForTimeout(500);
    const d = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
    await page.mouse.up();
    await page.waitForTimeout(120);
    await page.screenshot({ path: `artifacts/w2-${weapon}.png` });
    return { weapon: d.weapon, bullets: d.bullets, score: d.score };
  }

  const results = [];
  for (const w of ['scatter', 'lance', 'homing', 'blackhole', 'missile', 'reflect']) {
    results.push(await fireWeapon(w));
  }

  // death spam: explosive-like via missile + many enemies
  await page.evaluate(() => {
    window.__THREE_GAME_TEST_HOOKS__?.setState('give:missile');
    window.__THREE_GAME_TEST_HOOKS__?.setState('give:multishot');
    window.__THREE_GAME_TEST_HOOKS__?.setState('give:multishot');
    window.__THREE_GAME_TEST_HOOKS__?.setState('give:fireRate');
    window.__THREE_GAME_TEST_HOOKS__?.setState('give:wMissileBoomRadius');
    window.__THREE_GAME_TEST_HOOKS__?.setState('give:wMissileBoomDmg');
  });
  await page.mouse.down();
  const t0 = Date.now();
  let lastFrame = 0;
  let minDelta = 1e9;
  while (Date.now() - t0 < 3000) {
    await page.waitForTimeout(250);
    const d = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
    if (lastFrame) minDelta = Math.min(minDelta, d.frame - lastFrame);
    lastFrame = d.frame;
  }
  await page.mouse.up();

  console.log(JSON.stringify({ results, minFramesPer250ms: minDelta, errors }, null, 2));
  await browser.close();
  if (errors.length) process.exitCode = 1;
  for (const r of results) {
    if (r.weapon !== r.weapon) process.exitCode = 1;
  }
  if (minDelta < 3) {
    console.error('death/missile spam may stall');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
