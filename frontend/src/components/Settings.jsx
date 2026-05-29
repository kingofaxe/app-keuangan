import React, { useState, useRef } from 'react';
import { apiFetch } from '../api';

const MENU_LABELS = {
  dashboard:'📊 Tahunan', mingguan:'📆 Mingguan', real:'💎 Saldo Real', tabungan:'🏦 Tabungan',
  bulanan:'📅 Bulanan',   tambah:'➕ Tambah',      riwayat:'📋 Riwayat',
  kategori:'🏷️ Kategori', dompet:'👛 Dompet',      settings:'⚙️ Settings',
};
const NON_HIDEABLE = ['tambah','settings'];

const ICON_BOX_CLASSES = {
  dashboard: 'icon-box-purple',
  mingguan: 'icon-box-blue',
  real: 'icon-box-green',
  tabungan: 'icon-box-yellow',
  bulanan: 'icon-box-purple',
  tambah: 'icon-box-yellow',
  riwayat: 'icon-box-blue',
  kategori: 'icon-box-purple',
  dompet: 'icon-box-green',
  settings: 'icon-box-blue'
};

export default function Settings({ token, allCategories, prefs, onPrefsChange }) {
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');
  const [dragIdx, setDragIdx] = useState(null);
  const dragOver = useRef(null);

  // PIN states
  const [hasPinSet, setHasPinSet] = useState(localStorage.getItem('hasPinSet') === 'true');
  const [showPinModal, setShowPinModal] = useState(false);
  const [modalStep, setModalStep] = useState(1); // 1 = Enter PIN, 2 = Confirm PIN
  const [modalDigits, setModalDigits] = useState([]);
  const [firstPin, setFirstPin] = useState('');
  const [modalErr, setModalErr] = useState('');

  const openPinSetup = () => {
    setModalDigits([]);
    setFirstPin('');
    setModalErr('');
    setModalStep(1);
    setShowPinModal(true);
  };

  const handleModalKey = (num) => {
    if (modalDigits.length < 6) {
      const updated = [...modalDigits, num];
      setModalDigits(updated);
      if (updated.length === 6) {
        if (modalStep === 1) {
          setFirstPin(updated.join(''));
          setModalDigits([]);
          setModalStep(2);
          setModalErr('');
        } else {
          const secondPin = updated.join('');
          if (secondPin === firstPin) {
            savePin(secondPin);
          } else {
            setModalErr('PIN tidak cocok! Silakan coba lagi.');
            setModalDigits([]);
            setModalStep(1);
            setFirstPin('');
          }
        }
      }
    }
  };

  const savePin = async (pinValue) => {
    setSaving(true);
    setMsg('');
    try {
      await apiFetch('/user/pin', {
        method: 'PUT',
        body: JSON.stringify({ pin: pinValue })
      }, token);
      localStorage.setItem('hasPinSet', 'true');
      setHasPinSet(true);
      setShowPinModal(false);
      setMsg('✅ PIN Login berhasil disimpan!');
      setTimeout(() => setMsg(''), 3000);
    } catch(e) {
      setModalErr(e.message || 'Gagal menyimpan PIN');
      setModalDigits([]);
    } finally {
      setSaving(false);
    }
  };

  const deletePin = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus PIN login?')) return;
    setSaving(true);
    setMsg('');
    try {
      await apiFetch('/user/pin', {
        method: 'PUT',
        body: JSON.stringify({ pin: null })
      }, token);
      localStorage.setItem('hasPinSet', 'false');
      setHasPinSet(false);
      setMsg('✅ PIN Login berhasil dihapus!');
      setTimeout(() => setMsg(''), 3000);
    } catch(e) {
      setMsg('❌ Gagal menghapus PIN: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const menuOrder      = prefs?.menuOrder      || ['dashboard','real','tabungan','bulanan','tambah','riwayat','kategori','dompet','settings'];
  const hiddenSections = prefs?.hiddenSections || [];
  const tabInCats      = prefs?.tabInCats      || [];
  const tabOutCats     = prefs?.tabOutCats     || [];

  const savePrefs = async (updated) => {
    setSaving(true); setMsg('');
    try {
      await apiFetch('/preferences', { method:'PUT', body: JSON.stringify(updated) }, token);
      onPrefsChange(updated);
      setMsg('✅ Tersimpan!');
      setTimeout(() => setMsg(''), 2000);
    } catch(e) { setMsg('❌ ' + e.message); }
    finally { setSaving(false); }
  };

  // Drag & drop menu
  const onDragStart = i => setDragIdx(i);
  const onDragEnter = i => { dragOver.current = i; };
  const onDragEnd   = () => {
    const from = dragIdx; const to = dragOver.current;
    setDragIdx(null); dragOver.current = null;
    if (from===null || to===null || from===to) return;
    const newOrder = [...menuOrder];
    const [moved]  = newOrder.splice(from, 1);
    newOrder.splice(to, 0, moved);
    savePrefs({ menuOrder:newOrder, hiddenSections, tabInCats, tabOutCats });
  };

  const toggleHidden = id => {
    if (NON_HIDEABLE.includes(id)) return;
    const updated = hiddenSections.includes(id)
      ? hiddenSections.filter(x=>x!==id)
      : [...hiddenSections, id];
    savePrefs({ menuOrder, hiddenSections:updated, tabInCats, tabOutCats });
  };

  // Toggle kategori tabungan - multi select
  const toggleTabCat = (name, key) => {
    const list    = key==='tabInCats' ? tabInCats : tabOutCats;
    const updated = list.includes(name) ? list.filter(x=>x!==name) : [...list, name];
    savePrefs({
      menuOrder, hiddenSections,
      tabInCats:  key==='tabInCats'  ? updated : tabInCats,
      tabOutCats: key==='tabOutCats' ? updated : tabOutCats,
    });
  };

  // Kelompokkan kategori per dompet (dari allCategories yang sudah include wallet_id info)
  // allCategories berisi { id, name, type, wallet_id } — kita group by type
  const incCats = allCategories.filter(c => c.type==='income');
  const expCats = allCategories.filter(c => c.type==='expense');
  // Deduplicate by name
  const uniqueInc = [...new Map(incCats.map(c=>[c.name,c])).values()];
  const uniqueExp = [...new Map(expCats.map(c=>[c.name,c])).values()];

  return (
    <div>
      <h3 style={{marginBottom:4,fontSize:15}}>⚙️ Pengaturan</h3>
      <p style={{fontSize:12,color:'#9ca3af',marginBottom:14}}>Kustomisasi tampilan dan perilaku app</p>

      {msg && (
        <div style={{padding:'8px 12px',borderRadius:8,marginBottom:12,fontSize:13,
          background:msg.startsWith('✅')?'#dcfce7':'#fee2e2',
          color:msg.startsWith('✅')?'#166534':'#991b1b'}}>
          {msg} {saving && '⏳'}
        </div>
      )}

      {/* URUTAN MENU */}
      <div style={s.section}>
        <div style={s.secTitle}>📋 Urutan & Visibilitas Menu</div>
        <div style={{fontSize:12,color:'#9ca3af',marginBottom:10}}>⠿ Drag untuk ubah urutan · Klik untuk sembunyikan</div>
        {menuOrder.map((id, i) => {
          const isHidden   = hiddenSections.includes(id);
          const isDragging = dragIdx === i;
          
          const labelWithEmoji = MENU_LABELS[id] || id;
          const emoji = labelWithEmoji.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|\p{Emoji}/gu)?.[0] || '⚙️';
          const labelText = labelWithEmoji.replace(emoji, '').trim();
          const iconClass = ICON_BOX_CLASSES[id] || 'icon-box-blue';
          
          return (
            <div key={id}
              draggable
              onDragStart={() => onDragStart(i)}
              onDragEnter={() => onDragEnter(i)}
              onDragEnd={onDragEnd}
              onDragOver={e => e.preventDefault()}
              className="settings-item"
              style={{
                opacity: isDragging ? 0.4 : 1,
                borderLeft: isDragging ? '4px solid var(--primary)' : '1px solid var(--border)',
                cursor: 'grab'
              }}>
              <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <span style={{marginRight:12,color:'#9ca3af',fontSize:18}}>⠿</span>
                <div className={`icon-box ${iconClass}`}>
                  {emoji}
                </div>
                <span style={{fontSize:13,fontWeight:700,color:isHidden?'var(--text-muted)':'var(--text)'}}>
                  {labelText}
                </span>
              </div>
              {NON_HIDEABLE.includes(id) ? (
                <span style={{fontSize:10,color:'var(--text-sub)',padding:'4px 8px',background:'var(--bg-input)',borderRadius:12,fontWeight:600}}>wajib</span>
              ) : (
                <button style={{
                  background:isHidden?'var(--bg-input)':'var(--primary)',
                  color:isHidden?'var(--text-sub)':'#111',
                  border:'none',borderRadius:12,padding:'6px 12px',cursor:'pointer',fontSize:11,fontWeight:700
                }} onClick={()=>toggleHidden(id)}>
                  {isHidden ? '🙈 Sembunyi' : '👁️ Tampil'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* KATEGORI TABUNGAN */}
      <div style={s.section}>
        <div style={s.secTitle}>🏦 Kategori Tabungan</div>
        <div style={{fontSize:12,color:'#9ca3af',marginBottom:14}}>
          Pilih kategori yang dihitung sebagai uang masuk/keluar tabungan.
          Bisa pilih lebih dari satu.
        </div>

        {allCategories.length === 0 && (
          <div style={{textAlign:'center',color:'#9ca3af',fontSize:13,padding:16,background:'#f9fafb',borderRadius:8}}>
            Belum ada kategori. Tambahkan di menu 🏷️ Kategori dulu.
          </div>
        )}

        {/* TABUNGAN MASUK */}
        {(uniqueInc.length > 0 || uniqueExp.length > 0) && (
          <>
            <div style={s.tabLabel}>
              📥 Tabungan Masuk
              <span style={{fontSize:11,fontWeight:400,color:'#6b7280',marginLeft:8}}>
                ({tabInCats.length} dipilih)
              </span>
            </div>
            <div style={s.dropGrid}>
              {[...uniqueInc, ...uniqueExp].map(cat => {
                const selected = tabInCats.includes(cat.name);
                return (
                  <button key={`in-${cat.name}`}
                    style={{...s.catChip, background:selected?'#22c55e':'#f3f4f6', color:selected?'#fff':'#374151',
                      border:`2px solid ${selected?'#16a34a':'#e5e7eb'}`}}
                    onClick={() => toggleTabCat(cat.name,'tabInCats')}>
                    {selected && <span style={{marginRight:4}}>✓</span>}
                    {cat.name}
                    <span style={{fontSize:10,opacity:.7,marginLeft:4}}>
                      {cat.type==='income'?'💰':'💸'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* TABUNGAN KELUAR */}
            <div style={{...s.tabLabel,marginTop:14}}>
              📤 Tabungan Keluar
              <span style={{fontSize:11,fontWeight:400,color:'#6b7280',marginLeft:8}}>
                ({tabOutCats.length} dipilih)
              </span>
            </div>
            <div style={s.dropGrid}>
              {[...uniqueInc, ...uniqueExp].map(cat => {
                const selected = tabOutCats.includes(cat.name);
                return (
                  <button key={`out-${cat.name}`}
                    style={{...s.catChip, background:selected?'#ef4444':'#f3f4f6', color:selected?'#fff':'#374151',
                      border:`2px solid ${selected?'#dc2626':'#e5e7eb'}`}}
                    onClick={() => toggleTabCat(cat.name,'tabOutCats')}>
                    {selected && <span style={{marginRight:4}}>✓</span>}
                    {cat.name}
                    <span style={{fontSize:10,opacity:.7,marginLeft:4}}>
                      {cat.type==='income'?'💰':'💸'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* SUMMARY */}
            {(tabInCats.length > 0 || tabOutCats.length > 0) && (
              <div style={{marginTop:14,padding:'10px 14px',background:'#f0fdf4',borderRadius:10,fontSize:12}}>
                {tabInCats.length > 0 && (
                  <div style={{marginBottom:4}}>
                    <span style={{color:'#166534',fontWeight:700}}>📥 Masuk: </span>
                    {tabInCats.join(', ')}
                  </div>
                )}
                {tabOutCats.length > 0 && (
                  <div>
                    <span style={{color:'#991b1b',fontWeight:700}}>📤 Keluar: </span>
                    {tabOutCats.join(', ')}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* KEAMANAN / PIN LOGIN */}
      <div style={s.section}>
        <div style={s.secTitle}>🔒 Keamanan & PIN Login</div>
        <div style={{fontSize:12,color:'#9ca3af',marginBottom:14}}>
          Gunakan PIN 6-digit untuk masuk ke aplikasi dengan cepat di perangkat ini tanpa mengetik password.
        </div>

        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', background:'#fff', borderRadius:9, boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
          <div>
            <div style={{fontSize:13, fontWeight:600, color: hasPinSet ? '#166534' : '#1f2937'}}>
              {hasPinSet ? '🟢 PIN Login Aktif' : '⚪ PIN Belum Diatur'}
            </div>
            <div style={{fontSize:11, color:'#9ca3af', marginTop:2}}>
              {hasPinSet ? 'Anda bisa login cepat menggunakan PIN' : 'Atur PIN Anda sekarang'}
            </div>
          </div>

          <div style={{display:'flex', gap:8}}>
            {hasPinSet && (
              <button 
                style={{background:'#fee2e2', color:'#ef4444', border:'none', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:12, fontWeight:600}}
                onClick={deletePin}
                disabled={saving}
              >
                Hapus
              </button>
            )}
            <button 
              style={{background:hasPinSet?'#f3f4f6':'#667eea', color:hasPinSet?'#4b5563':'#fff', border:'none', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:12, fontWeight:600}}
              onClick={openPinSetup}
              disabled={saving}
            >
              {hasPinSet ? 'Ubah PIN' : 'Atur PIN'}
            </button>
          </div>
        </div>
      </div>

      {/* PIN SETUP MODAL OVERLAY */}
      {showPinModal && (
        <div style={ms.overlay}>
          <div style={ms.modal}>
            <div style={{textAlign:'right'}}>
              <button style={ms.closeBtn} onClick={() => setShowPinModal(false)}>✕</button>
            </div>
            
            <h4 style={{fontSize:16, fontWeight:700, textAlign:'center', marginBottom:4}}>
              {modalStep === 1 ? 'Atur PIN 6-Digit Baru' : 'Konfirmasi PIN Anda'}
            </h4>
            <p style={{fontSize:12, color:'#9ca3af', textAlign:'center', marginBottom:16}}>
              {modalStep === 1 ? 'Masukkan 6 digit angka untuk PIN Anda' : 'Masukkan kembali PIN yang Anda buat'}
            </p>

            {modalErr && <div style={{...s.err, textAlign:'center', padding:'6px 10px', fontSize:12, borderRadius:6}}>{modalErr}</div>}

            <div className="pin-dots" style={{justifyContent:'center', margin:'16px 0'}}>
              {[0, 1, 2, 3, 4, 5].map((idx) => (
                <div 
                  key={idx} 
                  className={`pin-dot ${idx < modalDigits.length ? 'active' : ''}`}
                />
              ))}
            </div>

            <div className="pin-pad-container" style={{maxWidth:240}}>
              <div className="pin-grid" style={{gap:10}}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button 
                    key={num} 
                    className="pin-btn" 
                    style={{width:50, height:50, fontSize:'1.2rem'}}
                    onClick={() => handleModalKey(num)}
                  >
                    {num}
                  </button>
                ))}
                <button 
                  className="pin-btn action" 
                  style={{width:50, height:50}}
                  onClick={() => setModalDigits([])}
                >
                  C
                </button>
                <button 
                  className="pin-btn" 
                  style={{width:50, height:50, fontSize:'1.2rem'}}
                  onClick={() => handleModalKey(0)}
                >
                  0
                </button>
                <button 
                  className="pin-btn action" 
                  style={{width:50, height:50}}
                  onClick={() => setModalDigits(modalDigits.slice(0, -1))}
                >
                  ⌫
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ms = {
  overlay: { position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:16 },
  modal: { background:'var(--bg-app)', color:'var(--text)', padding:20, borderRadius:16, width:'100%', maxWidth:320, boxShadow:'var(--shadow-app)' },
  closeBtn: { background:'none', border:'none', color:'var(--text-muted)', fontSize:16, cursor:'pointer' }
};

const s = {
  section:  {background:'#f8f9fa',borderRadius:12,padding:14,marginBottom:14},
  secTitle: {fontWeight:700,fontSize:14,marginBottom:10,color:'#1f2937'},
  menuRow:  {display:'flex',alignItems:'center',padding:'10px 12px',borderRadius:9,marginBottom:6,
             boxShadow:'0 1px 3px rgba(0,0,0,.06)',userSelect:'none'},
  tabLabel: {fontSize:13,fontWeight:700,color:'#374151',marginBottom:8},
  dropGrid: {display:'flex',flexWrap:'wrap',gap:8,marginBottom:4},
  catChip:  {fontSize:12,fontWeight:600,padding:'6px 12px',borderRadius:20,cursor:'pointer',
             transition:'all .15s',display:'flex',alignItems:'center'},
};
