import api from '@/services/api-client';

export async function deleteCallRecording(id: string) {
  return api.delete(`/call-logs/${id}/recording`);
}
