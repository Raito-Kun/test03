/** AI prompt templates for CRM agentic features */

export const SYSTEM_PROMPT = `Bạn là trợ lý AI của hệ thống CRM Omnichannel. Bạn hỗ trợ nhân viên telesale và thu nợ.
Trả lời bằng tiếng Việt, ngắn gọn, chuyên nghiệp. Dùng markdown cho format.`;

export function chatPrompt(context: string, question: string): string {
  return `Ngữ cảnh hiện tại: ${context}\n\nCâu hỏi: ${question}`;
}

export function summaryPrompt(customerData: string): string {
  return `Tóm tắt thông tin khách hàng 360° dưới đây thành 3-5 bullet points ngắn gọn cho nhân viên telesale/thu nợ.
Bao gồm: tình trạng liên hệ, lịch sử cuộc gọi gần đây, phiếu ghi mở, công nợ (nếu có).

Dữ liệu:
${customerData}`;
}

export function leadScorePrompt(leadData: string): string {
  return `Đánh giá lead dưới đây và cho điểm từ 0-100 (0=không tiềm năng, 100=rất tiềm năng).
Trả về JSON: {"score": number, "reason": "giải thích ngắn bằng tiếng Việt"}

Dữ liệu lead:
${leadData}`;
}

export function dispositionPrompt(callData: string): string {
  return `Dựa trên thông tin cuộc gọi dưới đây, đề xuất kết quả cuộc gọi (disposition) phù hợp nhất.
Trả về JSON: {"disposition": "mã disposition", "confidence": number, "reason": "giải thích ngắn"}

Thông tin cuộc gọi:
${callData}`;
}

export function coachingPrompt(callContext: string): string {
  return `Bạn đang hỗ trợ nhân viên trong cuộc gọi. Dựa trên ngữ cảnh, đưa ra 1-2 gợi ý ngắn gọn.
Ngữ cảnh: ${callContext}`;
}

export function anomalyPrompt(metricsData: string): string {
  return `Phân tích dữ liệu hiệu suất nhân viên và phát hiện bất thường.
Trả về JSON array: [{"type": "loại bất thường", "description": "mô tả", "severity": "low|medium|high"}]
Nếu không có bất thường, trả về mảng rỗng [].

Dữ liệu:
${metricsData}`;
}
