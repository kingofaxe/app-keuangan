import React, { useState, useEffect } from 'react';
import { apiFetch, fRp } from '../api';
import { swalConfirm, swalSuccess, swalError } from '../swal.js';

const EMOJIS = [
  '⚡','⛽','🍛','☕','🛒','🚌','🏠','🏥',
  '💰','💵','💸','🪙','🏦','🛍️','👔','📱',
  '🎮','🍿','🐾','💊','🎓','🔧','🎁','📦',
];

export default function TransaksiCepat({ token, wallet, data, onRefresh }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form templates state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('⚡');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [type, setType] = useState('expense');
  const [catId, setCatId] = useState('');
  const [subCatId, setSubCatId] = useState('');
  const [amount, setAmount] = useState('');
  const [remark, setRemark] = useState('');

  // Quick record state
  const [activeTemplateForRecord, setActiveTemplateForRecord] = useState(null);
  const [recordDate, setRecordDate] = useState(today());

  useEffect(() => {
    if (wallet) {
      fetchTemplates();
    }
  }, [wallet]);

  const fetchTemplates = async () => {
    if (!wallet) return;
    setLoading(true);
    try {
      const list = await apiFetch(`/templates?wallet_id=${wallet.id}`, {}, token);
      setTemplates(list);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAmount = e => {
    const r = e.target.value.replace(/\D/g,'');
    setAmount(r ? Number(r).toLocaleString('id-ID') : '');
  };

  const getRawAmount = () => Number(amount.replace(/\D/g,'')) || 0;

  const today = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  };

  const resetForm = () => {
    setName('');
    setIcon('⚡');
    setType('expense');
    setCatId('');
    setSubCatId('');
    setAmount('');
    setRemark('');
    setShowAddForm(false);
    setEditingTemplate(null);
    setShowIconPicker(false);
  };

  const openEdit = (t) => {
    setEditingTemplate(t);
    setName(t.name);
    setIcon(t.icon || '⚡');
    setType(t.type);
    setCatId(String(t.category_id || ''));
    setSubCatId(String(t.sub_category_id || ''));
    setAmount(Number(t.amount).toLocaleString('id-ID'));
    setRemark(t.remark || '');
    setShowAddForm(true);
  };

  const saveTemplate = async () => {
    if (!name.trim()) return swalError('Nama template wajib diisi');
    if (!catId) return swalError('Pilih kategori');
    const nominal = getRawAmount();
    if (nominal <= 0) return swalError('Masukkan nominal yang valid');

    const payload = {
      wallet_id: wallet.id,
      category_id: Number(catId),
      sub_category_id: subCatId ? Number(subCatId) : null,
      name: name.trim(),
      icon,
      type,
      amount: nominal,
      remark
    };

    setLoading(true);
    try {
      if (editingTemplate) {
        await apiFetch(`/templates/${editingTemplate.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        }, token);
        swalSuccess('Template berhasil diperbarui');
      } else {
        await apiFetch('/templates', {
          method: 'POST',
          body: JSON.stringify(payload)
        }, token);
        swalSuccess('Template berhasil ditambahkan');
      }
      resetForm();
      fetchTemplates();
    } catch (e) {
      swalError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteTemplate = async (id) => {
    const res = await swalConfirm('Hapus template transaksi ini?');
    if (!res.isConfirmed) return;

    setLoading(true);
    try {
      await apiFetch(`/templates/${id}`, { method: 'DELETE' }, token);
      swalSuccess('Template berhasil dihapus');
      fetchTemplates();
    } catch (e) {
      swalError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const quickRecord = async () => {
    if (!activeTemplateForRecord) return;
    if (!recordDate) return swalError('Pilih tanggal transaksi');

    setLoading(true);
    try {
      await apiFetch(`/templates/${activeTemplateForRecord.id}/use`, {
        method: 'POST',
        body: JSON.stringify({ date: recordDate })
      }, token);
      swalSuccess('Transaksi berhasil dicatat!');
      setActiveTemplateForRecord(null);
      onRefresh(); // Refresh data utama page
      fetchTemplates(); // Refresh usage stats template
    } catch (e) {
      swalError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = data?.categories?.filter(c => c.type === type) || [];
  const selectedCat = data?.categories?.find(c => String(c.id) === catId);
  const subCats = selectedCat?.sub_categories || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h3 style={{ marginBottom: 4, fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>⚡ Transaksi Cepat</h3>
          <p style={{ fontSize: 12, color: 'var(--text-sub)' }}>Catat pengeluaran rutin hanya dalam 2-klik</p>
        </div>
        {!showAddForm && (
          <button style={s.btnNew} onClick={() => setShowAddForm(true)}>
            ➕ Baru
          </button>
        )}
      </div>

      {error && <div style={s.err}>{error}</div>}

      {/* FORM TAMBAH / EDIT TEMPLATE */}
      {showAddForm && (
        <div style={s.card}>
          <h4 style={{ fontWeight: 700, fontSize: 13, marginBottom: 14, color: 'var(--text)' }}>
            {editingTemplate ? '✏️ Edit Template' : '➕ Tambah Template Baru'}
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 10, marginBottom: 12 }}>
            <div style={{ position: 'relative' }}>
              <label style={s.label}>Ikon</label>
              <button style={s.iconSelectorBtn} onClick={() => setShowIconPicker(!showIconPicker)}>
                <span style={{ fontSize: 24 }}>{icon}</span>
              </button>
              {showIconPicker && (
                <div style={s.iconPickerPopover}>
                  {EMOJIS.map(e => (
                    <button key={e} style={s.iconOpt} onClick={() => { setIcon(e); setShowIconPicker(false); }}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label style={s.label}>Nama Template</label>
              <input style={s.input} placeholder="Misal: Bensin Motor" value={name} onChange={e => setName(e.target.value)} />
            </div>
          </div>

          <div style={s.fg}>
            <label style={s.label}>Tipe</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ ...s.typeBtn, border: type === 'expense' ? '2.5px solid #ef4444' : '1px solid var(--border)', background: type === 'expense' ? '#fee2e2' : 'transparent', color: type === 'expense' ? '#b91c1c' : 'var(--text)' }}
                onClick={() => { setType('expense'); setCatId(''); setSubCatId(''); }}>
                💸 Pengeluaran
              </button>
              <button style={{ ...s.typeBtn, border: type === 'income' ? '2.5px solid #22c55e' : '1px solid var(--border)', background: type === 'income' ? '#dcfce7' : 'transparent', color: type === 'income' ? '#15803d' : 'var(--text)' }}
                onClick={() => { setType('income'); setCatId(''); setSubCatId(''); }}>
                💰 Pemasukan
              </button>
            </div>
          </div>

          <div style={s.fg}>
            <label style={s.label}>Nominal (Rp)</label>
            <input style={s.input} type="text" inputMode="numeric" placeholder="0" value={amount} onChange={handleAmount} />
          </div>

          <div style={s.fg}>
            <label style={s.label}>Kategori</label>
            <select style={s.input} value={catId} onChange={e => { setCatId(e.target.value); setSubCatId(''); }}>
              <option value="">— Pilih Kategori —</option>
              {filteredCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {subCats.length > 0 && (
            <div style={s.fg}>
              <label style={s.label}>Sub Kategori (opsional)</label>
              <select style={s.input} value={subCatId} onChange={e => setSubCatId(e.target.value)}>
                <option value="">— Pilih Sub Kategori —</option>
                {subCats.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
              </select>
            </div>
          )}

          <div style={s.fg}>
            <label style={s.label}>Keterangan (opsional)</label>
            <input style={s.input} placeholder="Catatan tambahan..." value={remark} onChange={e => setRemark(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button style={s.btnSave} onClick={saveTemplate} disabled={loading}>
              {loading ? '⏳ Menyimpan...' : '💾 Simpan'}
            </button>
            <button style={s.btnCancel} onClick={resetForm}>✕ Batal</button>
          </div>
        </div>
      )}

      {/* LIST TEMPLATES */}
      {!showAddForm && (
        <>
          {templates.length === 0 ? (
            <div style={s.empty}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
              <div>Belum ada template transaksi cepat.</div>
              <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 4 }}>
                Tekan tombol "+ Baru" atau aktifkan toggle "Simpan sebagai template" saat mencatat transaksi baru.
              </div>
            </div>
          ) : (
            <div style={s.grid}>
              {templates.map(t => (
                <div key={t.id} style={s.item}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={s.itemIcon}>
                      {t.icon || '📋'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={s.itemName}>{t.name}</div>
                      <div style={s.itemMeta}>
                        {t.category_name} {t.sub_category_name ? ` · ${t.sub_category_name}` : ''}
                      </div>
                      <div style={s.itemUsage}>
                        {t.usage_count > 0 ? (
                          <span>⚡ Dipakai {t.usage_count}x · Terakhir: {t.last_used_at?.slice(0,10)}</span>
                        ) : (
                          <span>Belum pernah digunakan</span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ ...s.itemAmount, color: t.type === 'income' ? '#22c55e' : '#ef4444' }}>
                        {t.type === 'income' ? '+' : '-'} {fRp(t.amount)}
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 6, justifyContent: 'flex-end' }}>
                        <button style={s.iconEditBtn} onClick={() => openEdit(t)} title="Edit Template">✏️</button>
                        <button style={s.iconDelBtn} onClick={() => deleteTemplate(t.id)} title="Hapus Template">🗑️</button>
                      </div>
                    </div>
                  </div>
                  
                  <button style={s.btnRecord} onClick={() => { setActiveTemplateForRecord(t); setRecordDate(today()); }}>
                    📅 Catat Sekarang
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* QUICK ADD MODAL */}
      {activeTemplateForRecord && (
        <div style={s.overlay} onClick={() => setActiveTemplateForRecord(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHead}>
              <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>
                ⚡ Catat Transaksi Cepat
              </span>
              <button style={s.modalClose} onClick={() => setActiveTemplateForRecord(null)}>×</button>
            </div>
            
            <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>{activeTemplateForRecord.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                {activeTemplateForRecord.name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-sub)', marginTop: 2 }}>
                {activeTemplateForRecord.category_name}
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, marginTop: 12, color: activeTemplateForRecord.type === 'income' ? '#22c55e' : '#ef4444' }}>
                {activeTemplateForRecord.type === 'income' ? '+' : '-'} {fRp(activeTemplateForRecord.amount)}
              </div>
            </div>

            <div style={s.fg}>
              <label style={s.label}>Pilih Tanggal</label>
              <input style={s.input} type="date" value={recordDate} onChange={e => setRecordDate(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={{ ...s.btnSave, padding: 12, flex: 1 }} onClick={quickRecord} disabled={loading}>
                {loading ? '⏳ Mencatat...' : '✅ Catat Sekarang!'}
              </button>
              <button style={{ ...s.btnCancel, padding: 12 }} onClick={() => setActiveTemplateForRecord(null)}>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  card:       { background: 'var(--bg-section)', padding: 16, borderRadius: 18, marginBottom: 18, border: '1px solid var(--border)' },
  fg:         { marginBottom: 12 },
  label:      { display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 12, color: 'var(--text-sub)' },
  input:      { width: '100%', padding: '11px 13px', border: '1.5px solid var(--border)', borderRadius: 12, fontSize: 14, background: 'var(--bg-card)', outline: 'none', boxSizing: 'border-box', color: 'var(--text)' },
  btnNew:     { background: 'var(--primary)', color: '#111', border: 'none', padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  iconSelectorBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 46, width: '100%', border: '1.5px solid var(--border)', borderRadius: 12, background: 'var(--bg-card)', cursor: 'pointer' },
  iconPickerPopover: { position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 14, padding: 8, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, width: 220, boxShadow: '0 8px 24px rgba(0,0,0,.15)' },
  iconOpt:    { fontSize: 20, padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s' },
  typeBtn:    { flex: 1, padding: '10px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s ease', outline: 'none' },
  btnSave:    { background: 'var(--primary)', color: '#111', border: 'none', padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  btnCancel:  { background: 'var(--bg-section)', color: 'var(--text-sub)', border: '1.5px solid var(--border)', padding: '9px 18px', borderRadius: 10, fontSize: 13, cursor: 'pointer' },
  err:        { background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 12, fontSize: 13, marginBottom: 14 },
  grid:       { display: 'flex', flexDirection: 'column', gap: 10 },
  item:       { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 14, boxShadow: '0 1px 3px rgba(0,0,0,.04)' },
  itemIcon:   { width: 42, height: 42, borderRadius: 12, background: 'var(--bg-section)', display: 'flex', alignItems: 'center', justifyContext: 'center', justifyContent: 'center', fontSize: 22 },
  itemName:   { fontWeight: 800, fontSize: 14, color: 'var(--text)' },
  itemMeta:   { fontSize: 11, color: 'var(--text-sub)', marginTop: 2 },
  itemUsage:  { fontSize: 10, color: 'var(--text-muted)', marginTop: 3 },
  itemAmount: { fontWeight: 800, fontSize: 14 },
  iconEditBtn: { background: 'var(--bg-section)', border: '1px solid var(--border)', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 11 },
  iconDelBtn: { background: '#fee2e2', border: 'none', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 11 },
  btnRecord:  { width: '100%', background: 'var(--primary-light)', border: '1px solid var(--primary)', color: 'var(--text)', borderRadius: 10, padding: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', marginTop: 10, transition: 'all 0.15s' },
  empty:      { textAlign: 'center', padding: '40px 20px', color: 'var(--text-sub)' },
  overlay:    { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,.5)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal:      { background: 'var(--bg-app)', padding: 18, borderRadius: 18, width: '100%', maxWidth: 360, boxShadow: 'var(--shadow-app)', color: 'var(--text)' },
  modalHead:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalClose: { background: 'none', border: 'none', fontSize: 24, color: 'var(--text-muted)', cursor: 'pointer' },
};
