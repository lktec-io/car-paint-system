import { useState, useEffect, useCallback } from 'react';
import { MdAdd, MdEdit, MdBuild, MdVisibility } from 'react-icons/md';
import api from '../../api/axios';
import useUiStore from '../../stores/uiStore';
import useAuthStore from '../../stores/authStore';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import FormField from '../../components/common/FormField';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import './JobsPage.css';

const STATUS_CLASS = { pending: 'badge-neutral', in_progress: 'badge-info', completed: 'badge-success', cancelled: 'badge-danger' };
const STATUS_LABEL = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled' };

const COLS = [
  { key: 'vehicle_plate', label: 'Plate No.' },
  { key: 'customer_name', label: 'Customer' },
  { key: 'vehicle_make',  label: 'Vehicle',  render: (v, r) => [v, r.vehicle_model, r.vehicle_color].filter(Boolean).join(' ') || '—' },
  { key: 'technician_name', label: 'Technician', render: v => v || '—' },
  { key: 'start_date',    label: 'Start',    render: v => v ? formatDate(v) : '—' },
  { key: 'estimated_cost', label: 'Est. Cost', render: v => formatCurrency(v) },
  { key: 'actual_cost',   label: 'Act. Cost', render: v => <b>{formatCurrency(v)}</b> },
  { key: 'status', label: 'Status',
    render: v => <span className={`badge ${STATUS_CLASS[v]||'badge-neutral'}`}>{STATUS_LABEL[v]||v}</span> },
];

const blankJob = () => ({
  customer_id: '', vehicle_plate: '', vehicle_make: '', vehicle_model: '', vehicle_color: '',
  job_description: '', assigned_technician_id: '', estimated_cost: '',
  start_date: new Date().toISOString().split('T')[0], notes: '',
});

function validateJob(f) {
  const e = {};
  if (!f.customer_id) e.customer_id = 'Customer required';
  if (!f.vehicle_plate?.trim()) e.vehicle_plate = 'Plate number required';
  return e;
}

