/**
 * Phone number normalization utility.
 * Phones stored as-entered in DB. Normalize at query time for CDR matching.
 *
 * Rules:
 * - Strip spaces, dashes, dots, parentheses
 * - 0912345678 → +84912345678
 * - 84912345678 → +84912345678
 * - +84912345678 → +84912345678 (already normalized)
 */
export function normalizePhone(phone: string): string {
  // Strip non-digit characters except leading +
  const cleaned = phone.replace(/[\s\-\.\(\)]/g, '');

  if (cleaned.startsWith('+84')) {
    return cleaned;
  }

  if (cleaned.startsWith('84') && cleaned.length >= 11) {
    return `+${cleaned}`;
  }

  if (cleaned.startsWith('0') && cleaned.length >= 10) {
    return `+84${cleaned.slice(1)}`;
  }

  // Return as-is if format is unrecognized
  return cleaned;
}

/** Check if a string looks like a Vietnamese phone number */
export function isVietnamesePhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-\.\(\)]/g, '');
  return /^(\+?84|0)[0-9]{9,10}$/.test(cleaned);
}
