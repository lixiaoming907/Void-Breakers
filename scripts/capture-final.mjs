import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

async function main() {
  const file = resolve('..', '虚空破阵-VOIDBREAKERS.html');
  const browser = await chromium.launch({ channel: 'chromium', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'artifacts/final-menu.png' });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  await page.mouse.move(700, 280);
  await page.mouse.down();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyA');
  await page.mouse.up();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'artifacts/final-gameplay.png' });
  await browser.close();
  console.log('screenshots saved');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
