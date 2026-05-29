import { swalConfirm } from '../swal.js';
import React, { useState } from 'react';
import { apiFetch } from '../api';

export default function Kategori({ data, token, wallet, onRefresh }) {
  const [newCatName, setNewCatName]   = useState('');
  const [newCatType, setNewCatType]   = useState('expense');
  const [newSubName, setNewSubName]   = useState({});   // catId -> string
  const [editCat,    setEditCat]      = useState(null); // { id, name, type }
  const [editSub,    setEditSub]      = useState(null); // { id, name }
  const [loading,    setLoading]      = useState(false);
  const [error,      setError]        = useState('');

  const incCats = data.categories.filter(c => c.type==='income');
  const expCats = data.categories.filter(c => c.type==='expense');

  const addCat = async () => {
    if (!newCatName.trim()) return;
    setLoading(true); setError('');
    try {
      await apiFetch('/categories', { method:'POST', body: JSON.stringify({ wallet_id: wallet.id, name: newCatName.trim(), type: newCatType }) }, token);
      setNewCatName(''); onRefresh();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const deleteCat = async (id) => {
    const r = await swalConfirm('Hapus kategori ini? Semua sub kategori ikut terhapus.');
    if (!r.isConfirmed) return;
    setLoading(true);
    try { await apiFetch(`/categories/${id}`, { method:'DELETE' }, token); onRefresh(); }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const saveEditCat = async () => {
    if (!editCat?.name?.trim()) return;
    setLoading(true);
    try {
      await apiFetch(`/categories/${editCat.id}`, { method:'PUT', body: JSON.stringify({ name: editCat.name, type: editCat.type }) }, token);
      setEditCat(null); onRefresh();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const addSub = async (catId) => {
    const name = (newSubName[catId]||'').trim();
    if (!name) return;
    setLoading(true);
    try {
      await apiFetch('/sub-categories', { method:'POST', body: JSON.stringify({ category_id: catId, name }) }, token);
      setNewSubName(prev => ({ ...prev, [catId]: '' })); onRefresh();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const deleteSub = async (id) => {
    const r = await swalConfirm('Hapus sub kategori ini?');
    if (!r.isConfirmed) return;
    setLoading(true);
    try { await apiFetch(`/sub-categories/${id}`, { method:'DELETE' }, token); onRefresh(); }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const saveEditSub = async () => {
    if (!editSub?.name?.trim()) return;
    setLoading(true);
    try {
      await apiFetch(`/sub-categories/${editSub.id}`, { method:'PUT', body: JSON.stringify({ name: editSub.name }) }, token);
      setEditSub(null); onRefresh();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <h3 style={{marginBottom:16,fontSize:16,fontWeight:800,color:'var(--text)'}}>🏷️ Kelola Kategori</h3>

      {error && <div style={s.err}>{error}</div>}

      {/* TAMBAH KATEGORI BARU */}
      <div style={s.addCard}>
        <div style={{fontWeight:700,fontSize:13,marginBottom:12,color:'var(--text)'}}>➕ Tambah Kategori Baru</div>
        <div style={{display:'flex',gap:8,marginBottom:10}}>
          <input style={{...s.input,flex:1}} placeholder="Nama kategori" value={newCatName}
            onChange={e=>setNewCatName(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&addCat()}/>
          <select style={{...s.input,width:140}} value={newCatType} onChange={e=>setNewCatType(e.target.value)}>
            <option value="income">💰 Pemasukan</option>
            <option value="expense">💸 Pengeluaran</option>
          </select>
        </div>
        <button style={s.btnAdd} onClick={addCat} disabled={loading || !newCatName.trim()}>
          {loading ? '⏳ Menyimpan...' : '➕ Tambah Kategori'}
        </button>
      </div>

      {/* LIST KATEGORI */}
      {[{label:'💰 Pemasukan', list: incCats, type:'income'}, {label:'💸 Pengeluaran', list: expCats, type:'expense'}].map(({ label, list, type }) => (
        <div key={type} style={{marginBottom:20}}>
          <div style={{
            ...s.secLabel,
            background: type==='income' ? '#dcfce7' : '#fee2e2',
            color:       type==='income' ? '#166534' : '#991b1b',
          }}>
            {label}
            <span style={{marginLeft:'auto',fontSize:11,fontWeight:500,opacity:0.7}}>{list.length} kategori</span>
          </div>
          {!list.length && <div style={s.empty}>Belum ada kategori</div>}
          {list.map(cat => (
            <div key={cat.id} style={s.catBox}>
              {/* Kategori header */}
              <div style={s.catHeader}>
                {editCat?.id === cat.id ? (
                  <div style={{display:'flex',gap:6,flex:1}}>
                    <input style={{...s.input,flex:1,padding:'7px 11px'}} value={editCat.name}
                      onChange={e=>setEditCat({...editCat,name:e.target.value})}
                      onKeyDown={e=>e.key==='Enter'&&saveEditCat()}/>
                    <button style={s.btnSave}   onClick={saveEditCat}>✅</button>
                    <button style={s.btnCancel} onClick={()=>setEditCat(null)}>✕</button>
                  </div>
                ) : (
                  <>
                    <span style={{fontWeight:700,fontSize:14,color:'var(--text)'}}>{cat.name}</span>
                    <div style={{display:'flex',gap:6}}>
                      <button style={s.btnEdit} onClick={()=>setEditCat({id:cat.id,name:cat.name,type:cat.type})}>✏️</button>
                      <button style={s.btnDel}  onClick={()=>deleteCat(cat.id)}>🗑️</button>
                    </div>
                  </>
                )}
              </div>

              {/* Sub categories */}
              <div style={{padding:'8px 14px 14px'}}>
                {(cat.sub_categories||[]).map(sc => (
                  <div key={sc.id} style={s.subRow}>
                    {editSub?.id === sc.id ? (
                      <div style={{display:'flex',gap:6,flex:1}}>
                        <input style={{...s.input,flex:1,padding:'5px 9px',fontSize:12}} value={editSub.name}
                          onChange={e=>setEditSub({...editSub,name:e.target.value})}
                          onKeyDown={e=>e.key==='Enter'&&saveEditSub()}/>
                        <button style={s.btnSave}   onClick={saveEditSub}>✅</button>
                        <button style={s.btnCancel} onClick={()=>setEditSub(null)}>✕</button>
                      </div>
                    ) : (
                      <>
                        <span style={{fontSize:13,color:'var(--text-sub)'}}>• {sc.name}</span>
                        <div style={{display:'flex',gap:4}}>
                          <button style={s.btnEditSm} onClick={()=>setEditSub({id:sc.id,name:sc.name})}>✏️</button>
                          <button style={s.btnDelSm}  onClick={()=>deleteSub(sc.id)}>🗑️</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}

                {/* Tambah sub kategori */}
                <div style={{display:'flex',gap:6,marginTop:8}}>
                  <input style={{...s.input,flex:1,padding:'7px 10px',fontSize:12}} placeholder="+ Sub kategori baru"
                    value={newSubName[cat.id]||''} onChange={e=>setNewSubName(prev=>({...prev,[cat.id]:e.target.value}))}
                    onKeyDown={e=>e.key==='Enter'&&addSub(cat.id)}/>
                  <button style={s.btnAddSm} onClick={()=>addSub(cat.id)} disabled={!(newSubName[cat.id]||'').trim()}>➕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const s = {
  addCard:    {background:'var(--bg-section)',padding:16,borderRadius:18,marginBottom:20,border:'1px solid var(--border)'},
  input:      {padding:'10px 13px',border:'1.5px solid var(--border)',borderRadius:10,fontSize:14,background:'var(--bg-card)',outline:'none',color:'var(--text)'},
  btnAdd:     {background:'var(--primary)',color:'#111',border:'none',padding:'11px 18px',borderRadius:12,fontSize:13,fontWeight:700,width:'100%',cursor:'pointer'},
  secLabel:   {fontSize:12,fontWeight:700,padding:'8px 14px',borderRadius:12,margin:'0 0 10px',display:'flex',alignItems:'center'},
  catBox:     {background:'var(--bg-card)',borderRadius:14,boxShadow:'0 1px 4px rgba(0,0,0,.06)',marginBottom:10,overflow:'hidden',border:'1px solid var(--border)'},
  catHeader:  {display:'flex',justifyContent:'space-between',alignItems:'center',padding:'11px 14px',background:'var(--bg-section)',borderBottom:'1px solid var(--border)'},
  subRow:     {display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid var(--row-border)'},
  btnEdit:    {background:'var(--bg-section)',color:'var(--text)',border:'1px solid var(--border)',padding:'4px 9px',borderRadius:7,fontSize:12,cursor:'pointer'},
  btnDel:     {background:'#fee2e2',color:'#dc2626',border:'none',padding:'4px 9px',borderRadius:7,fontSize:12,cursor:'pointer'},
  btnEditSm:  {background:'var(--bg-section)',color:'var(--text)',border:'1px solid var(--border)',padding:'3px 7px',borderRadius:6,fontSize:11,cursor:'pointer'},
  btnDelSm:   {background:'#fee2e2',color:'#dc2626',border:'none',padding:'3px 7px',borderRadius:6,fontSize:11,cursor:'pointer'},
  btnAddSm:   {background:'var(--primary)',color:'#111',border:'none',padding:'7px 13px',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer'},
  btnSave:    {background:'var(--primary)',color:'#111',border:'none',padding:'6px 11px',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer'},
  btnCancel:  {background:'var(--bg-section)',color:'var(--text-sub)',border:'1px solid var(--border)',padding:'6px 11px',borderRadius:8,fontSize:13,cursor:'pointer'},
  err:        {background:'#fee2e2',color:'#991b1b',padding:'10px 14px',borderRadius:10,fontSize:13,marginBottom:14},
  empty:      {textAlign:'center',color:'var(--text-muted)',fontSize:13,padding:10},
};
