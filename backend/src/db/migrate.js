import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import "dotenv/config";
import { pool } from "./pool.js";

const dir = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const authSchemaPath = path.join(dir, "auth-schema.sql");
  const domainSchemaPath = path.join(dir, "schema.sql");

  for (const file of [authSchemaPath, domainSchemaPath]) {
    try {
      const sql = await readFile(file, "utf8");
      console.log(`Applying ${path.basename(file)}...`);
      await pool.query(sql);
    } catch (err) {
      if (err.code === "ENOENT") {
        console.log(`Skipping ${path.basename(file)} (not found, run "npm run auth:generate" first).`);
        continue;
      }
      // 42P07: relation already exists. auth-schema.sql has no "if not
      // exists" guards (it is regenerated verbatim by the better-auth CLI),
      // so re-running migrate after the first successful run is expected to
      // hit this on that file specifically. Not fatal, schema.sql itself is
      // fully idempotent and still needs its turn.
      if (err.code === "42P07") {
        console.log(`Skipping ${path.basename(file)} (already applied).`);
        continue;
      }
      throw err;
    }
  }

  console.log("Migration complete.");
  await pool.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
