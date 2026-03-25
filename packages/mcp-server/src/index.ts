#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { callApi, eslCommand, runPlaywright } from './utils.js';

const server = new McpServer({ name: 'crm-voip', version: '1.0.0' });

async function login(email = 'admin@crm.local'): Promise<string> {
  const r = await callApi('/auth/login', 'POST', { email, password: 'changeme123' }) as { data?: { accessToken?: string } };
  return r?.data?.accessToken || '';
}

server.tool('click_to_call', 'Trigger C2C call via FusionPBX ESL',
  { phone: z.string(), agent_email: z.string().default('agent.ts@crm.local') },
  async ({ phone, agent_email }) => {
    const token = await login(agent_email);
    if (!token) return { content: [{ type: 'text' as const, text: 'Login failed' }] };
    const r = await callApi('/calls/originate', 'POST', { phone }, token) as { success?: boolean; error?: { message?: string } };
    return { content: [{ type: 'text' as const, text: r.success ? `Call to ${phone} initiated` : `Failed: ${r.error?.message}` }] };
  },
);

server.tool('get_call_logs', 'Fetch call history',
  { limit: z.number().default(20), direction: z.enum(['inbound', 'outbound', 'all']).default('all') },
  async ({ limit, direction }) => {
    const token = await login();
    const params = `?limit=${limit}${direction !== 'all' ? `&direction=${direction}` : ''}`;
    const r = await callApi(`/call-logs${params}`, 'GET', undefined, token) as { data?: Array<Record<string, string>>; meta?: { total?: number } };
    const calls = r.data || [];
    const lines = calls.map(c => `${c.direction} | ${c.callerNumber} → ${c.destinationNumber} | ${c.duration}s | ${c.startTime}`);
    return { content: [{ type: 'text' as const, text: `Call Logs (${r.meta?.total || calls.length}):\n${lines.join('\n') || 'None'}` }] };
  },
);

server.tool('get_recordings', 'List call recordings', { limit: z.number().default(10) },
  async ({ limit }) => {
    const token = await login();
    const r = await callApi(`/call-logs?limit=${limit}`, 'GET', undefined, token) as { data?: Array<Record<string, string>> };
    const recs = (r.data || []).filter(c => c.recordingStatus === 'available');
    const lines = recs.map(c => `${c.callerNumber} → ${c.destinationNumber} | ${c.duration}s`);
    return { content: [{ type: 'text' as const, text: recs.length ? `Recordings:\n${lines.join('\n')}` : 'No recordings' }] };
  },
);

server.tool('get_agent_status', 'Check agent status', {},
  async () => {
    const token = await login();
    const r = await callApi('/dashboard/agents', 'GET', undefined, token) as { data?: Array<{ fullName: string; status: string }> };
    const lines = (r.data || []).map(a => `${a.fullName}: ${a.status}`);
    return { content: [{ type: 'text' as const, text: lines.length ? `Agents:\n${lines.join('\n')}` : 'No agents' }] };
  },
);

server.tool('get_reports', 'Fetch CRM reports',
  { type: z.enum(['calls', 'telesale', 'collection']).default('calls') },
  async ({ type }) => {
    const token = await login();
    const r = await callApi(`/reports/${type}`, 'GET', undefined, token);
    return { content: [{ type: 'text' as const, text: `Report (${type}):\n${JSON.stringify(r, null, 2).substring(0, 2000)}` }] };
  },
);

server.tool('check_permissions', 'Verify role-based access',
  { role: z.enum(['admin', 'manager', 'qa', 'leader', 'agent_telesale', 'agent_collection']) },
  async ({ role }) => {
    const emails: Record<string, string> = {
      admin: 'admin@crm.local', manager: 'manager@crm.local', qa: 'qa@crm.local',
      leader: 'leader@crm.local', agent_telesale: 'agent.ts@crm.local', agent_collection: 'agent.col@crm.local',
    };
    const token = await login(emails[role]);
    const eps = ['/contacts', '/leads', '/debt-cases', '/call-logs', '/tickets', '/campaigns', '/users', '/reports/calls'];
    const results = await Promise.all(eps.map(async ep => {
      const r = await callApi(ep, 'GET', undefined, token) as { success?: boolean };
      return `${ep}: ${r.success ? '✓' : '✗'}`;
    }));
    return { content: [{ type: 'text' as const, text: `${role} permissions:\n${results.join('\n')}` }] };
  },
);

server.tool('run_health_check', 'Check all systems health', {},
  async () => {
    const checks: string[] = [];
    try { const h = await callApi('/health', 'GET') as { status?: string }; checks.push(`CRM: ${h.status === 'ok' ? '✓' : '✗'}`); } catch { checks.push('CRM: ✗'); }
    try { const s = await eslCommand('status'); checks.push(`ESL: ✓ ${s.substring(0, 60)}`); } catch (e) { checks.push(`ESL: ✗ ${(e as Error).message}`); }
    try { const t = await login(); checks.push(`Auth: ${t ? '✓' : '✗'}`); } catch { checks.push('Auth: ✗'); }
    return { content: [{ type: 'text' as const, text: `Health:\n${checks.join('\n')}` }] };
  },
);

server.tool('stress_test', 'Run Playwright E2E tests',
  { filter: z.string().optional() },
  async ({ filter }) => {
    const cmd = filter ? `npx playwright test e2e/${filter}.test.ts --reporter=list` : 'npx playwright test --reporter=list';
    const result = await runPlaywright(cmd);
    return { content: [{ type: 'text' as const, text: result || 'Tests completed' }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch(console.error);
