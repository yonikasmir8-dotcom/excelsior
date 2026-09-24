// Build step: produce a pre-seeded demo database (fixtures, outrights, a week of
// bot trading) so the phone doesn't have to simulate it on first launch.
const fs = require('fs');
const path = require('path');
const out = process.argv[2];
const tmp = path.join(path.dirname(out), 'seed-work.db');
for (const f of [out, tmp, tmp + '-wal', tmp + '-shm']) fs.rmSync(f, { force: true });
process.env.DB_PATH = tmp;
process.env.SEED_DEMO = 'true';
delete process.env.FOOTBALL_DATA_TOKEN;
const { db } = require('../backend/server.js');
db.prepare('DELETE FROM sessions').run();
db.pragma('wal_checkpoint(TRUNCATE)');
db.exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`);
for (const f of [tmp, tmp + '-wal', tmp + '-shm']) fs.rmSync(f, { force: true });
console.log(`seed db: ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
process.exit(0);
