import { Router, Request, Response } from 'express';

const router = Router();

const ALLOWED_TYPES = ['contacts', 'leads', 'campaigns', 'debt-cases'] as const;
type TemplateType = typeof ALLOWED_TYPES[number];

const TEMPLATES: Record<TemplateType, { header: string; example: string }> = {
  contacts: {
    header: 'fullName (*required),phone (*required),phoneAlt,email,gender,dateOfBirth (YYYY-MM-DD hoặc D/M/YYYY),idNumber (CCCD),occupation,income,province,district,fullAddress,company,jobTitle,companyEmail,bankName,bankAccount,creditLimit,source,tags,notes,internalNotes',
    example: 'Nguyễn Văn A,0901234567,0987654321,vana@email.com,male,1990-05-15,012345678901,Kế toán,15000000,Hồ Chí Minh,Quận 1,123 Nguyễn Huệ,Công ty ABC,Trưởng phòng,vana@congtyabc.com,Vietcombank,1234567890,50000000,website,vip,Khách tiềm năng,Ghi chú nội bộ',
  },
  leads: {
    header: 'contactPhone (*required),contactName (*required),status,source,value,leadScore,product,budget,notes',
    example: '0901234567,Nguyễn Văn A,new,website,5000000,85,Gói Bảo hiểm Nhân thọ,20000000,Quan tâm sản phẩm bảo hiểm',
  },
  campaigns: {
    header: 'name (*required),type (*required: telesale|collection),startDate (YYYY-MM-DD),endDate (YYYY-MM-DD),description',
    example: 'Chiến dịch Q2 2026,telesale,2026-04-01,2026-06-30,Gọi khách hàng mới tháng 4-6',
  },
  'debt-cases': {
    header: 'contactPhone (*required),contactName (*required),totalDebt (*required),paidAmount,remainingAmount,dpd,debtGroup,contractNumber,debtType,dueDate (YYYY-MM-DD),status,notes',
    example: '0901234567,Nguyễn Văn A,25000000,5000000,20000000,45,2,HD2026001,Vay tiêu dùng,2026-12-31,active,Hẹn trả cuối tháng',
  },
};

/** GET /api/v1/templates/:type — download CSV template (no auth required) */
router.get('/:type', (req: Request, res: Response): void => {
  const type = req.params['type'] as string;

  if (!ALLOWED_TYPES.includes(type as TemplateType)) {
    res.status(404).json({ success: false, error: { message: 'Template not found' } });
    return;
  }

  const tpl = TEMPLATES[type as TemplateType];
  const csv = `${tpl.header}\n${tpl.example}\n`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${type}-template.csv"`);
  // UTF-8 BOM so Excel opens Vietnamese text correctly
  res.send('\uFEFF' + csv);
});

export default router;
