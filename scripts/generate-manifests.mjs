import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"]);
const VIDEO_EXT = new Set([".mp4", ".webm", ".mov"]);
const MEDIA_EXT = new Set([...IMAGE_EXT, ...VIDEO_EXT]);

function exists(p) {
  return fs.existsSync(path.join(ROOT, p));
}

function listMedia(dir, prefix) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) {
    fs.mkdirSync(abs, { recursive: true });
  }

  const files = fs.readdirSync(abs)
    .filter(file => {
      const ext = path.extname(file).toLowerCase();
      if (!MEDIA_EXT.has(ext)) return false;
      if (file.toLowerCase().includes("-poster")) return false;
      if (file.toLowerCase() === "manifest.json") return false;
      return file.toLowerCase().startsWith(`${prefix}-`);
    });

  const items = files.map(file => {
    const src = `${dir}/${file}`.replaceAll("\\", "/");
    const ext = path.extname(file).toLowerCase();
    const type = VIDEO_EXT.has(ext) ? "video" : "image";
    const base = file.slice(0, -ext.length);
    const posterCandidates = [
      `${dir}/${base}-poster.jpg`,
      `${dir}/${base}-poster.jpeg`,
      `${dir}/${base}-poster.png`,
      `${dir}/${base}-poster.webp`
    ];
    const item = { src, type };
    const poster = posterCandidates.find(exists);
    if (poster) item.poster = poster;
    return item;
  });

  items.sort((a, b) => {
    const getNum = item => {
      const m = item.src.match(new RegExp(`${prefix}-(\\d+)`, "i"));
      return m ? parseInt(m[1], 10) : 0;
    };
    return getNum(b) - getNum(a);
  });

  fs.writeFileSync(
    path.join(ROOT, dir, "manifest.json"),
    JSON.stringify(items, null, 2) + "\n",
    "utf8"
  );

  console.log(`Updated ${dir}/manifest.json (${items.length} items)`);
}

function insideItem(base) {
  const candidates = [".mp4", ".webm", ".mov", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"];
  for (const ext of candidates) {
    const file = `assets/${base}${ext}`;
    if (exists(file)) {
      const type = VIDEO_EXT.has(ext) ? "video" : "image";
      const item = { src: file, type };
      const posterCandidates = [
        `assets/${base}-poster.jpg`,
        `assets/${base}-poster.jpeg`,
        `assets/${base}-poster.png`,
        `assets/${base}-poster.webp`
      ];
      const poster = posterCandidates.find(exists);
      if (poster) item.poster = poster;
      return item;
    }
  }
  return null;
}

function generateInsideManifest() {
  const bases = ["meeting", "analysis", "group", "indicator"];
  const manifest = {};
  for (const base of bases) {
    const item = insideItem(base);
    if (item) manifest[base] = item;
  }
  fs.writeFileSync(
    path.join(ROOT, "assets", "inside-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8"
  );
  console.log(`Updated assets/inside-manifest.json (${Object.keys(manifest).length} items)`);
}

listMedia("assets/results", "result");
listMedia("assets/reviews", "review");
generateInsideManifest();
