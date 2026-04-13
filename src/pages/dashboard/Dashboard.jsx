import { useState, useEffect, useCallback } from 'react';
import { MdTrendingUp, MdAccountBalance, MdWarning, MdReceipt } from 'react-icons/md';
import { FiRefreshCw, FiLoader } from 'react-icons/fi';
import {
  AreaChart, Area, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import api from '../../api/axios';
import useUiStore from '../../stores/uiStore';
import useAuthStore from '../../stores/authStore';
import StatCard from '../../components/common/StatCard';
import LowStockAlert from '../../components/common/LowStockAlert';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import '../../styles/Dashboard.css';

const PIE_COLORS = ['#F97316','#3498db','#2ecc71','#e74c3c','#9b59b6','#1abc9c','#f39c12','#FB923C'];

export default function Dashboard() {
  const addToast = useUiStore(s => s.addToast);
  const user     = useAuthStore(s => s.user);

  const [summary, setSummary]   = useState(null);
  const [revenue, setRevenue]   = useState([]);
  const [expChart, setExpChart] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartMonths, setChartMonths] = useState(6);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [sum, rev, exp, act] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/dashboard/charts/revenue', { params: { months: chartMonths } }),
        api.get('/dashboard/charts/expenses', { params: { months: chartMonths } }),
        api.get('/dashboard/recent-activity'),
      ]);
      setSummary(sum.data?.data  || null);
      setRevenue(rev.data?.data  || []);
      // Sanitise + embed fill color so Cell is not needed (Recharts v3)
      setExpChart(
        (exp.data?.data || [])
          .map((r, i) => ({
            ...r,
            total:    parseFloat(r.total) || 0,
            category: r.category || 'Uncategorised',
            fill:     PIE_COLORS[i % PIE_COLORS.length],
          }))
          .filter(r => r.total > 0)
      );
      setActivity(act.data?.data || []);
    } catch {
      addToast({ type: 'error', message: 'Failed to load dashboard' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast, chartMonths]);

  useEffect(() => { load(); }, [load]);

  // Safe fallback so stat cards never crash on null summary
  const s = summary || {
    revenue:  { month: 0, collected: 0 },
    expenses: { month: 0 },
    profit:   { month: 0 },
    invoices: { outstanding: 0, overdue: 0 },
    lowStock: [],
  };

  // Precomputed grand total for percentage calculations
  const grandTotal = expChart.reduce((acc, r) => acc + r.total, 0);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // ── Revenue tooltip ───────────────────────────────────────────
  const revenueTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.9rem', fontSize: 12 }}>
        <p style={{ fontWeight: 600, marginBottom: 4, color: 'var(--color-text-primary)' }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {formatCurrency(p.value)}</p>
        ))}
      </div>
    );
  };

  // ── Expense doughnut tooltip ──────────────────────────────────
  const expTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const { name, value } = payload[0];
    const pct = grandTotal > 0 ? ((value / grandTotal) * 100).toFixed(1) : '0';
    return (
      <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.95rem', fontSize: 12, minWidth: 160 }}>
        <p style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6 }}>{name}</p>
        <p style={{ color: 'var(--color-accent-red)', fontWeight: 600 }}>{formatCurrency(value)}</p>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 2 }}>{pct}% of total</p>
      </div>
    );
  };

  return (
    <div className="page-enter">

      {/* Welcome */}
      <div className="dashboard-welcome">
        <div className="welcome-text">
          <h1>Welcome back, {user?.full_name || 'Admin'}</h1>
          <p>{today}</p>
        </div>
        <button className="refresh-btn" onClick={() => load(true)} disabled={refreshing}>
          {refreshing ? <FiLoader className="spin" /> : <FiRefreshCw />}
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {/* Low stock banner — auto-updates when summary refreshes */}
      {!loading && (s.lowStock?.length || 0) > 0 && (
        <LowStockAlert items={s.lowStock} />
      )}

      {/* Stat cards */}
      <div className="dashboard-grid stagger-children">
        <StatCard icon={<MdTrendingUp />} label="Revenue (This Month)" color="green" loading={loading}
          value={formatCurrency(s.revenue.month)}
          sub={`Collected: ${formatCurrency(s.revenue.collected)}`} />

        <StatCard icon={<MdAccountBalance />} label="Expenses (This Month)" color="red" loading={loading}
          value={formatCurrency(s.expenses.month)} />

        <StatCard icon={<MdTrendingUp />} label="Net Profit (This Month)"
          color={s.profit.month >= 0 ? 'green' : 'red'} loading={loading}
          value={formatCurrency(s.profit.month)} />

        <StatCard icon={<MdReceipt />} label="Outstanding Balance" color="orange" loading={loading}
          value={formatCurrency(s.invoices.outstanding)}
          sub={`${s.invoices.overdue || 0} overdue`} />
      </div>

      {/* Period filter */}
      <div className="chart-filters">
        <span>Show last:</span>
        {[3, 6, 12].map(m => (
          <button key={m}
            className={`chart-filter-btn${chartMonths === m ? ' active' : ''}`}
            onClick={() => setChartMonths(m)}>
            {m}m
          </button>
        ))}
      </div>

      {/* Charts row */}
      <div className="dashboard-charts">

        {/* Revenue area chart */}
        <div className="chart-card">
          <p className="chart-card-title">Revenue vs Collections</p>
          {loading ? (
            <div className="chart-skeleton" />
          ) : revenue.length === 0 ? (
            <div className="chart-empty">No revenue data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={revenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
                <Tooltip content={revenueTooltip} />
                <Legend formatter={v => <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>{v}</span>} />
                <Area dataKey="revenue"   stroke="#F97316" fill="rgba(249,115,22,0.15)"  strokeWidth={2} />
                <Area dataKey="collected" stroke="#2ecc71" fill="rgba(46,204,113,0.12)"  strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Expenses doughnut chart */}
        <div className="chart-card">
          <p className="chart-card-title">Expenses by Category</p>

          {loading ? (
            <div className="chart-skeleton" />
          ) : expChart.length === 0 ? (
            <div className="chart-empty">No expense data for this period</div>
          ) : (
            <>
              {/* Doughnut + center label */}
              <div style={{ position: 'relative' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={expChart}
                      dataKey="total"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius="52%"
                      outerRadius="78%"
                      paddingAngle={2}
                      stroke="none"
                      isAnimationActive
                      animationDuration={600}
                    />
                    <Tooltip content={expTooltip} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center total (absolute overlay — stable across all Recharts versions) */}
                <div className="doughnut-center" aria-hidden="true">
                  <span className="doughnut-center-label">Total</span>
                  <span className="doughnut-center-value">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              {/* Category legend */}
              <div className="exp-legend">
                {expChart.map((item, i) => {
                  const pct = grandTotal > 0
                    ? ((item.total / grandTotal) * 100).toFixed(1)
                    : '0';
                  return (
                    <div key={i} className="exp-legend-item">
                      <span
                        className="exp-legend-swatch"
                        style={{ background: item.fill }}
                      />
                      <span className="exp-legend-name">{item.category}</span>
                      <span className="exp-legend-pct">{pct}%</span>
                      <span className="exp-legend-amt">{formatCurrency(item.total)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

      </div>

      {/* Bottom row */}
      <div className="dashboard-bottom">

        {/* Low stock */}
        <div className="chart-card">
          <p className="chart-card-title">
            Low Stock Alerts
            {(s.lowStock?.length || 0) > 0 && (
              <span className="badge badge-danger" style={{ marginLeft: '0.5rem', verticalAlign: 'middle' }}>
                {s.lowStock.length}
              </span>
            )}
          </p>
          {(s.lowStock?.length || 0) > 0 ? (
            <div className="low-stock-list">
              {s.lowStock.map(item => (
                <div key={item.id} className="low-stock-item">
                  <span className="low-stock-item-name">{item.item_name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="low-stock-qty">{parseFloat(item.quantity)} left</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                      / min {parseFloat(item.reorder_level)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', color: 'var(--color-accent-green)', fontSize: '0.875rem' }}>
              <span>✓</span> All items adequately stocked
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="chart-card">
          <p className="chart-card-title">Recent Activity</p>
          {(activity?.length || 0) > 0 ? (
            <div className="activity-list">
              {activity.map((item, i) => (
                <div key={i} className="activity-item">
                  <div className="activity-item-left">
                    <span className="activity-item-ref">{item.ref}</span>
                    <span className="activity-item-meta">
                      {item.customer_name && item.type === 'invoice' ? item.customer_name + ' · ' : ''}
                      {formatDate(item.date)}
                    </span>
                  </div>
                  <div className="activity-item-right">
                    <span className={`activity-item-amount ${item.type === 'expense' ? 'text-danger' : 'text-success'}`}>
                      {item.type === 'expense' ? '−' : '+'}{formatCurrency(item.amount)}
                    </span>
                    <span className={`badge badge-${item.type === 'expense' ? 'danger' : item.status === 'paid' ? 'success' : item.status === 'partial' ? 'warning' : 'info'}`}>
                      {item.type === 'expense' ? 'expense' : item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '0.75rem', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              No recent activity
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
