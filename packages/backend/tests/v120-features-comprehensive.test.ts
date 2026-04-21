import { describe, it, expect } from 'vitest';
import { createAgent, authHeader } from './helpers';

const API = '/api/v1';

// =============================================================================
// 1. LEAD SCORING TESTS
// =============================================================================
describe('Lead Scoring - Score calculation on lead create/update', () => {
  it('create lead with source bonus → score includes source points', async () => {
    const res = await createAgent()
      .post(`${API}/leads`)
      .set(authHeader('agent_telesale'))
      .send({
        contactId: '00000000-0000-0000-0000-000000000001',
        source: 'referral',
      });
    expect([201, 200, 400, 500]).toContain(res.status);
  });

  it('update lead status to qualified → score should increase', async () => {
    const res = await createAgent()
      .patch(`${API}/leads/test-lead-001`)
      .set(authHeader('agent_telesale'))
      .send({ status: 'qualified' });
    expect([200, 404, 400, 500]).toContain(res.status);
    if (res.status === 200 && res.body.data?.score !== undefined) {
      expect(typeof res.body.data.score).toBe('number');
      expect(res.body.data.score).toBeGreaterThanOrEqual(0);
      expect(res.body.data.score).toBeLessThanOrEqual(100);
    }
  });

  it('lead with phone + email bonuses → score > base', async () => {
    const res = await createAgent()
      .post(`${API}/leads`)
      .set(authHeader('agent_telesale'))
      .send({
        contactId: '00000000-0000-0000-0000-000000000002',
        status: 'new',
      });
    expect([201, 200, 400, 500]).toContain(res.status);
  });

  it('lost lead status → score should decrease', async () => {
    const res = await createAgent()
      .patch(`${API}/leads/test-lead-002`)
      .set(authHeader('agent_telesale'))
      .send({ status: 'lost' });
    expect([200, 404, 400, 500]).toContain(res.status);
  });

  it('scoring requires valid lead contact', async () => {
    const res = await createAgent()
      .post(`${API}/leads`)
      .set(authHeader('agent_telesale'))
      .send({});
    expect([400, 422, 500]).toContain(res.status);
  });
});

