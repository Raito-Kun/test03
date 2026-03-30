import { useQuery, useMutation } from '@tanstack/react-query';
import { Phone, PhoneCall, Headphones, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { PageWrapper } from '@/components/page-wrapper';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import api from '@/services/api-client';

interface AgentMonitor {
  id: string;
  fullName: string;
  extension: string;
  registered: boolean;
  status: string;
  teamName: string | null;
}

interface ActiveCall {
  uuid: string;
  callerNumber: string;
  destNumber: string;
  duration: number;
  agentExtension: string;
  agentName: string;
  direction: string;
}

function formatSec(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const STATUS_COLORS: Record<string, string> = {
  online: 'bg-green-500',
  on_call: 'bg-red-500',
  break: 'bg-yellow-500',
  offline: 'bg-gray-400',
};

const STATUS_LABELS: Record<string, string> = {
  online: 'Sẵn sàng',
  on_call: 'Đang gọi',
  break: 'Tạm nghỉ',
  offline: 'Ngoại tuyến',
};

export default function LiveDashboardPage() {
  const { data: agents, refetch: refetchAgents } = useQuery({
    queryKey: ['monitoring-agents'],
    queryFn: async () => {
      const { data: resp } = await api.get('/monitoring/agents');
      return resp.data as AgentMonitor[];
    },
    refetchInterval: 5000,
  });

  const { data: calls, refetch: refetchCalls } = useQuery({
    queryKey: ['monitoring-calls'],
    queryFn: async () => {
      const { data: resp } = await api.get('/monitoring/active-calls');
      return resp.data as ActiveCall[];
    },
    refetchInterval: 3000,
  });

  const whisperMutation = useMutation({
    mutationFn: async (callUuid: string) => {
      await api.post('/monitoring/whisper', { callUuid });
    },
    onSuccess: () => toast.success('Đã bắt đầu nghe thầm'),
    onError: (err: Error) => toast.error(`Lỗi: ${err.message}`),
  });

  const online = agents?.filter((a) => a.registered).length || 0;
  const total = agents?.length || 0;
  const activeCalls = calls?.length || 0;

  const refreshButton = (
    <Button variant="outline" size="icon" onClick={() => { refetchAgents(); refetchCalls(); }}>
      <RefreshCw className="h-4 w-4" />
    </Button>
  );

  return (
    <PageWrapper title="Giám sát trực tiếp" actions={refreshButton}>
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Nhân viên online</p>
          <p className="text-2xl font-bold">{online} <span className="text-sm font-normal text-muted-foreground">/ {total}</span></p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Cuộc gọi đang diễn ra</p>
          <p className="text-2xl font-bold">{activeCalls}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Tỷ lệ online</p>
          <p className="text-2xl font-bold">{total > 0 ? Math.round((online / total) * 100) : 0}%</p>
        </div>
      </div>

      {/* Agent grid */}
      <h3 className="font-medium mb-3">Trạng thái nhân viên</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        {agents?.map((a) => (
          <div key={a.id} className="border rounded-lg p-3 text-center">
            <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${STATUS_COLORS[a.status] || STATUS_COLORS.offline}`} />
            <p className="text-sm font-medium truncate">{a.fullName}</p>
            <p className="text-xs text-muted-foreground">{a.extension}</p>
            <Badge variant="secondary" className="text-xs mt-1">
              {STATUS_LABELS[a.status] || a.status}
            </Badge>
            {a.teamName && <p className="text-xs text-muted-foreground mt-1">{a.teamName}</p>}
          </div>
        ))}
      </div>

      {/* Active calls table */}
      <h3 className="font-medium mb-3">Cuộc gọi đang diễn ra</h3>
      {activeCalls === 0 ? (
        <p className="text-muted-foreground text-sm">Không có cuộc gọi nào</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">Nhân viên</th>
                <th className="text-left p-3">Số gọi</th>
                <th className="text-left p-3">Số nhận</th>
                <th className="text-left p-3">Hướng</th>
                <th className="text-left p-3">Thời lượng</th>
                <th className="text-left p-3">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {calls?.map((c) => (
                <tr key={c.uuid} className="border-t">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <PhoneCall className="h-4 w-4 text-red-500 animate-pulse" />
                      {c.agentName || c.agentExtension}
                    </div>
                  </td>
                  <td className="p-3">{c.callerNumber}</td>
                  <td className="p-3">{c.destNumber}</td>
                  <td className="p-3">
                    <Badge variant={c.direction === 'inbound' ? 'default' : 'secondary'}>
                      {c.direction === 'inbound' ? 'Gọi vào' : 'Gọi ra'}
                    </Badge>
                  </td>
                  <td className="p-3 font-mono">{formatSec(c.duration)}</td>
                  <td className="p-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => whisperMutation.mutate(c.uuid)}
                      disabled={whisperMutation.isPending}
                      title="Nghe thầm"
                    >
                      <Headphones className="h-4 w-4 mr-1" />
                      Whisper
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageWrapper>
  );
}
