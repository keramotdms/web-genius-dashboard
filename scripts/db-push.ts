/**
 * Robust `prisma db push` wrapper.
 * The sandbox shell exports its own DATABASE_URL (sqlite) which overrides the
 * project's .env and breaks Prisma. This wrapper re-reads .env and forces the
 * correct Postgres URL for the CLI invocation. On Vercel this script is not
 * needed — schema bootstrap happens automatically via ensureSchema().
 */
const raw = await Bun.file(".env").text();
const match = raw.match(/^DATABASE_URL=(.+)$/m);
const url = match?.[1]?.trim().replace(/^"(.*)"$/, "$1");

const proc = Bun.spawn(["bunx", "prisma", "db", "push", "--accept-data-loss"], {
  env: url ? { ...process.env, DATABASE_URL: url } : process.env,
  cwd: import.meta.dir + "/..",
  stdout: "inherit",
  stderr: "inherit",
});
await proc.exited;
process.exit(proc.exitCode ?? 0);
