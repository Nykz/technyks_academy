const { chromium } = require('playwright');
const { mkdirSync } = require('node:fs');

const baseUrl = process.env.LOCAL_SITE_URL || 'http://127.0.0.1:4310';
const email = process.env.LOCAL_ADMIN_EMAIL;
const password = process.env.LOCAL_ADMIN_PASSWORD;

if (!email || !password) {
  throw new Error('LOCAL_ADMIN_EMAIL and LOCAL_ADMIN_PASSWORD are required.');
}

let browser;

(async () => {
  mkdirSync('artifacts', { recursive: true });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(`${baseUrl}/templates`, { waitUntil: 'networkidle' });
  if (
    (await page.locator('main').innerText()).includes('// DIGITAL DESIGN SHOP')
  ) {
    throw new Error(
      'Decorative slash prefix is still visible on the template store.',
    );
  }
  const cards = page.locator('main article');
  await cards.first().waitFor({ state: 'visible' });
  const storefrontCount = await cards.count();
  if (storefrontCount !== 13) {
    throw new Error(
      `Expected 13 storefront products, found ${storefrontCount}.`,
    );
  }
  const unloadedImages = await page
    .locator('main article img')
    .evaluateAll(
      (images) =>
        images.filter((image) => !image.complete || image.naturalWidth === 0)
          .length,
    );
  if (unloadedImages)
    throw new Error(`${unloadedImages} storefront covers failed to load.`);
  await page.screenshot({
    path: 'artifacts/template-catalog-storefront.png',
    fullPage: true,
  });

  await cards.first().locator('a').first().click();
  await page.waitForLoadState('networkidle');
  await page.getByRole('heading', { name: /ClipForge/i }).waitFor();
  const detailUrl = page.url();

  await page.goto(`${baseUrl}/auth/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForLoadState('networkidle');
  await page.goto(`${baseUrl}/admin`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'UI templates', exact: true }).click();
  const productCards = page.locator('admin-templates article');
  await productCards.first().waitFor({ state: 'visible' });
  const adminCount = await productCards.count();
  if (adminCount !== 13) {
    throw new Error(`Expected 13 admin products, found ${adminCount}.`);
  }
  await page.screenshot({
    path: 'artifacts/template-catalog-admin-list.png',
    fullPage: true,
  });

  const clipForgeCard = productCards.filter({ hasText: 'ClipForge' }).first();
  await clipForgeCard.getByRole('link', { name: 'Edit product' }).click();
  await page.waitForURL(/\/admin\/templates\/[^/]+\/manage/);
  const titleInput = page.locator('input[name="title"]');
  await titleInput.waitFor({ state: 'visible' });
  await page.waitForFunction(() =>
    document.querySelector('input[name="title"]')?.value.includes('ClipForge'),
  );
  const editorTitle = await titleInput.inputValue();
  if (!editorTitle.includes('ClipForge')) {
    throw new Error(`Unexpected product editor title: ${editorTitle}`);
  }
  await page.getByRole('button', { name: 'Media', exact: true }).click();
  await page.getByText(/thumbnail guidelines/i).waitFor();
  await page.getByText(/video options/i).waitFor();
  const imageInput = page.locator('input[type="file"][accept^="image/"]');
  const videoInput = page.locator('input[type="file"][accept^="video/"]');
  if ((await imageInput.count()) !== 1 || (await videoInput.count()) !== 1) {
    throw new Error(
      'Thumbnail or promotional video upload control is missing.',
    );
  }
  await page.screenshot({
    path: 'artifacts/template-catalog-admin-editor.png',
    fullPage: true,
  });

  const meaningfulErrors = consoleErrors.filter(
    (message) => !message.includes('favicon.ico'),
  );
  if (meaningfulErrors.length) {
    throw new Error(`Browser console errors:\n${meaningfulErrors.join('\n')}`);
  }

  console.log(
    JSON.stringify(
      {
        storefrontCount,
        adminCount,
        unloadedImages,
        detailUrl,
        editorTitle,
        editorUrl: page.url(),
        thumbnailUpload: true,
        videoUpload: true,
        consoleErrors: meaningfulErrors.length,
      },
      null,
      2,
    ),
  );
})()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await browser?.close();
  });
