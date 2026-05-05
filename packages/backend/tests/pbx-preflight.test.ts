import { describe, it, expect } from 'vitest';
import { detectRecordingActions, RECORDING_ACTION_KEYWORDS, aggregateRuleStatuses, type PerRuleResult } from '../src/lib/pbx-dialplan-detect';
import { isPbxIpAllowed } from '../src/services/pbx-preflight-service';

describe('detectRecordingActions', () => {
  const fullXml = `
    <action application="set" data="record_path=..."/>
    <action application="set" data="record_name=..."/>
    <action application="mkdir" data="..."/>
    <action application="set" data="RECORD_ANSWER_REQ=true"/>
    <action application="set" data="api_on_answer=uuid_record ..."/>
    <action application="set" data="sip_h_accountcode=..."/>
  `;

  it('passes when all 6 keywords present', () => {
    const det = detectRecordingActions(fullXml);
    expect(det.ok).toBe(true);
    expect(det.missing).toEqual([]);
    expect(det.present.length).toBe(RECORDING_ACTION_KEYWORDS.length);
  });

  it('reports missing keywords when partial', () => {
    const partial = `<action data="record_path=..."/>\n<action data="record_name=..."/>`;
    const det = detectRecordingActions(partial);
    expect(det.ok).toBe(false);
    expect(det.missing).toEqual(['mkdir', 'RECORD_ANSWER_REQ', 'api_on_answer', 'sip_h_accountcode']);
  });

  it('reports all missing on empty input', () => {
    const det = detectRecordingActions('');
    expect(det.ok).toBe(false);
    expect(det.missing.length).toBe(RECORDING_ACTION_KEYWORDS.length);
  });

  it('handles nullish input without throwing', () => {
    // @ts-expect-error — simulate Postgres returning null
    const det = detectRecordingActions(null);
    expect(det.ok).toBe(false);
    expect(det.missing.length).toBe(RECORDING_ACTION_KEYWORDS.length);
  });

  it('matches substrings regardless of XML formatting', () => {
    // Blueva-style compact XML without newlines
    const compact = `<action data="record_path=X"/><action data="record_name=Y"/><action data="mkdir"/><action data="RECORD_ANSWER_REQ=true"/><action data="api_on_answer=z"/><action data="sip_h_accountcode=a"/>`;
    expect(detectRecordingActions(compact).ok).toBe(true);
  });
});

describe('aggregateRuleStatuses — multi-rule dialplan aggregation', () => {
  const ok = (name: string): PerRuleResult => ({ name, status: 'ok', missing: [] });
  const partial = (name: string, miss: string[]): PerRuleResult => ({ name, status: 'partial', missing: miss });
  const missing = (name: string): PerRuleResult => ({ name, status: 'missing', missing: [...RECORDING_ACTION_KEYWORDS] });

  it('all rules ok → pass', () => {
    const agg = aggregateRuleStatuses([ok('OUT-VIETTEL'), ok('OUT-MOBI'), ok('OUT-VINA')]);
    expect(agg.status).toBe('pass');
    expect(agg.okCount).toBe(3);
    expect(agg.failCount).toBe(0);
    expect(agg.message).toContain('Đủ');
    expect(agg.hint).toBeUndefined();
  });

  it('some ok + some partial → warn with copy-hint', () => {
    const agg = aggregateRuleStatuses([ok('OUT-VIETTEL'), partial('OUT-MOBI', ['record_path', 'mkdir'])]);
    expect(agg.status).toBe('warn');
    expect(agg.okCount).toBe(1);
    expect(agg.failCount).toBe(1);
    expect(agg.hint).toContain('OUT-VIETTEL');
    expect(agg.hint).toContain('OUT-MOBI');
  });

  it('zero ok, all failing → fail, no copy-hint', () => {
    const agg = aggregateRuleStatuses([partial('A', ['record_path']), missing('B')]);
    expect(agg.status).toBe('fail');
    expect(agg.okCount).toBe(0);
    expect(agg.hint).not.toContain('Copy block');
    expect(agg.hint).toContain('crm-pbx-onboard');
  });

  it('rule missing from FusionPBX is reported distinctly', () => {
    const agg = aggregateRuleStatuses([ok('EXISTS'), missing('DELETED-RULE')]);
    expect(agg.status).toBe('warn');
    expect(agg.summary).toContain('không tồn tại');
    expect(agg.summary).toContain('EXISTS ✓');
  });

  it('empty rule list is not the job of this aggregator — caller must gate', () => {
    // Defensive: still shouldn't throw
    const agg = aggregateRuleStatuses([]);
    expect(agg.okCount).toBe(0);
    expect(agg.failCount).toBe(0);
    // With 0 failures and 0 passes, pass branch wins by construction — caller handles "skipped"
    expect(agg.status).toBe('pass');
  });
});

describe('isPbxIpAllowed', () => {
  it('accepts exact IP match', () => {
    expect(isPbxIpAllowed('10.10.101.206', '10.10.101.206,127.0.0.1')).toBe(true);
  });

  it('accepts wildcard 0.0.0.0', () => {
    expect(isPbxIpAllowed('192.168.1.50', '0.0.0.0')).toBe(true);
  });

  it('rejects IP not in list', () => {
    expect(isPbxIpAllowed('10.10.101.99', '10.10.101.206,10.10.101.189')).toBe(false);
  });

  it('rejects on empty allowlist', () => {
    expect(isPbxIpAllowed('10.10.101.206', '')).toBe(false);
  });

  it('trims whitespace around entries', () => {
    expect(isPbxIpAllowed('10.10.101.206', '  10.10.101.206 , 127.0.0.1 ')).toBe(true);
  });
});
