import { useState, useEffect, useCallback } from 'react';
import { MdTrendingUp, MdAccountBalance, MdWork, MdWarning, MdReceipt } from 'react-icons/md';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../../api/axios';
import useUiStore from '../../stores/uiStore';
import StatCard from '../../components/common/StatCard';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import '../../styles/Dashboard.css';

const COLORS = ['#2ecc71','#3498db','#e67e22','#e74c3c','#9b59b6','#1abc9c','#f39c12','#34495e'];

const STATUS_CLASS = { invoice: 'badge-info', expense: 'badge-danger' };

export default function Dashboard() {
  const addToast = useUiStore(s => s.addToast);
  const [summary, setSummary]     = useState(null);
  const [revenue, setRevenue]     = useState([]);
  const [expChart, setExpChart]   = useState([]);
  const [activity, setActivity]   = useState([]);
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async () => {
    try {
      const [sum, rev, exp, act] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/dashboard/charts/revenue'),
        api.get('/dashboard/charts/expenses'),
        api.get('/dashboard/recent-activity'),
      ]);
      setSummary(sum.data.data);
      setRevenue(rev.data.data);
      setExpChart(exp.data.data);
      setActivity(act.data.data);
    } catch { addToast({ type: 'error', message: 'Failed to load dashboard' }); }
    finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const s = summary;

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <button className="btn btn-secondary" onClick={load} style={{ fontSize: '0.8rem' }}>Refresh</button>
      </div>

      {/* Stat Cards */}
      <div className="dashboard-grid">
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

      {/* Charts row */}
      <div className="dashboard-charts">
        <div className="chart-card">
          <p className="chart-card-title">Revenue vs Collections (6 months)</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenue} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2ecc71" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2ecc71" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="col" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3498db" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3498db" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} tickFormatter={v => formatCurrency(v).replace(/\.00$/, '')} />
              <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: 12 }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="revenue"   name="Revenue"   stroke="#2ecc71" fill="url(#rev)" strokeWidth={2} />
              <Area type="monotone" dataKey="collected" name="Collected" stroke="#3498db" fill="url(#col)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <p className="chart-card-title">Expenses by Category</p>
          {expChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={expChart} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={80} label={({ category, percent }) => `${category} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {expChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>No expense data</div>
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
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 36, borderRadius: 'var(--radius)' }} />)}
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
              {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 'var(--radius)' }} />)}
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
              <Tooltip contentStyle={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: 12 }} />
              <Bar dataKey="value" name="Jobs" radius={[0, 4, 4, 0]}>
                {[{ fill: '#e67e22' }, { fill: '#3498db' }, { fill: '#2ecc71' }].map((c, i) => <Cell key={i} fill={c.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
