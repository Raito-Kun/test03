/**
 * Diagnose: admin sees contacts, super_admin doesn't. Dump all roles' dataScope
 * inputs — cluster_id on their JWT-carried user row + contact counts per cluster.
 */
const { Client } = require('ssh2');
const SSH_CONFIG = { host: '10.10.101.207', port: 22, username: 'root', password: '123456', readyTimeout: 15000 };

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

const b64 = (sql) => Buffer.from(sql, 'utf8').toString('base64');
const q = (conn, name, sql) =>
  runRemote(conn,
    `docker exec crm-postgres bash -c '` +
    `echo ${b64(sql)} | base64 -d > /tmp/${name}.sql && ` +
    `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /tmp/${name}.sql'`,
  );

async function main() {
  const conn = new Client();
  await new Promise((r, j) => conn.on('ready', r).on('error', j).connect(SSH_CONFIG));

  console.log('\n=== Users by role + cluster ===');
  await q(conn, 'users_by_role',
    `SELECT role, email, cluster_id, status FROM users ORDER BY role, email;`,
  );

  console.log('\n=== Clusters ===');
  await q(conn, 'clusters',
    `SELECT id, name, is_active FROM pbx_clusters ORDER BY is_active DESC, name;`,
  );

  console.log('\n=== Contacts by cluster ===');
  await q(conn, 'contacts',
    `SELECT cluster_id, COUNT(*) FROM contacts GROUP BY cluster_id ORDER BY count DESC;`,
  );

  conn.end();
}
main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
