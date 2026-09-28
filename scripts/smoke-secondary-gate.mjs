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

  // force upgrade UI many times WITHOUT owning secondaries — collect card titles
  const titles = new Set();
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setState('upgrade'));
    await page.waitForTimeout(120);
    const names = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#upgrade-cards .upgrade-card strong')).map((el) => el.textContent),
    );
    for (const n of names) titles.add(n);
    // pick first card to advance (may unlock secondary eventually)
    await page.keyboard.press('Digit1');
    await page.waitForTimeout(100);
  }

  // unlock a secondary and check HUD
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setState('give:orbit'));
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setState('give:missilePod'));
  await page.waitForTimeout(150);
  const secondaryHud = await page.evaluate(() => document.querySelector('#secondary-value')?.textContent);
  const diag = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);

  await page.screenshot({ path: 'artifacts/fix6-ui.png' });

  const list = Array.from(titles);
  // secondary buffs that must NOT appear without owning that secondary
  const forbidden = ['光轮研磨', '多环结构', '高速旋转', '高爆弹头', '多联装', '快速装填', '新星增幅', '扩散力场', '充能加速', '炮塔校准', '速射机芯', '远程索敌'];
  // note: 高爆弹头 is also explosive general upgrade name — check tag via DOM instead
  const leakedForbidden = list.filter((t) => forbidden.includes(t));

  console.log(
    JSON.stringify(
      {
        titles: list,
        secondaryHud,
        owned: diag.secondaries,
        leakedForbidden,
        errors,
      },
      null,
      2,
    ),
  );

  await browser.close();
  if (errors.length) process.exitCode = 1;
  if (!secondaryHud || secondaryHud === '—') {
    console.error('secondary HUD not updated');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
