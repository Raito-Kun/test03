const { Client } = require('ssh2');
const SSH_CONFIG = { host: '10.10.101.207', port: 22, username: 'root', password: '123456', readyTimeout: 20000 };

function runRemote(conn, cmd, timeoutMs = 120000) {
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

  // Nuclear option: compose rm + remove network + up fresh
  await step(conn, '1. compose rm cloudflared -fs', `cd /opt/03-Test && docker compose rm -fs cloudflared 2>&1 || true`);
  await step(conn, '2. rm 03-test network', `docker network rm 03-test_app-network 2>&1 || true`);
  await step(conn, '3. up cloudflared', `cd /opt/03-Test && docker compose up -d cloudflared`, 120000);
  await step(conn, '4. ps cloudflared', `docker ps -a --filter name=cloudflared --format '{{.Names}}|{{.Status}}'`);
  await step(conn, '5. logs', `docker logs --tail 8 cloudflared 2>&1 | tail -15`);

  conn.end();
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
