const { Client } = require('ssh2');
const SSH_CONFIG = { host: '10.10.101.207', port: 22, username: 'root', password: '123456', readyTimeout: 20000 };

function runRemote(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = '', stderr = '';
      stream.on('close', (code) => resolve({ code, stdout, stderr }))
        .on('data', (d) => (stdout += d.toString()))
        .stderr.on('data', (d) => (stderr += d.toString()));
    });
  });
}

async function main() {
  const conn = new Client();
  await new Promise((res, rej) => conn.on('ready', res).on('error', rej).connect(SSH_CONFIG));

  const commands = [
    ['== df -h / ==', `df -h /`],
    ['== df -h /var/lib ==', `df -h /var/lib 2>/dev/null || df -h /var`],
    ['== overlayfs total size ==', `du -sh /var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/ 2>/dev/null`],
    ['== overlayfs subdir sizes ==', `du -sh /var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/*/ 2>/dev/null | sort -h | tail -20`],
    ['== snapshots dir count ==', `ls /var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots 2>/dev/null | wc -l`],
    ['== biggest snapshots ==', `du -sh /var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/snapshots/*/ 2>/dev/null | sort -h | tail -15`],
    ['== docker ps ==', `docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Size}}' 2>/dev/null`],
    ['== docker system df ==', `docker system df 2>/dev/null`],
    ['== docker system df -v (verbose) ==', `docker system df -v 2>/dev/null | head -80`],
    ['== docker images all ==', `docker images -a --format 'table {{.Repository}}:{{.Tag}}\t{{.ID}}\t{{.CreatedSince}}\t{{.Size}}' 2>/dev/null`],
    ['== dangling images ==', `docker images -f dangling=true 2>/dev/null`],
    ['== stopped containers ==', `docker ps -a -f status=exited -f status=created --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}' 2>/dev/null`],
    ['== unused volumes ==', `docker volume ls -f dangling=true 2>/dev/null`],
    ['== /var/lib/docker size ==', `du -sh /var/lib/docker/ 2>/dev/null`],
    ['== top 10 dirs in /var/lib ==', `du -sh /var/lib/*/ 2>/dev/null | sort -h | tail -10`],
  ];

  for (const [label, cmd] of commands) {
    console.log(`\n${label}`);
    const r = await runRemote(conn, cmd);
    if (r.stdout) console.log(r.stdout.trimEnd());
    if (r.stderr && !r.stderr.match(/^\s*$/)) console.log('[stderr]', r.stderr.trimEnd());
  }
  conn.end();
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
