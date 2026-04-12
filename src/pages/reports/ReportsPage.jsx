import { useState } from 'react';
import { MdPictureAsPdf, MdTableChart } from 'react-icons/md';
import api from '../../api/axios';
import useUiStore from '../../stores/uiStore';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import { exportTablePdf, exportReportPdf } from '../../utils/exportPdf';
import { exportTableExcel, exportReportExcel } from '../../utils/exportExcel';
import './ReportsPage.css';

const TABS = [
  { id: 'profit-loss',   label: 'Profit & Loss' },
  { id: 'balance-sheet', label: 'Balance Sheet' },
  { id: 'trial-balance', label: 'Trial Balance' },
  { id: 'sales',         label: 'Sales Report' },
  { id: 'expenses',      label: 'Expense Report' },
];

function getMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const to   = now.toISOString().split('T')[0];
  return { from, to };
}

export default function ReportsPage() {
  const addToast = useUiStore(s => s.addToast);
  const [tab, setTab]     = useState('profit-loss');
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { from: defFrom, to: defTo } = getMonthRange();
  const [from, setFrom]   = useState(defFrom);
  const [to, setTo]       = useState(defTo);

  async function loadReport() {
    setLoading(true); setData(null);
    try {
      let res;
      if (tab === 'profit-loss')   res = await api.get('/reports/profit-loss',   { params: { from, to } });
      else if (tab === 'balance-sheet') res = await api.get('/reports/balance-sheet', { params: { as_of: to } });
      else if (tab === 'trial-balance') res = await api.get('/reports/trial-balance', { params: { as_of: to } });
      else if (tab === 'sales')      res = await api.get('/sales');
      else if (tab === 'expenses')  res = await api.get('/expenses');
      setData(res.data.data);
    } catch { addToast({ type: 'error', message: 'Failed to load report' }); }
    finally { setLoading(false); }
  }

  async function handleExportPdf() {
    if (!data) return;
    setExporting(true);
    try {
      const subtitle = `${formatDate(from)} — ${formatDate(to)}`;
      if (tab === 'profit-loss') {
        const sections = buildPLSections(data);
        exportReportPdf({ title: 'Profit & Loss', sections, filename: 'profit-loss', subtitle });
      } else if (tab === 'balance-sheet') {
        const sections = buildBSSections(data);
        exportReportPdf({ title: 'Balance Sheet', sections, filename: 'balance-sheet', subtitle: `As of ${formatDate(to)}` });
      } else if (tab === 'trial-balance') {
        exportTablePdf({ title: 'Trial Balance', headers: ['Account Code', 'Account Name', 'Debit', 'Credit'], rows: data.map(r => [r.account_code, r.account_name, formatCurrency(r.total_debit), formatCurrency(r.total_credit)]), filename: 'trial-balance', subtitle: `As of ${formatDate(to)}` });
      } else if (tab === 'sales') {
        exportTablePdf({ title: 'Sales Report', headers: ['Sale #', 'Date', 'Items', 'Total', 'Method', 'By'], rows: (data || []).map(r => [r.sale_number, formatDate(r.sale_date), r.item_count, formatCurrency(r.total_amount), r.payment_method, r.created_by_name]), filename: 'sales-report', subtitle });
      } else if (tab === 'expenses') {
        exportTablePdf({ title: 'Expense Report', headers: ['Date', 'Category', 'Description', 'Method', 'Amount'], rows: data.map(r => [formatDate(r.expense_date), r.category_name, r.description||'', r.payment_method, formatCurrency(r.amount)]), filename: 'expenses', subtitle });
      }
    } finally { setExporting(false); }
  }

  async function handleExportExcel() {
    if (!data) return;
    setExporting(true);
    try {
      const subtitle = `${formatDate(from)} — ${formatDate(to)}`;
      if (tab === 'profit-loss') {
        const sections = buildPLSections(data);
        await exportReportExcel({ title: 'Profit & Loss', sections, filename: 'profit-loss' });
      } else if (tab === 'balance-sheet') {
        const sections = buildBSSections(data);
        await exportReportExcel({ title: 'Balance Sheet', sections, filename: 'balance-sheet' });
      } else if (tab === 'trial-balance') {
        await exportTableExcel({ sheetName: 'Trial Balance', title: 'Trial Balance', headers: ['Account Code', 'Account Name', 'Debit', 'Credit'], rows: data.map(r => [r.account_code, r.account_name, formatCurrency(r.total_debit), formatCurrency(r.total_credit)]), filename: 'trial-balance' });
      } else if (tab === 'sales') {
        await exportTableExcel({ sheetName: 'Sales', title: 'Sales Report', headers: ['Sale #', 'Date', 'Items', 'Total', 'Method', 'By'], rows: (data || []).map(r => [r.sale_number, formatDate(r.sale_date), r.item_count, formatCurrency(r.total_amount), r.payment_method, r.created_by_name]), filename: 'sales-report' });
      } else if (tab === 'expenses') {
        await exportTableExcel({ sheetName: 'Expenses', title: 'Expense Report', headers: ['Date', 'Category', 'Description', 'Method', 'Amount'], rows: data.map(r => [formatDate(r.expense_date), r.category_name, r.description||'', r.payment_method, formatCurrency(r.amount)]), filename: 'expenses' });
      }
    } finally { setExporting(false); }
  }

  function buildPLSections(d) {
    if (!d) return [];
    return [
      { title: 'Revenue', rows: (d.revenue||[]).map(a => [a.account_name, formatCurrency(a.balance)]).concat([['TOTAL REVENUE', formatCurrency(d.total_revenue||0)]]) },
      { title: 'Cost of Sales', rows: (d.cost_of_sales||[]).map(a => [a.account_name, formatCurrency(a.balance)]).concat([['TOTAL COST OF SALES', formatCurrency(d.total_cost_of_sales||0)]]) },
      { title: 'Operating Expenses', rows: (d.expenses||[]).map(a => [a.account_name, formatCurrency(a.balance)]).concat([['TOTAL EXPENSES', formatCurrency(d.total_expenses||0)], ['NET PROFIT / (LOSS)', formatCurrency(d.net_profit||0)]]) },
    ];
  }

  function buildBSSections(d) {
    if (!d) return [];
    return [
      { title: 'Assets', rows: (d.assets||[]).map(a => [a.account_name, formatCurrency(a.balance)]).concat([['TOTAL ASSETS', formatCurrency(d.total_assets||0)]]) },
      { title: 'Liabilities', rows: (d.liabilities||[]).map(a => [a.account_name, formatCurrency(a.balance)]).concat([['TOTAL LIABILITIES', formatCurrency(d.total_liabilities||0)]]) },
      { title: 'Equity', rows: (d.equity||[]).map(a => [a.account_name, formatCurrency(a.balance)]).concat([['TOTAL EQUITY', formatCurrency(d.total_equity||0)]]) },
    ];
  }

  return (
    <div className="page-enter">
      <div className="page-header">
        <h2>Reports</h2>
        {data && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={handleExportPdf} disabled={exporting}><MdPictureAsPdf /> PDF</button>
            <button className="btn btn-secondary" onClick={handleExportExcel} disabled={exporting}><MdTableChart /> Excel</button>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="reports-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`reports-tab ${tab === t.id ? 'active' : ''}`} onClick={() => { setTab(t.id); setData(null); }}>{t.label}</button>
        ))}
      </div>

      {/* Filters */}
      <div className="reports-filters">
        {(tab === 'sales' || tab === 'expenses' || tab === 'profit-loss') && (
          <>
            <label>From <input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
            <label>To   <input type="date" value={to}   onChange={e => setTo(e.target.value)} /></label>
          </>
        )}
        {(tab === 'balance-sheet' || tab === 'trial-balance') && (
          <label>As of <input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
        )}
        <button className="btn btn-primary" onClick={loadReport} disabled={loading}>{loading ? 'Loading…' : 'Run Report'}</button>
      </div>

      {/* Report output */}
      <div className="reports-output">
        {loading && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading report…</div>}

        {!loading && !data && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
            Select filters and click <b>Run Report</b>
          </div>
        )}

        {!loading && data && (tab === 'trial-balance') && (
          <ReportTable
            headers={['Account Code', 'Account Name', 'Debit', 'Credit']}
            rows={data.map(r => [r.account_code, r.account_name, formatCurrency(r.total_debit), formatCurrency(r.total_credit)])}
          />
        )}

        {!loading && data && tab === 'profit-loss' && <PLReport data={data} />}
        {!loading && data && tab === 'balance-sheet' && <BSReport data={data} />}

        {!loading && data && tab === 'sales' && Array.isArray(data) && (
          <ReportTable
            headers={['Sale #', 'Date', 'Items', 'Total (TZS)', 'Method', 'Recorded By']}
            rows={(data || []).map(r => [
              r.sale_number,
              formatDate(r.sale_date),
              r.item_count,
              formatCurrency(r.total_amount),
              r.payment_method,
              r.created_by_name,
            ])}
          />
        )}

        {!loading && data && tab === 'expenses' && Array.isArray(data) && (
          <ReportTable
            headers={['Date', 'Category', 'Description', 'Method', 'Amount']}
            rows={data.map(r => [formatDate(r.expense_date), r.category_name, r.description||'—', r.payment_method, formatCurrency(r.amount)])}
          />
        )}
      </div>
    </div>
  );
}

