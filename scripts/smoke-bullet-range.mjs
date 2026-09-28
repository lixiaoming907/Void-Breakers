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
  await page.waitForTimeout(150);

  // Teleport-like: hold D for a long time toward +X (outer map)
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(2500);
  await page.keyboard.up('KeyD');
  const outer = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
  await page.waitForTimeout(100);

  await page.mouse.move(1000, 360); // aim +X-ish on screen
  await page.mouse.down();
  await page.waitForTimeout(250);
  const mid = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
  await page.waitForTimeout(500);
  const later = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
  await page.mouse.up();

  await page.screenshot({ path: 'artifacts/bullet-range-fix.png' });

  console.log(
    JSON.stringify(
      {
        outerPos: outer.player.position,
        mid: { bullets: mid.bullets, x: mid.player.position.x },
        later: { bullets: later.bullets, x: later.player.position.x },
        errors,
      },
      null,
      2,
    ),
  );

  await browser.close();
  if (outer.player.position.x < 15) {
    console.error('player did not reach outer arena');
    process.exitCode = 1;
  }
  if ((later.bullets ?? 0) < 1) {
    console.error('no bullets survived after firing in outer arena');
    process.exitCode = 1;
  }
  if (errors.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
