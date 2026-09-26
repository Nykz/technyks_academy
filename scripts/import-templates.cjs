/*
 * Loads the UI templates from the marketplace folder into the live store:
 * screenshots (resized) -> slideshow, sale ZIP -> private download (uploaded
 * in 8 MB pieces), promo video, and preview-link fixes.
 *
 *   node scripts/import-templates.cjs --api https://api.technyks.com/api [--only <slug>] [--apply]
 *
 * Without --apply it only prints the plan. Needs ADMIN_EMAIL and
 * ADMIN_PASSWORD in the environment (ADD-TEMPLATES.bat asks for them).
 * Progress is recorded in <marketplace>/.technyks-template-import.json so a
 * rerun skips anything already done.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const MARKETPLACE = process.env.MARKETPLACE_DIR || 'G:/My Drive/technyks courses/English Courses/marketplace';
const STATE_FILE = process.env.TEMPLATE_IMPORT_STATE || path.join(MARKETPLACE, '.technyks-template-import.json');
const PIECE = 8 * 1024 * 1024;

const PLAN = [
  { folder: 'Angular Starter Admin Portal', slug: 'angular-starter-kit', zip: 'Angular-Starter-Template.zip', screenshots: 'screenshots.zip' },
  { folder: 'Angular_Laravel_Starter_Admin_Portal', slug: 'angular-laravel-admin-starter-kit', zip: 'Angular-Laravel-Starter-Template.zip', screenshots: 'screenshots.zip' },
  { folder: 'Complete Food Delivery App', slug: 'ionic-8-food-delivery-apps-angular-19-admin-panel-with-firebase', zip: 'Ionic8FoodDeliveryPlatform.zip', screenshots: 'screenshots.zip', promo: 'prmo video final.mp4' },
  { folder: 'Construct Kit - A Construction CRM', slug: 'construct-kit-app-the-ultimate-construction-site-management-system', zip: 'construct-kit-platform.zip', screenshots: 'constructor screenshots.zip', clearPreview: true },
  { folder: 'Jokar App UI', slug: 'ionic-jokar-all-in-one-delivery-dunzo-clone-app-template', zip: 'JokarAppFiles.zip', screenshots: 'Jokar app screenshots.zip' },
  { folder: 'MazaEats Customer App UI', slug: 'ionic-customer-food-delivery-app-ui-template-standalone-ngmodule', zip: 'Food-delivery-app code.zip', screenshots: 'NEW SCREENSHOTS.zip' },
  { folder: 'MazaEats Driver App UI', slug: 'ionic-8-rider-food-delivery-app-ui-template', zip: 'rider_app_files.zip', screenshots: 'Rider mobile screens.zip' },
  { folder: 'MazaEats Restaurant App UI', slug: 'ionic-8-restaurant-food-delivery-app-ui-template', zip: 'restaurant_app_files.zip', screenshots: 'restaurant mobile screens.zip' },
];

function die(message) {
  console.error(`\n✕ ${message}`);
  process.exit(1);
}

function args() {
  const argv = process.argv.slice(2);
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return { api: (get('--api') || '').replace(/\/$/, ''), only: get('--only'), apply: argv.includes('--apply') };
}

const loadState = () => {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
};
const saveState = (state) => fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);

async function http(url, options = {}, attempts = 5) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, options);
      const text = await response.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      if (response.ok) return body;
      const error = new Error(`${response.status} ${typeof body === 'object' ? body?.message || '' : String(body).slice(0, 200)}`);
      error.status = response.status;
      error.body = body;
      // Retry only what can succeed later: rate limits and server/proxy errors.
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt >= attempts) throw error;
    } catch (error) {
      if (error.status && ![429, 500, 502, 503, 504].includes(error.status)) throw error;
      if (attempt >= attempts) throw error;
    }
    const wait = 5000 * attempt;
    console.log(`   network hiccup, retrying in ${wait / 1000}s…`);
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

async function login(api) {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) die('ADMIN_EMAIL and ADMIN_PASSWORD are required.');
  const result = await http(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }, 1);
  if (!result?.accessToken) die('Admin login did not return an access token.');
  return { authorization: `Bearer ${result.accessToken}` };
}

function prepareScreenshots(zipPath, slug) {
  const out = path.join(os.tmpdir(), 'technyks-template-screens', slug);
  const script = path.join(__dirname, 'prepare-screenshots.ps1');
  execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, zipPath, out], { stdio: 'pipe' });
  return fs.readdirSync(out).filter((name) => name.endsWith('.jpg')).sort().map((name) => path.join(out, name));
}

async function uploadImage(api, auth, file) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)], { type: 'image/jpeg' }), path.basename(file));
  const result = await http(`${api}/admin/media/image`, { method: 'POST', headers: auth, body: form });
  return result.url;
}

/** Uploads a large file in 8 MB pieces; each piece is retried on failure. */
async function uploadLarge(api, auth, file, purpose, templateId) {
  const size = fs.statSync(file).size;
  const { uploadId } = await http(`${api}/admin/uploads`, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ purpose, fileName: path.basename(file), size, templateId }),
  });
  const handle = fs.openSync(file, 'r');
  try {
    let offset = 0;
    while (offset < size) {
      const length = Math.min(PIECE, size - offset);
      const piece = Buffer.alloc(length);
      fs.readSync(handle, piece, 0, length, offset);
      try {
        const result = await http(`${api}/admin/uploads/${uploadId}?offset=${offset}`, {
          method: 'PUT',
          headers: { ...auth, 'content-type': 'application/octet-stream' },
          body: piece,
        });
        offset = result.received;
      } catch (error) {
        // The server says where it actually is; continue from there.
        if (error.status === 409 && Number.isFinite(error.body?.received)) offset = error.body.received;
        else throw error;
      }
      process.stdout.write(`\r   ${path.basename(file)}: ${Math.round((offset / size) * 100)}% of ${(size / 1e6).toFixed(0)} MB   `);
    }
    process.stdout.write('\n');
  } finally {
    fs.closeSync(handle);
  }
  return http(`${api}/admin/uploads/${uploadId}/finish`, { method: 'POST', headers: auth });
}

