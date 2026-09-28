import { chromium } from '@playwright/test';

function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

async function main() {
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('http://127.0.0.1:5188/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__?.setState('active-play'));
  await page.waitForTimeout(250);

  // Move player so shield is on, then circle the mouse 1.5 turns
  const rows = [];
  const cx = 640;
  const cy = 360;
  for (let i = 0; i < 90; i++) {
    const t = (i / 60) * Math.PI * 2 * 1.5;
    const x = cx + Math.cos(t) * 240;
    const y = cy + Math.sin(t) * 170;
    await page.mouse.move(x, y);
    await page.waitForTimeout(16);
    const d = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
    rows.push({
      yaw: d.player.yaw,
      px: d.player.position.x,
      pz: d.player.position.z,
      sx: d.shieldWorld?.x,
      sz: d.shieldWorld?.z,
      shield: d.shield,
    });
  }

  // Walk around while shield is active to ensure it tracks
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(100);

  const end = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__);
  await page.screenshot({ path: 'artifacts/fix-aim-shield.png' });

  // Analyze yaw wrap: max per-frame jump should be small (shortest arc)
  let maxJump = 0;
  for (let i = 1; i < rows.length; i++) {
    const jump = Math.abs(angDiff(rows[i].yaw, rows[i - 1].yaw));
    if (jump > maxJump) maxJump = jump;
  }

  // Shield local vs expected: shield is child of player group, diagnostics stores local pos
  // After parenting fix, local should stay near 0 while player moves
  const localErr = Math.hypot(end.shieldWorld.x, end.shieldWorld.z);

  // If shield were double-transformed, local would equal player world pos.
  // We record shieldFx.group.position which IS local when parented.
  // Expected local ~0. If it tracks world player pos, bug remains.
  const doubleTransform = Math.hypot(end.shieldWorld.x - end.player.position.x, end.shieldWorld.z - end.player.position.z) < 0.2
    && Math.hypot(end.player.position.x, end.player.position.z) > 1;

  console.log(
    JSON.stringify(
      {
        samples: rows.length,
        maxYawJumpRad: maxJump,
        maxYawJumpDeg: (maxJump * 180) / Math.PI,
        endPlayer: end.player.position,
        endShieldLocal: end.shieldWorld,
        localErr,
        shieldActive: end.shield,
        doubleTransformLikely: doubleTransform,
        errors,
      },
      null,
      2,
    ),
  );

  await browser.close();
  // per-frame jump with 16ms wait should be well under 40 degrees even when spinning
  const maxYawJumpDeg = (maxJump * 180) / Math.PI;
  if (maxYawJumpDeg > 40) {
    console.error('yaw still takes long way / too jumpy', maxYawJumpDeg);
    process.exitCode = 1;
  }
  if (localErr > 0.6) {
    console.error('shield local offset too large — may not follow player');
    process.exitCode = 1;
  }
  if (errors.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
