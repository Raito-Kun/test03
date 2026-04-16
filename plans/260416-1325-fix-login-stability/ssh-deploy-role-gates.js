/**
 * Deploy role gating: dashboard (/) + /settings now supervisor-only.
 * Agents land on /contacts.
 * Frontend-only deploy.
 */
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const SSH_CONFIG = { host: '10.10.101.207', port: 22, username: 'root', password: '123456', readyTimeout: 15000 };
const REPO_LOCAL = path.resolve(__dirname, '..', '..');
const REPO_REMOTE = '/opt/crm';

const FILES = [
  'packages/frontend/src/app.tsx',
  'packages/frontend/src/components/role-guard.tsx',
  'packages/frontend/src/components/layout/sidebar.tsx',
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
  const sftp = await getSftp(conn);
  for (const rel of FILES) {
    const localPath = path.join(REPO_LOCAL, rel);
    const remotePath = path.posix.join(REPO_REMOTE, rel.replace(/\\/g, '/'));
    await mkdirRemote(conn, path.posix.dirname(remotePath));
    const stat = fs.statSync(localPath);
    await upload(sftp, localPath, remotePath);
    console.log(`  ↑ ${rel}  (${stat.size}B)`);
  }
  console.log('\n=== rebuild frontend (no cache) ===');
  await runRemote(conn, `cd ${REPO_REMOTE} && docker compose -f docker-compose.prod.yml build --no-cache frontend 2>&1 | tail -6`);
  console.log('\n=== recreate ===');
  await runRemote(conn, `cd ${REPO_REMOTE} && docker compose -f docker-compose.prod.yml up -d frontend 2>&1 | tail -5`);
  console.log('\n=== smoke ===');
  await runRemote(conn, `curl -k -s -o - -w '\\nHTTP=%{http_code}\\n' https://localhost/api/v1/health`);
  conn.end();
}
main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
