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
  await page.waitForTimeout(500);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);

  const before = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);

  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyD');
  await page.mouse.move(900, 300);
  await page.mouse.down();
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('KeyD');
  await page.mouse.up();
  await page.waitForTimeout(400);

  const after = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);

  await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(250);
  await page.keyboard.up('ShiftLeft');
  await page.waitForTimeout(200);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const paused = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  await page.screenshot({ path: 'artifacts/gameplay-smoke.png', fullPage: false });

  const moved =
    Math.abs(after.player.position.x - before.player.position.x) +
    Math.abs(after.player.position.z - before.player.position.z);

  console.log(
    JSON.stringify(
      {
        before: {
          state: before.state,
          enemies: before.enemies,
          health: before.player.health,
          pos: before.player.position,
        },
        after: {
          state: after.state,
          enemies: after.enemies,
          health: after.player.health,
          pos: after.player.position,
          score: after.score,
          wave: after.wave,
        },
        pausedState: paused.state,
        moved,
        errors,
      },
      null,
      2,
    ),
  );

  await browser.close();
  if (errors.length > 0) process.exitCode = 1;
  if (moved < 0.5) {
    console.error('Player did not move enough');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
