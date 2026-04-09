import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import useUiStore from '../../stores/uiStore';
import FormField from '../../components/common/FormField';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatCurrency } from '../../utils/formatCurrency';
import '../../styles/AccountingPages.css';

const today = new Date().toISOString().split('T')[0];

export default function TrialBalance() {
  const addToast = useUiStore((s) => s.addToast);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [asOf, setAsOf] = useState(today);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/reports/trial-balance?as_of=${asOf}`);
      setData(res.data);
    } catch { addToast({ type: 'error', message: 'Failed to load trial balance' }); }
    finally { setLoading(false); }
  }, [asOf, addToast]);

  useEffect(() => { load(); }, [load]);

  const totalDebit  = data.reduce((s, r) => s + parseFloat(r.total_debit), 0);
  const totalCredit = data.reduce((s, r) => s + parseFloat(r.total_credit), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div className="accounting-page page-enter">
      <div className="page-header"><h2>Trial Balance</h2></div>
      <div className="report-controls">
        <FormField label="As of Date" htmlFor="tb-asof">
          <input id="tb-asof" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </FormField>
        <button className="btn btn-secondary" onClick={load} style={{ alignSelf: 'flex-end' }}>Refresh</button>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="report-card">
          <div className="report-card-header">
            <h3>Trial Balance — As of {asOf}</h3>
            <span className={balanced ? 'je-balanced' : 'je-unbalanced'}>{balanced ? '✓ Balanced' : '⚠ Out of Balance'}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="report-table">
              <thead><tr><th>Code</th><th>Account Name</th><th>Type</th><th>Debit</th><th>Credit</th></tr></thead>
              <tbody>
                {data.filter((r) => parseFloat(r.total_debit) > 0 || parseFloat(r.total_credit) > 0).map((row, i) => (
                  <tr key={i}>
                    <td><code style={{ fontSize: '0.8rem', color: 'var(--color-accent-blue)' }}>{row.account_code}</code></td>
                    <td>{row.account_name}</td>
                    <td><span className="badge badge-neutral">{row.account_type}</span></td>
                    <td>{parseFloat(row.total_debit) > 0 ? formatCurrency(row.total_debit) : '—'}</td>
                    <td>{parseFloat(row.total_credit) > 0 ? formatCurrency(row.total_credit) : '—'}</td>
                  </tr>
                ))}
                <tr className="report-total-row">
                  <td colSpan={3}>TOTALS</td>
                  <td>{formatCurrency(totalDebit)}</td>
                  <td>{formatCurrency(totalCredit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