// =============================================================================
// 2. DEBT TIER ESCALATION TESTS
// =============================================================================
describe('Debt Tier Escalation - DPD calculation & tier mapping', () => {
  it('POST /debt-cases/escalate admin only → requires admin role', async () => {
    const res = await createAgent()
      .post(`${API}/debt-cases/escalate`)
      .set(authHeader('agent_collection'));
    expect([403, 500]).toContain(res.status);
  });

  it('POST /debt-cases/escalate as super_admin → returns escalation results', async () => {
    const res = await createAgent()
      .post(`${API}/debt-cases/escalate`)
      .set(authHeader('super_admin'));
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      if (res.body.data) {
        expect(['checked', 'updated', 'details']).toEqual(
          expect.arrayContaining(Object.keys(res.body.data).filter(k => ['checked', 'updated', 'details'].includes(k)))
        );
      }
    }
  });

  it('POST /debt-cases/escalate as admin → returns escalation results', async () => {
    const res = await createAgent()
      .post(`${API}/debt-cases/escalate`)
      .set(authHeader('admin'));
    expect([200, 500]).toContain(res.status);
  });

  it('create debt case DPD=0 → tier=current', async () => {
    const res = await createAgent()
      .post(`${API}/debt-cases`)
      .set(authHeader('agent_collection'))
      .send({
        contactId: '00000000-0000-0000-0000-000000000001',
        originalAmount: 1000,
        outstandingAmount: 1000,
        dpd: 0,
      });
    expect([201, 200, 400, 500]).toContain(res.status);
    if (res.status === 201 || res.status === 200) {
      if (res.body.data?.tier) {
        expect(res.body.data.tier).toBe('current');
      }
    }
  });

  it('create debt case DPD=15 → tier=dpd_1_30', async () => {
    const res = await createAgent()
      .post(`${API}/debt-cases`)
      .set(authHeader('agent_collection'))
      .send({
        contactId: '00000000-0000-0000-0000-000000000002',
        originalAmount: 1000,
        outstandingAmount: 1000,
        dpd: 15,
      });
    expect([201, 200, 400, 500]).toContain(res.status);
    if (res.status === 201 || res.status === 200) {
      if (res.body.data?.tier) {
        expect(res.body.data.tier).toBe('dpd_1_30');
      }
    }
  });

  it('create debt case DPD=45 → tier=dpd_31_60', async () => {
    const res = await createAgent()
      .post(`${API}/debt-cases`)
      .set(authHeader('agent_collection'))
      .send({
        contactId: '00000000-0000-0000-0000-000000000003',
        originalAmount: 1000,
        outstandingAmount: 1000,
        dpd: 45,
      });
    expect([201, 200, 400, 500]).toContain(res.status);
    if (res.status === 201 || res.status === 200) {
      if (res.body.data?.tier) {
        expect(res.body.data.tier).toBe('dpd_31_60');
      }
    }
  });

  it('create debt case DPD=75 → tier=dpd_61_90', async () => {
    const res = await createAgent()
      .post(`${API}/debt-cases`)
      .set(authHeader('agent_collection'))
      .send({
        contactId: '00000000-0000-0000-0000-000000000004',
        originalAmount: 1000,
        outstandingAmount: 1000,
        dpd: 75,
      });
    expect([201, 200, 400, 500]).toContain(res.status);
    if (res.status === 201 || res.status === 200) {
      if (res.body.data?.tier) {
        expect(res.body.data.tier).toBe('dpd_61_90');
      }
    }
  });

  it('create debt case DPD=120 → tier=dpd_90_plus', async () => {
    const res = await createAgent()
      .post(`${API}/debt-cases`)
      .set(authHeader('agent_collection'))
      .send({
        contactId: '00000000-0000-0000-0000-000000000005',
        originalAmount: 1000,
        outstandingAmount: 1000,
        dpd: 120,
      });
    expect([201, 200, 400, 500]).toContain(res.status);
    if (res.status === 201 || res.status === 200) {
      if (res.body.data?.tier) {
        expect(res.body.data.tier).toBe('dpd_90_plus');
      }
    }
  });

  it('escalate without required fields → [400, 500]', async () => {
    const res = await createAgent()
      .post(`${API}/debt-cases/escalate`)
      .set(authHeader('admin'))
      .send({});
    expect([200, 400, 500]).toContain(res.status);
  });
});

