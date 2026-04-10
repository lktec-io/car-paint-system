import { useState, useMemo } from 'react';
import { MdArrowUpward, MdArrowDownward, MdInbox, MdChevronLeft, MdChevronRight } from 'react-icons/md';
import { FiSearch } from 'react-icons/fi';
import '../../styles/DataTable.css';

/**
 * Reusable DataTable with sorting, client-side search, pagination, and row actions.
 *
 * @prop {Array}    columns       - [{ key, label, render?, sortable?, width? }]
 * @prop {Array}    data          - Row objects
 * @prop {boolean}  searchable    - Show search input
 * @prop {string}   searchPlaceholder
 * @prop {Function} onRowClick    - Called with row object when a row is clicked
 * @prop {Function} actions       - Called with row, returns ReactNode (edit/delete buttons)
 * @prop {number}   pageSize      - Rows per page (default 15)
 * @prop {boolean}  loading       - Show skeleton rows
 * @prop {ReactNode} toolbar      - Extra elements appended to the toolbar
 * @prop {string}   emptyMessage
 */
export default function DataTable({
  columns = [],
  data = [],
  searchable = true,
  searchPlaceholder = 'Search…',
  onRowClick,
  actions,
  pageSize = 15,
  loading = false,
  toolbar,
  emptyMessage = 'No records found',
}) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  // Client-side search across all string/number cell values
  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => {
        const val = col.render ? null : row[col.key];
        return val !== null && val !== undefined && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, columns]);

  // Sorting
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === bv) return 0;
      const cmp = av < bv ? -1 : 1;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  }

  function handleSearch(val) {
    setSearch(val);
    setPage(1);
  }

  const hasActions = Boolean(actions);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, sorted.length);

  // Visible page numbers (max 5 around current)
  const pageNums = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === totalPages || (n >= safePage - 1 && n <= safePage + 1)
  );

  return (
    <div className="datatable-wrapper">
      {/* Toolbar */}
      {(searchable || toolbar) && (
        <div className="datatable-toolbar">
          {searchable && (
            <div className="search-input-wrapper">
              <FiSearch className="search-icon" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="search-input"
              />
            </div>
          )}
          {toolbar && <div className="datatable-toolbar-actions">{toolbar}</div>}
        </div>
      )}

      {/* Table */}
      <div className="datatable-scroll">
        <table className="datatable-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={col.sortable !== false && !col.render ? 'sortable' : ''}
                  style={col.width ? { width: col.width } : {}}
                  onClick={() => col.sortable !== false && !col.render && handleSort(col.key)}
                >
                  <div className="th-inner">
                    {col.label}
                    {col.sortable !== false && !col.render && (
                      sortKey === col.key
                        ? sortDir === 'asc'
                          ? <MdArrowUpward className="sort-icon sort-icon--active" />
                          : <MdArrowDownward className="sort-icon sort-icon--active" />
                        : <MdArrowUpward className="sort-icon" />
                    )}
                  </div>
                </th>
              ))}
              {hasActions && <th style={{ width: 100 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      <div className="skeleton" style={{ height: 14, width: '70%', borderRadius: 4 }} />
                    </td>
                  ))}
                  {hasActions && <td><div className="skeleton" style={{ height: 14, width: 60 }} /></td>}
                </tr>
              ))
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (hasActions ? 1 : 0)}>
                  <div className="datatable-empty">
                    <MdInbox />
                    <p>{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              paged.map((row, i) => (
                <tr
                  key={row.id ?? i}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={!onRowClick ? 'no-row-click' : ''}
                >
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                  {hasActions && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="row-actions">{actions(row)}</div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {sorted.length > pageSize && (
        <div className="datatable-pagination">
          <span className="pagination-info">
            {sorted.length === 0 ? '0' : `${start}–${end}`} of {sorted.length}
          </span>
          <div className="pagination-controls">
            <button className="page-btn" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>
              <MdChevronLeft />
            </button>
            {pageNums.map((n, i) => {
              const prev = pageNums[i - 1];
              return (
                <span key={n} style={{ display: 'contents' }}>
                  {prev && n - prev > 1 && <span style={{ color: 'var(--color-text-secondary)', padding: '0 2px' }}>…</span>}
                  <button
                    className={`page-btn${n === safePage ? ' page-btn--active' : ''}`}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                </span>
              );
            })}
            <button className="page-btn" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>
              <MdChevronRight />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
