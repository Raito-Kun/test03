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

  // A. Remove dead containers
  await step(conn, 'A. rm dead containers', `docker rm -f crm-backend 9e06b0cc0bd3_crm-backend blackjack-web cloudflared 2>&1 || true`);

  // B. Start CRM backend via prod compose (do not recreate running deps)
  await step(conn, 'B. CRM backend up', `cd /opt/crm && docker compose -f docker-compose.prod.yml up -d --no-deps backend`, 300000);

  // C. Start cloudflared only (not blackjack-web)
  await step(conn, 'C. cloudflared up', `cd /opt/03-Test && docker compose up -d cloudflared`, 180000);

  // D. Wait for backend healthy
  await step(conn, 'D1. backend status 20s', `sleep 20 && docker ps --filter name=crm-backend --format '{{.Names}}|{{.Status}}'`);
  await step(conn, 'D2. backend logs tail', `docker logs --tail 30 crm-backend 2>&1 | tail -40`);
  await step(conn, 'D3. all running', `docker ps --format '{{.Names}}|{{.Image}}|{{.Status}}'`);
  await step(conn, 'D4. API health', `curl -sk -o /dev/null -w '%{http_code}\\n' https://localhost/api/v1/health ; echo ---; curl -sk https://localhost/api/v1/health | head -c 200`);

  conn.end();
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
