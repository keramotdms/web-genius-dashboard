import EmbeddedPostgres from "/tmp/pgtest/node_modules/embedded-postgres/dist/index.js";

const pg = new EmbeddedPostgres({
  databaseDir: "/tmp/pgtest/pgdata",
  user: "postgres",
  password: "password",
  port: 5432,
  persistent: true,
});

try {
  await pg.initialise();
  console.log("initialised");
} catch (e) {
  console.log("initialise skipped:", String(e).slice(0, 80));
}
await pg.start();
try {
  await pg.createDatabase("finance");
  console.log("db finance created");
} catch (e) {
  console.log("db exists:", String(e).slice(0, 60));
}
console.log("POSTGRES READY on 5433");
setInterval(() => {}, 1 << 30);
