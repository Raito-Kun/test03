/**
 * Deploy the 3 bug fixes (dedup + leader-scope + stale-build) to dev 10.10.101.207.
 * Uploads modified backend files + forces frontend rebuild so the wizard binaries
 * on the server match current HEAD (addresses Fix #2's stale-build theory).
 */
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const SSH_CONFIG = { host: '10.10.101.207', port: 22, username: 'root', password: '123456', readyTimeout: 15000 };
const REPO_LOCAL = path.resolve(__dirname, '..', '..');
const REPO_REMOTE = '/opt/crm';

const FILES = [
  // Backend fixes
  'packages/backend/src/services/contact-import-parser.ts',
  'packages/backend/src/services/contact-import-wizard-service.ts',
  'packages/backend/src/services/contact-service.ts',
  'packages/backend/src/middleware/data-scope-middleware.ts',
  // Frontend re-sync (ensures Hoàn tất / skip-assignment path is current)
  'packages/frontend/src/pages/contacts/contact-import-wizard.tsx',
  'packages/frontend/src/pages/contacts/contact-import-step-assign.tsx',
  'packages/frontend/src/pages/contacts/contact-import-step-dedup.tsx',
  'packages/frontend/src/pages/contacts/contact-import-step-preview.tsx',
  'packages/frontend/src/pages/contacts/contact-import-wizard-types.ts',
];

function runRemote(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, { pty: false }, (err, stream) => {
      if (err) return reject(err);
      let out = '', errOut = '';
      stream.on('close', (code) => resolve({ code, stdout: out, stderr: errOut }))
        .on('data', (d) => { process.stdout.write(d); out += d; })
        .stderr.on('data', (d) => { process.stderr.write(d); errOut += d; });
    });
  });
}
function getSftp(conn) { return new Promise((res, rej) => conn.sftp((e, s) => e ? rej(e) : res(s))); }
function mkdirRemote(conn, dir) { return runRemote(conn, `mkdir -p ${dir}`); }
function upload(sftp, localPath, remotePath) {
  return new Promise((res, rej) => sftp.fastPut(localPath, remotePath, {}, (e) => e ? rej(e) : res()));
}

async function main() {
  const conn = new Client();
  await new Promise((r, j) => conn.on('ready', r).on('error', j).connect(SSH_CONFIG));
  console.log('SSH connected.\n');

  const sftp = await getSftp(conn);
  for (const rel of FILES) {
    const localPath = path.join(REPO_LOCAL, rel);
    const remotePath = path.posix.join(REPO_REMOTE, rel.replace(/\\/g, '/'));
    await mkdirRemote(conn, path.posix.dirname(remotePath));
    const stat = fs.statSync(localPath);
    await upload(sftp, localPath, remotePath);
    console.log(`  ↑ ${rel}  (${stat.size}B)`);
  }

  console.log('\n=== Rebuild backend + frontend (no cache on frontend to beat stale build) ===');
  await runRemote(conn, `cd ${REPO_REMOTE} && docker compose -f docker-compose.prod.yml build backend 2>&1 | tail -15`);
  await runRemote(conn, `cd ${REPO_REMOTE} && docker compose -f docker-compose.prod.yml build --no-cache frontend 2>&1 | tail -15`);

  console.log('\n=== Recreate containers ===');
  await runRemote(conn, `cd ${REPO_REMOTE} && docker compose -f docker-compose.prod.yml up -d backend frontend 2>&1 | tail -10`);

  console.log('\n=== Wait backend healthy ===');
  await runRemote(conn,
    `for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do ` +
    `s=$(docker inspect -f '{{.State.Health.Status}}' crm-backend 2>/dev/null); echo "[$i] backend=$s"; ` +
    `if [ "$s" = "healthy" ]; then break; fi; sleep 3; done`,
  );

  console.log('\n=== Smoke curl ===');
  await runRemote(conn, `curl -k -s -o - -w '\\nHTTP=%{http_code}\\n' https://localhost/api/v1/health`);

  conn.end();
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