function ReportTable({ headers, rows }) {
  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead>
          <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={headers.length} style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '1.5rem' }}>No data</td></tr>
            : rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)
          }
        </tbody>
      </table>
    </div>
  );
}

function PLReport({ data }) {
  return (
    <div className="report-financial">
      <FinSection title="Revenue" accounts={data.revenue} total={data.total_revenue} />
      <FinSection title="Cost of Sales" accounts={data.cost_of_sales} total={data.total_cost_of_sales} />
      <FinSection title="Operating Expenses" accounts={data.expenses} total={data.total_expenses} />
      <div className="report-total-row net">
        <span>Net Profit / (Loss)</span>
        <span style={{ color: parseFloat(data.net_profit) >= 0 ? 'var(--color-accent-green)' : 'var(--color-accent-red)' }}>{formatCurrency(data.net_profit)}</span>
      </div>
    </div>
  );
}

function BSReport({ data }) {
  return (
    <div className="report-financial">
      <FinSection title="Assets"      accounts={data.assets}      total={data.total_assets} />
      <FinSection title="Liabilities" accounts={data.liabilities} total={data.total_liabilities} />
      <FinSection title="Equity"      accounts={data.equity}      total={data.total_equity} />
    </div>
  );
}

function FinSection({ title, accounts = [], total }) {
  return (
    <div className="report-section">
      <div className="report-section-title">{title}</div>
      {accounts.map((a, i) => (
        <div key={i} className="report-row">
          <span>{a.account_name}</span>
          <span>{formatCurrency(a.balance)}</span>
        </div>
      ))}
      <div className="report-total-row">
        <span>Total {title}</span>
        <span>{formatCurrency(total)}</span>
      </div>
    </div>
  );
}
