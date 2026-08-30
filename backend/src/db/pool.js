import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// node-postgres emits "error" on the pool whenever an idle client hits an
// unexpected problem (dropped connection, Postgres restart, etc). With no
// listener attached, that event throws and takes down the whole Node
// process, even though the pool itself recovers fine on its own. This is
// what was silently killing the server right after "listening on port".
pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client:", err);
});
