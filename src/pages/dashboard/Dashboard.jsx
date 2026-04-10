import { useState, useEffect, useCallback, useMemo } from 'react';
import { MdTrendingUp, MdAccountBalance, MdWork, MdWarning, MdReceipt } from 'react-icons/md';
import { FiRefreshCw, FiLoader } from 'react-icons/fi';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
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

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear - 1, currentYear - 2];

export default function Dashboard() {
  const addToast  = useUiStore(s => s.addToast);
  const user      = useAuthStore(s => s.user);

  const [summary, setSummary]     = useState(null);
  const [revenue, setRevenue]     = useState([]);
  const [expChart, setExpChart]   = useState([]);
  const [activity, setActivity]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Chart filters
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
      setSummary(sum.data.data);
      setRevenue(rev.data.data);
      setExpChart(exp.data.data);
      setActivity(act.data.data);
    } catch { addToast({ type: 'error', message: 'Failed to load dashboard' }); }
    finally { setLoading(false); setRefreshing(false); }
  }, [addToast, chartMonths]);

  useEffect(() => { load(); }, [load]);

  const s = summary;

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
      {/* Welcome header */}
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

      {/* Stat Cards */}
      <div className="dashboard-grid stagger-children">
        <StatCard icon={<MdTrendingUp />} label="Revenue (This Month)" color="green" loading={loading}
          value={s ? formatCurrency(s.revenue.month) : '—'}
          sub={s ? `Collected: ${formatCurrency(s.revenue.collected)}` : undefined} />
        <StatCard icon={<MdAccountBalance />} label="Expenses (This Month)" color="red" loading={loading}
          value={s ? formatCurrency(s.expenses.month) : '—'} />
        <StatCard icon={<MdTrendingUp />} label="Net Profit (This Month)" color={s && s.profit.month >= 0 ? 'green' : 'red'} loading={loading}
          value={s ? formatCurrency(s.profit.month) : '—'} />
        <StatCard icon={<MdReceipt />} label="Outstanding Balance" color="orange" loading={loading}
          value={s ? formatCurrency(s.invoices.outstanding) : '—'}
          sub={s ? `${s.invoices.overdue || 0} overdue` : undefined} />
        <StatCard icon={<MdWork />} label="Active Jobs" color="blue" loading={loading}
          value={s ? String(parseInt(s.jobs.in_progress || 0) + parseInt(s.jobs.pending || 0)) : '—'}
          sub={s ? `${s.jobs.completed || 0} completed total` : undefined} />
      </div>

      {/* Chart filters */}
      <div className="chart-filters">
        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>Show last:</span>
        {[3, 6, 12].map(m => (
          <button key={m} className={`chart-filter-btn${chartMonths === m ? ' active' : ''}`} onClick={() => setChartMonths(m)}>{m}m</button>
        ))}
      </div>

      {/* Charts row */}
      <div className="dashboard-charts">
        <div className="chart-card">
          <p className="chart-card-title">Revenue vs Collections</p>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={revenue} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#F97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#FB923C" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#FB923C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} tickFormatter={v => 'TZS ' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v)} />
              <Tooltip content={customTooltip} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="revenue"   name="Revenue"   stroke="#F97316" fill="url(#colorRevenue)"   strokeWidth={2} isAnimationActive />
              <Area type="monotone" dataKey="collected" name="Collected" stroke="#FB923C" fill="url(#colorCollected)" strokeWidth={2} isAnimationActive />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <p className="chart-card-title">Expenses by Category</p>
          {expChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={expChart} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={85}
                  label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false} fontSize={10} isAnimationActive>
                  {expChart.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={customTooltip} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>No expense data</div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="dashboard-bottom">
        {/* Low Stock */}
        <div className="chart-card">
          <p className="chart-card-title"><MdWarning style={{ color: 'var(--color-accent-orange)', verticalAlign: 'middle', marginRight: '0.35rem' }} />Low Stock Alerts</p>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[1,2,3].map(i => <div key={i} className="skeleton skeleton-row" />)}
            </div>
          ) : s?.lowStock?.length > 0 ? (
            <div className="low-stock-list">
              {s.lowStock.map(item => (
                <div key={item.id} className="low-stock-item">
                  <span className="low-stock-item-name">{item.item_name}</span>
                  <span className={`low-stock-qty ${parseFloat(item.quantity) > 0 ? 'ok' : ''}`}>
                    {item.quantity} / {item.reorder_level}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>All stock levels are healthy</p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="chart-card">
          <p className="chart-card-title">Recent Activity</p>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton skeleton-row" />)}
            </div>
          ) : activity.length > 0 ? (
            <div className="activity-list">
              {activity.map((item, i) => (
                <div key={i} className="activity-item">
                  <div className="activity-item-left">
                    <span className="activity-item-ref">{item.ref}</span>
                    <span className="activity-item-meta">{item.customer_name || item.type} · {formatDate(item.date)}</span>
                  </div>
                  <div className="activity-item-right">
                    <span className="activity-item-amount" style={{ color: item.type === 'expense' ? 'var(--color-accent-red)' : 'var(--color-accent-green)' }}>
                      {item.type === 'expense' ? '−' : '+'}{formatCurrency(item.amount)}
                    </span>
                    <span className={`badge ${STATUS_CLASS[item.type] || 'badge-neutral'}`} style={{ fontSize: '0.68rem' }}>{item.type}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>No recent activity</p>
          )}
        </div>
      </div>

      {/* Jobs status bar chart */}
      {s && (
        <div className="chart-card" style={{ marginTop: '1rem' }}>
          <p className="chart-card-title">Jobs by Status</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart layout="vertical" data={[
              { name: 'Pending',     value: parseInt(s.jobs.pending||0) },
              { name: 'In Progress', value: parseInt(s.jobs.in_progress||0) },
              { name: 'Completed',   value: parseInt(s.jobs.completed||0) },
            ]} margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} allowDecimals={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} width={80} />
              <Tooltip contentStyle={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 12 }} />
              <Bar dataKey="value" name="Jobs" radius={[0, 6, 6, 0]} isAnimationActive>
                {[{ fill: '#e67e22' }, { fill: '#3498db' }, { fill: '#2ecc71' }].map((c, i) => <Cell key={i} fill={c.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
