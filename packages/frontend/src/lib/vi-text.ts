/** Vietnamese UI text constants — all labels, menus, buttons, placeholders */

export const VI = {
  // App
  appName: 'CRM AI',

  // Auth
  login: 'Đăng nhập',
  logout: 'Đăng xuất',
  email: 'Email',
  password: 'Mật khẩu',
  loginTitle: 'Đăng nhập hệ thống',
  loginButton: 'Đăng nhập',
  loginError: 'Email hoặc mật khẩu không đúng',
  loggingIn: 'Đang đăng nhập...',

  // Sidebar nav
  nav: {
    dashboard: 'Tổng quan',
    contacts: 'Danh sách khách hàng',
    leads: 'Nhóm khách hàng',
    debtCases: 'Công nợ',
    callLogs: 'Lịch sử cuộc gọi',
    campaigns: 'Chiến dịch',
    tickets: 'Phiếu ghi',
    reports: 'Báo cáo',
    settings: 'Cài đặt',
  },

  // Header
  search: 'Tìm kiếm...',
  notifications: 'Thông báo',
  noNotifications: 'Không có thông báo',
  markAllRead: 'Đánh dấu tất cả đã đọc',
  profile: 'Hồ sơ cá nhân',
  changePassword: 'Đổi mật khẩu',

  // Agent status
  agentStatus: {
    offline: 'Ngoại tuyến',
    ready: 'Sẵn sàng',
    break: 'Nghỉ',
    ringing: 'Đang đổ chuông',
    on_call: 'Đang gọi',
    hold: 'Giữ cuộc gọi',
    wrap_up: 'Kết thúc',
    transfer: 'Chuyển cuộc gọi',
  },

  // Common actions
  actions: {
    create: 'Tạo mới',
    edit: 'Chỉnh sửa',
    delete: 'Xóa',
    save: 'Lưu',
    cancel: 'Hủy',
    confirm: 'Xác nhận',
    close: 'Đóng',
    back: 'Quay lại',
    filter: 'Lọc',
    export: 'Xuất',
    import: 'Nhập',
    refresh: 'Làm mới',
    viewDetail: 'Xem chi tiết',
    loading: 'Đang tải...',
    noData: 'Không có dữ liệu',
    search: 'Tìm kiếm',
  },

  // Data table
  table: {
    rowsPerPage: 'Dòng mỗi trang',
    page: 'Trang',
    of: 'trên',
    total: 'Tổng',
    noResults: 'Không tìm thấy kết quả',
    previous: 'Trước',
    next: 'Tiếp',
  },

  // Confirm dialog
  confirmDelete: 'Bạn có chắc chắn muốn xóa?',
  confirmDeleteDesc: 'Hành động này không thể hoàn tác.',

  // Dashboard
  dashboard: {
    totalCalls: 'Tổng cuộc gọi',
    answered: 'Đã nghe',
    missed: 'Nhỡ',
    avgDuration: 'Thời lượng TB',
    activeCalls: 'Đang gọi',
    agentGrid: 'Trạng thái nhân viên',
    leadSummary: 'Phễu khách hàng',
    debtSummary: 'Tổng hợp công nợ',
  },

  // Contacts
  contact: {
    title: 'Danh sách khách hàng',
    fullName: 'Họ tên',
    phone: 'Số điện thoại',
    phoneAlt: 'Số điện thoại phụ',
    email: 'Email',
    source: 'Nguồn',
    tags: 'Nhãn',
    assignedTo: 'Phụ trách',
    createdAt: 'Ngày tạo',
    gender: 'Giới tính',
    dateOfBirth: 'Ngày sinh',
    idNumber: 'CMND/CCCD',
    address: 'Địa chỉ',
    occupation: 'Nghề nghiệp',
    income: 'Thu nhập',
    province: 'Tỉnh/Thành',
    district: 'Quận/Huyện',
    fullAddress: 'Địa chỉ đầy đủ',
    company: 'Công ty',
    jobTitle: 'Chức vụ',
    companyEmail: 'Email công ty',
    creditLimit: 'Hạn mức tín dụng',
    bankAccount: 'Số tài khoản',
    bankName: 'Ngân hàng',
    internalNotes: 'Ghi chú nội bộ',
    tabs: { info: 'Thông tin', tickets: 'Phiếu ghi', calls: 'Cuộc gọi', timeline: 'Dòng thời gian' },
    sections: {
      basic: 'Thông tin cơ bản',
      work: 'Công việc',
      address: 'Địa chỉ',
      finance: 'Tài chính',
      notes: 'Ghi chú',
    },
    createTitle: 'Tạo liên hệ',
    editTitle: 'Sửa liên hệ',
  },

  // Leads
  lead: {
    title: 'Nhóm khách hàng',
    status: 'Trạng thái',
    score: 'Điểm',
    leadScore: 'Điểm lead',
    product: 'Sản phẩm',
    budget: 'Ngân sách',
    campaign: 'Chiến dịch',
    notes: 'Ghi chú',
    followUp: 'Lịch liên hệ',
    createTitle: 'Tạo lead',
    editTitle: 'Sửa lead',
    statuses: {
      new: 'Mới', contacted: 'Đã liên hệ', qualified: 'Đạt điều kiện',
      proposal: 'Đề xuất', won: 'Thành công', lost: 'Thất bại',
    },
  },

  // Debt cases
  debt: {
    title: 'Công nợ',
    amount: 'Số tiền nợ',
    paidAmount: 'Đã trả',
    remainingAmount: 'Còn lại',
    tier: 'Phân nhóm',
    status: 'Trạng thái',
    dpd: 'DPD',
    debtGroup: 'Nhóm nợ',
    contractNumber: 'Số hợp đồng',
    debtType: 'Loại nợ',
    dueDate: 'Ngày đáo hạn',
    promiseDate: 'Ngày hẹn trả',
    promiseAmount: 'Số tiền hẹn',
    ptpTitle: 'Ghi nhận cam kết trả',
    tiers: {
      current: 'Hiện tại', dpd_1_30: '1-30 ngày', dpd_31_60: '31-60 ngày',
      dpd_61_90: '61-90 ngày', dpd_90_plus: 'Trên 90 ngày',
    },
    statuses: {
      active: 'Đang hoạt động', in_progress: 'Đang xử lý',
      promise_to_pay: 'Cam kết trả', paid: 'Đã trả', written_off: 'Xóa nợ',
    },
  },

  // Call logs
  callLog: {
    title: 'Lịch sử cuộc gọi',
    direction: 'Hướng',
    duration: 'Thời lượng',
    disposition: 'Kết quả',
    agent: 'Nhân viên',
    recording: 'Ghi âm',
    qa: 'Đánh giá QA',
    inbound: 'Gọi vào',
    outbound: 'Gọi ra',
    startTime: 'Thời gian',
  },

  // Call bar
  callBar: {
    hold: 'Giữ',
    mute: 'Tắt mic',
    transfer: 'Chuyển',
    hangup: 'Kết thúc',
    calling: 'Đang gọi',
    selectDisposition: 'Chọn kết quả cuộc gọi',
    script: 'Kịch bản',
  },

  // Tickets
  ticket: {
    title: 'Phiếu ghi',
    category: 'Danh mục',
    priority: 'Độ ưu tiên',
    status: 'Trạng thái',
    content: 'Nội dung',
    macro: 'Mẫu macro',
    createTitle: 'Tạo phiếu ghi',
    editTitle: 'Sửa phiếu ghi',
    statuses: { open: 'Mở', in_progress: 'Đang xử lý', resolved: 'Đã giải quyết', closed: 'Đóng' },
    priorities: { low: 'Thấp', medium: 'Trung bình', high: 'Cao', urgent: 'Khẩn cấp' },
  },

  // Campaigns
  campaign: {
    title: 'Chiến dịch',
    name: 'Tên chiến dịch',
    type: 'Loại',
    status: 'Trạng thái',
    startDate: 'Ngày bắt đầu',
    endDate: 'Ngày kết thúc',
    script: 'Kịch bản',
    category: 'Loại chiến dịch',
    queue: 'Hàng đợi',
    dialMode: 'Hình thức',
    callbackUrl: 'Callback URL',
    workSchedule: 'Lịch làm việc',
    workStartTime: 'Thời gian bắt đầu',
    workEndTime: 'Thời gian kết thúc',
    types: { telesale: 'Telesale', collection: 'Thu nợ' },
    categories: { telesale: 'Gọi điện', collection: 'Thu nợ', customer_service: 'CSKH' },
    dialModes: { manual: 'Thủ công', auto_dialer: 'Auto-dialer', power_dialer: 'Power-dialer' },
    schedules: { all_day: 'Cả ngày', business_hours: 'Giờ hành chính', custom: 'Tùy chỉnh' },
    queues: { campaign_call: 'Call chiến dịch', inbound: 'Gọi đến', outbound: 'Gọi ra' },
    statuses: { draft: 'Nháp', active: 'Hoạt động', paused: 'Tạm dừng', completed: 'Hoàn thành' },
    contactList: 'Danh sách liên hệ',
    agentList: 'Chuyên viên',
    addAgent: 'Thêm chuyên viên',
    detailTitle: 'Chi tiết chiến dịch',
  },

  // Settings
  settings: {
    title: 'Cài đặt',
    profileTitle: 'Hồ sơ cá nhân',
    passwordTitle: 'Đổi mật khẩu',
    currentPassword: 'Mật khẩu hiện tại',
    newPassword: 'Mật khẩu mới',
    confirmPassword: 'Xác nhận mật khẩu',
    saveSuccess: 'Đã lưu thành công',
  },

  // Reports
  report: {
    title: 'Báo cáo',
    callReport: 'Báo cáo cuộc gọi',
    telesaleReport: 'Báo cáo Telesale',
    collectionReport: 'Báo cáo Thu nợ',
  },

  // Roles — super_admin kept as English by product decision (2026-04-21)
  roles: {
    super_admin: 'Super Admin',
    admin: 'Quản trị viên',
    manager: 'Quản lý',
    supervisor: 'Giám sát viên',
    qa: 'QA',
    leader: 'Trưởng nhóm',
    agent: 'Nhân viên',
    agent_telesale: 'Nhân viên Telesale',
    agent_collection: 'Nhân viên Thu nợ',
  },

  // FreeSWITCH hangup causes → Vietnamese (single source of truth; used by tables, charts, exports)
  hangupCause: {
    NORMAL_CLEARING: 'Thành công',
    ORIGINATOR_CANCEL: 'Hủy',
    NO_ANSWER: 'Không trả lời',
    USER_BUSY: 'Máy bận',
    CALL_REJECTED: 'Từ chối cuộc gọi',
    UNALLOCATED_NUMBER: 'Số không tồn tại',
    NO_ROUTE_DESTINATION: 'Không tìm thấy đích',
    RECOVERY_ON_TIMER_EXPIRE: 'Hết thời gian',
    SUBSCRIBER_ABSENT: 'Thuê bao không liên lạc được',
    NORMAL_TEMPORARY_FAILURE: 'Lỗi tạm thời',
    NORMAL_UNSPECIFIED: 'Bình thường',
    DESTINATION_OUT_OF_ORDER: 'Đích không khả dụng',
    NETWORK_OUT_OF_ORDER: 'Mạng không khả dụng',
    SWITCH_CONGESTION: 'Tổng đài nghẽn',
    REQUESTED_CHAN_UNAVAIL: 'Kênh không khả dụng',
    EXCHANGE_ROUTING_ERROR: 'Lỗi định tuyến',
    SERVICE_UNAVAILABLE: 'Dịch vụ không khả dụng',
    INVALID_NUMBER_FORMAT: 'Số sai định dạng',
    INCOMPATIBLE_DESTINATION: 'Đích không tương thích',
    MEDIA_TIMEOUT: 'Hết thời gian media',
    ALLOTTED_TIMEOUT: 'Hết thời gian cho phép',
    BEARERCAPABILITY_NOTAVAIL: 'Dung lượng mang không sẵn',
    LOSE_RACE: 'Cuộc gọi khác nhấc trước',
  } as Record<string, string>,

  // SIP reason phrases commonly returned by proxies/carriers → Vietnamese
  sipReason: {
    Answer: 'Nghe máy',
    OK: 'Thành công',
    Ringing: 'Đang đổ chuông',
    'Session Progress': 'Đang xử lý',
    Voicemail: 'Hộp thư thoại',
    Busy: 'Máy bận',
    'Busy Here': 'Máy bận',
    'Temporarily Unavailable': 'Tạm thời không liên lạc được',
    'Not Found': 'Không tìm thấy số',
    Forbidden: 'Bị chặn',
    Unauthorized: 'Chưa xác thực',
    'Request Timeout': 'Hết thời gian',
    'Request Terminated': 'Cuộc gọi bị hủy',
    'Call/Transaction Does Not Exist': 'Cuộc gọi không tồn tại',
    'Service Unavailable': 'Dịch vụ không khả dụng',
    'Internal Server Error': 'Lỗi tổng đài',
    Decline: 'Từ chối',
    'Address Incomplete': 'Số không đầy đủ',
  } as Record<string, string>,

  // Call direction → Vietnamese (mirrors callLog.inbound/outbound for compact usage)
  direction: {
    inbound: 'Gọi vào',
    outbound: 'Gọi ra',
  } as Record<string, string>,
} as const;
