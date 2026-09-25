/*
 * Bulk-imports one local course folder to Bunny Stream and then saves the
 * resulting Bunny video IDs to the Technyks course curriculum.
 *
 * Default mode is a no-write preview. Uploads require --apply.
 * Existing courses also require --replace-curriculum to avoid overwriting
 * a live course by accident.
 */

const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.m4v',
  '.mkv',
  '.webm',
  '.mov',
  '.avi',
]);
const MANIFEST_FILE = '.technyks-bunny-import.json';

function die(message) {
  console.error(`\n✕ ${message}`);
  process.exit(1);
}

function readEnv() {
  const file = path.join(process.cwd(), '.env');
  if (!fs.existsSync(file)) die('Missing .env file. Add your Bunny settings first.');
  const values = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(.*?))\s*$/);
    if (match) values[match[1]] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  // Command-line environment values take precedence for one-off local runs.
  // Secrets remain outside source control either way.
  return { ...values, ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key in values || key === 'ADMIN_EMAIL' || key === 'ADMIN_PASSWORD' || key === 'APP_API_URL')) };
}

function parseArgs(argv) {
  const result = { apply: false, replace: false, create: false, api: '', price: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    // pnpm forwards the separator itself on some Windows installations.
    if (value === '--') continue;
    if (value === '--apply') result.apply = true;
    else if (value === '--replace-curriculum') result.replace = true;
    else if (value === '--create') result.create = true;
    else if (value === '--source') result.source = argv[++index];
    else if (value === '--course') result.course = argv[++index];
    else if (value === '--api') result.api = argv[++index];
    else if (value === '--price') {
      result.price = Number(argv[++index]);
      if (!Number.isFinite(result.price) || result.price < 0) die('--price must be a number such as 499 (INR).');
    }
    else if (value === '--help' || value === '-h') result.help = true;
    else die(`Unknown option: ${value}`);
  }
  return result;
}

function printHelp() {
  console.log(`
Technyks Bunny bulk course importer

Course folder layout:
  My Course/
    01 Getting started/
      01 Welcome.mp4
      02 Course roadmap.mp4
    02 JavaScript basics/
      01 Variables.mp4

Preview a new course (does not upload anything):
  pnpm run import:bunny-course -- --source "C:\\path\\My Course" --create

Upload and create the course:
  pnpm run import:bunny-course -- --source "C:\\path\\My Course" --create --apply

Replace the curriculum of an existing *unpublished* course:
  pnpm run import:bunny-course -- --source "C:\\path\\My Course" --course "course-slug" --replace-curriculum --apply

The source folder stays local. A small resume manifest is saved there so a
stopped import does not upload the same videos again.
`);
}