export default function JobsPage() {
  const addToast = useUiStore(s => s.addToast);
  const role = useAuthStore(s => s.user?.role);
  const [rows, setRows]           = useState([]);
  const [customers, setCustomers] = useState([]);
  const [techs, setTechs]         = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editJob, setEditJob]     = useState(null);
  const [statusJob, setStatusJob] = useState(null);
  const [matJob, setMatJob]       = useState(null);
  const [viewJob, setViewJob]     = useState(null);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState(blankJob());
  const [errors, setErrors]       = useState({});
  const [touched, setTouched]     = useState({});
  const [newStatus, setNewStatus] = useState('');
  const [materials, setMaterials] = useState([{ inventory_item_id: '', quantity_used: '1' }]);

  const canManage = ['super_admin','store_manager','sales_officer'].includes(role);
  const canStatus = ['super_admin','store_manager','technician'].includes(role);

  const load = useCallback(async () => {
    try {
      const [jobs, custs, users, inv] = await Promise.all([
        api.get('/jobs'), api.get('/customers'),
        api.get('/users'), api.get('/inventory'),
      ]);
      setRows(jobs.data.data);
      setCustomers(custs.data.data);
      setTechs(users.data.data.filter(u => u.role === 'technician' && u.is_active));
      setInventory(inv.data.data);
    } catch { addToast({ type: 'error', message: 'Failed to load jobs' }); }
    finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setForm(blankJob()); setErrors({}); setTouched({}); setCreateOpen(true); }
  function openEdit(r)  {
    setEditJob(r);
    setForm({ customer_id: r.customer_id, vehicle_plate: r.vehicle_plate, vehicle_make: r.vehicle_make||'', vehicle_model: r.vehicle_model||'', vehicle_color: r.vehicle_color||'', job_description: r.job_description||'', assigned_technician_id: r.assigned_technician_id||'', estimated_cost: r.estimated_cost||'', start_date: r.start_date?.split('T')[0]||'', notes: r.notes||'' });
    setErrors({}); setTouched({}); setCreateOpen(true);
  }

  function setField(k, v) {
    const next = { ...form, [k]: v };
    setForm(next); setTouched(t => ({ ...t, [k]: true })); setErrors(validateJob(next));
  }

  async function saveJob() {
    setTouched(Object.fromEntries(Object.keys(form).map(k => [k, true])));
    const errs = validateJob(form); setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const payload = { ...form, estimated_cost: parseFloat(form.estimated_cost)||0, assigned_technician_id: form.assigned_technician_id||null };
      editJob ? await api.put(`/jobs/${editJob.id}`, payload) : await api.post('/jobs', payload);
      addToast({ type: 'success', message: editJob ? 'Job updated' : 'Job created' });
      setCreateOpen(false); setEditJob(null); load();
    } catch (err) { addToast({ type: 'error', message: err.response?.data?.error || 'Save failed' }); }
    finally { setSaving(false); }
  }

  async function updateStatus() {
    if (!newStatus) return;
    setSaving(true);
    try {
      await api.put(`/jobs/${statusJob.id}/status`, { status: newStatus });
      addToast({ type: 'success', message: 'Status updated' });
      setStatusJob(null); load();
    } catch (err) { addToast({ type: 'error', message: err.response?.data?.error || 'Update failed' }); }
    finally { setSaving(false); }
  }

  function setMat(idx, k, v) { setMaterials(m => m.map((it, i) => i === idx ? { ...it, [k]: v } : it)); }
  function addMat()   { setMaterials(m => [...m, { inventory_item_id: '', quantity_used: '1' }]); }
  function remMat(i)  { setMaterials(m => m.filter((_, idx) => idx !== i)); }

  async function addMaterials() {
    if (materials.some(m => !m.inventory_item_id)) return addToast({ type: 'error', message: 'Select all items' });
    setSaving(true);
    try {
      await api.post(`/jobs/${matJob.id}/materials`, { materials: materials.map(m => ({ inventory_item_id: parseInt(m.inventory_item_id), quantity_used: parseFloat(m.quantity_used) })) });
      addToast({ type: 'success', message: 'Materials logged' });
      setMatJob(null); setMaterials([{ inventory_item_id: '', quantity_used: '1' }]); load();
    } catch (err) { addToast({ type: 'error', message: err.response?.data?.error || 'Failed' }); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Jobs</h2>
        {canManage && <button className="btn btn-primary" onClick={openCreate}><MdAdd /> New Job</button>}
      </div>

      <DataTable columns={COLS} data={rows} loading={loading} searchable searchPlaceholder="Search jobs…"
        actions={r => (<>
          <button className="btn-icon" title="View" onClick={() => setViewJob(r)}><MdVisibility /></button>
          {canManage && <button className="btn-icon" title="Edit" onClick={() => openEdit(r)}><MdEdit /></button>}
          {canManage && r.status !== 'cancelled' && r.status !== 'completed' && (
            <button className="btn-icon" title="Log Materials" style={{ color: 'var(--color-accent-blue)' }} onClick={() => { setMatJob(r); setMaterials([{ inventory_item_id: '', quantity_used: '1' }]); }}><MdBuild /></button>
          )}
          {canStatus && r.status !== 'cancelled' && r.status !== 'completed' && (
            <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }} onClick={() => { setStatusJob(r); setNewStatus(r.status); }}>Status</button>
          )}
        </>)}
      />

      {/* Create / Edit Modal */}
      <Modal open={createOpen} onClose={() => { setCreateOpen(false); setEditJob(null); }} title={editJob ? 'Edit Job' : 'New Job'} size="lg"
        footer={<>
          <button className="btn btn-secondary" onClick={() => { setCreateOpen(false); setEditJob(null); }} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={saveJob} disabled={saving || Object.keys(validateJob(form)).length > 0}>{saving ? 'Saving…' : editJob ? 'Save' : 'Create'}</button>
        </>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-row">
            <FormField label="Customer" error={touched.customer_id && errors.customer_id} required htmlFor="job-cust">
              <select id="job-cust" value={form.customer_id} onChange={e => setField('customer_id', e.target.value)}>
                <option value="">Select customer…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="Vehicle Plate" error={touched.vehicle_plate && errors.vehicle_plate} required htmlFor="job-plate">
              <input id="job-plate" value={form.vehicle_plate} onChange={e => setField('vehicle_plate', e.target.value)} placeholder="ABC-1234" />
            </FormField>
          </div>
          <div className="form-row">
            <FormField label="Make" htmlFor="job-make"><input id="job-make" value={form.vehicle_make} onChange={e => setField('vehicle_make', e.target.value)} placeholder="Toyota" /></FormField>
            <FormField label="Model" htmlFor="job-model"><input id="job-model" value={form.vehicle_model} onChange={e => setField('vehicle_model', e.target.value)} placeholder="Camry" /></FormField>
            <FormField label="Color" htmlFor="job-color"><input id="job-color" value={form.vehicle_color} onChange={e => setField('vehicle_color', e.target.value)} placeholder="Red" /></FormField>
          </div>
          <div className="form-row">
            <FormField label="Technician" htmlFor="job-tech">
              <select id="job-tech" value={form.assigned_technician_id} onChange={e => setField('assigned_technician_id', e.target.value)}>
                <option value="">Unassigned</option>
                {techs.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </FormField>
            <FormField label="Estimated Cost" htmlFor="job-est">
              <input id="job-est" type="number" min="0" step="0.01" value={form.estimated_cost} onChange={e => setField('estimated_cost', e.target.value)} />
            </FormField>
            <FormField label="Start Date" htmlFor="job-start">
              <input id="job-start" type="date" value={form.start_date} onChange={e => setField('start_date', e.target.value)} />
            </FormField>
          </div>
          <FormField label="Job Description" htmlFor="job-desc">
            <textarea id="job-desc" rows={2} value={form.job_description} onChange={e => setField('job_description', e.target.value)} placeholder="Describe the work to be done…" />
          </FormField>
          <FormField label="Notes" htmlFor="job-notes">
            <textarea id="job-notes" rows={2} value={form.notes} onChange={e => setField('notes', e.target.value)} />
          </FormField>
        </div>
      </Modal>

      {/* Status Update Modal */}
      <Modal open={!!statusJob} onClose={() => setStatusJob(null)} title="Update Job Status" size="sm"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setStatusJob(null)} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={updateStatus} disabled={saving}>{saving ? 'Updating…' : 'Update'}</button>
        </>}
      >
        {statusJob && (
          <FormField label="New Status" htmlFor="st-sel">
            <select id="st-sel" value={newStatus} onChange={e => setNewStatus(e.target.value)}>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </FormField>
        )}
      </Modal>

      {/* Add Materials Modal */}
      <Modal open={!!matJob} onClose={() => setMatJob(null)} title="Log Materials Used" size="md"
        footer={<>
          <button className="btn btn-secondary" onClick={() => setMatJob(null)} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={addMaterials} disabled={saving}>{saving ? 'Saving…' : 'Log Materials'}</button>
        </>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {materials.map((m, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
              <FormField label={idx === 0 ? 'Item' : ''} htmlFor={`mat-item-${idx}`} style={{ flex: 1 }}>
                <select id={`mat-item-${idx}`} value={m.inventory_item_id} onChange={e => setMat(idx, 'inventory_item_id', e.target.value)}>
                  <option value="">Select item…</option>
                  {inventory.map(i => <option key={i.id} value={i.id}>{i.item_name} (stock: {i.quantity})</option>)}
                </select>
              </FormField>
              <FormField label={idx === 0 ? 'Qty' : ''} htmlFor={`mat-qty-${idx}`} style={{ width: 80 }}>
                <input id={`mat-qty-${idx}`} type="number" min="0.01" step="0.01" value={m.quantity_used} onChange={e => setMat(idx, 'quantity_used', e.target.value)} />
              </FormField>
              {materials.length > 1 && (
                <button className="btn-icon" style={{ color: 'var(--color-accent-red)', marginBottom: '0.1rem' }} onClick={() => remMat(idx)}>✕</button>
              )}
            </div>
          ))}
          <button className="btn btn-secondary" style={{ alignSelf: 'flex-start', fontSize: '0.8rem' }} onClick={addMat}><MdAdd /> Add Row</button>
        </div>
      </Modal>

      {/* View Job Modal */}
      {viewJob && (
        <Modal open={!!viewJob} onClose={() => setViewJob(null)} title={`Job — ${viewJob.vehicle_plate}`} size="md"
          footer={<button className="btn btn-secondary" onClick={() => setViewJob(null)}>Close</button>}
        >
          <div style={{ fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="form-row">
              <div><b>Customer:</b> {viewJob.customer_name}</div>
              <div><b>Status:</b> <span className={`badge ${STATUS_CLASS[viewJob.status]||'badge-neutral'}`}>{STATUS_LABEL[viewJob.status]||viewJob.status}</span></div>
            </div>
            <div className="form-row">
              <div><b>Vehicle:</b> {[viewJob.vehicle_make, viewJob.vehicle_model, viewJob.vehicle_color].filter(Boolean).join(' ') || '—'}</div>
              <div><b>Technician:</b> {viewJob.technician_name || 'Unassigned'}</div>
            </div>
            <div className="form-row">
              <div><b>Est. Cost:</b> {formatCurrency(viewJob.estimated_cost)}</div>
              <div><b>Actual Cost:</b> <b>{formatCurrency(viewJob.actual_cost)}</b></div>
            </div>
            <div className="form-row">
              <div><b>Start:</b> {viewJob.start_date ? formatDate(viewJob.start_date) : '—'}</div>
              <div><b>Completed:</b> {viewJob.completion_date ? formatDate(viewJob.completion_date) : '—'}</div>
            </div>
            {viewJob.job_description && <div><b>Description:</b> {viewJob.job_description}</div>}
            {viewJob.notes && <div><b>Notes:</b> {viewJob.notes}</div>}
          </div>
        </Modal>
      )}
    </div>
  );
}
