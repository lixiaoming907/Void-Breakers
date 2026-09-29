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
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setState('give:blackhole'));

  // fire blackhole forward and measure enemy pull
  await page.mouse.move(640, 200);
  await page.mouse.down();
  await page.waitForTimeout(200);
  await page.mouse.up();

  const a = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
  await page.waitForTimeout(800);
  const b = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);

  await page.screenshot({ path: 'artifacts/blackhole-gravity.png' });

  console.log(
    JSON.stringify(
      {
        weapon: b.weapon,
        bullets: b.bullets,
        enemiesA: a.enemies,
        enemiesB: b.enemies,
        scoreA: a.score,
        scoreB: b.score,
        errors,
      },
      null,
      2,
    ),
  );

  await browser.close();
  if (errors.length) process.exitCode = 1;
  if (b.weapon !== 'blackhole') {
    console.error('weapon not blackhole');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
