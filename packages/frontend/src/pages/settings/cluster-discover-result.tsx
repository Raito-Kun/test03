import { useState } from 'react';
import { ChevronDown, ChevronRight, FolderOpen, ArrowUpRight, ArrowDownLeft, Check } from 'lucide-react';

interface GatewayInfo { name: string; uuid: string; profile: string; sipUri: string; status: string; }
interface RouteInfo { name: string; number: string; }
interface DomainDetail { name: string; outboundRoutes: RouteInfo[]; inboundRoutes: RouteInfo[]; }
interface ProfileInfo { name: string; type: string; uri: string; }

export interface DiscoverData {
  eslHost: string;
  eslPort: number;
  eslPassword: string;
  pbxIp: string;
  domainDetails: DomainDetail[];
  gateways: GatewayInfo[];
  profiles: ProfileInfo[];
  sipWssUrl: string;
  version: string;
  domains?: string[];
}

interface Props {
  data: DiscoverData;
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

/** System routes to exclude from outbound display */
const SYSTEM_ROUTES = new Set([
  'call_direction-outbound', 'default_hold_music', 'domain-variables',
  'eavesdrop', 'group-intercept', 'intercept-ext', 'number_queue',
  'operator-forward', 'page-extension', 'recordings', 'ring-group-forward',
  'local_extension', 'CF', 'CF_registered', 'extension-intercom',
  'att_xfer', 'tone_stream',
]);

/** Filter out system routes, keep only custom business routes */
function filterOutbound(routes: RouteInfo[]): RouteInfo[] {
  return routes.filter((r) => !SYSTEM_ROUTES.has(r.name));
}

export default function ClusterDiscoverResult({ data, onApply }: Props) {
  const domainList = data.domainDetails?.length
    ? data.domainDetails
    : (data.domains || []).map((d) => ({ name: d, outboundRoutes: [], inboundRoutes: [] }));

  const [expandedDomain, setExpandedDomain] = useState<string | null>(domainList[0]?.name || null);
  const [selectedDomain, setSelectedDomain] = useState<string>(domainList[0]?.name || '');
  const [selectedOutbound, setSelectedOutbound] = useState<string>('');
  const [selectedInbound, setSelectedInbound] = useState<string>('');
  const [applied, setApplied] = useState(false);

  function handleApply() {
    onApply({
      eslHost: data.eslHost,
      eslPort: data.eslPort,
      eslPassword: data.eslPassword,
      pbxIp: data.pbxIp,
      sipDomain: selectedDomain,
      gatewayName: selectedOutbound || data.gateways[0]?.uuid || '',
      sipWssUrl: data.sipWssUrl,
    });
    setApplied(true);
  }

  return (
    <div className="border border-dashed border-border rounded-sm bg-card shadow-sm overflow-hidden animate-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <div className="px-4 py-3 bg-emerald-50/60 border-b border-dashed border-border">
        <p className="text-sm font-semibold text-emerald-800">
          Kết nối thành công — {data.version}
        </p>
        <p className="text-xs text-emerald-600 mt-0.5 font-mono">{data.eslHost}:{data.eslPort}</p>
      </div>

      {/* Domain tree */}
      <div className="p-3 space-y-1 max-h-80 overflow-y-auto">
        {domainList.map((domain) => {
          const isExpanded = expandedDomain === domain.name;
          const isDomainSelected = selectedDomain === domain.name;
          const outRoutes = filterOutbound(domain.outboundRoutes);

          return (
            <div key={domain.name} className="select-none">
              <button
                type="button"
                onClick={() => {
                  setExpandedDomain(isExpanded ? null : domain.name);
                  setSelectedDomain(domain.name);
                  // Auto-select first outbound/inbound if switching domain
                  if (domain.name !== selectedDomain) {
                    const firstOut = filterOutbound(domain.outboundRoutes)[0];
                    setSelectedOutbound(firstOut?.name || '');
                    setSelectedInbound(domain.inboundRoutes[0]?.number || domain.inboundRoutes[0]?.name || '');
                  }
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                  isDomainSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/60'
                }`}
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span className="font-medium truncate">{domain.name}</span>
                {isDomainSelected && <span className="ml-auto text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">đã chọn</span>}
              </button>

              {isExpanded && (
                <div className="ml-5 mt-1 space-y-2.5 border-l-2 border-muted pl-3 pb-1">
                  {/* Outbound Routes — selectable */}
                  {outRoutes.length > 0 && (
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                        <ArrowUpRight className="h-3 w-3" />
                        Outbound Routes
                      </p>
                      <div className="space-y-0.5">
                        {outRoutes.map((r) => (
                          <label
                            key={r.name}
                            className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                              selectedOutbound === r.name ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="outbound"
                              checked={selectedOutbound === r.name}
                              onChange={() => setSelectedOutbound(r.name)}
                              className="accent-violet-600"
                            />
                            <span className="font-medium">{r.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inbound Routes — selectable for reference */}
                  {domain.inboundRoutes.length > 0 && (
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                        <ArrowDownLeft className="h-3 w-3" />
                        Inbound Routes
                      </p>
                      <div className="space-y-0.5">
                        {domain.inboundRoutes.map((r) => (
                          <label
                            key={r.name + r.number}
                            className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                              selectedInbound === (r.number || r.name) ? 'bg-green-50 text-green-700' : 'hover:bg-muted/50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="inbound"
                              checked={selectedInbound === (r.number || r.name)}
                              onChange={() => setSelectedInbound(r.number || r.name)}
                              className="accent-green-600"
                            />
                            {r.number && <span className="font-mono font-medium">{r.number}</span>}
                            {r.number && <span className="text-muted-foreground">—</span>}
                            <span>{r.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {outRoutes.length === 0 && domain.inboundRoutes.length === 0 && (
                    <p className="text-xs text-muted-foreground py-1">Không có route nào</p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {domainList.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">Không tìm thấy domain nào</p>
        )}
      </div>

      {/* Apply bar */}
      <div className="px-4 py-3 border-t border-dashed border-border bg-muted/20 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground truncate">
          Domain: <span className="font-mono font-medium text-foreground">{selectedDomain || '—'}</span>
          {selectedOutbound && <>{' · '}Outbound: <span className="font-mono font-medium text-foreground">{selectedOutbound}</span></>}
          {selectedInbound && <>{' · '}Inbound: <span className="font-mono font-medium text-foreground">{selectedInbound}</span></>}
        </p>
        <button
          type="button"
          onClick={handleApply}
          disabled={!selectedDomain}
          className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white transition-colors disabled:opacity-50 shrink-0 ${applied ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-emerald-500 hover:bg-emerald-600'}`}
        >
          {applied ? <><Check className="h-3.5 w-3.5" /> Đã áp dụng</> : 'Áp dụng'}
        </button>
      </div>
    </div>
  );
}
