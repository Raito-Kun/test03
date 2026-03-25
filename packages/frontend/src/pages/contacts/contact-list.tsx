import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { MoreHorizontal, Trash2, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { PageWrapper } from '@/components/page-wrapper';
import { DataTable, Column } from '@/components/data-table/data-table';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { VI } from '@/lib/vi-text';
import { usePagination } from '@/hooks/use-pagination';
import api from '@/services/api-client';
import { ContactForm } from './contact-form';

interface Contact {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  assignedTo?: { fullName: string };
  createdAt: string;
}

interface ContactsResponse {
  data: Contact[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export default function ContactListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pagination = usePagination();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', pagination.queryParams],
    queryFn: () =>
      api.get<ContactsResponse>('/contacts', { params: pagination.queryParams }).then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setDeleteTarget(null);
      toast.success('Đã xóa liên hệ');
    },
    onError: () => toast.error('Xóa thất bại'),
  });

  const columns: Column<Contact>[] = [
    { key: 'fullName', label: VI.contact.fullName, sortable: true },
    {
      key: 'phone', label: VI.contact.phone,
      render: (row) => (
        <span className="flex items-center gap-1.5">
          {row.phone}
          <button
            onClick={(e) => { e.stopPropagation(); api.post('/calls/originate', { phone: row.phone }).then(() => toast.success(`Đang gọi ${row.phone}...`)).catch(() => toast.error('Không thể gọi')); }}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
            title="Gọi"
          >
            <Phone className="h-3 w-3" />
          </button>
        </span>
      ),
    },
    { key: 'email', label: VI.contact.email, render: (row) => row.email || '—' },
    {
      key: 'assignedTo',
      label: VI.contact.assignedTo,
      render: (row) => row.assignedTo?.fullName || '—',
    },
    {
      key: 'createdAt',
      label: VI.contact.createdAt,
      sortable: true,
      render: (row) => format(new Date(row.createdAt), 'dd/MM/yyyy HH:mm'),
    },
  ];

  return (
    <PageWrapper
      title={VI.contact.title}
      createLabel={VI.actions.create}
      onCreate={() => setFormOpen(true)}
    >
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        total={data?.meta.total ?? 0}
        page={pagination.page}
        limit={pagination.limit}
        isLoading={isLoading}
        searchValue={pagination.search}
        onSearchChange={pagination.setSearch}
        onPageChange={pagination.setPage}
        onLimitChange={pagination.setLimit}
        onSort={pagination.handleSort}
        sortKey={pagination.sortKey}
        sortOrder={pagination.sortOrder}
        onRowClick={(row) => navigate(`/contacts/${row.id}`)}
        actions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteTarget(row)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {VI.actions.delete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <ContactForm open={formOpen} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />
    </PageWrapper>
  );
}
