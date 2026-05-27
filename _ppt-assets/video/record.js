const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: path.join(__dirname, 'tmp-video'),
      size: { width: 1920, height: 1080 },
    },
  });
  const page = await context.newPage();

  const htmlPath = 'file://' + path.join(__dirname, 'kiyo-demo-v2.html');
  console.log('Opening:', htmlPath);
  await page.goto(htmlPath, { waitUntil: 'networkidle' });

  // Wait for the full 96-second animation
  console.log('Recording 96s animation...');
  await page.waitForTimeout(97000);

  console.log('Done. Closing...');
  await context.close();
  await browser.close();
  console.log('Video saved to tmp-video/');
})();
