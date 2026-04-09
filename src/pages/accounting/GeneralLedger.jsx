import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import useUiStore from '../../stores/uiStore';
import FormField from '../../components/common/FormField';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { formatDate } from '../../utils/formatDate';
import { formatCurrency } from '../../utils/formatCurrency';
import { MdBook } from 'react-icons/md';
import '../../styles/AccountingPages.css';

const today = new Date().toISOString().split('T')[0];
const yearStart = `${new Date().getFullYear()}-01-01`;

export default function GeneralLedger() {
  const addToast = useUiStore((s) => s.addToast);
  const [accounts, setAccounts] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ account_id: '', start: yearStart, end: today });

  useEffect(() => {
    api.get('/accounts').then(({ data }) => setAccounts(data.data)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!filters.account_id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ account_id: filters.account_id, start: filters.start, end: filters.end });
      const { data } = await api.get(`/journal-entries/ledger?${params}`);
      setLedger(data.data);
    } catch { addToast({ type: 'error', message: 'Failed to load ledger' }); }
    finally { setLoading(false); }
  }, [filters, addToast]);

  useEffect(() => { load(); }, [load]);

  const selectedAcc = accounts.find((a) => String(a.id) === String(filters.account_id));

  return (
    <div className="accounting-page page-enter">
      <div className="page-header"><h2>General Ledger</h2></div>
      <div className="report-controls">
        <FormField label="Account" htmlFor="gl-acc">
          <select id="gl-acc" value={filters.account_id} onChange={(e) => setFilters((f) => ({ ...f, account_id: e.target.value }))} style={{ minWidth: 260 }}>
            <option value="">— Select account —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_code} — {a.account_name}</option>)}
          </select>
        </FormField>
        <FormField label="From" htmlFor="gl-start">
          <input id="gl-start" type="date" value={filters.start} onChange={(e) => setFilters((f) => ({ ...f, start: e.target.value }))} />
        </FormField>
        <FormField label="To" htmlFor="gl-end">
          <input id="gl-end" type="date" value={filters.end} onChange={(e) => setFilters((f) => ({ ...f, end: e.target.value }))} />
        </FormField>
      </div>

      {!filters.account_id ? (
        <EmptyState icon={MdBook} title="Select an account" message="Choose an account above to view its ledger" />
      ) : loading ? <LoadingSpinner /> : ledger.length === 0 ? (
        <EmptyState title="No transactions" message="No posted entries for this account in the selected period" />
      ) : (
        <div className="report-card">
          <div className="report-card-header">
            <h3>{selectedAcc?.account_code} — {selectedAcc?.account_name}</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="report-table">
              <thead><tr><th>Date</th><th>Reference</th><th>Description</th><th style={{ textAlign: 'right' }}>Debit</th><th style={{ textAlign: 'right' }}>Credit</th><th style={{ textAlign: 'right' }}>Balance</th></tr></thead>
              <tbody>
                {ledger.map((row, i) => (
                  <tr key={i}>
                    <td>{formatDate(row.entry_date)}</td>
                    <td>{row.reference_number}</td>
                    <td>{row.line_description || row.entry_description || '—'}</td>
                    <td style={{ textAlign: 'right', color: row.debit > 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>{row.debit > 0 ? formatCurrency(row.debit) : '—'}</td>
                    <td style={{ textAlign: 'right', color: row.credit > 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>{row.credit > 0 ? formatCurrency(row.credit) : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: row.balance >= 0 ? 'var(--color-accent-green)' : 'var(--color-accent-red)' }} className="ledger-balance-col">{formatCurrency(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
