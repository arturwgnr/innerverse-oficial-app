// Copies manually-dropped assets from the project root into public/, the
// only place Vite can serve static files from. Runs automatically before
// dev/build so a new file dropped into /fotos or /music shows up without a
// manual copy step.
import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from "node:fs";
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
  let synced = 0;
  let skipped = 0;
  for (const file of files) {
    const sourcePath = join(sourceDir, file);
    const targetPath = join(targetDir, file);

    // Same size at both ends almost always means this file was already
    // synced on a previous run, so there is nothing to copy, this also
    // sidesteps re-copying a file Explorer/a media player/antivirus
    // currently has open (a plain read-only compare never touches the lock
    // that a write-mode copy would trip).
    try {
      if (existsSync(targetPath) && statSync(targetPath).size === statSync(sourcePath).size) {
        continue;
      }
    } catch {
      // Fall through to the real copy attempt below, whatever this was
      // will surface there instead with a clearer file name attached.
    }

    // A locked/open file on Windows (Explorer preview pane, a player with
    // it open, antivirus mid-scan) fails copyFileSync with a generic
    // "UNKNOWN" error, previously this crashed the whole predev step and
    // blocked npm run dev entirely over one asset. Skip and warn instead,
    // the rest of the app does not depend on this one file syncing this
    // instant, only on the dev server actually starting.
    try {
      copyFileSync(sourcePath, targetPath);
      synced++;
    } catch (err) {
      skipped++;
      console.warn(
        `Could not sync "${file}" (${err.code || err.message}), skipping it for now. ` +
          `It's likely open in another program (a player, Explorer's preview pane, antivirus), close it and restart the dev server to pick it up.`
      );
    }
  }
  console.log(
    `Synced ${synced} file(s) from /${sourceName} to frontend/public/${targetName}` +
      (skipped > 0 ? ` (${skipped} skipped, see warnings above).` : `.`)
  );
}

sync("fotos", "oracle", /\.(png|jpe?g|webp|svg)$/i);
sync("music", "music", /\.(mp3|wav|ogg|m4a)$/i);
