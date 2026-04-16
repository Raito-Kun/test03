/**
 * One-shot cleanup:
 *   1) backfill 14 null-cluster contacts → blueva cluster
 *   2) delete 5 E2E fixtures from the inactive crm cluster
 *   3) re-report cluster distribution
 */
const { Client } = require('ssh2');
const SSH_CONFIG = { host: '10.10.101.207', port: 22, username: 'root', password: '123456', readyTimeout: 15000 };
const BLUEVA = '13bec0b3-a748-4bff-9e4e-046e20c65319';
const CRM_INACTIVE = '20000000-0000-0000-0000-000000000001';

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

// Write SQL to a temp file inside the postgres container, then psql -f it.
// Avoids shell-quoting hell for single quotes in UUIDs.
function writeAndRun(conn, name, sql) {
  const b64 = Buffer.from(sql, 'utf8').toString('base64');
  // Use single-quote outer so $POSTGRES_USER expands INSIDE the container, not outside.
  const cmd =
    `docker exec crm-postgres bash -c '` +
    `echo ${b64} | base64 -d > /tmp/${name}.sql && ` +
    `psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /tmp/${name}.sql'`;
  return runRemote(conn, cmd);
}

async function main() {
  const conn = new Client();
  await new Promise((r, j) => conn.on('ready', r).on('error', j).connect(SSH_CONFIG));

  console.log('\n=== BEFORE ===');
  await writeAndRun(conn, 'before',
    `SELECT cluster_id, COUNT(*) FROM contacts GROUP BY cluster_id ORDER BY count DESC;`,
  );

  console.log('\n=== 1) backfill null → blueva ===');
  await writeAndRun(conn, 'backfill',
    `UPDATE contacts SET cluster_id = '${BLUEVA}' WHERE cluster_id IS NULL;`,
  );

  console.log('\n=== 2) delete E2E fixtures from inactive crm cluster ===');
  await writeAndRun(conn, 'delete_e2e',
    `DELETE FROM contacts WHERE cluster_id = '${CRM_INACTIVE}' AND source = 'wizard-e2e';`,
  );

  console.log('\n=== AFTER ===');
  await writeAndRun(conn, 'after',
    `SELECT cluster_id, COUNT(*) FROM contacts GROUP BY cluster_id ORDER BY count DESC;`,
  );

  console.log('\n=== blueva sample ===');
  await writeAndRun(conn, 'sample',
    `SELECT phone, full_name, assigned_to, created_at FROM contacts WHERE cluster_id = '${BLUEVA}' ORDER BY created_at DESC LIMIT 5;`,
  );

  conn.end();
}
main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
