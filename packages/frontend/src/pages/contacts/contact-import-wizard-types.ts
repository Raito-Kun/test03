/** Shared types for the 3-step contact import wizard. */

export type DuplicateAction = 'create' | 'overwrite' | 'merge' | 'skip' | 'keep';

export interface ContactImportRow {
  rowNumber: number;
  fullName: string;
  phone: string;
  phoneAlt?: string;
  email?: string;
  idNumber?: string;
  address?: string;
  province?: string;
  district?: string;
  company?: string;
  jobTitle?: string;
  source?: string;
  tags?: string[];
  // Other optional fields parsed by backend — kept open so we don't have to
  // echo the full Prisma Contact shape in frontend types.
  [key: string]: unknown;
}

export interface ExistingContactSnapshot {
  id: string;
  fullName: string;
  phone: string;
  phoneAlt: string | null;
  email: string | null;
  idNumber: string | null;
  address: string | null;
  company: string | null;
  source: string | null;
  assignedTo: string | null;
}

export interface DuplicateEntry {
  rowNumber: number;
  new: ContactImportRow;
  existing: ExistingContactSnapshot;
  /** Chosen action — filled in by the user in step 2. */
  action: DuplicateAction;
}

export interface Agent {
  id: string;
  fullName: string;
  role: string;
  agentStatus?: string;
}

/** Final per-row record sent to POST /contacts/import/commit. */
export interface CommitRow {
  row: ContactImportRow;
  action: DuplicateAction;
  existingId?: string;
  assignToUserId?: string | null;
}