async function main() {
  const { api, only, apply } = args();
  if (!fs.existsSync(MARKETPLACE)) die(`Marketplace folder not found: ${MARKETPLACE}`);
  const plan = PLAN.filter((item) => !only || item.slug === only || item.folder === only);
  if (!plan.length) die(`Nothing matches "${only}".`);

  for (const item of plan) {
    const dir = path.join(MARKETPLACE, item.folder);
    const zip = path.join(dir, item.zip);
    for (const file of [zip, path.join(dir, item.screenshots), ...(item.promo ? [path.join(dir, item.promo)] : [])]) {
      if (!fs.existsSync(file)) die(`Missing file: ${file}`);
    }
    console.log(`• ${item.folder} -> ${item.slug}: ZIP ${(fs.statSync(zip).size / 1e6).toFixed(0)} MB${item.promo ? ', promo video' : ''}${item.clearPreview ? ', remove broken preview link' : ''}`);
  }
  if (!apply) {
    console.log('\nPreview only - nothing was changed. Add --apply to upload.');
    return;
  }
  if (!api) die('Pass --api, e.g. --api https://api.technyks.com/api');

  const auth = await login(api);
  const templates = await http(`${api}/admin/templates`, { headers: auth });
  const state = loadState();

  for (const item of plan) {
    console.log(`\n=== ${item.folder}`);
    const template = templates.find((candidate) => candidate.slug === item.slug);
    if (!template) die(`No template with slug ${item.slug} in the store.`);
    const done = (state[item.slug] ||= {});
    const dir = path.join(MARKETPLACE, item.folder);

    if (!done.gallery) {
      const files = prepareScreenshots(path.join(dir, item.screenshots), item.slug);
      console.log(`   uploading ${files.length} screenshots…`);
      const urls = [];
      for (const file of files) urls.push(await uploadImage(api, auth, file));
      await http(`${api}/admin/templates/${template.id}`, {
        method: 'PATCH',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({ gallery: urls }),
      });
      done.gallery = urls.length;
      saveState(state);
      console.log(`   ✓ ${urls.length} screenshots in the slideshow`);
    } else console.log(`   ✓ screenshots already done (${done.gallery})`);

    const zip = path.join(dir, item.zip);
    const zipSize = fs.statSync(zip).size;
    if (done.file !== zipSize) {
      await uploadLarge(api, auth, zip, 'template-file', template.id);
      done.file = zipSize;
      saveState(state);
      console.log('   ✓ sale ZIP attached (buyers can download it)');
    } else console.log('   ✓ sale ZIP already attached');

    if (item.promo && !done.promo) {
      const video = await uploadLarge(api, auth, path.join(dir, item.promo), 'video');
      await http(`${api}/admin/templates/${template.id}`, {
        method: 'PATCH',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({ promoVideoUrl: video.url }),
      });
      done.promo = video.url;
      saveState(state);
      console.log('   ✓ promo video added');
    }

    if (item.clearPreview && !done.previewCleared) {
      await http(`${api}/admin/templates/${template.id}`, {
        method: 'PATCH',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({ previewUrl: '' }),
      });
      done.previewCleared = true;
      saveState(state);
      console.log('   ✓ broken live-preview link removed');
    }
  }
  console.log('\n✓ All templates are updated. Open Admin -> UI templates to review them.');
}

main().catch((error) => die(error?.message || 'Import failed.'));
