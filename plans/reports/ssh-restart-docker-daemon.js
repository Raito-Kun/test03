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

  await step(conn, '1. Restart docker daemon', `systemctl restart docker`, 120000);
  await step(conn, '2. Wait + check docker up', `sleep 10 && systemctl is-active docker && docker version --format '{{.Server.Version}}'`);

  // Clean lingering containers after restart
  await step(conn, '3. ps -a (expect auto-restart by unless-stopped)', `docker ps -a --format '{{.Names}}|{{.Status}}'`);
  await step(conn, '4. Remove any still-dead containers', `docker rm -f crm-backend blackjack-web cloudflared 9e06b0cc0bd3_crm-backend 2>&1 || true`);

  // Start backend (postgres/redis/frontend auto-restart via unless-stopped)
  await step(conn, '5. CRM up -d (all services)', `cd /opt/crm && docker compose -f docker-compose.prod.yml up -d`, 300000);

  // Start cloudflared only
  await step(conn, '6. cloudflared up', `cd /opt/03-Test && docker compose up -d cloudflared`, 120000);

  // Verify
  await step(conn, '7. Wait 25s for healthchecks', `sleep 25 && docker ps --format '{{.Names}}|{{.Status}}'`);
  await step(conn, '8. Backend logs', `docker logs --tail 20 crm-backend 2>&1 | tail -30`);
  await step(conn, '9. API health', `curl -sk -o /dev/null -w '%{http_code}\\n' https://localhost/api/v1/health ; echo ---; curl -sk https://localhost/api/v1/health`);
  await step(conn, '10. df -h', `df -h /`);

  conn.end();
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
