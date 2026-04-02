import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Trash2, RefreshCw, ArrowRightLeft } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import api from '@/services/api-client';

export interface ClusterFormData {
  id?: string;
  name: string;
  eslHost: string;
  eslPort: number;
  eslPassword: string;
  sipDomain: string;
  sipWssUrl: string;
  pbxIp: string;
  gatewayName: string;
  recordingPath: string;
  recordingUrlPrefix: string;
  cdrReportUrl: string;
  aiApiEndpoint: string;
  aiApiKey: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
  isActive: boolean;
}

interface Props {
  cluster: ClusterFormData;
  onChange: (data: ClusterFormData) => void;
  onSaved: () => void;
  onDeleted: () => void;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}{required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {children}
    </div>
  );
}

export default function ClusterDetailForm({ cluster, onChange, onSaved, onDeleted }: Props) {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const isNew = !cluster.id;

  function update<K extends keyof ClusterFormData>(key: K, value: ClusterFormData[K]) {
    onChange({ ...cluster, [key]: value });
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      isNew
        ? api.post('/clusters', cluster).then((r) => r.data.data)
        : api.put(`/clusters/${cluster.id}`, cluster).then((r) => r.data.data),
    onSuccess: () => {
      toast.success('Đã lưu cấu hình cụm');
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      onSaved();
    },
    onError: () => toast.error('Lưu thất bại'),
  });

  const testMutation = useMutation({
    mutationFn: () => api.post(`/clusters/${cluster.id}/test-connection`).then((r) => r.data),
    onSuccess: (data) => toast.success(data.message ?? 'Kết nối thành công'),
    onError: () => toast.error('Kết nối thất bại'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/clusters/${cluster.id}`),
    onSuccess: () => {
      toast.success('Đã xóa cụm');
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      setConfirmDelete(false);
      onDeleted();
    },
    onError: () => toast.error('Xóa thất bại'),
  });

  const switchMutation = useMutation({
    mutationFn: () => api.post(`/clusters/${cluster.id}/switch`),
    onSuccess: () => {
      toast.success('Đã chuyển sang cụm này');
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      setConfirmSwitch(false);
    },
    onError: () => toast.error('Chuyển cụm thất bại'),
  });

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="connection" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="connection">Kết nối tổng đài</TabsTrigger>
          <TabsTrigger value="recording">Ghi âm & CDR</TabsTrigger>
          <TabsTrigger value="ai-email">AI & Email</TabsTrigger>
          <TabsTrigger value="users">Người dùng</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="connection" className="space-y-4 mt-0">
            <Field label="Tên cụm" required>
              <Input value={cluster.name} onChange={(e) => update('name', e.target.value)} placeholder="VD: Cụm HN-01" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="IP tổng đài (ESL Host)" required>
                <Input value={cluster.eslHost} onChange={(e) => update('eslHost', e.target.value)} placeholder="192.168.1.10" />
              </Field>
              <Field label="ESL Port">
                <Input type="number" value={cluster.eslPort} onChange={(e) => update('eslPort', Number(e.target.value))} />
              </Field>
            </div>
            <Field label="ESL Password" required>
              <Input type="password" value={cluster.eslPassword} onChange={(e) => update('eslPassword', e.target.value)} />
            </Field>
            <Field label="PBX IP" required>
              <Input value={cluster.pbxIp} onChange={(e) => update('pbxIp', e.target.value)} placeholder="192.168.1.10" />
            </Field>
            <Field label="SIP Domain" required>
              <Input value={cluster.sipDomain} onChange={(e) => update('sipDomain', e.target.value)} placeholder="sip.example.com" />
            </Field>
            <Field label="SIP WebSocket URL">
              <Input value={cluster.sipWssUrl} onChange={(e) => update('sipWssUrl', e.target.value)} placeholder="wss://sip.example.com:7443" />
            </Field>
            <Field label="Gateway/Trunk name" required>
              <Input value={cluster.gatewayName} onChange={(e) => update('gatewayName', e.target.value)} placeholder="gateway_main" />
            </Field>
            {!isNew && (
              <Button variant="outline" size="sm" onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>
                {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Test kết nối
              </Button>
            )}
          </TabsContent>

          <TabsContent value="recording" className="space-y-4 mt-0">
            <Field label="Đường dẫn ghi âm">
              <Input value={cluster.recordingPath} onChange={(e) => update('recordingPath', e.target.value)} placeholder="/var/recordings" />
            </Field>
            <Field label="URL prefix ghi âm">
              <Input value={cluster.recordingUrlPrefix} onChange={(e) => update('recordingUrlPrefix', e.target.value)} placeholder="https://cdn.example.com/recordings" />
            </Field>
            <Field label="CDR Report URL">
              <Input value={cluster.cdrReportUrl} onChange={(e) => update('cdrReportUrl', e.target.value)} placeholder="https://cdr.example.com/api" />
            </Field>
          </TabsContent>

          <TabsContent value="ai-email" className="space-y-4 mt-0">
            <Field label="AI API Endpoint">
              <Input value={cluster.aiApiEndpoint} onChange={(e) => update('aiApiEndpoint', e.target.value)} placeholder="https://api.openai.com/v1" />
            </Field>
            <Field label="AI API Key">
              <Input type="password" value={cluster.aiApiKey} onChange={(e) => update('aiApiKey', e.target.value)} placeholder="sk-..." />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="SMTP Host">
                <Input value={cluster.smtpHost} onChange={(e) => update('smtpHost', e.target.value)} placeholder="smtp.gmail.com" />
              </Field>
              <Field label="SMTP Port">
                <Input type="number" value={cluster.smtpPort} onChange={(e) => update('smtpPort', Number(e.target.value))} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="SMTP User">
                <Input value={cluster.smtpUser} onChange={(e) => update('smtpUser', e.target.value)} />
              </Field>
              <Field label="SMTP Password">
                <Input type="password" value={cluster.smtpPassword} onChange={(e) => update('smtpPassword', e.target.value)} />
              </Field>
            </div>
            <Field label="Email gửi báo cáo">
              <Input type="email" value={cluster.smtpFrom} onChange={(e) => update('smtpFrom', e.target.value)} placeholder="report@example.com" />
            </Field>
          </TabsContent>

          <TabsContent value="users" className="mt-0">
            <div className="flex flex-col items-center justify-center h-32 gap-3 text-muted-foreground border rounded-lg">
              <p className="text-sm">Quản lý người dùng cụm này đang phát triển</p>
              <Button variant="outline" size="sm" onClick={() => toast.info('Tính năng đang phát triển')}>
                Tạo users mặc định
              </Button>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t mt-4">
        <div className="flex gap-2">
          {!isNew && !cluster.isActive && (
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Xóa cụm
            </Button>
          )}
          {!isNew && !cluster.isActive && (
            <Button variant="outline" size="sm" onClick={() => setConfirmSwitch(true)}>
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Chuyển sang cụm này
            </Button>
          )}
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Lưu
        </Button>
      </div>

      {/* Delete confirm */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader><DialogTitle>Xác nhận xóa cụm</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Bạn có chắc muốn xóa cụm <strong>{cluster.name}</strong>? Hành động này không thể hoàn tác.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Hủy</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Switch confirm */}
      <Dialog open={confirmSwitch} onOpenChange={setConfirmSwitch}>
        <DialogContent>
          <DialogHeader><DialogTitle>Chuyển sang cụm</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Chuyển hoạt động sang cụm <strong>{cluster.name}</strong>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSwitch(false)}>Hủy</Button>
            <Button onClick={() => switchMutation.mutate()} disabled={switchMutation.isPending}>
              {switchMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
