const { Client } = require('ssh2');
const SSH_CONFIG = { host: '10.10.101.207', port: 22, username: 'root', password: '123456', readyTimeout: 20000 };

function runRemote(conn, cmd, timeoutMs = 180000) {
  return new Promise((resolve) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return resolve({ code: -1, stdout: '', stderr: err.message });
      let stdout = '', stderr = '', done = false;
      const to = setTimeout(() => { if (!done) { done = true; try { stream.signal('KILL'); } catch {} resolve({ code: -1, stdout, stderr: stderr + '[TIMEOUT]' }); } }, timeoutMs);
      stream.on('close', (code) => { if (!done) { done = true; clearTimeout(to); resolve({ code, stdout, stderr }); } })
        .on('data', (d) => { const s = d.toString(); stdout += s; process.stdout.write(s); })
        .stderr.on('data', (d) => { const s = d.toString(); stderr += s; process.stderr.write(s); });
    });
  });
}

async function step(conn, label, cmd, timeout) {
  console.log(`\n==== ${label} ====`);
  console.log(`$ ${cmd}`);
  const r = await runRemote(conn, cmd, timeout);
  console.log(`[exit=${r.code}]`);
  return r;
}

async function main() {
  const conn = new Client();
  await new Promise((res, rej) => conn.on('ready', res).on('error', rej).connect(SSH_CONFIG));

  // Inspect both compose files
  await step(conn, 'crm compose', `cat /opt/crm/docker-compose.yml`);
  await step(conn, 'crm compose prod override (if exists)', `cat /opt/crm/docker-compose.prod.yml 2>/dev/null || echo '(no prod override)'`);
  await step(conn, '03-Test compose', `cat /opt/03-Test/docker-compose.yml`);

  // Check all container state incl stopped
  await step(conn, 'all containers', `docker ps -a --format '{{.Names}}|{{.Image}}|{{.Status}}'`);

  // Check images still exist
  await step(conn, 'all images', `docker images --format '{{.Repository}}:{{.Tag}}|{{.ID}}|{{.Size}}'`);

  conn.end();
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