function stripOrderingPrefix(value) {
  return value
    .replace(/^\s*(?:\d+[._ -]*)+/, '')
    .replace(/_+/g, ' ')
    // "my-lesson-name" style names become words; real titles keep their
    // hyphens ("Mid-Build", "Pre-Launch").
    .replace(/^\S*$/, (name) => name.replace(/-+/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function titleFromFilename(filename, moduleTitle) {
  const title = stripOrderingPrefix(path.basename(filename, path.extname(filename)));
  if (title) return title;
  // Files named only "1.mp4", "2.mp4"… inherit their module's name.
  const part = (path.basename(filename, path.extname(filename)).match(/\d+/) || [''])[0];
  return moduleTitle ? `${moduleTitle}${part ? ` — Part ${part}` : ''}` : 'Untitled lecture';
}

function naturalSort(items) {
  return items.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

function readVideoFiles(directory) {
  return naturalSort(
    fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => entry.name),
  );
}

function coursePlan(source) {
  const entries = fs.readdirSync(source, { withFileTypes: true });
  const folders = naturalSort(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name));
  const modules = folders
    .map((folder) => ({
      title: stripOrderingPrefix(folder) || folder,
      folder,
      videos: readVideoFiles(path.join(source, folder)),
    }))
    .filter((module) => module.videos.length > 0);

  const rootVideos = readVideoFiles(source);
  if (rootVideos.length > 0) {
    modules.unshift({ title: 'Introduction', folder: '', videos: rootVideos });
  }
  return modules;
}

function loadManifest(source) {
  const file = path.join(source, MANIFEST_FILE);
  if (!fs.existsSync(file)) return { version: 1, videos: {} };
  try {
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { version: 1, videos: {}, ...manifest, videos: manifest.videos || {} };
  } catch {
    die(`Could not read ${MANIFEST_FILE}. Rename or remove that file and try again.`);
  }
}

function saveManifest(source, manifest) {
  fs.writeFileSync(path.join(source, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    const detail = typeof body === 'string' ? body.slice(0, 300) : body?.message || JSON.stringify(body);
    throw new Error(`${response.status} ${response.statusText}${detail ? ` — ${detail}` : ''}`);
  }
  return body;
}

async function login(api, env) {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    die('ADMIN_EMAIL and ADMIN_PASSWORD are required in .env for the local admin importer.');
  }
  const result = await request(`${api}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }),
  });
  if (!result?.accessToken) die('Admin login did not return an access token.');
  return result.accessToken;
}

async function apiRequest(api, token, endpoint, options = {}) {
  return request(`${api}${endpoint}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

async function uploadToBunny(env, localPath, title) {
  const library = env.BUNNY_STREAM_LIBRARY_ID;
  const accessKey = env.BUNNY_STREAM_API_KEY;
  const base = `https://video.bunnycdn.com/library/${encodeURIComponent(library)}/videos`;
  const created = await request(base, {
    method: 'POST',
    headers: { AccessKey: accessKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ title }),
  });
  const videoId = created?.guid || created?.Guid;
  if (!videoId) throw new Error('Bunny created a video but did not return its video ID.');

  const size = fs.statSync(localPath).size;
  const stream = Readable.toWeb(fs.createReadStream(localPath));
  await request(`${base}/${encodeURIComponent(videoId)}`, {
    method: 'PUT',
    headers: {
      AccessKey: accessKey,
      'content-type': 'application/octet-stream',
      'content-length': String(size),
    },
    body: stream,
    duplex: 'half',
  });
  return videoId;
}

async function bunnyVideoLength(env, videoId) {
  try {
    const video = await request(
      `https://video.bunnycdn.com/library/${encodeURIComponent(env.BUNNY_STREAM_LIBRARY_ID)}/videos/${encodeURIComponent(videoId)}`,
      { headers: { AccessKey: env.BUNNY_STREAM_API_KEY, accept: 'application/json' } },
    );
    return Math.max(0, Math.round(Number(video?.length) || 0));
  } catch (error) {
    die(`Bunny video ${videoId} could not be read (${error.message}). It may have been deleted; remove its entry from ${MANIFEST_FILE} to upload it again.`);
  }
}

function basicCoursePayload(title, modules, price) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `imported-course-${Date.now()}`;
  return {
    slug,
    title,
    subtitle: 'Course curriculum imported from a local folder.',
    description: 'Draft course. Complete the landing page details, thumbnail, price, and publishing settings in the admin panel before making it live.',
    price: price ?? 0,
    isFree: price === 0,
    currency: 'INR',
    level: 'All Levels',
    category: 'Web Development',
    isPublished: false,
    modules,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();
  if (!args.source) die('Use --source followed by the course folder path. Run with --help for an example.');
  const source = path.resolve(args.source);
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) die(`Course folder not found: ${source}`);

  const env = readEnv();
  for (const key of ['BUNNY_STREAM_LIBRARY_ID', 'BUNNY_STREAM_API_KEY']) {
    if (!env[key]) die(`${key} is missing in .env.`);
  }
  const modules = coursePlan(source);
  const lectureCount = modules.reduce((total, module) => total + module.videos.length, 0);
  if (!lectureCount) die('No supported video files were found. Use MP4, M4V, MKV, WebM, MOV, or AVI.');

  console.log(`\nCourse folder: ${path.basename(source)}`);
  console.log(`Modules: ${modules.length} | Videos: ${lectureCount}`);
  for (const module of modules) {
    console.log(`  • ${module.title}: ${module.videos.length} video(s)`);
    for (const filename of module.videos) console.log(`      - ${titleFromFilename(filename, module.title)}`);
  }
  if (!args.apply) {
    console.log('\nPreview only — no video or course was changed. Add --apply when you are ready.');
    return;
  }

  if (!args.create && !args.course) die('Choose --create for a new draft course or pass --course for an existing course.');
  const api = (args.api || env.APP_API_URL || 'http://127.0.0.1:4310/api').replace(/\/$/, '');
  const token = await login(api, env);
  const courses = await apiRequest(api, token, '/admin/courses');
  let course = Array.isArray(courses) ? courses.find((item) => item.id === args.course || item.slug === args.course) : null;

  if (!course && !args.create) die(`No course matched "${args.course}". Use --create to make a new draft course.`);
  if (course && !args.replace) die('For safety, an existing course requires --replace-curriculum. Do not use this on a live course with students.');

  const manifest = loadManifest(source);
  if (manifest.libraryId && String(manifest.libraryId) !== String(env.BUNNY_STREAM_LIBRARY_ID)) {
    die(`${MANIFEST_FILE} records uploads to Bunny library ${manifest.libraryId}, but .env points at ${env.BUNNY_STREAM_LIBRARY_ID}. Those video IDs would not play. Rename the manifest to upload again into the new library.`);
  }
  manifest.libraryId = env.BUNNY_STREAM_LIBRARY_ID;
  const importedModules = [];
  let completed = 0;
  let uploaded = 0;
  for (const [moduleIndex, module] of modules.entries()) {
    const lessons = [];
    for (const [lessonIndex, filename] of module.videos.entries()) {
      const relative = path.join(module.folder, filename).replace(/\\/g, '/');
      let bunnyVideoId = manifest.videos[relative]?.videoId;
      if (bunnyVideoId) {
        console.log(`Reusing uploaded video: ${relative}`);
      } else {
        console.log(`Uploading ${completed + 1}/${lectureCount}: ${relative}`);
        bunnyVideoId = await uploadToBunny(env, path.join(source, module.folder, filename), titleFromFilename(filename, module.title));
        manifest.videos[relative] = { videoId: bunnyVideoId, title: titleFromFilename(filename, module.title), uploadedAt: new Date().toISOString() };
        saveManifest(source, manifest);
        uploaded += 1;
      }
      completed += 1;
      lessons.push({
        title: titleFromFilename(filename, module.title),
        description: null,
        // Seconds, as the admin editor and course page expect. Freshly
        // uploaded videos report 0 until Bunny finishes encoding them.
        duration: await bunnyVideoLength(env, bunnyVideoId),
        order: lessonIndex + 1,
        isFreePreview: moduleIndex === 0 && lessonIndex === 0,
        videoAssetRef: bunnyVideoId,
      });
    }
    importedModules.push({ title: module.title, order: moduleIndex + 1, lessons });
  }

  if (!course) {
    course = await apiRequest(api, token, '/admin/courses', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(basicCoursePayload(stripOrderingPrefix(path.basename(source)) || path.basename(source), importedModules, args.price)),
    });
  } else {
    const payload = {
      slug: course.slug, title: course.title, subtitle: course.subtitle, description: course.description,
      thumbnail: course.thumbnail, promoVideoUrl: course.promoVideoUrl, price: course.price,
      isFree: course.isFree, currency: course.currency, level: course.level, category: course.category,
      isPublished: false, modules: importedModules,
    };
    course = await apiRequest(api, token, `/admin/courses/${encodeURIComponent(course.id)}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
  }

  console.log(`\n✓ Saved ${lectureCount} lessons to course "${course.title}" (${uploaded} newly uploaded to Bunny, ${lectureCount - uploaded} already there).`);
  console.log('The course is kept unpublished. Review its details in Admin before publishing.');
}

main().catch((error) => die(error?.message || 'Bulk import failed.'));
