import api from './api-client';
import { getAccessToken } from './api-client';

const BASE = '/ai';

/** Stream AI chat response via SSE */
export async function* chatStream(context: string, message: string): AsyncGenerator<string> {
  const response = await fetch(`/api/v1${BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({ context, message }),
  });

  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          if (parsed.text) yield parsed.text;
        } catch { /* skip invalid JSON */ }
      }
    }
  }
}

/** Get customer 360 summary */
export async function summarizeCustomer(customerData: string): Promise<string> {
  const { data } = await api.post(`${BASE}/summarize`, { customerData });
  return data.data.summary;
}

/** Get AI lead score */
export async function scoreLead(leadData: string): Promise<{ score: number; reason: string }> {
  const { data } = await api.post(`${BASE}/score-lead`, { leadData });
  return data.data;
}

/** Get disposition suggestion */
export async function suggestDisposition(callData: string): Promise<{ disposition: string; confidence: number; reason: string }> {
  const { data } = await api.post(`${BASE}/suggest-disposition`, { callData });
  return data.data;
}

/** Get coaching suggestion */
export async function getCoaching(callContext: string): Promise<string> {
  const { data } = await api.post(`${BASE}/coaching`, { callContext });
  return data.data.suggestion;
}

/** Get anomaly alerts */
export async function getAnomalies(): Promise<Array<{ type: string; description: string; severity: string }>> {
  const { data } = await api.get(`${BASE}/anomalies`);
  return data.data;
}
