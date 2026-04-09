import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import useUiStore from '../../stores/uiStore';
import FormField from '../../components/common/FormField';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatCurrency } from '../../utils/formatCurrency';
import '../../styles/AccountingPages.css';

const today = new Date().toISOString().split('T')[0];
const yearStart = `${new Date().getFullYear()}-01-01`;

export default function ProfitLoss() {
  const addToast = useUiStore((s) => s.addToast);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState({ start: yearStart, end: today });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/reports/profit-loss?start=${range.start}&end=${range.end}`);
      setResult(data.data);
    } catch { addToast({ type: 'error', message: 'Failed to load P&L' }); }
    finally { setLoading(false); }
  }, [range, addToast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="accounting-page page-enter">
      <div className="page-header"><h2>Profit & Loss</h2></div>
      <div className="report-controls">
        <FormField label="From" htmlFor="pl-start"><input id="pl-start" type="date" value={range.start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} /></FormField>
        <FormField label="To" htmlFor="pl-end"><input id="pl-end" type="date" value={range.end} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} /></FormField>
        <button className="btn btn-secondary" onClick={load} style={{ alignSelf: 'flex-end' }}>Refresh</button>
      </div>

      {loading ? <LoadingSpinner /> : result && (
        <>
          <div className="report-card page-enter" style={{ marginBottom: "1rem" }}>
            <div className="report-card-header"><h3>Revenue</h3><strong className="text-success">{formatCurrency(result.totalRevenue)}</strong></div>
            <table className="report-table">
              <thead><tr><th>Account</th><th>Name</th><th>Amount</th></tr></thead>
              <tbody>
                {result.revenue.map((r, i) => (
                  <tr key={i}>
                    <td><code style={{ fontSize: '0.8rem', color: 'var(--color-accent-blue)' }}>{r.account_code}</code></td>
                    <td>{r.account_name}</td>
                    <td>{formatCurrency(parseFloat(r.total_credit) - parseFloat(r.total_debit))}</td>
                  </tr>
                ))}
                <tr className="report-total-row"><td colSpan={2}>Total Revenue</td><td>{formatCurrency(result.totalRevenue)}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="report-card page-enter" style={{ marginBottom: "1rem" }}>
            <div className="report-card-header"><h3>Expenses</h3><strong className="text-danger">{formatCurrency(result.totalExpense)}</strong></div>
            <table className="report-table">
              <thead><tr><th>Account</th><th>Name</th><th>Amount</th></tr></thead>
              <tbody>
                {result.expenses.map((r, i) => (
                  <tr key={i}>
                    <td><code style={{ fontSize: '0.8rem', color: 'var(--color-accent-blue)' }}>{r.account_code}</code></td>
                    <td>{r.account_name}</td>
                    <td>{formatCurrency(parseFloat(r.total_debit) - parseFloat(r.total_credit))}</td>
                  </tr>
                ))}
                <tr className="report-total-row"><td colSpan={2}>Total Expenses</td><td>{formatCurrency(result.totalExpense)}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="report-card">
            <table className="report-table">
              <tbody>
                <tr className={`report-net-row${result.netIncome < 0 ? ' negative' : ''}`}>
                  <td colSpan={2}>{result.netIncome >= 0 ? 'Net Income' : 'Net Loss'}</td>
                  <td>{formatCurrency(Math.abs(result.netIncome))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
