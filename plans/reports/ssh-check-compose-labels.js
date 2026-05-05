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

  for (const name of ['crm-frontend', 'crm-postgres', 'crm-redis', 'crm-backend']) {
    await step(conn, `labels ${name}`, `docker inspect ${name} --format '{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}|{{index .Config.Labels "com.docker.compose.project.config_files"}}|{{.State.Status}}|{{.State.Error}}' 2>/dev/null`);
  }

  await step(conn, 'backend exit details', `docker inspect crm-backend --format '{{.State.StartedAt}}|{{.State.FinishedAt}}|{{.State.ExitCode}}|{{.State.Error}}' 2>/dev/null`);
  await step(conn, 'backend logs tail', `docker logs --tail 30 crm-backend 2>&1 | tail -40`);
  await step(conn, 'opt/03-Test env', `ls -la /opt/03-Test/.env 2>/dev/null ; head -5 /opt/03-Test/.env 2>/dev/null`);
  await step(conn, 'opt/crm env', `ls -la /opt/crm/.env 2>/dev/null`);
  await step(conn, 'docker networks', `docker network ls`);

  conn.end();
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
