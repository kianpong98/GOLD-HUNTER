const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov']);
const MEDIA_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS]);
const POSTER_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

function exists(filePath) {
  try { fs.accessSync(filePath); return true; } catch { return false; }
}

function mediaNumber(filename, prefix) {
  const match = filename.match(new RegExp(`^${prefix}-(\\d+)`, 'i'));
  return match ? Number(match[1]) : 0;
}

function sortLatestFirst(files, prefix) {
  return files.sort((a, b) => {
    const nb = mediaNumber(b, prefix);
    const na = mediaNumber(a, prefix);
    if (nb !== na) return nb - na;
    return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });
  });
}

function findPoster(folderAbsolute, publicFolder, baseName) {
  for (const ext of POSTER_EXTENSIONS) {
    const candidate = `${baseName}-poster${ext}`;
    if (exists(path.join(folderAbsolute, candidate))) {
      return `${publicFolder}/${candidate}`;
    }
  }
  return '';
}

function generateManifest({ folder, prefix }) {
  const folderAbsolute = path.join(ROOT, folder);
  const publicFolder = folder.replace(/\\/g, '/');

  if (!exists(folderAbsolute)) {
    console.log(`Skipping missing folder: ${folder}`);
    return;
  }

  const files = fs.readdirSync(folderAbsolute)
    .filter((file) => {
      const ext = path.extname(file).toLowerCase();
      if (!MEDIA_EXTENSIONS.has(ext)) return false;
      if (file.toLowerCase().includes('-poster.')) return false;
      return file.toLowerCase().startsWith(`${prefix}-`);
    });

  const items = sortLatestFirst(files, prefix).map((file) => {
    const ext = path.extname(file).toLowerCase();
    const baseName = path.basename(file, ext);
    const isVideo = VIDEO_EXTENSIONS.has(ext);
    const item = {
      src: `${publicFolder}/${file}`,
      type: isVideo ? 'video' : 'image'
    };
    if (isVideo) {
      const poster = findPoster(folderAbsolute, publicFolder, baseName);
      if (poster) item.poster = poster;
    }
    return item;
  });

  const manifestPath = path.join(folderAbsolute, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(items, null, 2) + '\n');
  console.log(`Updated ${manifestPath}: ${items.length} items`);
}

generateManifest({ folder: 'assets/results', prefix: 'result' });
generateManifest({ folder: 'assets/reviews', prefix: 'review' });
