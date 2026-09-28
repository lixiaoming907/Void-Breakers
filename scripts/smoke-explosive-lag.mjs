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

  // Force explosive + multishot + high fire rate to reproduce the lag case
  await page.evaluate(() => {
    window.__THREE_GAME_TEST_HOOKS__?.setState('give:explosive');
    window.__THREE_GAME_TEST_HOOKS__?.setState('give:multishot');
    window.__THREE_GAME_TEST_HOOKS__?.setState('give:multishot');
    window.__THREE_GAME_TEST_HOOKS__?.setState('give:fireRate');
    window.__THREE_GAME_TEST_HOOKS__?.setState('give:fireRate');
    window.__THREE_GAME_TEST_HOOKS__?.setState('give:plasma');
    for (let i = 0; i < 8; i++) window.__THREE_GAME_TEST_HOOKS__?.setState('give:multishot');
  });

  await page.mouse.move(700, 300);
  await page.mouse.down();
  await page.keyboard.down('KeyA');
  const t0 = Date.now();
  let frames = 0;
  let minDelta = 1e9;
  let lastFrame = 0;
  const fpsSamples = [];
  while (Date.now() - t0 < 3500) {
    await page.waitForTimeout(250);
    const d = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
    if (lastFrame) {
      const df = d.frame - lastFrame;
      fpsSamples.push(df * 4); // frames per ~250ms -> fps approx if 250ms wait
      minDelta = Math.min(minDelta, df);
    }
    lastFrame = d.frame;
    frames = d.frame;
  }
  await page.keyboard.up('KeyA');
  await page.mouse.up();

  const avgFps = fpsSamples.reduce((a, b) => a + b, 0) / Math.max(1, fpsSamples.length);
  console.log(
    JSON.stringify(
      {
        totalFrames: frames,
        avgFpsApprox: avgFps.toFixed(1),
        minFramesPer250ms: minDelta,
        errors,
      },
      null,
      2,
    ),
  );

  await browser.close();
  if (errors.length) process.exitCode = 1;
  // if we stall hard, min frames per 250ms would be 0-2
  if (minDelta < 3) {
    console.error('possible frame stall under explosive spam');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
