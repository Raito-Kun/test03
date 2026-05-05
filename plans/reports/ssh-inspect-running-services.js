const { Client } = require('ssh2');
const SSH_CONFIG = { host: '10.10.101.207', port: 22, username: 'root', password: '123456', readyTimeout: 20000 };

function runRemote(conn, cmd, timeoutMs = 30000) {
  return new Promise((resolve) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return resolve({ code: -1, stdout: '', stderr: err.message });
      let stdout = '', stderr = '', done = false;
      const to = setTimeout(() => { if (!done) { done = true; try { stream.signal('KILL'); } catch {} resolve({ code: -1, stdout, stderr: stderr + `[TIMEOUT]` }); } }, timeoutMs);
      stream.on('close', (code) => { if (!done) { done = true; clearTimeout(to); resolve({ code, stdout, stderr }); } })
        .on('data', (d) => (stdout += d.toString()))
        .stderr.on('data', (d) => (stderr += d.toString()));
    });
  });
}

async function main() {
  const conn = new Client();
  await new Promise((res, rej) => conn.on('ready', res).on('error', rej).connect(SSH_CONFIG));

  const cmds = [
    ['ports-listen', `ss -tlnp 2>/dev/null | grep -v '127.0.0.1\\|::1' | head -30`],
    ['compose-files', `find /root /home /opt /srv -maxdepth 4 -name 'docker-compose*.yml' -o -name 'compose.yml' 2>/dev/null | head -20`],
    ['blackjack-inspect', `docker inspect blackjack-web --format '{{json .HostConfig.Binds}} | {{json .Config.Labels}} | network={{json .NetworkSettings.Networks}} | cmd={{json .Config.Cmd}} | ports={{json .NetworkSettings.Ports}}' 2>/dev/null`],
    ['blackjack-logs-tail', `docker logs --tail 5 blackjack-web 2>&1 | head -10`],
    ['cloudflared-inspect', `docker inspect cloudflared --format '{{json .Config.Cmd}} | {{json .Config.Env}} | {{json .HostConfig.Binds}}' 2>/dev/null`],
    ['cloudflared-logs-tail', `docker logs --tail 15 cloudflared 2>&1 | tail -20`],
    ['frontend-inspect', `docker inspect crm-frontend --format 'ports={{json .NetworkSettings.Ports}} | binds={{json .HostConfig.Binds}}' 2>/dev/null`],
    ['nginx-blackjack-conf', `docker exec blackjack-web sh -c 'cat /etc/nginx/conf.d/*.conf 2>/dev/null | head -60' 2>/dev/null`],
    ['blackjack-webroot-ls', `docker exec blackjack-web sh -c 'ls /usr/share/nginx/html 2>/dev/null | head -20' 2>/dev/null`],
    ['blackjack-image-history', `docker history nginx:alpine --no-trunc --format '{{.CreatedBy}}' 2>/dev/null | head -3`],
  ];

  for (const [label, cmd] of cmds) {
    const r = await runRemote(conn, cmd);
    console.log(`\n### ${label} (exit=${r.code})`);
    if (r.stdout.trim()) console.log(r.stdout.trimEnd());
    if (r.stderr.trim()) console.log('[stderr]', r.stderr.trimEnd());
  }
  conn.end();
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
