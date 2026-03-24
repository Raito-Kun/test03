/** Mirror of Prisma enums for frontend use (no Prisma dependency needed) */

export const ROLES = ['admin', 'manager', 'qa', 'leader', 'agent_telesale', 'agent_collection'] as const;
export type Role = (typeof ROLES)[number];

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const DEBT_TIERS = ['current', 'dpd_1_30', 'dpd_31_60', 'dpd_61_90', 'dpd_90_plus'] as const;
export type DebtTier = (typeof DEBT_TIERS)[number];

export const DEBT_STATUSES = ['active', 'in_progress', 'promise_to_pay', 'paid', 'written_off'] as const;
export type DebtStatus = (typeof DEBT_STATUSES)[number];

export const CAMPAIGN_TYPES = ['telesale', 'collection'] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'completed'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const AGENT_STATUSES = ['offline', 'ready', 'break', 'ringing', 'on_call', 'hold', 'wrap_up', 'transfer'] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const CALL_DIRECTIONS = ['inbound', 'outbound'] as const;
export type CallDirection = (typeof CALL_DIRECTIONS)[number];

export const NOTIFICATION_TYPES = ['follow_up_reminder', 'ptp_due', 'system_alert', 'campaign_assigned', 'recording_failed'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
