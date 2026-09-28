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
  await page.waitForTimeout(200);

  // Hold fire + move for 4s to stress bullets/effects
  await page.mouse.move(700, 300);
  await page.mouse.down();
  await page.keyboard.down('KeyW');
  const t0 = Date.now();
  let frames = 0;
  const samples = [];
  while (Date.now() - t0 < 4000) {
    await page.waitForTimeout(200);
    const d = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
    frames = d.frame;
    samples.push({
      t: Date.now() - t0,
      frame: d.frame,
      bullets: d.bullets,
      enemies: d.enemies,
      calls: d.renderer?.calls,
      tris: d.renderer?.triangles,
    });
  }
  await page.keyboard.up('KeyW');
  await page.mouse.up();

  // pause for stats panel
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const pauseHtml = await page.evaluate(() => document.querySelector('#pause-stats')?.innerHTML ?? '');
  await page.screenshot({ path: 'artifacts/perf-pause.png' });
  await page.keyboard.press('Escape');

  const fps = (frames / 4).toFixed(1);
  console.log(
    JSON.stringify(
      {
        fpsApprox: fps,
        last: samples[samples.length - 1],
        sampleCount: samples.length,
        pauseHasStats: pauseHtml.includes('stat-row'),
        errors,
      },
      null,
      2,
    ),
  );

  await browser.close();
  if (errors.length) process.exitCode = 1;
  if (!pauseHtml.includes('stat-row')) {
    console.error('pause stats missing');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
