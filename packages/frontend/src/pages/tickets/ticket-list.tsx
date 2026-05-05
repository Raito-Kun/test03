import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, User, Flag, Tag, X } from 'lucide-react';
import { VI } from '@/lib/vi-text';
import { Button } from '@/components/ui/button';
import TicketForm from './ticket-form';
import { ExportButton } from '@/components/export-button';
import { TicketKanban } from './ticket-kanban';

const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
type TicketPriority = typeof TICKET_PRIORITIES[number];

// Deterministic avatar bg from string
const AVATAR_BG = ['bg-violet-200 text-violet-800', 'bg-pink-200 text-pink-800', 'bg-amber-200 text-amber-800', 'bg-emerald-200 text-emerald-800'];
function avatarBg(s: string) {
  let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_BG[Math.abs(h) % AVATAR_BG.length];
}

// Placeholder assignee avatars (pulled from current user pool in UI — no real API needed for display)
const MOCK_AGENTS = ['LM', 'PM', 'QT', 'TH'];

export default function TicketListPage() {
  const queryClient = useQueryClient();
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const hasFilter = !!(priorityFilter || categoryFilter);

  return (
    <div className="space-y-0">
      {/* Page header section */}
      <div className="border-b border-dashed border-border bg-background/60 pb-6 mb-0">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Bảng Phiếu ghi</h1>
            <p className="text-sm text-muted-foreground mt-1">Theo dõi và quản lý các yêu cầu hỗ trợ từ khách hàng.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Assignee avatar stack */}
            <div className="flex -space-x-2">
              {MOCK_AGENTS.map((a) => (
                <div
                  key={a}
                  className={`w-8 h-8 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold ${avatarBg(a)}`}
                  title={a}
                >
                  {a}
                </div>
              ))}
              <div className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                +4
              </div>
            </div>
            <Button onClick={() => setShowForm(true)} className="gap-2 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4" />
              Tạo phiếu
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['tickets-kanban'] })}
              title={VI.actions.refresh}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <ExportButton entity="tickets" filters={{ search, priority: priorityFilter }} />
          </div>
        </div>

        {/* Filter pills row */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 border border-dashed border-border rounded-full text-sm font-medium flex items-center gap-1.5 hover:bg-accent transition-colors"
          >
            <User className="h-3.5 w-3.5" />
            Người phụ trách
            <span className="text-muted-foreground">▾</span>
          </button>
          <button
            type="button"
            onClick={() => setPriorityFilter(priorityFilter ? '' : 'high')}
            className={`px-3 py-1.5 border border-dashed rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors ${priorityFilter ? 'border-primary text-primary bg-primary/5' : 'border-border hover:bg-accent'}`}
          >
            <Flag className="h-3.5 w-3.5" />
            {priorityFilter ? VI.ticket.priorities[priorityFilter as TicketPriority] : 'Mức độ ưu tiên'}
            <span className="text-muted-foreground">▾</span>
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter(categoryFilter ? '' : 'support')}
            className={`px-3 py-1.5 border border-dashed rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors ${categoryFilter ? 'border-primary text-primary bg-primary/5' : 'border-border hover:bg-accent'}`}
          >
            <Tag className="h-3.5 w-3.5" />
            Danh mục
            <span className="text-muted-foreground">▾</span>
          </button>
          {hasFilter && (
            <>
              <div className="h-5 w-px bg-border" />
              <button
                type="button"
                onClick={() => { setPriorityFilter(''); setCategoryFilter(''); }}
                className="text-primary text-sm font-semibold hover:underline flex items-center gap-1"
              >
                <X className="h-3.5 w-3.5" />
                Xóa bộ lọc
              </button>
            </>
          )}
        </div>
      </div>

      {/* Kanban board */}
      <div className="pt-4">
        <TicketKanban priorityFilter={priorityFilter} searchQuery={search} />
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-transform z-50"
        aria-label="Tạo phiếu mới"
      >
        <Plus className="h-6 w-6" />
      </button>

      {showForm && (
        <TicketForm
          open={showForm}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['tickets-kanban'] });
          }}
        />
      )}
    </div>
  );
}
