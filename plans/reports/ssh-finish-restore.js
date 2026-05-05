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

  // Clean any orphan crm-frontend containers, then recreate
  await step(conn, '1. rm crm-frontend if any', `docker rm -f crm-frontend 2>&1 || true`);
  await step(conn, '2. start frontend', `cd /opt/crm && docker compose -f docker-compose.prod.yml up -d --no-deps frontend`, 120000);

  // For 03-test: down with remove-orphans, then up just cloudflared
  await step(conn, '3. 03-test compose down --remove-orphans', `cd /opt/03-Test && docker compose down --remove-orphans 2>&1 || true`, 60000);
  await step(conn, '4. rm any stale cloudflared', `docker rm -f cloudflared 2>&1 || true`);
  await step(conn, '5. up cloudflared only', `cd /opt/03-Test && docker compose up -d cloudflared`, 120000);

  // Verify
  await step(conn, '6. wait 20s + ps', `sleep 20 && docker ps --format '{{.Names}}|{{.Status}}'`);
  await step(conn, '7. API health', `curl -sk -o /dev/null -w '%{http_code}\\n' https://localhost/api/v1/health ; echo ---; curl -sk https://localhost/api/v1/health | head -c 300`);
  await step(conn, '8. frontend logs if unhealthy', `docker logs --tail 10 crm-frontend 2>&1 | tail -15`);
  await step(conn, '9. cloudflared logs', `docker logs --tail 5 cloudflared 2>&1 | tail -10`);
  await step(conn, '10. df -h', `df -h /`);

  conn.end();
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
