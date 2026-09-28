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
  await page.waitForTimeout(800);
  const boot = await page.evaluate(() => ({
    hasHooks: !!window.__THREE_GAME_TEST_HOOKS__,
    hasDiag: !!window.__THREE_GAME_DIAGNOSTICS__,
  }));
  console.log('boot', JSON.stringify(boot), 'errors-so-far', errors);

  // Start + shield visible
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    // inject shield via test-friendly path: pick up is hard; use complete state's shield
    window.__THREE_GAME_TEST_HOOKS__?.setState('active-play');
  });
  await page.waitForTimeout(200);
  // active-play already adds shield 40
  await page.waitForTimeout(300);
  const withShield = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
  await page.screenshot({ path: 'artifacts/v2-shield.png' });

  // Force upgrade UI
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setState('upgrade'));
  await page.waitForTimeout(400);
  const upgradeState = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
  await page.screenshot({ path: 'artifacts/v2-upgrade.png' });

  // Pick upgrade 2
  await page.keyboard.press('Digit2');
  await page.waitForTimeout(300);
  const afterUpgrade = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);

  // Combat fire
  await page.mouse.move(700, 300);
  await page.mouse.down();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1000);
  await page.keyboard.up('KeyW');
  await page.mouse.up();
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'artifacts/v2-combat.png' });
  const combat = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);

  // complete state with plasma + boss
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setState('complete'));
  await page.waitForTimeout(500);
  await page.mouse.move(640, 280);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.up();
  await page.screenshot({ path: 'artifacts/v2-complete.png' });
  const complete = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);

  console.log(
    JSON.stringify(
      {
        withShield: {
          state: withShield.state,
          shield: withShield.shield,
          enemies: withShield.enemies,
        },
        upgradeState: { state: upgradeState.state, upgrades: upgradeState.upgrades },
        afterUpgrade: {
          state: afterUpgrade.state,
          weapon: afterUpgrade.weapon,
          upgrades: afterUpgrade.upgrades,
          shield: afterUpgrade.shield,
        },
        combat: {
          state: combat.state,
          score: combat.score,
          weapon: combat.weapon,
          bullets: combat.bullets,
          enemies: combat.enemies,
        },
        complete: {
          state: complete.state,
          weapon: complete.weapon,
          score: complete.score,
          enemies: complete.enemies,
          shield: complete.shield,
        },
        errors,
      },
      null,
      2,
    ),
  );

  await browser.close();
  if (errors.length) process.exitCode = 1;
  if (upgradeState.state !== 'upgrade') {
    console.error('upgrade state failed');
    process.exitCode = 1;
  }
  if (afterUpgrade.state !== 'playing' || afterUpgrade.upgrades < 1) {
    console.error('upgrade apply failed');
    process.exitCode = 1;
  }
  if (withShield.shield <= 0) {
    console.error('shield not active');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