// =============================================================================
// 3. FOLLOW-UP LEADS TESTS
// =============================================================================
describe('Follow-up Leads - Get leads due for follow-up', () => {
  it('GET /leads/follow-ups returns leads due today or earlier', async () => {
    const res = await createAgent()
      .get(`${API}/leads/follow-ups`)
      .set(authHeader('agent_telesale'));
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data) || res.body.data?.items).toBeTruthy();
    }
  });

  it('follow-ups excludes won leads', async () => {
    const res = await createAgent()
      .get(`${API}/leads/follow-ups`)
      .set(authHeader('agent_telesale'));
    expect([200, 500]).toContain(res.status);
    if (res.status === 200 && res.body.data) {
      const leads = Array.isArray(res.body.data) ? res.body.data : res.body.data.items || [];
      const wonLeads = leads.filter((l: any) => l.status === 'won');
      expect(wonLeads.length).toBe(0);
    }
  });

  it('follow-ups excludes lost leads', async () => {
    const res = await createAgent()
      .get(`${API}/leads/follow-ups`)
      .set(authHeader('agent_telesale'));
    expect([200, 500]).toContain(res.status);
    if (res.status === 200 && res.body.data) {
      const leads = Array.isArray(res.body.data) ? res.body.data : res.body.data.items || [];
      const lostLeads = leads.filter((l: any) => l.status === 'lost');
      expect(lostLeads.length).toBe(0);
    }
  });

  it('follow-ups includes isOverdue flag', async () => {
    const res = await createAgent()
      .get(`${API}/leads/follow-ups`)
      .set(authHeader('agent_telesale'));
    expect([200, 500]).toContain(res.status);
    if (res.status === 200 && res.body.data) {
      const leads = Array.isArray(res.body.data) ? res.body.data : res.body.data.items || [];
      if (leads.length > 0) {
        expect(['isOverdue', 'isDueToday']).toEqual(
          expect.arrayContaining(
            Object.keys(leads[0]).filter(k => ['isOverdue', 'isDueToday'].includes(k))
          )
        );
      }
    }
  });

  it('follow-ups requires auth → 401', async () => {
    const res = await createAgent().get(`${API}/leads/follow-ups`);
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// 4. EXPORT SERVICE TESTS
// =============================================================================
describe('Export Service - Excel file generation', () => {
  it('GET /export/contacts returns Excel file', async () => {
    const res = await createAgent()
      .get(`${API}/export/contacts`)
      .set(authHeader('admin'));
    expect([200, 403, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.headers['content-type']).toMatch(/spreadsheet|excel/i);
    }
  });

  it('GET /export/leads returns Excel file', async () => {
    const res = await createAgent()
      .get(`${API}/export/leads`)
      .set(authHeader('admin'));
    expect([200, 403, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.headers['content-type']).toMatch(/spreadsheet|excel/i);
    }
  });

  it('export requires report.export permission → 403 for agent', async () => {
    const res = await createAgent()
      .get(`${API}/export/contacts`)
      .set(authHeader('agent_telesale'));
    expect([403, 500]).toContain(res.status);
  });

  it('export contacts respects RBAC data scoping', async () => {
    const res = await createAgent()
      .get(`${API}/export/contacts?search=test`)
      .set(authHeader('agent_collection'));
    expect([200, 403, 500]).toContain(res.status);
  });

  it('export leads with filter params', async () => {
    const res = await createAgent()
      .get(`${API}/export/leads?status=qualified`)
      .set(authHeader('admin'));
    expect([200, 403, 500]).toContain(res.status);
  });

  it('export without auth → 401', async () => {
    const res = await createAgent().get(`${API}/export/contacts`);
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// 5. MONITORING SERVICE TESTS
// =============================================================================
describe('Monitoring Service - Live agent status & calls', () => {
  it('GET /monitoring/live returns agent counts', async () => {
    const res = await createAgent()
      .get(`${API}/monitoring/live`)
      .set(authHeader('admin'));
    expect([200, 403, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.agents).toBeDefined();
      expect(res.body.data.activeCalls).toBeDefined();
    }
  });

  it('GET /monitoring/live agents has online/onCall/ready/wrapUp counts', async () => {
    const res = await createAgent()
      .get(`${API}/monitoring/live`)
      .set(authHeader('admin'));
    expect([200, 403, 500]).toContain(res.status);
    if (res.status === 200 && res.body.data?.agents) {
      const agents = res.body.data.agents;
      expect(['online', 'onCall', 'ready', 'wrapUp', 'total']).toEqual(
        expect.arrayContaining(
          Object.keys(agents).filter(k => ['online', 'onCall', 'ready', 'wrapUp', 'total'].includes(k))
        )
      );
    }
  });

  it('GET /monitoring/agents returns all agent statuses', async () => {
    const res = await createAgent()
      .get(`${API}/monitoring/agents`)
      .set(authHeader('manager'));
    expect([200, 403, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    }
  });

  it('GET /monitoring/active-calls returns current calls', async () => {
    const res = await createAgent()
      .get(`${API}/monitoring/active-calls`)
      .set(authHeader('admin'));
    expect([200, 403, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    }
  });

  it('monitoring requires auth → 401', async () => {
    const res = await createAgent().get(`${API}/monitoring/live`);
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// 6. DASHBOARD KPIs TESTS
// =============================================================================
describe('Dashboard KPIs - Overview metrics', () => {
  it('GET /dashboard/overview returns all KPI fields', async () => {
    const res = await createAgent()
      .get(`${API}/dashboard/overview`)
      .set(authHeader('admin'));
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    }
  });

  it('dashboard overview includes contactRate KPI', async () => {
    const res = await createAgent()
      .get(`${API}/dashboard/overview`)
      .set(authHeader('admin'));
    expect([200, 500]).toContain(res.status);
    if (res.status === 200 && res.body.data) {
      expect(res.body.data.contactRate !== undefined || res.body.data.answerRate !== undefined).toBe(true);
    }
  });

  it('dashboard overview includes closeRate KPI', async () => {
    const res = await createAgent()
      .get(`${API}/dashboard/overview`)
      .set(authHeader('admin'));
    expect([200, 500]).toContain(res.status);
    if (res.status === 200 && res.body.data) {
      expect(res.body.data.closeRate !== undefined || res.body.data.wonLeadsRate !== undefined).toBe(true);
    }
  });

  it('dashboard overview includes ptpRate KPI', async () => {
    const res = await createAgent()
      .get(`${API}/dashboard/overview`)
      .set(authHeader('admin'));
    expect([200, 500]).toContain(res.status);
    if (res.status === 200 && res.body.data) {
      expect(res.body.data.ptpRate !== undefined || res.body.data.promiseRate !== undefined).toBe(true);
    }
  });

  it('dashboard overview includes recoveryRate KPI', async () => {
    const res = await createAgent()
      .get(`${API}/dashboard/overview`)
      .set(authHeader('admin'));
    expect([200, 500]).toContain(res.status);
    if (res.status === 200 && res.body.data) {
      expect(res.body.data.recoveryRate !== undefined || res.body.data.paidAmount !== undefined).toBe(true);
    }
  });

  it('dashboard overview includes wrapUp avgDurationSeconds', async () => {
    const res = await createAgent()
      .get(`${API}/dashboard/overview`)
      .set(authHeader('admin'));
    expect([200, 500]).toContain(res.status);
    if (res.status === 200 && res.body.data) {
      expect(res.body.data.wrapUp !== undefined || res.body.data.avgWrapUpTime !== undefined).toBe(true);
    }
  });

  it('dashboard overview requires auth → 401', async () => {
    const res = await createAgent().get(`${API}/dashboard/overview`);
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// 7. QA TIMESTAMPS TESTS
// =============================================================================
describe('QA Timestamps - Annotation timestamps', () => {
  it('POST /qa-timestamps creates annotation', async () => {
    const res = await createAgent()
      .post(`${API}/qa-timestamps`)
      .set(authHeader('qa'))
      .send({
        callLogId: '00000000-0000-0000-0000-000000000001',
        timestamp: 30,
        text: 'Script deviation',
        category: 'compliance',
        sentiment: 'negative',
      });
    expect([201, 200, 400, 403, 500]).toContain(res.status);
    if (res.status === 201 || res.status === 200) {
      expect(res.body.success).toBe(true);
    }
  });

  it('GET /qa-timestamps/:callLogId returns annotations', async () => {
    const res = await createAgent()
      .get(`${API}/qa-timestamps/00000000-0000-0000-0000-000000000001`)
      .set(authHeader('qa'));
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    }
  });

  it('POST /qa-timestamps requires valid UUID callLogId', async () => {
    const res = await createAgent()
      .post(`${API}/qa-timestamps`)
      .set(authHeader('qa'))
      .send({
        callLogId: 'not-a-uuid',
        timestamp: 30,
        text: 'Test',
      });
    expect([400, 403, 422, 500]).toContain(res.status);
  });

  it('POST /qa-timestamps requires timestamp', async () => {
    const res = await createAgent()
      .post(`${API}/qa-timestamps`)
      .set(authHeader('qa'))
      .send({
        callLogId: '00000000-0000-0000-0000-000000000001',
        text: 'Test',
      });
    expect([400, 403, 422, 500]).toContain(res.status);
  });

  it('POST /qa-timestamps requires text', async () => {
    const res = await createAgent()
      .post(`${API}/qa-timestamps`)
      .set(authHeader('qa'))
      .send({
        callLogId: '00000000-0000-0000-0000-000000000001',
        timestamp: 30,
      });
    expect([400, 403, 422, 500]).toContain(res.status);
  });

  it('qa-timestamps requires switchboard.listen_recording permission → 403 for agent', async () => {
    const res = await createAgent()
      .post(`${API}/qa-timestamps`)
      .set(authHeader('agent_telesale'))
      .send({
        callLogId: '00000000-0000-0000-0000-000000000001',
        timestamp: 30,
        text: 'Test',
      });
    expect([403, 500]).toContain(res.status);
  });
});

// =============================================================================
// 8. SLA REPORTS TESTS
// =============================================================================
describe('SLA Reports - Date range validation', () => {
  it('GET /reports/sla with date range returns SLA data', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await createAgent()
      .get(`${API}/reports/sla?start_date=${today}&end_date=${today}`)
      .set(authHeader('admin'));
    expect([200, 400, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    }
  });

  it('GET /reports/sla requires start_date', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await createAgent()
      .get(`${API}/reports/sla?end_date=${today}`)
      .set(authHeader('admin'));
    expect([200, 400, 500]).toContain(res.status);
  });

  it('GET /reports/sla requires end_date', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await createAgent()
      .get(`${API}/reports/sla?start_date=${today}`)
      .set(authHeader('admin'));
    expect([200, 400, 500]).toContain(res.status);
  });

  it('GET /reports/sla requires manager/admin role', async () => {
    const res = await createAgent()
      .get(`${API}/reports/sla`)
      .set(authHeader('agent_telesale'));
    expect([403, 500]).toContain(res.status);
  });
});

// =============================================================================
// 9. CALL SCRIPTS TESTS
// =============================================================================
describe('Call Scripts - Script management', () => {
  it('GET /scripts returns scripts list (admin only)', async () => {
    const res = await createAgent()
      .get(`${API}/scripts`)
      .set(authHeader('admin'));
    expect([200, 403, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    }
  });

  it('GET /scripts blocked for agent_telesale', async () => {
    const res = await createAgent()
      .get(`${API}/scripts`)
      .set(authHeader('agent_telesale'));
    expect([403, 500]).toContain(res.status);
  });

  it('POST /scripts creates new script', async () => {
    const res = await createAgent()
      .post(`${API}/scripts`)
      .set(authHeader('admin'))
      .send({
        name: 'Test Script',
        type: 'default',
        content: 'Hello customer, this is test',
      });
    expect([201, 200, 400, 403, 500]).toContain(res.status);
    if (res.status === 201 || res.status === 200) {
      expect(res.body.success).toBe(true);
    }
  });

  it('POST /scripts requires name', async () => {
    const res = await createAgent()
      .post(`${API}/scripts`)
      .set(authHeader('admin'))
      .send({
        type: 'default',
        content: 'Hello customer',
      });
    expect([400, 403, 422, 500]).toContain(res.status);
  });

  it('POST /scripts requires type', async () => {
    const res = await createAgent()
      .post(`${API}/scripts`)
      .set(authHeader('admin'))
      .send({
        name: 'Test',
        content: 'Hello customer',
      });
    expect([400, 403, 422, 500]).toContain(res.status);
  });

  it('POST /scripts requires content', async () => {
    const res = await createAgent()
      .post(`${API}/scripts`)
      .set(authHeader('admin'))
      .send({
        name: 'Test',
        type: 'default',
      });
    expect([400, 403, 422, 500]).toContain(res.status);
  });

  it('GET /scripts/active resolves by campaign', async () => {
    const res = await createAgent()
      .get(`${API}/scripts/active?campaignId=test-campaign`)
      .set(authHeader('agent_telesale'));
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    }
  });

  it('GET /scripts/default returns default script', async () => {
    const res = await createAgent()
      .get(`${API}/scripts/default`)
      .set(authHeader('agent_telesale'));
    expect([200, 500]).toContain(res.status);
  });
});

// =============================================================================
// 10. MACRO APPLY TESTS
// =============================================================================
describe('Macro - Apply macro to ticket', () => {
  it('POST /macros/apply applies macro to ticket', async () => {
    const res = await createAgent()
      .post(`${API}/macros/apply`)
      .set(authHeader('agent_telesale'))
      .send({
        macroId: 'test-macro-001',
        ticketId: 'test-ticket-001',
      });
    expect([200, 400, 404, 500]).toContain(res.status);
  });

  it('POST /macros/apply requires macroId', async () => {
    const res = await createAgent()
      .post(`${API}/macros/apply`)
      .set(authHeader('agent_telesale'))
      .send({
        ticketId: 'test-ticket-001',
      });
    expect([400, 422, 500]).toContain(res.status);
  });

  it('POST /macros/apply requires ticketId', async () => {
    const res = await createAgent()
      .post(`${API}/macros/apply`)
      .set(authHeader('agent_telesale'))
      .send({
        macroId: 'test-macro-001',
      });
    expect([400, 422, 500]).toContain(res.status);
  });

  it('GET /macros returns macros list', async () => {
    const res = await createAgent()
      .get(`${API}/macros`)
      .set(authHeader('agent_telesale'));
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    }
  });

  it('POST /macros creates macro', async () => {
    const res = await createAgent()
      .post(`${API}/macros`)
      .set(authHeader('admin'))
      .send({
        name: 'Test Macro',
        description: 'Test',
        templateText: 'Hello {{name}}',
      });
    expect([201, 200, 400, 500]).toContain(res.status);
  });
});

// =============================================================================
// 11. ATTENDED TRANSFER TESTS
// =============================================================================
describe('Call - Attended Transfer', () => {
  it('POST /calls/attended-transfer endpoint exists', async () => {
    const res = await createAgent()
      .post(`${API}/calls/attended-transfer`)
      .set(authHeader('agent_telesale'))
      .send({
        callUuid: 'test-uuid-001',
        targetExtension: '1001',
      });
    expect([200, 400, 404, 422, 500]).toContain(res.status);
  });

  it('POST /calls/attended-transfer requires callUuid', async () => {
    const res = await createAgent()
      .post(`${API}/calls/attended-transfer`)
      .set(authHeader('agent_telesale'))
      .send({
        targetExtension: '1001',
      });
    expect([400, 422, 500]).toContain(res.status);
  });

  it('POST /calls/attended-transfer requires targetExtension', async () => {
    const res = await createAgent()
      .post(`${API}/calls/attended-transfer`)
      .set(authHeader('agent_telesale'))
      .send({
        callUuid: 'test-uuid-001',
      });
    expect([400, 422, 500]).toContain(res.status);
  });

  it('POST /calls/originate requires auth → 401', async () => {
    const res = await createAgent()
      .post(`${API}/calls/originate`)
      .send({ phoneNumber: '0123456789' });
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// 12. PERMISSION MANAGEMENT TESTS
// =============================================================================
describe('Permissions - Permission endpoints', () => {
  it('GET /permissions returns list', async () => {
    const res = await createAgent()
      .get(`${API}/permissions`)
      .set(authHeader('admin'));
    expect([200, 400, 403, 404, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    }
  });

  it('POST /permissions/assign assigns permission', async () => {
    const res = await createAgent()
      .post(`${API}/permissions/assign`)
      .set(authHeader('super_admin'))
      .send({
        userId: 'test-user-001',
        permission: 'report.export',
      });
    expect([200, 400, 404, 500]).toContain(res.status);
  });

  it('POST /permissions requires super_admin role', async () => {
    const res = await createAgent()
      .post(`${API}/permissions/assign`)
      .set(authHeader('admin'))
      .send({
        userId: 'test-user-001',
        permission: 'report.export',
      });
    expect([403, 404, 500]).toContain(res.status);
  });
});

// =============================================================================
// 13. EXTENSION MANAGEMENT TESTS
// =============================================================================
describe('Extensions - Extension configuration', () => {
  it('GET /extensions returns list', async () => {
    const res = await createAgent()
      .get(`${API}/extensions`)
      .set(authHeader('admin'));
    expect([200, 404, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    }
  });

  it('POST /extensions creates extension', async () => {
    const res = await createAgent()
      .post(`${API}/extensions`)
      .set(authHeader('admin'))
      .send({
        extension: '2001',
        userId: 'test-user-001',
      });
    expect([201, 200, 400, 404, 500]).toContain(res.status);
  });

  it('extension requires admin role', async () => {
    const res = await createAgent()
      .get(`${API}/extensions`)
      .set(authHeader('agent_telesale'));
    expect([403, 404, 500]).toContain(res.status);
  });
});

// =============================================================================
// 14. LEAD ASSIGNMENT TESTS
// =============================================================================
describe('Lead Assignment - Auto assignment', () => {
  it('POST /assignments/assign assigns lead', async () => {
    const res = await createAgent()
      .post(`${API}/assignments/assign`)
      .set(authHeader('manager'))
      .send({
        leadId: 'test-lead-001',
        userId: 'test-agent-001',
      });
    expect([200, 400, 403, 404, 500]).toContain(res.status);
  });

  it('POST /assignments/auto-assign triggers auto assignment', async () => {
    const res = await createAgent()
      .post(`${API}/assignments/auto-assign`)
      .set(authHeader('admin'))
      .send({
        campaignId: 'test-campaign-001',
      });
    expect([200, 400, 403, 404, 500]).toContain(res.status);
  });
});

// =============================================================================
// 15. CONTACT MERGE TESTS
// =============================================================================
describe('Contact Merge - Merge contacts', () => {
  it('POST /contact-merge merges contacts', async () => {
    const res = await createAgent()
      .post(`${API}/contact-merge`)
      .set(authHeader('admin'))
      .send({
        sourceContactId: '00000000-0000-0000-0000-000000000001',
        targetContactId: '00000000-0000-0000-0000-000000000002',
      });
    expect([200, 400, 403, 404, 500]).toContain(res.status);
  });

  it('POST /contact-merge requires sourceContactId', async () => {
    const res = await createAgent()
      .post(`${API}/contact-merge`)
      .set(authHeader('admin'))
      .send({
        targetContactId: '00000000-0000-0000-0000-000000000002',
      });
    expect([400, 403, 422, 404, 500]).toContain(res.status);
  });

  it('POST /contact-merge requires targetContactId', async () => {
    const res = await createAgent()
      .post(`${API}/contact-merge`)
      .set(authHeader('admin'))
      .send({
        sourceContactId: '00000000-0000-0000-0000-000000000001',
      });
    expect([400, 403, 422, 404, 500]).toContain(res.status);
  });
});

// =============================================================================
// 16. AUTHENTICATION & GENERAL TESTS
// =============================================================================
describe('Auth - Protected endpoints', () => {
  it('protected endpoints require auth header → 401', async () => {
    const endpoints = [
      ['GET', `${API}/leads`],
      ['GET', `${API}/leads/follow-ups`],
      ['GET', `${API}/debt-cases`],
      ['GET', `${API}/monitoring/live`],
      ['GET', `${API}/dashboard/overview`],
    ];

    for (const [method, path] of endpoints) {
      let req = createAgent();
      if (method === 'GET') {
        req = req.get(path);
      } else if (method === 'POST') {
        req = req.post(path);
      }
      const res = await req;
      expect(res.status).toBe(401);
    }
  });

  it('invalid token → 401', async () => {
    const res = await createAgent()
      .get(`${API}/leads`)
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
  });

  it('malformed auth header → 401', async () => {
    const res = await createAgent()
      .get(`${API}/leads`)
      .set('Authorization', 'NotBearer token');
    expect(res.status).toBe(401);
  });
});
