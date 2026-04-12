import { useState, useEffect, useCallback } from 'react';
import { MdTrendingUp, MdAccountBalance, MdWarning, MdReceipt } from 'react-icons/md';
import { FiRefreshCw, FiLoader } from 'react-icons/fi';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import api from '../../api/axios';
import useUiStore from '../../stores/uiStore';
import useAuthStore from '../../stores/authStore';
import StatCard from '../../components/common/StatCard';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import '../../styles/Dashboard.css';

const PIE_COLORS = ['#F97316','#FB923C','#FDBA74','#3498db','#2ecc71','#e74c3c','#9b59b6','#1abc9c'];

const STATUS_CLASS = { invoice: 'badge-info', expense: 'badge-danger' };

export default function Dashboard() {
  const addToast  = useUiStore(s => s.addToast);
  const user      = useAuthStore(s => s.user);

  const [summary, setSummary]     = useState(null);
  const [revenue, setRevenue]     = useState([]);
  const [expChart, setExpChart]   = useState([]);
  const [activity, setActivity]   = useState([]);
  const [loading, setLoading]     = useState(true);
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

      setSummary(sum.data?.data || null);
      setRevenue(rev.data?.data || []);
      setExpChart(exp.data?.data || []);
      setActivity(act.data?.data || []);
    } catch {
      addToast({ type: 'error', message: 'Failed to load dashboard' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast, chartMonths]);

  useEffect(() => { load(); }, [load]);

  // ✅ SAFE FALLBACK (CRITICAL FIX)
  const s = summary || {
    revenue: { month: 0, collected: 0 },
    expenses: { month: 0 },
    profit: { month: 0 },
    invoices: { outstanding: 0, overdue: 0 },
    lowStock: []
  };

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const customTooltip = ({ active, payload, label }) => {
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

      {/* Stats */}
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

      {/* Filters */}
      <div className="chart-filters">
        <span>Show last:</span>
        {[3,6,12].map(m => (
          <button key={m}
            className={`chart-filter-btn${chartMonths === m ? ' active' : ''}`}
            onClick={() => setChartMonths(m)}>
            {m}m
          </button>
        ))}
      </div>

      {/* Charts */}
      <div className="dashboard-charts">

        {/* Revenue */}
        <div className="chart-card">
          <p className="chart-card-title">Revenue vs Collections</p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={revenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip content={customTooltip} />
              <Legend />
              <Area dataKey="revenue" stroke="#F97316" fillOpacity={0.2} />
              <Area dataKey="collected" stroke="#FB923C" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Expenses */}
        <div className="chart-card">
          <p className="chart-card-title">Expenses by Category</p>
          {expChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={expChart}
                  dataKey="total"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {expChart.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [formatCurrency(value), name]}
                  contentStyle={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                />
                <Legend
                  formatter={(value) => <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              No expense data for this period
            </div>
          )}
        </div>

      </div>

      {/* Bottom */}
      <div className="dashboard-bottom">

        {/* Low Stock */}
        <div className="chart-card">
          <p className="chart-card-title">
            Low Stock Alerts
            {s.lowStock.length > 0 && (
              <span className="badge badge-danger" style={{ marginLeft: '0.5rem', verticalAlign: 'middle' }}>
                {s.lowStock.length}
              </span>
            )}
          </p>
          {s.lowStock.length > 0 ? (
            <div className="low-stock-list">
              {s.lowStock.map(item => (
                <div key={item.id} className="low-stock-item">
                  <span className="low-stock-item-name">{item.item_name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="low-stock-qty">
                      {parseFloat(item.quantity)} left
                    </span>
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

        {/* Activity */}
        <div className="chart-card">
          <p className="chart-card-title">Recent Activity</p>
          {activity.length > 0 ? (
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