import { useState } from 'react';
import { VI } from '@/lib/vi-text';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Search, ArrowUpDown } from 'lucide-react';

export interface Column<T> {
  key: string;
  label: React.ReactNode;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  total: number;
  page: number;
  limit: number;
  isLoading?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  /** When provided, search is deferred until button click or Enter */
  onSearchSubmit?: (value: string) => void;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  onSort?: (key: string, order: 'asc' | 'desc') => void;
  sortKey?: string;
  sortOrder?: 'asc' | 'desc';
  onRowClick?: (row: T) => void;
  actions?: (row: T) => React.ReactNode;
  toolbar?: React.ReactNode;
}

export function DataTable<T extends { id?: string }>({
  columns, data, total, page, limit, isLoading,
  searchValue, onSearchChange, onSearchSubmit, onPageChange, onLimitChange,
  onSort, sortKey, sortOrder, onRowClick, actions, toolbar,
}: DataTableProps<T>) {
  const totalPages = Math.ceil(total / limit) || 1;
  const [localSearch, setLocalSearch] = useState(searchValue || '');

  // If using deferred search mode, keep local state; otherwise sync
  const isDeferred = !!onSearchSubmit;
  const displaySearch = isDeferred ? localSearch : (searchValue || '');

  function handleSort(key: string) {
    if (!onSort) return;
    const newOrder = sortKey === key && sortOrder === 'asc' ? 'desc' : 'asc';
    onSort(key, newOrder);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && isDeferred) {
      onSearchSubmit!(localSearch);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        {(onSearchChange || onSearchSubmit) && (
          <div className="relative max-w-sm flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={VI.actions.search}
                value={displaySearch}
                onChange={(e) => {
                  if (isDeferred) setLocalSearch(e.target.value);
                  else onSearchChange?.(e.target.value);
                }}
                onKeyDown={handleSearchKeyDown}
                className="pl-9"
              />
            </div>
            {isDeferred && (
              <Button size="sm" onClick={() => onSearchSubmit!(localSearch)}>
                {VI.actions.search}
              </Button>
            )}
          </div>
        )}
        {toolbar}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={`${col.className || ''} ${col.sortable ? 'cursor-pointer select-none' : ''}`}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && <ArrowUpDown className="h-3 w-3" />}
                  </div>
                </TableHead>
              ))}
              {actions && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: limit }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col.key}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                  {actions && <TableCell><Skeleton className="h-4 w-8" /></TableCell>}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (actions ? 1 : 0)} className="h-24 text-center text-muted-foreground">
                  {VI.table.noResults}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, idx) => (
                <TableRow
                  key={(row as Record<string, unknown>).id as string || idx}
                  className={onRowClick ? 'cursor-pointer' : ''}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </TableCell>
                  ))}
                  {actions && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {actions(row)}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {VI.table.total}: {total}
        </p>
        <div className="flex items-center gap-2">
          {onLimitChange && (
            <Select value={String(limit)} onValueChange={(v) => onLimitChange(Number(v))}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <span className="text-sm text-muted-foreground">
            {VI.table.page} {page} {VI.table.of} {totalPages}
          </span>
          <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
