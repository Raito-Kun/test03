/**
 * Cross-leg CDR merge helpers for the FusionPBX webhook.
 *
 * A single C2C outbound call produces 3-4 CDR legs (loopback-A orphan,
 * loopback-B canonical, gateway/trunk, agent-SIP). Each leg reports
 * different timing slices. The agent-SIP leg carries the true `endTime`;
 * the loopback-B leg carries the true `answerTime` (moment customer
 * picked up). Real customer talk time = endTime − answerTime.
 *
 * These helpers let both leg handlers converge on the same merged
 * values regardless of arrival order.
 */

/**
 * Pick the best billsec for the canonical row.
 *
 * Invariant: no answerTime = no talk time. Busy/No-answer/Rejected/Voicemail
 * legs sometimes inherit spurious billsec from a parallel call — drop it.
 *
 * When both answerTime and endTime are known, the cross-leg formula wins
 * over any single leg's reported billsec. When only answerTime is known,
 * fall back to MAX of candidate vs existing (a later leg will refine once
 * endTime arrives).
 */
export function mergeBillsec(
  candidateBillsec: number,
  existingBillsec: number,
  answerTime: Date | null | undefined,
  endTime: Date | null | undefined,
): number {
  if (!answerTime) return 0;
  const best = Math.max(candidateBillsec || 0, existingBillsec || 0);
  if (endTime) {
    const realTalk = Math.floor((endTime.getTime() - answerTime.getTime()) / 1000);
    if (realTalk > 0) return realTalk;
  }
  return best;
}

/** MAX across legs — duration should only ever grow as more legs arrive. */
export function mergeDuration(candidate: number, existing: number | null | undefined): number {
  return Math.max(candidate || 0, existing || 0);
}
