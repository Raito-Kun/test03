import Anthropic from '@anthropic-ai/sdk';
import logger from '../lib/logger';
import * as prompts from '../lib/ai-prompts';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

const MODEL = 'claude-sonnet-4-20250514';

/** Chat with AI assistant — returns streaming response */
export async function* chatStream(context: string, message: string): AsyncGenerator<string> {
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system: prompts.SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompts.chatPrompt(context, message) }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  } catch (err) {
    logger.error('AI chat error', { error: (err as Error).message });
    yield 'Xin lỗi, AI tạm thời không khả dụng.';
  }
}

/** Generate customer 360 summary */
export async function summarizeCustomer(customerData: string): Promise<string> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: prompts.SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompts.summaryPrompt(customerData) }],
    });

    const block = response.content[0];
    return block.type === 'text' ? block.text : '';
  } catch (err) {
    logger.error('AI summary error', { error: (err as Error).message });
    return 'Không thể tạo tóm tắt.';
  }
}

/** Score a lead with AI */
export async function scoreLead(leadData: string): Promise<{ score: number; reason: string }> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 256,
      system: prompts.SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompts.leadScorePrompt(leadData) }],
    });

    const block = response.content[0];
    const text = block.type === 'text' ? block.text : '{}';
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { score: 50, reason: 'Không thể phân tích' };
  } catch (err) {
    logger.error('AI lead score error', { error: (err as Error).message });
    return { score: 50, reason: 'AI tạm không khả dụng' };
  }
}

/** Suggest disposition after call */
export async function suggestDisposition(callData: string): Promise<{ disposition: string; confidence: number; reason: string }> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 256,
      system: prompts.SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompts.dispositionPrompt(callData) }],
    });

    const block = response.content[0];
    const text = block.type === 'text' ? block.text : '{}';
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { disposition: '', confidence: 0, reason: '' };
  } catch (err) {
    logger.error('AI disposition error', { error: (err as Error).message });
    return { disposition: '', confidence: 0, reason: 'AI tạm không khả dụng' };
  }
}

/** Get coaching suggestions during call */
export async function getCoachingSuggestion(callContext: string): Promise<string> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 256,
      system: prompts.SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompts.coachingPrompt(callContext) }],
    });

    const block = response.content[0];
    return block.type === 'text' ? block.text : '';
  } catch (err) {
    logger.error('AI coaching error', { error: (err as Error).message });
    return '';
  }
}

/** Detect anomalies in agent performance */
export async function detectAnomalies(metricsData: string): Promise<Array<{ type: string; description: string; severity: string }>> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: prompts.SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompts.anomalyPrompt(metricsData) }],
    });

    const block = response.content[0];
    const text = block.type === 'text' ? block.text : '[]';
    const match = text.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch (err) {
    logger.error('AI anomaly error', { error: (err as Error).message });
    return [];
  }
}
