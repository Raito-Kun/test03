import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Terminal, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import api from '@/services/api-client';
import ClusterDiscoverResult, { type DiscoverData } from './cluster-discover-result';

interface Props {
  eslHost: string;
  onApply: (patch: {
    eslHost: string;
    eslPort: number;
    eslPassword: string;
    pbxIp: string;
    sipDomain: string;
    gatewayName: string;
    sipWssUrl: string;
  }) => void;
}

export default function ClusterSshDiscover({ eslHost, onApply }: Props) {
  const [sshHost, setSshHost] = useState(eslHost);
  const [sshPort, setSshPort] = useState(22);
  const [sshUser, setSshUser] = useState('root');
  const [sshPassword, setSshPassword] = useState('');
  const [result, setResult] = useState<DiscoverData | null>(null);

  const effectiveHost = sshHost || eslHost;

  const discoverMutation = useMutation({
    mutationFn: () =>
      api.post('/clusters/ssh-discover', {
        sshHost: effectiveHost,
        sshPort,
        sshUser,
        sshPassword,
      }).then((r) => r.data.data as DiscoverData),
    onSuccess: (data) => {
      setResult(data);
      toast.success('Lấy thông tin PBX thành công');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || 'Kết nối SSH thất bại';
      toast.error(msg);
    },
  });

  return (
    <div className="space-y-3">
      {/* SSH credentials form */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">SSH Host (IP FusionPBX)</Label>
          <Input value={effectiveHost} onChange={(e) => setSshHost(e.target.value)} placeholder="10.10.101.189" className="h-8 text-sm font-mono" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">SSH Port</Label>
          <Input type="number" value={sshPort} onChange={(e) => setSshPort(Number(e.target.value))} className="h-8 text-sm font-mono" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">SSH Username</Label>
          <Input value={sshUser} onChange={(e) => setSshUser(e.target.value)} className="h-8 text-sm font-mono" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">SSH Password</Label>
          <Input type="password" value={sshPassword} onChange={(e) => setSshPassword(e.target.value)} placeholder="••••••" className="h-8 text-sm font-mono" />
        </div>
      </div>

      <button
        type="button"
        onClick={() => { setResult(null); discoverMutation.mutate(); }}
        disabled={discoverMutation.isPending || !effectiveHost}
        className="w-full inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
      >
        {discoverMutation.isPending
          ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
          : <Terminal className="h-4 w-4 mr-2" />}
        {discoverMutation.isPending ? 'Đang kết nối...' : 'Kết nối & Lấy thông tin tự động'}
      </button>

      {/* Structured result panel */}
      {result && (
        <ClusterDiscoverResult data={result} onApply={onApply} />
      )}

      <p className="text-[10px] text-muted-foreground">
        Mật khẩu SSH chỉ dùng một lần để lấy thông tin, không được lưu lại.
      </p>
    </div>
  );
}
