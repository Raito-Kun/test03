/**
 * Detect whether a FusionPBX OUT-ALL dialplan_xml carries the full set of
 * recording actions required for outbound call recording to fire.
 *
 * See `plans/reports/debugger-260326-1443-recording-debug.md` for why each
 * keyword matters — the user_record dialplan never fires on loopback-B legs,
 * so these actions must live on OUT-ALL itself.
 */

export const RECORDING_ACTION_KEYWORDS = [
  'record_path',
  'record_name',
  'mkdir',
  'RECORD_ANSWER_REQ',
  'api_on_answer',
  'sip_h_accountcode',
] as const;

export interface DialplanDetection {
  ok: boolean;
  missing: string[];
  present: string[];
}

export function detectRecordingActions(dialplanXml: string): DialplanDetection {
  if (!dialplanXml || typeof dialplanXml !== 'string') {
    return { ok: false, missing: [...RECORDING_ACTION_KEYWORDS], present: [] };
  }
  const present: string[] = [];
  const missing: string[] = [];
  for (const kw of RECORDING_ACTION_KEYWORDS) {
    if (dialplanXml.includes(kw)) present.push(kw);
    else missing.push(kw);
  }
  return { ok: missing.length === 0, missing, present };
}

export interface PerRuleResult {
  name: string;
  status: 'ok' | 'partial' | 'missing';
  missing: readonly string[];
}

export interface AggregatedRuleStatus {
  status: 'pass' | 'warn' | 'fail';
  okCount: number;
  failCount: number;
  summary: string;
  message: string;
  hint?: string;
}

/**
 * Aggregate per-rule detection into a single preflight status.
 *
 * All rules OK → pass.
 * Some OK + some failing → warn (not blocking — some rules may be intentionally
 *   without recording, e.g. emergency numbers).
 * Zero OK → fail.
 */
export function aggregateRuleStatuses(perRule: PerRuleResult[]): AggregatedRuleStatus {
  const okCount = perRule.filter((r) => r.status === 'ok').length;
  const failCount = perRule.filter((r) => r.status !== 'ok').length;
  const summary = perRule
    .map((r) => {
      if (r.status === 'ok') return `${r.name} ✓`;
      if (r.status === 'missing') return `${r.name} ✗ (không tồn tại)`;
      return `${r.name} ✗ (thiếu ${r.missing.length})`;
    })
    .join(' · ');

  if (failCount === 0) {
    return {
      status: 'pass',
      okCount,
      failCount,
      summary,
      message: `Đủ ${RECORDING_ACTION_KEYWORDS.length}/${RECORDING_ACTION_KEYWORDS.length} action trên cả ${okCount} rule: ${summary}`,
    };
  }

  const okRule = perRule.find((r) => r.status === 'ok');
  const failed = perRule.filter((r) => r.status !== 'ok');
  const hint = okRule
    ? `Copy block recording từ "${okRule.name}" sang ${failed.map((r) => r.name).join(', ')}`
    : 'Xem skill crm-pbx-onboard → Recording Prerequisites để copy XML block';

  const status: 'fail' | 'warn' = okCount === 0 ? 'fail' : 'warn';
  const firstFail = failed[0];
  const message = okCount === 0
    ? `${failCount}/${perRule.length} rule chưa có recording. Rule đầu: ${firstFail.name} thiếu ${firstFail.missing.length}/${RECORDING_ACTION_KEYWORDS.length}`
    : `${okCount}/${perRule.length} rule OK, ${failCount} cần patch: ${summary}`;

  return { status, okCount, failCount, summary, message, hint };
}
