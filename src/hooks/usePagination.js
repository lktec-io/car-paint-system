import { useState, useCallback } from 'react';

/**
 * @param {number} pageSize - Rows per page
 * @returns {{ page, offset, pageSize, totalPages, goToPage, nextPage, prevPage, reset, setTotal }}
 */
export default function usePagination(pageSize = 20) {
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const offset = (page - 1) * pageSize;

  const goToPage = useCallback((n) => {
    setPage(Math.min(Math.max(1, n), Math.max(1, Math.ceil(total / pageSize))));
  }, [total, pageSize]);

  const nextPage = useCallback(() => goToPage(page + 1), [page, goToPage]);
  const prevPage = useCallback(() => goToPage(page - 1), [page, goToPage]);
  const reset = useCallback(() => setPage(1), []);

  return { page, offset, pageSize, total, totalPages, goToPage, nextPage, prevPage, reset, setTotal };
}
