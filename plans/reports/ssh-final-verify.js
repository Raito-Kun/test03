const { Client } = require('ssh2');
const SSH_CONFIG = { host: '10.10.101.207', port: 22, username: 'root', password: '123456', readyTimeout: 20000 };

function runRemote(conn, cmd, timeoutMs = 60000) {
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

async function step(conn, label, cmd) {
  console.log(`\n==== ${label} ====`);
  const r = await runRemote(conn, cmd);
  console.log(`[exit=${r.code}]`);
  return r;
}

async function main() {
  const conn = new Client();
  await new Promise((res, rej) => conn.on('ready', res).on('error', rej).connect(SSH_CONFIG));

  await step(conn, 'running', `docker ps --format '{{.Names}}|{{.Status}}'`);
  await step(conn, 'API health', `curl -sk https://localhost/api/v1/health`);
  await step(conn, 'API login smoke', `curl -sk -X POST https://localhost/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"superadmin@crm.local","password":"SuperAdmin@123"}' | head -c 200`);
  await step(conn, 'backend recent errors', `docker logs --since 3m crm-backend 2>&1 | grep -iE 'error|fatal|exception' | head -10`);
  await step(conn, 'disk', `df -h /`);
  await step(conn, 'docker df', `docker system df`);

  conn.end();
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
