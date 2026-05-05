const { Client } = require('ssh2');
const SSH_CONFIG = { host: '10.10.101.208', port: 22, username: 'root', password: '123456', readyTimeout: 20000 };

function runRemote(conn, cmd, timeoutMs = 600000) {
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

  await step(conn, 'BEFORE df', `df -h /`);
  await step(conn, 'BEFORE docker df', `docker system df`);
  await step(conn, 'BEFORE containers', `docker ps --format '{{.Names}}|{{.Status}}'`);

  await step(conn, 'Scoped builder prune (>168h)', `docker builder prune --filter 'until=168h' -f`, 600000);

  // Verify no container was killed
  await step(conn, 'AFTER containers (verify healthy)', `docker ps --format '{{.Names}}|{{.Status}}'`);
  await step(conn, 'AFTER dead/exited check', `docker ps -a -f status=dead -f status=exited --format '{{.Names}}|{{.Status}}' ; echo '(empty=none)'`);
  await step(conn, 'AFTER docker df', `docker system df`);
  await step(conn, 'AFTER df', `df -h /`);

  // API health check since prod
  await step(conn, 'API health', `curl -sk https://localhost/api/v1/health`);

  conn.end();
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
