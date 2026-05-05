import { useState, useRef, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Trash2, RefreshCw, ArrowRightLeft, Save, X, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import api from '@/services/api-client';
import { FieldHelp } from './cluster-field-help';
import ClusterSshDiscover from './cluster-network-scan';
import ClusterDiscoverResult, { type DiscoverData } from './cluster-discover-result';
import ClusterFeatureFlagsTab from './cluster-feature-flags-tab';
import ClusterPreflightTab from './cluster-preflight-tab';
import ClusterDialplanPicker from './cluster-dialplan-picker';

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
  sshUser: string;
  sshPassword: string;
  fusionpbxPgHost: string;
  fusionpbxPgPort: number;
  fusionpbxPgUser: string;
  fusionpbxPgPassword: string;
  fusionpbxPgDatabase: string;
  outboundDialplanNames: string[];
  isActive: boolean;
}

export interface ClusterSyncInfo {
  status?: 'idle' | 'syncing' | 'done' | 'failed';
  error?: string | null;
  count?: number | null;
  finishedAt?: string | null;
}

interface Props {
  cluster: ClusterFormData;
  syncInfo?: ClusterSyncInfo;
  onChange: (data: ClusterFormData) => void;
  onSaved: () => void;
  onDeleted: () => void;
  onCancel: () => void;
}

function Field({ label, required, helpKey, error, children }: { label: string; required?: boolean; helpKey?: string; error?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className={`text-sm font-medium inline-flex items-center gap-1.5 ${error ? 'text-destructive' : ''}`}>
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
        {helpKey && <FieldHelp field={helpKey} />}
      </Label>
      {children}
    </div>
  );
}

