/**
 * Lead scoring service - rule-based scoring engine
 * Score range: 0-100 (capped)
 */

interface LeadForScoring {
  status?: string | null;
  source?: string | null; // from contact
  phone?: string | null;  // from contact
  email?: string | null;  // from contact
  callCount?: number;     // interaction count
  lastContactedAt?: Date | null;
}

const SOURCE_SCORES: Record<string, number> = {
  referral: 10,
  website: 5,
  zalo: 4,
  facebook: 4,
  email: 3,
};

const STATUS_SCORES: Record<string, number> = {
  qualified: 20,
  proposal: 15,
  contacted: 8,
  won: 25,
  new: 0,
  lost: -10,
};

/** Calculate days since last contact — returns decay penalty */
function decayScore(lastContactedAt?: Date | null): number {
  if (!lastContactedAt) return -5;
  const daysSince = Math.floor((Date.now() - lastContactedAt.getTime()) / 86400000);
  if (daysSince <= 3) return 0;
  if (daysSince <= 7) return -2;
  if (daysSince <= 14) return -5;
  if (daysSince <= 30) return -10;
  return -15;
}

/** Main scoring function — returns integer score capped 0-100 */
export function calculateScore(lead: LeadForScoring): number {
  let score = 30; // base score

  // Source bonus
  if (lead.source) {
    score += SOURCE_SCORES[lead.source.toLowerCase()] ?? 2;
  }

  // Status bonus
  if (lead.status) {
    score += STATUS_SCORES[lead.status.toLowerCase()] ?? 0;
  }

  // Contact info bonuses
  if (lead.phone) score += 5;
  if (lead.email) score += 5;

  // Interaction count bonus (capped at +10)
  const interactions = lead.callCount || 0;
  score += Math.min(interactions * 2, 10);

  // Recency decay
  score += decayScore(lead.lastContactedAt);

  // Cap between 0 and 100
  return Math.max(0, Math.min(100, score));
}
