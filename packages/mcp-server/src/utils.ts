import { exec } from 'child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const CRM_URL = process.env.CRM_API_URL || 'https://10.10.101.207/api/v1';
const ESL_HOST = process.env.ESL_HOST || '10.10.101.189';
const ESL_PORT = parseInt(process.env.ESL_PORT || '8021');
const ESL_PASSWORD = process.env.ESL_PASSWORD || 'ClueCon';

/** Call CRM API */
export async function callApi(path: string, method = 'GET', body?: unknown, token?: string): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  // Skip TLS verification for self-signed cert
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const res = await fetch(`${CRM_URL}${path}`, opts);
  return await res.json() as Record<string, unknown>;
}

/** Execute ESL command via modesl */
export async function eslCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Dynamic require for modesl (CommonJS)
      const esl = require('modesl');
      const conn = new esl.Connection(ESL_HOST, ESL_PORT, ESL_PASSWORD, () => {
        conn.bgapi(command, (evt: { getBody: () => string }) => {
          const body = evt.getBody();
          conn.disconnect();
          resolve(body);
        });
      });
      conn.on('error', (err: Error) => {
        reject(new Error(`ESL error: ${err.message}`));
      });
      setTimeout(() => reject(new Error('ESL timeout')), 10000);
    } catch (err) {
      reject(err);
    }
  });
}

/** Run Playwright tests */
export async function runPlaywright(cmd: string): Promise<string> {
  const projectRoot = process.env.CRM_PROJECT_ROOT || 'C:/Users/Raito/OneDrive/TRAINNING/VIBE CODING/02.CRM';
  return new Promise((resolve) => {
    exec(
      `cd "${projectRoot}" && E2E_BASE_URL=https://10.10.101.207 ${cmd}`,
      { timeout: 300000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        const output = stdout + (stderr ? `\n${stderr}` : '');
        // Extract summary
        const lines = output.split('\n');
        const summary = lines.filter(l => /passed|failed|✓|✘/.test(l)).join('\n');
        resolve(summary || output.substring(output.length - 500));
      },
    );
  });
}
