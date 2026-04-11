import { useState, useEffect, useCallback } from 'react';
import { MdAdd, MdEdit, MdDelete } from 'react-icons/md';
import api from '../../api/axios';
import useUiStore from '../../stores/uiStore';
import useAuth from '../../hooks/useAuth';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import FormField from '../../components/common/FormField';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDateTime } from '../../utils/formatDate';
import '../../styles/InventoryPage.css';

const TABS = { items: 'items', low: 'low', movements: 'movements' };

function validate(form) {
  const e = {};
  if (!form.item_name?.trim()) e.item_name = 'Name required';
  if (!form.sku?.trim()) e.sku = 'SKU required';
  if (form.unit_cost === '' || isNaN(parseFloat(form.unit_cost))) e.unit_cost = 'Valid cost required';
  return e;
}

export default function InventoryPage() {
  const { user } = useAuth();
  const addToast = useUiStore((s) => s.addToast);
  const canManage = ['super_admin', 'store_manager'].includes(user?.role);

  const [tab, setTab] = useState(TABS.items);
  const [items, setItems] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [movements, setMovements] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteMovTarget, setDeleteMovTarget] = useState(null);
  const [deletingMov, setDeletingMov] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ item_name: '', sku: '', unit: 'pcs', quantity: '0', unit_cost: '', reorder_level: '0', category_id: '', supplier_id: '' });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const load = useCallback(async () => {
    try {
      const [itemsRes, catRes] = await Promise.all([api.get('/inventory'), api.get('/inventory/categories')]);
      setItems(itemsRes.data.data);
      setCategories(catRes.data.data);
      const supRes = await api.get('/suppliers').catch(() => ({ data: { data: [] } }));
      setSuppliers(supRes.data.data);
    } catch { addToast({ type: 'error', message: 'Failed to load inventory' }); }
    finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab === TABS.low) api.get('/inventory/low-stock').then(({ data }) => setLowStock(data.data)).catch(() => {});
    if (tab === TABS.movements) api.get('/inventory/movements').then(({ data }) => setMovements(data.data)).catch(() => {});
  }, [tab]);

  function openCreate() {
    setEditItem(null);
    setForm({ item_name: '', sku: '', unit: 'pcs', quantity: '0', unit_cost: '', reorder_level: '0', category_id: '', supplier_id: '' });
    setErrors({}); setTouched({}); setModalOpen(true);
  }

  function openEdit(item) {
    setEditItem(item);
    setForm({ item_name: item.item_name, sku: item.sku, unit: item.unit, quantity: String(item.quantity), unit_cost: String(item.unit_cost), reorder_level: String(item.reorder_level), category_id: item.category_id || '', supplier_id: item.supplier_id || '' });
    setErrors({}); setTouched({}); setModalOpen(true);
  }

  function setField(k, v) {
    const next = { ...form, [k]: v };
    setForm(next); setTouched((t) => ({ ...t, [k]: true })); setErrors(validate(next));
  }

  async function handleSave() {
    setTouched(Object.fromEntries(Object.keys(form).map((k) => [k, true])));
    const errs = validate(form); setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const payload = { ...form, unit_cost: parseFloat(form.unit_cost), reorder_level: parseFloat(form.reorder_level) || 0, category_id: form.category_id || null, supplier_id: form.supplier_id || null };
      if (!editItem) payload.quantity = parseFloat(form.quantity) || 0;
      if (editItem) {
        await api.put(`/inventory/${editItem.id}`, payload);
        addToast({ type: 'success', message: 'Item updated' });
      } else {
        await api.post('/inventory', payload);
        addToast({ type: 'success', message: 'Item created' });
      }
      setModalOpen(false); load();
    } catch (err) { addToast({ type: 'error', message: err.response?.data?.error || 'Save failed' }); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/inventory/${deleteTarget.id}`);
      addToast({ type: 'success', message: 'Item deleted' });
      setDeleteTarget(null); load();
    } catch (err) { addToast({ type: 'error', message: err.response?.data?.error || 'Delete failed' }); }
    finally { setDeleting(false); }
  }

  async function handleDeleteMovement() {
    setDeletingMov(true);
    try {
      await api.delete(`/inventory/movements/${deleteMovTarget.id}`);
      addToast({ type: 'success', message: 'Movement deleted and stock updated' });
      setDeleteMovTarget(null);
      api.get('/inventory/movements').then(({ data }) => setMovements(data.data)).catch(() => {});
    } catch (err) { addToast({ type: 'error', message: err.response?.data?.error || 'Delete failed' }); }
    finally { setDeletingMov(false); }
  }

  const isFormValid = Object.keys(validate(form)).length === 0;

  const ITEM_COLS = [
    { key: 'sku', label: 'SKU', render: (v) => <code style={{ fontSize: '0.8rem', color: 'var(--color-accent-blue)' }}>{v}</code> },
    { key: 'item_name', label: 'Name' },
    { key: 'category_name', label: 'Category', render: (v) => v || '—' },
    { key: 'unit', label: 'Unit' },
    { key: 'quantity', label: 'Stock', render: (v, row) => (
      <span style={{ color: parseFloat(v) <= parseFloat(row.reorder_level) ? 'var(--color-accent-orange)' : 'var(--color-accent-green)', fontWeight: 600 }}>{v} {row.unit}</span>
    )},
    { key: 'unit_cost', label: 'Unit Cost', render: (v) => formatCurrency(v) },
    { key: 'reorder_level', label: 'Reorder At' },
  ];

  const MOVE_COLS = [
    { key: 'created_at', label: 'Date', render: (v) => formatDateTime(v) },
    { key: 'item_name', label: 'Item' },
    { key: 'movement_type', label: 'Type', render: (v) => <span className={`badge badge-${v === 'in' ? 'success' : v === 'out' ? 'danger' : 'warning'}`}>{v}</span> },
    { key: 'quantity', label: 'Qty' },
    { key: 'reference_type', label: 'Source' },
    { key: 'created_by_name', label: 'By' },
  ];

  const tabList = [
    { id: TABS.items, label: 'All Items' },
    { id: TABS.low, label: lowStock.length ? `Low Stock (${lowStock.length})` : 'Low Stock' },
    { id: TABS.movements, label: 'Stock Movements' },
  ];

  return (
    <div className="inventory-page page-enter">
      <div className="page-header">
        <h2>Inventory Management</h2>
        {canManage && <button className="btn btn-primary" onClick={openCreate}><MdAdd /> Add Item</button>}
      </div>

      <div className="tabs">
        {tabList.map((t) => <button key={t.id} className={`tab-btn${tab === t.id ? ' tab-btn--active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {tab === TABS.items && (
            <DataTable columns={ITEM_COLS} data={items} searchable searchPlaceholder="Search inventory…"
              actions={canManage ? (row) => (<><button className="btn-icon" onClick={() => openEdit(row)}><MdEdit /></button><button className="btn-icon" style={{ color: 'var(--color-accent-red)' }} onClick={() => setDeleteTarget(row)}><MdDelete /></button></>) : undefined}
            />
          )}
          {tab === TABS.low && (
            lowStock.length === 0
              ? <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>✓ All items are adequately stocked</div>
              : <DataTable columns={ITEM_COLS} data={lowStock} searchable />
          )}
          {tab === TABS.movements && (
            <DataTable columns={MOVE_COLS} data={movements} searchable searchPlaceholder="Search movements…"
              actions={canManage ? (row) => (
                <button className="btn-icon" style={{ color: 'var(--color-accent-red)' }} title="Delete movement" onClick={() => setDeleteMovTarget(row)}>
                  <MdDelete />
                </button>
              ) : undefined}
            />
          )}
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Item' : 'New Inventory Item'} size="lg"
        footer={<><button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={saving || !isFormValid}>{saving ? 'Saving…' : editItem ? 'Save' : 'Create'}</button></>}
      >
        <div className="user-form">
          <div className="form-row">
            <FormField label="Item Name" error={touched.item_name && errors.item_name} required htmlFor="inv-name"><input id="inv-name" value={form.item_name} onChange={(e) => setField('item_name', e.target.value)} placeholder="Acrylic Paint — White" /></FormField>
            <FormField label="SKU" error={touched.sku && errors.sku} required htmlFor="inv-sku"><input id="inv-sku" value={form.sku} onChange={(e) => setField('sku', e.target.value)} placeholder="PAINT-001" disabled={Boolean(editItem)} /></FormField>
          </div>
          <div className="form-row">
            <FormField label="Unit Cost (TZS)" error={touched.unit_cost && errors.unit_cost} required htmlFor="inv-cost"><input id="inv-cost" type="number" min="0" step="0.01" value={form.unit_cost} onChange={(e) => setField('unit_cost', e.target.value)} placeholder="0.00" /></FormField>
            <FormField label="Unit" htmlFor="inv-unit"><input id="inv-unit" value={form.unit} onChange={(e) => setField('unit', e.target.value)} placeholder="pcs, litre, kg" /></FormField>
          </div>
          <div className="form-row">
            {!editItem && <FormField label="Opening Qty" htmlFor="inv-qty"><input id="inv-qty" type="number" min="0" step="0.01" value={form.quantity} onChange={(e) => setField('quantity', e.target.value)} /></FormField>}
            <FormField label="Reorder Level" htmlFor="inv-reorder"><input id="inv-reorder" type="number" min="0" step="0.01" value={form.reorder_level} onChange={(e) => setField('reorder_level', e.target.value)} /></FormField>
          </div>
          <div className="form-row">
            <FormField label="Category" htmlFor="inv-cat">
              <select id="inv-cat" value={form.category_id} onChange={(e) => setField('category_id', e.target.value)}>
                <option value="">— None —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="Supplier" htmlFor="inv-sup">
              <select id="inv-sup" value={form.supplier_id} onChange={(e) => setField('supplier_id', e.target.value)}>
                <option value="">— None —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormField>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} loading={deleting}
        title="Delete Item" message={`Delete "${deleteTarget?.item_name}"? This cannot be undone.`} variant="danger"
      />

      <ConfirmDialog open={Boolean(deleteMovTarget)} onClose={() => setDeleteMovTarget(null)} onConfirm={handleDeleteMovement} loading={deletingMov}
        title="Delete Stock Movement"
        message={`Delete this ${deleteMovTarget?.movement_type} movement of ${deleteMovTarget?.quantity} ${deleteMovTarget?.item_name}? Stock will be reversed.`}
        variant="danger"
      />
    </div>
  );
}
