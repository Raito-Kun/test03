import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2, Users, Target, Landmark, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api-client';

interface SearchResult {
  type: 'contact' | 'lead' | 'debt_case' | 'ticket';
  id: string;
  title: string;
  subtitle: string;
}

const TYPE_CONFIG = {
  contact: { icon: Users, label: 'Liên hệ', path: '/contacts' },
  lead: { icon: Target, label: 'Lead', path: '/leads' },
  debt_case: { icon: Landmark, label: 'Công nợ', path: '/debt-cases' },
  ticket: { icon: FileText, label: 'Phiếu ghi', path: '/tickets' },
};

interface AiSearchBarProps {
  open: boolean;
  onClose: () => void;
}

export function AiSearchBar({ open, onClose }: AiSearchBarProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const { data: results, isLoading } = useQuery({
    queryKey: ['ai-search', query],
    queryFn: async () => {
      if (query.length < 2) return [];
      const responses = await Promise.allSettled([
        api.get('/contacts', { params: { search: query, limit: 3 } }),
        api.get('/leads', { params: { search: query, limit: 3 } }),
        api.get('/tickets', { params: { search: query, limit: 3 } }),
      ]);

      const results: SearchResult[] = [];
      const [contacts, leads, tickets] = responses;

      if (contacts.status === 'fulfilled') {
        (contacts.value.data.data?.items ?? contacts.value.data.data ?? []).slice(0, 3).forEach((c: Record<string, string>) => {
          results.push({ type: 'contact', id: c.id, title: c.fullName, subtitle: c.phone || '' });
        });
      }
      if (leads.status === 'fulfilled') {
        (leads.value.data.data?.items ?? leads.value.data.data ?? []).slice(0, 3).forEach((l: Record<string, string | Record<string, string>>) => {
          results.push({ type: 'lead', id: l.id as string, title: (l.contact as Record<string, string>)?.fullName || 'Lead', subtitle: l.status as string });
        });
      }
      if (tickets.status === 'fulfilled') {
        (tickets.value.data.data?.items ?? tickets.value.data.data ?? []).slice(0, 3).forEach((t: Record<string, string>) => {
          results.push({ type: 'ticket', id: t.id, title: t.contactName || 'Ticket', subtitle: t.category || '' });
        });
      }
      return results;
    },
    enabled: query.length >= 2,
    staleTime: 10_000,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm liên hệ, lead, phiếu ghi..."
            className="flex-1 text-sm outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 px-4 py-6 justify-center text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tìm kiếm...
          </div>
        )}

        {results && results.length > 0 && (
          <div className="max-h-72 overflow-y-auto py-2">
            {results.map((r) => {
              const config = TYPE_CONFIG[r.type];
              const Icon = config.icon;
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => { navigate(`${config.path}/${r.id}`); onClose(); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                >
                  <Icon className="h-4 w-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{r.title}</p>
                    <p className="text-xs text-slate-400 truncate">{r.subtitle}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{config.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {results && results.length === 0 && query.length >= 2 && !isLoading && (
          <p className="text-center text-sm text-slate-400 py-6">Không tìm thấy kết quả</p>
        )}
      </div>
    </div>
  );
}
