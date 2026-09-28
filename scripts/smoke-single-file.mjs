import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

async function main() {
  const file = resolve('..', '虚空破阵-VOIDBREAKERS.html');
  const url = pathToFileURL(file).href;
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  await page.keyboard.down('KeyW');
  await page.mouse.move(800, 300);
  await page.mouse.down();
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyW');
  await page.mouse.up();
  const diag = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
  await page.screenshot({ path: 'artifacts/single-file-check.png' });
  console.log(
    JSON.stringify(
      {
        hasCanvas: await page.evaluate(() => !!document.querySelector('#game-canvas')),
        hasHooks: await page.evaluate(() => !!window.__THREE_GAME_TEST_HOOKS__),
        diag: diag
          ? {
              state: diag.state,
              score: diag.score,
              enemies: diag.enemies,
              health: diag.player?.health,
              pos: diag.player?.position,
            }
          : null,
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
  if (errors.length || !diag || diag.state !== 'playing') process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
