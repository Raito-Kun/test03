/** Feature flag module groups for display */
export interface FeatureFlagDef {
  key: string;
  label: string;
}

export interface FeatureFlagModule {
  name: string;
  features: FeatureFlagDef[];
}

export const FEATURE_FLAG_MODULES: FeatureFlagModule[] = [
  {
    name: 'CRM',
    features: [
      { key: 'contacts', label: 'Danh bạ' },
      { key: 'leads', label: 'Khách hàng tiềm năng' },
      { key: 'debt', label: 'Công nợ' },
      { key: 'campaigns', label: 'Chiến dịch' },
      { key: 'tickets', label: 'Phiếu ghi' },
    ],
  },
  {
    name: 'Tổng đài',
    features: [
      { key: 'voip_c2c', label: 'Click-to-call' },
      { key: 'recording', label: 'Ghi âm' },
      { key: 'cdr_webhook', label: 'CDR Webhook' },
      { key: 'live_monitoring', label: 'Giám sát trực tiếp' },
      { key: 'call_history', label: 'Lịch sử cuộc gọi' },
    ],
  },
  {
    name: 'Báo cáo',
    features: [
      { key: 'reports_summary', label: 'Báo cáo tóm tắt' },
      { key: 'reports_detail', label: 'Báo cáo chi tiết' },
      { key: 'reports_chart', label: 'Biểu đồ' },
      { key: 'reports_export', label: 'Xuất Excel' },
    ],
  },
  {
    name: 'AI',
    features: [
      { key: 'ai_assistant', label: 'Nút AI' },
      { key: 'ai_qa', label: 'QA tự động' },
    ],
  },
  {
    name: 'Hệ thống',
    features: [
      { key: 'team_management', label: 'Quản lý team' },
      { key: 'permission_matrix', label: 'Ma trận quyền' },
      { key: 'pbx_cluster_mgmt', label: 'Khai báo cụm PBX' },
    ],
  },
];

/** All feature keys flat */
export const ALL_FEATURE_KEYS = FEATURE_FLAG_MODULES.flatMap((m) => m.features.map((f) => f.key));

/**
 * Map feature key → sidebar route paths.
 * Used to hide sidebar items when feature is disabled.
 */
export const FEATURE_ROUTE_MAP: Record<string, string[]> = {
  contacts: ['/contacts'],
  leads: ['/leads'],
  debt: ['/debt-cases'],
  campaigns: ['/campaigns'],
  tickets: ['/tickets'],
  voip_c2c: [],
  recording: [],
  cdr_webhook: [],
  live_monitoring: ['/monitoring/live-calls', '/monitoring/agent-status', '/monitoring/team-stats'],
  call_history: ['/call-logs'],
  reports_summary: ['/reports'],
  reports_detail: ['/reports'],
  reports_chart: ['/reports'],
  reports_export: [],
  ai_assistant: [],
  ai_qa: [],
  team_management: ['/settings/teams'],
  permission_matrix: ['/settings/permissions'],
  pbx_cluster_mgmt: ['/settings/clusters'],
};
