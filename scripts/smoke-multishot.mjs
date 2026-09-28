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

  // 1) take multishot then fire pulse
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setState('give:multishot'));
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setState('give:multishot'));
  await page.mouse.move(640, 300);
  await page.mouse.down();
  await page.waitForTimeout(350);
  const pulse = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
  await page.mouse.up();

  // 2) switch to railgun — multishot must still apply
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setState('give:railgun'));
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.waitForTimeout(450);
  const rail = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
  await page.mouse.up();

  // 3) switch to flak — still applies
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setState('give:flak'));
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.waitForTimeout(350);
  const flak = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
  await page.mouse.up();

  // secondary unlock
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setState('give:orbit'));
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setState('give:missilePod'));
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setState('give:sOrbitCount'));
  await page.waitForTimeout(200);
  const sec = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);

  await page.screenshot({ path: 'artifacts/v4-multishot.png' });

  console.log(
    JSON.stringify(
      {
        pulse: { weapon: pulse.weapon, bullets: pulse.bullets },
        rail: { weapon: rail.weapon, bullets: rail.bullets },
        flak: { weapon: flak.weapon, bullets: flak.bullets },
        sec: { upgrades: sec.upgrades, bullets: sec.bullets },
        errors,
      },
      null,
      2,
    ),
  );

  await browser.close();
  // after 2x multishot, pulse should fire 3, railgun 3, flak more
  if (rail.weapon !== 'railgun') {
    console.error('railgun not equipped');
    process.exitCode = 1;
  }
  if ((rail.bullets ?? 0) < 3) {
    console.error('multishot lost after weapon swap', rail.bullets);
    process.exitCode = 1;
  }
  if (errors.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
