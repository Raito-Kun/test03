/** Vietnamese UI text constants — all labels, menus, buttons, placeholders */

export const VI = {
  // App
  appName: 'CRM PLS',

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
    contacts: 'Danh bạ',
    leads: 'Khách hàng tiềm năng',
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
    title: 'Danh bạ',
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
    title: 'Khách hàng tiềm năng',
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
    types: { telesale: 'Telesale', collection: 'Thu nợ' },
    statuses: { draft: 'Nháp', active: 'Hoạt động', paused: 'Tạm dừng', completed: 'Hoàn thành' },
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

  // Roles
  roles: {
    admin: 'Quản trị viên', manager: 'Quản lý', qa: 'QA',
    leader: 'Trưởng nhóm', agent_telesale: 'NV Telesale', agent_collection: 'NV Thu nợ',
  },
} as const;
