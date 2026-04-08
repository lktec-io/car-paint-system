import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';
import useUiStore from '../../stores/uiStore';
import FormField from '../../components/common/FormField';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatCurrency } from '../../utils/formatCurrency';
import '../../styles/AccountingPages.css';

const today = new Date().toISOString().split('T')[0];

function Section({ title, rows, total, colorClass }) {
  return (
    <div className="report-card" style={{ marginBottom: '1rem' }}>
      <div className="report-card-header"><h3>{title}</h3><strong className={colorClass}>{formatCurrency(total)}</strong></div>
      <table className="report-table">
        <thead><tr><th>Code</th><th>Account</th><th>Balance</th></tr></thead>
        <tbody>
          {rows.filter((r) => r.balance !== 0).map((r, i) => (
            <tr key={i}>
              <td><code style={{ fontSize: '0.8rem', color: 'var(--color-accent-blue)' }}>{r.account_code}</code></td>
              <td>{r.account_name}</td>
              <td>{formatCurrency(r.balance)}</td>
            </tr>
          ))}
          <tr className="report-total-row"><td colSpan={2}>Total {title}</td><td>{formatCurrency(total)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

export default function BalanceSheet() {
  const addToast = useUiStore((s) => s.addToast);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [asOf, setAsOf] = useState(today);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/reports/balance-sheet?as_of=${asOf}`);
      setResult(data.data);
    } catch { addToast({ type: 'error', message: 'Failed to load balance sheet' }); }
    finally { setLoading(false); }
  }, [asOf, addToast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="accounting-page">
      <div className="page-header"><h2>Balance Sheet</h2></div>
      <div className="report-controls">
        <FormField label="As of Date" htmlFor="bs-asof"><input id="bs-asof" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></FormField>
        <button className="btn btn-secondary" onClick={load} style={{ alignSelf: 'flex-end' }}>Refresh</button>
      </div>

      {loading ? <LoadingSpinner /> : result && (
        <>
          <Section title="Assets" rows={result.assets} total={result.totalAssets} colorClass="text-info" />
          <Section title="Liabilities" rows={result.liabilities} total={result.totalLiabilities} colorClass="text-warning" />
          <Section title="Equity" rows={result.equity} total={result.totalEquity} colorClass="text-success" />
          <div className="report-card">
            <table className="report-table">
              <tbody>
                <tr className="report-total-row">
                  <td>Liabilities + Equity</td>
                  <td>{formatCurrency(result.totalLiabilities + result.totalEquity)}</td>
                </tr>
                <tr className={`report-net-row${Math.abs(result.totalAssets - (result.totalLiabilities + result.totalEquity)) > 0.01 ? ' negative' : ''}`}>
                  <td>{Math.abs(result.totalAssets - (result.totalLiabilities + result.totalEquity)) < 0.01 ? '✓ Balanced' : '⚠ Out of Balance'}</td>
                  <td>{formatCurrency(result.totalAssets)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
