// Copies manually-dropped assets from the project root into public/, the
// only place Vite can serve static files from. Runs automatically before
// dev/build so a new file dropped into /fotos or /music shows up without a
// manual copy step.
import { existsSync, mkdirSync, readdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");
const frontendPublic = join(__dirname, "..", "public");

function sync(sourceName, targetName, pattern) {
  const sourceDir = join(root, sourceName);
  const targetDir = join(frontendPublic, targetName);

  if (!existsSync(sourceDir)) {
    console.log(`No /${sourceName} folder found at the project root, skipping ${targetName} asset sync.`);
    return;
  }

  mkdirSync(targetDir, { recursive: true });
  const files = readdirSync(sourceDir).filter((f) => pattern.test(f));
  for (const file of files) {
    copyFileSync(join(sourceDir, file), join(targetDir, file));
  }
  console.log(`Synced ${files.length} file(s) from /${sourceName} to frontend/public/${targetName}.`);
}

sync("fotos", "oracle", /\.(png|jpe?g|webp|svg)$/i);
sync("music", "music", /\.(mp3|wav|ogg|m4a)$/i);
