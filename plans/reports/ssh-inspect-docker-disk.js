const { Client } = require('ssh2');
const SSH_CONFIG = { host: '10.10.101.207', port: 22, username: 'root', password: '123456', readyTimeout: 20000 };

function runRemote(conn, cmd, timeoutMs = 30000) {
  return new Promise((resolve) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return resolve({ code: -1, stdout: '', stderr: err.message });
      let stdout = '', stderr = '', done = false;
      const to = setTimeout(() => {
        if (!done) { done = true; try { stream.signal('KILL'); } catch {} resolve({ code: -1, stdout, stderr: stderr + `\n[TIMEOUT ${timeoutMs}ms]` }); }
      }, timeoutMs);
      stream.on('close', (code) => { if (!done) { done = true; clearTimeout(to); resolve({ code, stdout, stderr }); } })
        .on('data', (d) => (stdout += d.toString()))
        .stderr.on('data', (d) => (stderr += d.toString()));
    });
  });
}

async function main() {
  const conn = new Client();
  await new Promise((res, rej) => conn.on('ready', res).on('error', rej).connect(SSH_CONFIG));

  // Fast docker-native queries first — avoid du on overlayfs root.
  const cmds = [
    ['df-root', `df -h / 2>/dev/null`],
    ['docker-df', `docker system df 2>/dev/null`, 30000],
    ['docker-df-v', `docker system df -v 2>/dev/null`, 60000],
    ['docker-ps', `docker ps --format '{{.Names}}|{{.Image}}|{{.Status}}' 2>/dev/null`],
    ['stopped-containers', `docker ps -a -f status=exited -f status=dead -f status=created --format '{{.Names}}|{{.Image}}|{{.Status}}' 2>/dev/null`],
    ['dangling-images', `docker images -f dangling=true --format '{{.Repository}}:{{.Tag}}|{{.ID}}|{{.Size}}' 2>/dev/null`],
    ['all-images', `docker images -a --format '{{.Repository}}:{{.Tag}}|{{.ID}}|{{.CreatedSince}}|{{.Size}}' 2>/dev/null | sort -t'|' -k4 -h`],
    ['dangling-volumes', `docker volume ls -f dangling=true --format '{{.Name}}|{{.Driver}}' 2>/dev/null`],
    ['builder-cache', `docker builder df 2>/dev/null`],
    ['docker-info-snapshotter', `docker info 2>/dev/null | grep -E 'Storage Driver|Docker Root Dir|Server Version' | head -5`],
    // Filesystem-level: only immediate children, no recursion through overlayfs contents.
    ['dockerRoot-topdirs', `du -sh --max-depth=1 /var/lib/docker/ 2>/dev/null | sort -h`, 120000],
    ['containerd-topdirs', `du -sh --max-depth=1 /var/lib/containerd/ 2>/dev/null | sort -h`, 60000],
    ['overlay-snapshot-count', `ls /var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots 2>/dev/null | wc -l`],
    ['overlay-metadata-sizes', `du -sh --max-depth=1 /var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/ 2>/dev/null`, 120000],
  ];

  for (const [label, cmd, timeout] of cmds) {
    const r = await runRemote(conn, cmd, timeout || 30000);
    console.log(`\n### ${label} (exit=${r.code})`);
    if (r.stdout.trim()) console.log(r.stdout.trimEnd());
    if (r.stderr.trim()) console.log('[stderr]', r.stderr.trimEnd());
  }
  conn.end();
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