export default function ClusterDetailForm({ cluster, syncInfo, onChange, onSaved, onDeleted, onCancel }: Props) {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const [testDiscoverData, setTestDiscoverData] = useState<DiscoverData | null>(null);
  const [activeTab, setActiveTab] = useState('connection');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const isNew = !cluster.id;

  // Track original values to detect unsaved changes
  const originalRef = useRef<string>(JSON.stringify(cluster));
  useEffect(() => {
    originalRef.current = JSON.stringify(cluster);
  }, [cluster.id]);

  const hasChanges = useMemo(
    () => JSON.stringify(cluster) !== originalRef.current,
    [cluster],
  );

  function update<K extends keyof ClusterFormData>(key: K, value: ClusterFormData[K]) {
    onChange({ ...cluster, [key]: value });
  }

  /** Validate required fields for create. Returns missing field labels or empty if valid. */
  function validateForSave(): string[] {
    // PUT (update) allows partial — no client-side required check
    if (!isNew) return [];
    const missing: string[] = [];
    if (!cluster.name.trim()) missing.push('Tên cụm');
    if (!cluster.eslHost.trim()) missing.push('IP tổng đài (ESL Host)');
    if (!cluster.eslPassword.trim()) missing.push('ESL Password');
    if (!cluster.sipDomain.trim()) missing.push('SIP Domain');
    if (!cluster.gatewayName.trim()) missing.push('Gateway/Trunk name');
    return missing;
  }

  function handleSave() {
    const missing = validateForSave();
    if (missing.length > 0) {
      setValidationErrors(missing);
      setActiveTab('connection'); // All required fields are on connection tab
      toast.error(`Vui lòng điền: ${missing.join(', ')}`);
      return;
    }
    setValidationErrors([]);
    saveMutation.mutate();
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      isNew
        ? api.post('/clusters', cluster).then((r) => r.data.data)
        : api.put(`/clusters/${cluster.id}`, cluster).then((r) => r.data.data),
    onSuccess: () => {
      toast.success('Đã lưu cấu hình cụm');
      originalRef.current = JSON.stringify(cluster);
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      onSaved();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || 'Lưu thất bại';
      toast.error(msg);
    },
  });

  const testMutation = useMutation({
    mutationFn: () => {
      // For saved clusters, use /:id/test-connection (reads real password from DB)
      if (cluster.id) {
        return api.post(`/clusters/${cluster.id}/test-connection`).then((r) => r.data);
      }
      // For new unsaved clusters, use direct test
      return api.post('/clusters/test-connection-direct', {
        eslHost: cluster.eslHost,
        eslPort: cluster.eslPort || 8021,
        eslPassword: cluster.eslPassword,
      }).then((r) => r.data);
    },
    onSuccess: (data) => {
      const info = data.data;
      if (info?.version) {
        // Build DiscoverData from ESL test response (no DB access → flat domains)
        setTestDiscoverData({
          eslHost: cluster.eslHost,
          eslPort: cluster.eslPort || 8021,
          eslPassword: cluster.eslPassword,
          pbxIp: cluster.pbxIp || cluster.eslHost,
          domainDetails: [],
          domains: info.domains || [],
          gateways: info.gateways || [],
          profiles: info.profiles || [],
          sipWssUrl: cluster.sipWssUrl || `wss://${cluster.eslHost}:7443`,
          version: info.version,
        });
        toast.success(info.message);
      } else {
        toast.success(data.message ?? 'Kết nối thành công');
      }
    },
    onError: (err: any) => {
      setTestDiscoverData(null);
      toast.error(err?.response?.data?.error?.message || 'Kết nối thất bại');
    },
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

  const syncMutation = useMutation({
    mutationFn: () => api.post(`/clusters/${cluster.id}/sync-extensions`).then((r) => r.data.data),
    onSuccess: (data) => {
      toast.success(`Đã sync ${data.count} extensions từ domain ${cluster.sipDomain}`);
      queryClient.invalidateQueries({ queryKey: ['cluster-extensions', cluster.id] });
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      queryClient.invalidateQueries({ queryKey: ['clusters', cluster.id] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || 'Sync thất bại';
      toast.error(msg);
      queryClient.invalidateQueries({ queryKey: ['clusters'] });
      queryClient.invalidateQueries({ queryKey: ['clusters', cluster.id] });
    },
  });

  const { data: extensions = [] } = useQuery<{ id: string; extension: string; callerName: string; accountcode: string }[]>({
    queryKey: ['cluster-extensions', cluster.id],
    queryFn: () => api.get(`/clusters/${cluster.id}/extensions`).then((r) => r.data.data ?? []),
    enabled: !!cluster.id,
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header with unsaved indicator */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">{isNew ? 'Tạo cụm mới' : cluster.name}</h3>
          {hasChanges && (
            <span className="inline-flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              Chưa lưu
            </span>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-7 mb-4 h-auto bg-transparent border-b border-dashed border-border rounded-none p-0 gap-0">
          <TabsTrigger value="connection" className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs py-2">
            Kết nối
            {validationErrors.length > 0 && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive" />
            )}
          </TabsTrigger>
          <TabsTrigger value="ssh" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs py-2">SSH & Ext</TabsTrigger>
          <TabsTrigger value="recording" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs py-2">Ghi âm & CDR</TabsTrigger>
          <TabsTrigger value="ai-email" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs py-2">AI & Email</TabsTrigger>
          <TabsTrigger value="preflight" disabled={isNew} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs py-2">Tiền kiểm</TabsTrigger>
          <TabsTrigger value="users" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs py-2">Người dùng</TabsTrigger>
          <TabsTrigger value="features" disabled={isNew} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs py-2">Tính năng</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="connection" className="space-y-4 mt-0">
            {validationErrors.length > 0 && (
              <div className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
                Vui lòng điền: {validationErrors.join(', ')}
              </div>
            )}
            <Field label="Tên cụm" required error={validationErrors.includes('Tên cụm')}>
              <Input value={cluster.name} onChange={(e) => { update('name', e.target.value); setValidationErrors([]); }} placeholder="VD: Cụm HN-01" className={validationErrors.includes('Tên cụm') ? 'border-destructive' : ''} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="IP tổng đài (ESL Host)" required helpKey="eslHost" error={validationErrors.includes('IP tổng đài (ESL Host)')}>
                <Input value={cluster.eslHost} onChange={(e) => { update('eslHost', e.target.value); setValidationErrors([]); }} placeholder="192.168.1.10" className={cn('font-mono', validationErrors.includes('IP tổng đài (ESL Host)') ? 'border-destructive' : '')} />
              </Field>
              <Field label="ESL Port" helpKey="eslPort">
                <Input type="number" value={cluster.eslPort} onChange={(e) => update('eslPort', Number(e.target.value))} className="font-mono" />
              </Field>
            </div>
            <Field label="ESL Password" required helpKey="eslPassword" error={validationErrors.includes('ESL Password')}>
              <Input type="password" value={cluster.eslPassword} onChange={(e) => { update('eslPassword', e.target.value); setValidationErrors([]); }} className={validationErrors.includes('ESL Password') ? 'border-destructive' : ''} />
            </Field>
            <Field label="PBX IP" helpKey="pbxIp">
              <Input value={cluster.pbxIp} onChange={(e) => update('pbxIp', e.target.value)} placeholder="192.168.1.10" className="font-mono" />
            </Field>
            <Field label="SIP Domain" required helpKey="sipDomain" error={validationErrors.includes('SIP Domain')}>
              <Input value={cluster.sipDomain} onChange={(e) => { update('sipDomain', e.target.value); setValidationErrors([]); }} placeholder="sip.example.com" className={cn('font-mono', validationErrors.includes('SIP Domain') ? 'border-destructive' : '')} />
            </Field>
            <Field label="SIP WebSocket URL" helpKey="sipWssUrl">
              <Input value={cluster.sipWssUrl} onChange={(e) => update('sipWssUrl', e.target.value)} placeholder="wss://sip.example.com:7443" className="font-mono" />
            </Field>
            <Field label="Gateway/Trunk name" required helpKey="gatewayName" error={validationErrors.includes('Gateway/Trunk name')}>
              <Input value={cluster.gatewayName} onChange={(e) => { update('gatewayName', e.target.value); setValidationErrors([]); }} placeholder="gateway_main" className={cn('font-mono', validationErrors.includes('Gateway/Trunk name') ? 'border-destructive' : '')} />
            </Field>

            {/* Test connection button */}
            <button
              type="button"
              onClick={() => { setTestDiscoverData(null); testMutation.mutate(); }}
              disabled={testMutation.isPending || !cluster.eslHost || !cluster.eslPassword}
              className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Test kết nối
            </button>

            {/* Test connection result panel */}
            {testDiscoverData && (
              <ClusterDiscoverResult
                data={testDiscoverData}
                onApply={(patch) => onChange({ ...cluster, ...patch })}
              />
            )}

            {/* SSH discovery section */}
            <div className="border-t border-dashed border-border pt-4 mt-2">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Kết nối SSH để tự động lấy thông tin:</p>
              <ClusterSshDiscover
                eslHost={cluster.eslHost}
                onApply={(patch) => onChange({ ...cluster, ...patch })}
              />
            </div>
          </TabsContent>

          <TabsContent value="ssh" className="space-y-4 mt-0">
            <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
              Cấu hình SSH để đồng bộ danh sách extension từ FusionPBX. Thông tin này được lưu bảo mật.
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="SSH User">
                <Input value={cluster.sshUser} onChange={(e) => update('sshUser', e.target.value)} placeholder="root" className="font-mono" />
              </Field>
              <Field label="SSH Password">
                <Input type="password" value={cluster.sshPassword} onChange={(e) => update('sshPassword', e.target.value)} placeholder="Mật khẩu SSH" className="font-mono" />
              </Field>
            </div>

            <div className="border-t border-dashed border-border pt-4">
              <p className="text-sm font-medium mb-1">FusionPBX Postgres (read-only)</p>
              <p className="text-xs text-muted-foreground mb-3">
                Dùng cho tab Tiền kiểm: kiểm tra domain, dialplan ghi âm, số extension. Tất cả query là SELECT. Để trống nếu không muốn dùng.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="PG Host">
                  <Input value={cluster.fusionpbxPgHost} onChange={(e) => update('fusionpbxPgHost', e.target.value)} placeholder="10.10.101.206" className="font-mono" />
                </Field>
                <Field label="PG Port">
                  <Input type="number" value={cluster.fusionpbxPgPort} onChange={(e) => update('fusionpbxPgPort', Number(e.target.value) || 5432)} placeholder="5432" className="font-mono" />
                </Field>
                <Field label="PG User">
                  <Input value={cluster.fusionpbxPgUser} onChange={(e) => update('fusionpbxPgUser', e.target.value)} placeholder="fusionpbx_readonly" className="font-mono" />
                </Field>
                <Field label="PG Password">
                  <Input type="password" value={cluster.fusionpbxPgPassword} onChange={(e) => update('fusionpbxPgPassword', e.target.value)} placeholder="••••••••" className="font-mono" />
                </Field>
                <Field label="PG Database">
                  <Input value={cluster.fusionpbxPgDatabase} onChange={(e) => update('fusionpbxPgDatabase', e.target.value)} placeholder="fusionpbx" className="font-mono" />
                </Field>
              </div>

              <ClusterDialplanPicker
                clusterId={cluster.id}
                selected={cluster.outboundDialplanNames}
                pgConfigured={!!cluster.fusionpbxPgHost && !!cluster.fusionpbxPgUser && !!cluster.fusionpbxPgDatabase}
                onChange={(next) => update('outboundDialplanNames', next)}
              />
            </div>

            {!isNew && cluster.id && (
              <div className="border-t border-dashed border-border pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Danh sách extension</p>
                    <p className="text-xs text-muted-foreground">{extensions.length} extensions đã sync</p>
                    {syncInfo?.status === 'syncing' && (
                      <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Đang sync từ PBX...
                      </p>
                    )}
                    {syncInfo?.status === 'failed' && syncInfo.error && (
                      <p className="text-xs text-destructive break-words max-w-md">
                        Lần sync trước lỗi: {syncInfo.error}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending || syncInfo?.status === 'syncing'}
                  >
                    {(syncMutation.isPending || syncInfo?.status === 'syncing') ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
                    Sync extensions
                  </Button>
                </div>
                {extensions.length > 0 && (
                  <div className="border rounded-md overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Extension</th>
                          <th className="text-left px-3 py-2 font-medium">Tên</th>
                          <th className="text-left px-3 py-2 font-medium">Accountcode</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {extensions.map((ext) => (
                          <tr key={ext.id} className="hover:bg-muted/50">
                            <td className="px-3 py-1.5 font-mono">{ext.extension}</td>
                            <td className="px-3 py-1.5">{ext.callerName || '-'}</td>
                            <td className="px-3 py-1.5 text-muted-foreground">{ext.accountcode || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="recording" className="space-y-4 mt-0">
            <Field label="Đường dẫn ghi âm" helpKey="recordingPath">
              <Input value={cluster.recordingPath} onChange={(e) => update('recordingPath', e.target.value)} placeholder="/var/recordings" className="font-mono" />
            </Field>
            <Field label="URL prefix ghi âm">
              <Input value={cluster.recordingUrlPrefix} onChange={(e) => update('recordingUrlPrefix', e.target.value)} placeholder="https://cdn.example.com/recordings" className="font-mono" />
            </Field>
            <div className="border-t border-dashed border-border pt-2" />
            <Field label="CDR Report URL" helpKey="cdrReportUrl">
              <Input value={cluster.cdrReportUrl} onChange={(e) => update('cdrReportUrl', e.target.value)} placeholder="https://cdr.example.com/api" className="font-mono" />
            </Field>
          </TabsContent>

          <TabsContent value="ai-email" className="space-y-4 mt-0">
            <Field label="AI API Endpoint">
              <Input value={cluster.aiApiEndpoint} onChange={(e) => update('aiApiEndpoint', e.target.value)} placeholder="https://api.openai.com/v1" className="font-mono" />
            </Field>
            <Field label="AI API Key">
              <Input type="password" value={cluster.aiApiKey} onChange={(e) => update('aiApiKey', e.target.value)} placeholder="sk-..." className="font-mono" />
            </Field>
            <div className="border-t border-dashed border-border pt-2" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="SMTP Host">
                <Input value={cluster.smtpHost} onChange={(e) => update('smtpHost', e.target.value)} placeholder="smtp.gmail.com" className="font-mono" />
              </Field>
              <Field label="SMTP Port">
                <Input type="number" value={cluster.smtpPort} onChange={(e) => update('smtpPort', Number(e.target.value))} className="font-mono" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="SMTP User">
                <Input value={cluster.smtpUser} onChange={(e) => update('smtpUser', e.target.value)} className="font-mono" />
              </Field>
              <Field label="SMTP Password">
                <Input type="password" value={cluster.smtpPassword} onChange={(e) => update('smtpPassword', e.target.value)} className="font-mono" />
              </Field>
            </div>
            <Field label="Email gửi báo cáo">
              <Input type="email" value={cluster.smtpFrom} onChange={(e) => update('smtpFrom', e.target.value)} placeholder="report@example.com" className="font-mono" />
            </Field>
          </TabsContent>

          <TabsContent value="preflight" className="mt-0">
            <ClusterPreflightTab clusterId={cluster.id} />
          </TabsContent>

          <TabsContent value="users" className="mt-0">
            <div className="flex flex-col items-center justify-center h-32 gap-3 text-muted-foreground border rounded-lg">
              <p className="text-sm">Quản lý tài khoản người dùng của cụm này</p>
              {!isNew && cluster.id && (
                <a
                  href={`/settings/accounts?clusterId=${cluster.id}`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Đi đến trang Quản lý tài khoản →
                </a>
              )}
            </div>
          </TabsContent>

          <TabsContent value="features" className="mt-0">
            {cluster.id ? (
              <ClusterFeatureFlagsTab clusterId={cluster.id} />
            ) : (
              <div className="text-sm text-muted-foreground text-center py-8">
                Lưu cụm trước khi cấu hình tính năng
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-dashed border-border mt-4">
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" />
            Hủy
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-primary hover:bg-primary/90">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Lưu thay đổi
          </Button>
        </div>
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
