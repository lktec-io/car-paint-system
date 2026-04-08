import { useState, useCallback } from 'react';
import api from '../../api/axios';
import useUiStore from '../../stores/uiStore';
import { formatDateTime } from '../../utils/formatDate';
import Modal from '../../components/common/Modal';
import './AuditLogPage.css';

const ACTION_CLASS = {
  CREATE: 'badge-success',
  UPDATE: 'badge-info',
  DELETE: 'badge-danger',
  LOGIN:  'badge-neutral',
  LOGOUT: 'badge-neutral',
};

const ENTITY_TYPES = ['invoices','customers','suppliers','inventory_items','expenses','jobs','purchases','journal_entries','users','accounts'];
const ACTIONS      = ['CREATE','UPDATE','DELETE','LOGIN','LOGOUT'];

export default function AuditLogPage() {
  const addToast = useUiStore(s => s.addToast);
  const [rows, setRows]       = useState([]);
  const [meta, setMeta]       = useState({ total: 0, page: 1, limit: 50 });
  const [loading, setLoading] = useState(false);
  const [detail, setDetail]   = useState(null);

  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.slice(0, 7) + '-01';

  const [filters, setFilters] = useState({
    entity_type: '', action: '', from: monthStart, to: today, page: 1,
  });

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v, page: 1 }));

  const load = useCallback(async (f = filters) => {
    setLoading(true);
    try {
      const params = {};
      if (f.entity_type) params.entity_type = f.entity_type;
      if (f.action)      params.action      = f.action;
      if (f.from)        params.from        = f.from;
      if (f.to)          params.to          = f.to;
      params.page  = f.page || 1;
      params.limit = meta.limit;

      const { data } = await api.get('/audit-logs', { params });
      setRows(data.data);
      setMeta(data.meta);
    } catch { addToast({ type: 'error', message: 'Failed to load audit logs' }); }
    finally { setLoading(false); }
  }, [filters, meta.limit, addToast]);

  function handleRun() { load(filters); }

  function changePage(p) {
    const next = { ...filters, page: p };
    setFilters(next);
    load(next);
  }

  function formatChanges(row) {
    if (!row.old_values && !row.new_values) return '—';
    return 'View changes';
  }

  const totalPages = Math.ceil((meta.total || 0) / meta.limit);

  return (
    <div>
      <div className="page-header">
        <h2>Audit Logs</h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{meta.total} records</span>
      </div>

      {/* Filters */}
      <div className="audit-filters">
        <label>
          From
          <input type="date" value={filters.from} onChange={e => setFilter('from', e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={filters.to} onChange={e => setFilter('to', e.target.value)} />
        </label>
        <label>
          Entity
          <select value={filters.entity_type} onChange={e => setFilter('entity_type', e.target.value)}>
            <option value="">All entities</option>
            {ENTITY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
          </select>
        </label>
        <label>
          Action
          <select value={filters.action} onChange={e => setFilter('action', e.target.value)}>
            <option value="">All actions</option>
            {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <button className="btn btn-primary" onClick={handleRun} disabled={loading}>
          {loading ? 'Loading…' : 'Search'}
        </button>
      </div>

      {/* Table */}
      <div className="audit-table-wrap">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>ID</th>
              <th>IP Address</th>
              <th>Changes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j}><div className="skeleton" style={{ height: 14, width: '80%', borderRadius: 4 }} /></td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="audit-empty">No audit records found for the selected filters</td></tr>
            ) : (
              rows.map(row => (
                <tr key={row.id}>
                  <td className="audit-ts">{formatDateTime(row.created_at)}</td>
                  <td>
                    <div className="audit-user">{row.user_name}</div>
                    <div className="audit-user-email">{row.user_email}</div>
                  </td>
                  <td><span className={`badge ${ACTION_CLASS[row.action] || 'badge-neutral'}`}>{row.action}</span></td>
                  <td className="audit-entity">{row.entity_type?.replace(/_/g,' ')}</td>
                  <td>{row.entity_id || '—'}</td>
                  <td className="audit-ip">{row.ip_address || '—'}</td>
                  <td>
                    {(row.old_values || row.new_values) ? (
                      <button className="btn-text" onClick={() => setDetail(row)}>View</button>
                    ) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="audit-pagination">
          <span className="audit-pagination-info">
            Page {meta.page} of {totalPages} ({meta.total} records)
          </span>
          <div className="audit-pagination-btns">
            <button className="btn btn-secondary" onClick={() => changePage(meta.page - 1)} disabled={meta.page <= 1 || loading}>Prev</button>
            <button className="btn btn-secondary" onClick={() => changePage(meta.page + 1)} disabled={meta.page >= totalPages || loading}>Next</button>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <Modal open={!!detail} onClose={() => setDetail(null)} title={`${detail.action} — ${detail.entity_type} #${detail.entity_id || '?'}`} size="md"
          footer={<button className="btn btn-secondary" onClick={() => setDetail(null)}>Close</button>}
        >
          <div style={{ fontSize: '0.83rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <p style={{ fontWeight: 600, marginBottom: '0.35rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontSize: '0.75rem' }}>By</p>
              <p>{detail.user_name} ({detail.user_email}) · {formatDateTime(detail.created_at)}</p>
            </div>
            {detail.old_values && (
              <div>
                <p style={{ fontWeight: 600, marginBottom: '0.35rem', color: 'var(--color-accent-red)', textTransform: 'uppercase', fontSize: '0.75rem' }}>Old Values</p>
                <pre className="audit-json">{JSON.stringify(typeof detail.old_values === 'string' ? JSON.parse(detail.old_values) : detail.old_values, null, 2)}</pre>
              </div>
            )}
            {detail.new_values && (
              <div>
                <p style={{ fontWeight: 600, marginBottom: '0.35rem', color: 'var(--color-accent-green)', textTransform: 'uppercase', fontSize: '0.75rem' }}>New Values</p>
                <pre className="audit-json">{JSON.stringify(typeof detail.new_values === 'string' ? JSON.parse(detail.new_values) : detail.new_values, null, 2)}</pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
