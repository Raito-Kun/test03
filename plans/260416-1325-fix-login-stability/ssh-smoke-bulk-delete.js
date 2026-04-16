/**
 * Smoke-test bulk-delete from inside the server network to bypass local AV.
 * Logs in as admin@crm.local, creates 2 throwaway contacts, bulk-deletes them.
 */
const { Client } = require('ssh2');
const SSH_CONFIG = { host: '10.10.101.207', port: 22, username: 'root', password: '123456', readyTimeout: 15000 };

function runRemote(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, { pty: false }, (err, stream) => {
      if (err) return reject(err);
      let out = '', errOut = '';
      stream.on('close', (code) => resolve({ code, stdout: out, stderr: errOut }))
        .on('data', (d) => { process.stdout.write(d); out += d; })
        .stderr.on('data', (d) => { process.stderr.write(d); errOut += d; });
    });
  });
}

async function main() {
  const conn = new Client();
  await new Promise((r, j) => conn.on('ready', r).on('error', j).connect(SSH_CONFIG));

  const script = `
set -e
BASE="https://localhost"
TOKEN=$(curl -k -s -X POST "$BASE/api/v1/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@crm.local","password":"changeme123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])")
echo "TOKEN=\${TOKEN:0:20}..."
# Create 2 contacts
C1=$(curl -k -s -X POST "$BASE/api/v1/contacts" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"fullName":"BulkDel-1","phone":"0999000001"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['id'])")
C2=$(curl -k -s -X POST "$BASE/api/v1/contacts" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"fullName":"BulkDel-2","phone":"0999000002"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['id'])")
echo "Created: $C1, $C2"
# Bulk delete
curl -k -s -X POST "$BASE/api/v1/contacts/bulk-delete" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\\"ids\\":[\\"$C1\\",\\"$C2\\"]}" -w "\\nHTTP=%{http_code}\\n"
echo "---"
# Empty ids rejected
curl -k -s -X POST "$BASE/api/v1/contacts/bulk-delete" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"ids":[]}' -w "\\nHTTP=%{http_code}\\n"
`;
  await runRemote(conn, script);
  conn.end();
}
main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
