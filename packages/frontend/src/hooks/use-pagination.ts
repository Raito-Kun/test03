import { useState, useCallback } from 'react';

/** Reusable pagination state hook */
export function usePagination(initialLimit = 20) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = useCallback((key: string, order: 'asc' | 'desc') => {
    setSortKey(key);
    setSortOrder(order);
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleLimitChange = useCallback((value: number) => {
    setLimit(value);
    setPage(1);
  }, []);

  return {
    page, setPage, limit, setLimit: handleLimitChange,
    search, setSearch: handleSearchChange,
    sortKey, sortOrder, handleSort,
    queryParams: { page, limit, search, sort: sortKey, order: sortOrder },
  };
}
