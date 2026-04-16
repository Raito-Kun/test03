/**
 * Deploy super_admin cluster-bypass redesign.
 * - Backend: resolveListClusterFilter helper + list services/controllers passing role
 * - DB: rebind @crm.local users (incl. superadmin) onto the active blueva cluster
 *   so their own account / team / extension views aren't empty either.
 */
const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const SSH_CONFIG = { host: '10.10.101.207', port: 22, username: 'root', password: '123456', readyTimeout: 15000 };
const REPO_LOCAL = path.resolve(__dirname, '..', '..');
const REPO_REMOTE = '/opt/crm';
const BLUEVA = '13bec0b3-a748-4bff-9e4e-046e20c65319';

const FILES = [
  'packages/backend/src/lib/active-cluster.ts',
  'packages/backend/src/services/contact-service.ts',
  'packages/backend/src/controllers/contact-controller.ts',
  'packages/backend/src/services/lead-service.ts',
  'packages/backend/src/controllers/lead-controller.ts',
  'packages/backend/src/services/debt-case-service.ts',
  'packages/backend/src/controllers/debt-case-controller.ts',
  'packages/backend/src/services/call-log-service.ts',
  'packages/backend/src/controllers/call-log-controller.ts',
  'packages/backend/src/services/campaign-service.ts',
  'packages/backend/src/controllers/campaign-controller.ts',
  'packages/backend/src/services/user-service.ts',
  'packages/backend/src/controllers/user-controller.ts',
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
const b64 = (sql) => Buffer.from(sql, 'utf8').toString('base64');
function psqlRun(conn, name, sql) {
  return runRemote(conn,
    `docker exec crm-postgres bash -c '` +
    `echo ${b64(sql)} | base64 -d > /tmp/${name}.sql && ` +
    `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /tmp/${name}.sql'`,
  );
}

async function main() {
  const conn = new Client();
  await new Promise((r, j) => conn.on('ready', r).on('error', j).connect(SSH_CONFIG));
  console.log('SSH connected.');

  const sftp = await getSftp(conn);
  for (const rel of FILES) {
    const localPath = path.join(REPO_LOCAL, rel);
    const remotePath = path.posix.join(REPO_REMOTE, rel.replace(/\\/g, '/'));
    await mkdirRemote(conn, path.posix.dirname(remotePath));
    const stat = fs.statSync(localPath);
    await upload(sftp, localPath, remotePath);
    console.log(`  ↑ ${rel}  (${stat.size}B)`);
  }

  console.log('\n=== DB: rebind @crm.local users onto blueva cluster ===');
  await psqlRun(conn, 'before_users', `SELECT email, cluster_id FROM users WHERE email LIKE '%@crm.local' ORDER BY email;`);
  await psqlRun(conn, 'rebind_users', `UPDATE users SET cluster_id = '${BLUEVA}' WHERE email LIKE '%@crm.local';`);
  await psqlRun(conn, 'after_users', `SELECT email, cluster_id FROM users WHERE email LIKE '%@crm.local' ORDER BY email;`);

  console.log('\n=== rebuild backend ===');
  await runRemote(conn, `cd ${REPO_REMOTE} && docker compose -f docker-compose.prod.yml build backend 2>&1 | tail -6`);
  console.log('\n=== recreate backend ===');
  await runRemote(conn, `cd ${REPO_REMOTE} && docker compose -f docker-compose.prod.yml up -d backend 2>&1 | tail -5`);
  console.log('\n=== wait healthy ===');
  await runRemote(conn,
    `for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do ` +
    `s=$(docker inspect -f '{{.State.Health.Status}}' crm-backend 2>/dev/null); echo "[$i] backend=$s"; ` +
    `if [ "$s" = "healthy" ]; then break; fi; sleep 3; done`,
  );

  console.log('\n=== smoke: super_admin sees contacts across clusters ===');
  const script = `
set -e
BASE="https://localhost"
T=$(curl -k -s -X POST "$BASE/api/v1/auth/login" -H "Content-Type: application/json" -d '{"email":"superadmin@crm.local","password":"changeme123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])")
echo "super_admin contacts total:"
curl -k -s "$BASE/api/v1/contacts?limit=100" -H "Authorization: Bearer $T" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('meta',{}).get('total'))"
echo "---"
T2=$(curl -k -s -X POST "$BASE/api/v1/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@blueva","password":"changeme123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])")
echo "admin@blueva contacts total:"
curl -k -s "$BASE/api/v1/contacts?limit=100" -H "Authorization: Bearer $T2" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('meta',{}).get('total'))"
`;
  await runRemote(conn, script);

  conn.end();
}
main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
