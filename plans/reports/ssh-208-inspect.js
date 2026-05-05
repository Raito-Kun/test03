const { Client } = require('ssh2');
const SSH_CONFIG = { host: '10.10.101.208', port: 22, username: 'root', password: '123456', readyTimeout: 20000 };

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

async function step(conn, label, cmd, timeout) {
  console.log(`\n==== ${label} ====`);
  const r = await runRemote(conn, cmd, timeout);
  console.log(`[exit=${r.code}]`);
  return r;
}

async function main() {
  const conn = new Client();
  await new Promise((res, rej) => conn.on('ready', res).on('error', rej).connect(SSH_CONFIG));

  await step(conn, 'df-root', `df -h /`);
  await step(conn, 'docker-info', `docker info 2>/dev/null | grep -E 'Server Version|Storage Driver|Docker Root Dir|Containers:|Images:' | head -10`);
  await step(conn, 'docker-df', `docker system df`);
  await step(conn, 'docker-df-v', `docker system df -v 2>/dev/null`, 60000);
  await step(conn, 'running', `docker ps --format '{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}'`);
  await step(conn, 'all-containers', `docker ps -a --format '{{.Names}}|{{.Image}}|{{.Status}}'`);
  await step(conn, 'all-images', `docker images --format '{{.Repository}}:{{.Tag}}|{{.ID}}|{{.CreatedSince}}|{{.Size}}'`);
  await step(conn, 'compose-files', `find /opt /root /home /srv -maxdepth 4 \\( -name 'docker-compose*.yml' -o -name 'compose.yml' \\) 2>/dev/null`);
  await step(conn, 'ports-listen', `ss -tlnp 2>/dev/null | grep -v '127.0.0.1\\|::1' | head -20`);
  await step(conn, 'compose-projects', `docker ps -a --format '{{.Names}}|{{.Label "com.docker.compose.project"}}|{{.Label "com.docker.compose.project.config_files"}}'`);
  await step(conn, 'dangling-images', `docker images -f dangling=true --format '{{.ID}}|{{.Size}}' | head -20`);
  await step(conn, 'stopped-containers', `docker ps -a -f status=exited -f status=dead -f status=created --format '{{.Names}}|{{.Image}}|{{.Status}}'`);
  await step(conn, 'networks', `docker network ls`);
  await step(conn, 'volumes', `docker volume ls`);

  conn.end();
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
