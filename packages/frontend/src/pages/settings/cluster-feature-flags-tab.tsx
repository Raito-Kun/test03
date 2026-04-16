import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Save, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api from '@/services/api-client';
import { FEATURE_FLAG_MODULES, ALL_FEATURE_KEYS } from '@/lib/feature-flags';

interface FlagRow {
  featureKey: string;
  isEnabled: boolean;
}

interface FlagsResponse {
  flags: { featureKey: string; isEnabled: boolean; domainName: string }[];
  domains: string[];
}

interface Props {
  clusterId: string;
}

export default function ClusterFeatureFlagsTab({ clusterId }: Props) {
  const queryClient = useQueryClient();
  const [activeScope, setActiveScope] = useState('cluster');
  const [addingDomain, setAddingDomain] = useState(false);
  const [newDomain, setNewDomain] = useState('');

  const { data, isLoading } = useQuery<FlagsResponse>({
    queryKey: ['feature-flags', clusterId],
    queryFn: () => api.get(`/feature-flags?clusterId=${clusterId}`).then((r) => r.data.data),
    enabled: !!clusterId,
  });

  // Local state for toggles (per scope)
  const [localFlags, setLocalFlags] = useState<Record<string, Record<string, boolean>>>({});

  // Domains: cluster-level ("cluster") + discovered domains
  const domains = useMemo(() => data?.domains ?? [], [data]);

  // Build initial state from API data
  useEffect(() => {
    if (!data) return;
    const state: Record<string, Record<string, boolean>> = {};

    // Cluster-level (domainName="")
    const clusterMap: Record<string, boolean> = {};
    for (const key of ALL_FEATURE_KEYS) clusterMap[key] = true; // default ON
    data.flags.filter((f) => f.domainName === '').forEach((f) => { clusterMap[f.featureKey] = f.isEnabled; });
    state['cluster'] = clusterMap;

    // Per-domain
    for (const domain of data.domains) {
      const domainMap: Record<string, boolean> = {};
      for (const key of ALL_FEATURE_KEYS) domainMap[key] = true;
      data.flags.filter((f) => f.domainName === domain).forEach((f) => { domainMap[f.featureKey] = f.isEnabled; });
      state[domain] = domainMap;
    }

    setLocalFlags(state);
  }, [data]);

  function toggleFlag(scope: string, featureKey: string) {
    setLocalFlags((prev) => ({
      ...prev,
      [scope]: { ...prev[scope], [featureKey]: !prev[scope]?.[featureKey] },
    }));
  }

  function handleAddDomain() {
    const d = newDomain.trim();
    if (!d) return;
    if (domains.includes(d) || d === 'cluster') {
      toast.error('Domain đã tồn tại');
      return;
    }
    // Init default flags for new domain
    const domainMap: Record<string, boolean> = {};
    for (const key of ALL_FEATURE_KEYS) domainMap[key] = true;
    setLocalFlags((prev) => ({ ...prev, [d]: domainMap }));
    setAddingDomain(false);
    setNewDomain('');
    setActiveScope(d);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const scopes = Object.entries(localFlags);
      for (const [scope, flags] of scopes) {
        const domainName = scope === 'cluster' ? '' : scope;
        const flagList = Object.entries(flags).map(([featureKey, isEnabled]) => ({ featureKey, isEnabled }));
        await api.put('/feature-flags', { clusterId, domainName, flags: flagList });
      }
    },
    onSuccess: () => {
      toast.success('Đã lưu cấu hình tính năng');
      queryClient.invalidateQueries({ queryKey: ['feature-flags', clusterId] });
      queryClient.invalidateQueries({ queryKey: ['effective-flags'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Lưu thất bại');
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const scopeTabs = ['cluster', ...domains, ...Object.keys(localFlags).filter((k) => k !== 'cluster' && !domains.includes(k))];
  const uniqueTabs = [...new Set(scopeTabs)];
  const currentFlags = localFlags[activeScope] ?? {};

  // Check if cluster-level disables a feature (for domain tabs: show override indicator)
  const clusterFlags = localFlags['cluster'] ?? {};

  return (
    <div className="space-y-4">
      <Tabs value={activeScope} onValueChange={setActiveScope}>
        <div className="flex items-center gap-2">
          <TabsList className="flex-1 justify-start h-auto flex-wrap">
            {uniqueTabs.map((scope) => (
              <TabsTrigger key={scope} value={scope} className="text-xs">
                {scope === 'cluster' ? 'Toàn cụm' : scope}
              </TabsTrigger>
            ))}
          </TabsList>
          {!addingDomain ? (
            <Button variant="ghost" size="sm" onClick={() => setAddingDomain(true)} className="shrink-0">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Domain
            </Button>
          ) : (
            <div className="flex items-center gap-1">
              <Input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="domain_name"
                className="h-8 w-40 text-xs"
                onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                autoFocus
              />
              <Button size="sm" variant="outline" onClick={handleAddDomain} className="h-8 text-xs">Thêm</Button>
              <Button size="sm" variant="ghost" onClick={() => { setAddingDomain(false); setNewDomain(''); }} className="h-8 text-xs">Hủy</Button>
            </div>
          )}
        </div>

        {uniqueTabs.map((scope) => (
          <TabsContent key={scope} value={scope} className="mt-3">
            <FeatureFlagGrid
              flags={localFlags[scope] ?? {}}
              onToggle={(key) => toggleFlag(scope, key)}
              clusterFlags={scope !== 'cluster' ? clusterFlags : undefined}
            />
          </TabsContent>
        ))}
      </Tabs>

      <div className="flex justify-end pt-2 border-t">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Lưu thay đổi
        </Button>
      </div>
    </div>
  );
}

/** Renders the toggle grid grouped by module */
function FeatureFlagGrid({
  flags,
  onToggle,
  clusterFlags,
}: {
  flags: Record<string, boolean>;
  onToggle: (key: string) => void;
  clusterFlags?: Record<string, boolean>;
}) {
  return (
    <div className="space-y-4">
      {FEATURE_FLAG_MODULES.map((mod) => (
        <div key={mod.name} className="border rounded-lg overflow-hidden">
          <div className="bg-muted px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {mod.name}
          </div>
          <div className="divide-y">
            {mod.features.map((feat) => {
              const enabled = flags[feat.key] ?? true;
              const clusterDisabled = clusterFlags && clusterFlags[feat.key] === false;
              return (
                <div
                  key={feat.key}
                  className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{feat.label}</span>
                    {clusterDisabled && (
                      <span className="text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
                        Cụm đã tắt
                      </span>
                    )}
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={() => onToggle(feat.key)}
                    disabled={clusterDisabled}
                    className="data-[state=checked]:bg-blue-500"
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
