/**
 * Diagnose why admin@blueva sees empty contact list despite recent imports.
 * Hypothesis: contacts belong to a different cluster_id than admin's JWT cluster.
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

async function main() {
  const conn = new Client();
  await new Promise((r, j) => conn.on('ready', r).on('error', j).connect(SSH_CONFIG));

  console.log('\n=== discover postgres creds ===');
  await runRemote(conn, `docker exec crm-postgres env | grep -E 'POSTGRES_(USER|DB|PASSWORD)'`);

  // Helper that uses env vars inside the container
  const q = (sql) =>
    runRemote(conn, `docker exec crm-postgres bash -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "${sql.replace(/"/g, '\\"')}"'`);

  console.log('\n=== contacts summary ===');
  await q(`SELECT COUNT(*) total, COUNT(DISTINCT cluster_id) clusters, COUNT(*) FILTER (WHERE cluster_id IS NULL) null_cluster FROM contacts;`);

  console.log('\n=== contacts by cluster ===');
  await q(`SELECT cluster_id, COUNT(*) FROM contacts GROUP BY cluster_id ORDER BY count DESC LIMIT 10;`);

  console.log('\n=== clusters ===');
  await q(`SELECT id, name, is_active FROM pbx_clusters ORDER BY is_active DESC;`);

  console.log('\n=== admin user cluster binding ===');
  await q(`SELECT id, email, role, cluster_id FROM users WHERE email ILIKE 'admin%' OR email ILIKE '%blueva%' ORDER BY email;`);

  console.log('\n=== sample imported phones ===');
  await q(`SELECT phone, cluster_id, assigned_to, created_by, created_at FROM contacts ORDER BY created_at DESC LIMIT 10;`);

  console.log('\n=== backend recent logs (import telemetry) ===');
  await runRemote(conn, `docker logs crm-backend --since 15m 2>&1 | grep -iE 'wizard|dedup|import' | tail -20 || echo "no matches"`);

  conn.end();
}
main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
