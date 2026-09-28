import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`page: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });

  await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  // Menu screenshot
  await page.screenshot({ path: 'artifacts/state-menu.png' });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);

  // Aim at arena center-ish and hold fire while circling slightly
  const start = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
  await page.mouse.move(640, 360);
  await page.mouse.down();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(180);
    await page.keyboard.up('KeyA');
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(180);
    await page.keyboard.up('KeyD');
    await page.mouse.move(500 + i * 40, 320 + (i % 3) * 30);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);

  const mid = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
  await page.screenshot({ path: 'artifacts/state-combat.png' });

  // Force game over via hook then restart
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setState('gameover'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'artifacts/state-gameover.png' });
  const dead = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  const restarted = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);

  console.log(
    JSON.stringify(
      {
        start: { state: start.state, score: start.score, enemies: start.enemies },
        mid: {
          state: mid.state,
          score: mid.score,
          enemies: mid.enemies,
          health: mid.player.health,
          wave: mid.wave,
        },
        dead: { state: dead.state, health: dead.player.health },
        restarted: {
          state: restarted.state,
          health: restarted.player.health,
          score: restarted.score,
          wave: restarted.wave,
          enemies: restarted.enemies,
        },
        errors,
      },
      null,
      2,
    ),
  );

  await browser.close();
  if (errors.length) process.exitCode = 1;
  if (restarted.state !== 'playing' || restarted.player.health !== 100) {
    console.error('Restart failed');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
