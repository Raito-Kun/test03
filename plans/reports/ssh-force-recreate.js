const { Client } = require('ssh2');
const SSH_CONFIG = { host: '10.10.101.207', port: 22, username: 'root', password: '123456', readyTimeout: 20000 };

function runRemote(conn, cmd, timeoutMs = 300000) {
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

  await step(conn, '1. images', `docker images --format '{{.Repository}}:{{.Tag}}|{{.ID}}|{{.Size}}'`);
  await step(conn, '2. compose ps (crm)', `cd /opt/crm && docker compose -f docker-compose.prod.yml ps -a`);
  await step(conn, '3. frontend logs', `docker logs --tail 20 crm-frontend 2>&1 | tail -30`);

  // Force recreate backend + frontend (leave postgres/redis untouched)
  await step(conn, '4. force recreate backend+frontend', `cd /opt/crm && docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate backend frontend`, 300000);

  // Cloudflared fresh
  await step(conn, '5. cloudflared force recreate', `cd /opt/03-Test && docker compose up -d --force-recreate cloudflared`, 120000);

  // Verify
  await step(conn, '6. wait 30s + ps', `sleep 30 && docker ps --format '{{.Names}}|{{.Status}}'`);
  await step(conn, '7. backend logs', `docker logs --tail 25 crm-backend 2>&1 | tail -40`);
  await step(conn, '8. frontend logs', `docker logs --tail 15 crm-frontend 2>&1 | tail -20`);
  await step(conn, '9. API health', `curl -sk -o /dev/null -w '%{http_code}\\n' https://localhost/api/v1/health`);

  conn.end();
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
