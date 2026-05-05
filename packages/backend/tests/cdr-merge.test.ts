import { describe, it, expect } from 'vitest';
import { mergeBillsec, mergeDuration } from '../src/lib/cdr-merge';

/**
 * Scenario: click-to-call outbound, agent ext 101 → customer 0919239894.
 *  - t=0   agent's phone rings
 *  - t=7s  agent picks up → bridge to loopback-B → outbound to customer
 *  - t=7s  customer is being dialed (no audio yet)
 *  - t=9s  loopback-B answered (internal handoff) — answerTime anchored here
 *  - t=22s agent hangs up — endTime anchored here
 *  - Real customer talk time = 22s − 9s = 13s
 */
const ANSWER = new Date('2026-04-17T12:00:09Z');
const END = new Date('2026-04-17T12:00:22Z');

describe('mergeBillsec — cross-leg formula', () => {
  it('returns endTime−answerTime when both timestamps are known', () => {
    // loopback-B reported billsec=2 (handoff overhead, garbage)
    // agent-SIP reported billsec=15 (ring+talk)
    // both wrong for "customer talk time" — cross-leg formula wins
    expect(mergeBillsec(2, 15, ANSWER, END)).toBe(13);
  });

  it('returns 0 when answerTime missing — no answer means no talk time', () => {
    // Busy/No-answer/Rejected calls never carry talk time. If a parallel leg
    // leaks a non-zero billsec into the merge, the invariant drops it.
    // If the call *does* get answered later, the next leg will arrive with
    // answerTime set and the cross-leg formula kicks in.
    expect(mergeBillsec(15, 0, null, END)).toBe(0);
  });

  it('falls back to MAX when endTime missing (loopback-B arrives first)', () => {
    // Loopback-B sets answerTime but agent leg hasn't written endTime yet.
    expect(mergeBillsec(2, 0, ANSWER, null)).toBe(2);
  });

  it('ignores cross-leg formula if it would be zero or negative (clock skew)', () => {
    const end = new Date('2026-04-17T12:00:09Z'); // equal to ANSWER
    expect(mergeBillsec(5, 3, ANSWER, end)).toBe(5);
  });

  it('coerces nullish candidates to 0 without NaN', () => {
    // @ts-expect-error intentionally passing undefined to simulate upstream default
    expect(mergeBillsec(undefined, 7, ANSWER, null)).toBe(7);
  });
});

describe('mergeDuration — MAX across legs', () => {
  it('keeps the larger value', () => {
    expect(mergeDuration(22, 10)).toBe(22);
    expect(mergeDuration(10, 22)).toBe(22);
  });

  it('treats null/undefined existing as 0', () => {
    expect(mergeDuration(22, null)).toBe(22);
    expect(mergeDuration(22, undefined)).toBe(22);
  });
});
