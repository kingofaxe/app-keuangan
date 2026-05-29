import { swalConfirm } from '../swal.js';
import React, { useState, useEffect } from 'react';
import { apiFetch, fRp } from '../api';

export default function DashboardReal({ token, wallets, allData, prefs, readOnlyItems }) {
  const isReadOnly = readOnlyItems !== undefined;
  const [items,    setItems]    = useState(readOnlyItems || []);
  const [newLabel, setNewLabel] = useState('');
  const [newAmt,   setNewAmt]   = useState('');
  const [newType,  setNewType]  = useState('asset');
  const [editId,   setEditId]   = useState(null);
  const [editRow,  setEditRow]  = useState({});
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    if (isReadOnly) {
      setItems(readOnlyItems.filter(i => i.type==='asset' || i.type==='debt'));
      return;
    }
    apiFetch('/real-balance', {}, token)
      .then(data => setItems(data.filter(i => i.type==='asset' || i.type==='debt')))
      .catch(e => setError(e.message));
  }, [token, isReadOnly]);

  const walletSaldo = w => {
    const txs = allData[w.id]?.transactions || [];
    let total = Number(w.initial_balance || 0);
    txs.forEach(t => { total += t.type==='income' ? Number(t.amount) : -Number(t.amount); });
    return total;
  };

  const tabInCats  = prefs?.tabInCats  || [];
  const tabOutCats = prefs?.tabOutCats || [];
  const hasTabConfig = tabInCats.length > 0 || tabOutCats.length > 0;

  const totalTabungan = (() => {
    if (!hasTabConfig) return 0;
    let tin = 0, tout = 0;
    wallets.forEach(w => {
      (allData[w.id]?.transactions || []).forEach(t => {
        const name = (t.sub_category_name || t.category_name || '').toLowerCase().trim();
        if (tabInCats.some(k  => name === k.toLowerCase().trim())) tin  += Number(t.amount);
        if (tabOutCats.some(k => name === k.toLowerCase().trim())) tout += Number(t.amount);
      });
    });
    return tin - tout;
  })();

  const totalDompet = wallets.reduce((sum, w) => sum + walletSaldo(w), 0);
  // Total catatan = semua dompet + tabungan (kalau aktif)
  const totalCatatan = totalDompet + (hasTabConfig ? totalTabungan : 0);

  const totalAsset      = items.filter(i => i.type==='asset').reduce((s,i) => s+Number(i.amount), 0);
  const totalDebt       = items.filter(i => i.type==='debt').reduce((s,i)  => s+Number(i.amount), 0);
  const totalAsetHutang = totalAsset - totalDebt;

  // Rumus BENAR: Total Aset & Hutang − Total Catatan
  const selisih = totalAsetHutang - totalCatatan;

  const fmtInput = v => { const r=v.replace(/\D/g,''); return r?Number(r).toLocaleString('id-ID'):''; };

  const addItem = async () => {
    if (!newLabel.trim()||!newAmt){setError('Isi keterangan dan nominal');return;}
    setLoading(true);setError('');
    try {
      const item = await apiFetch('/real-balance',{method:'POST',body:JSON.stringify({label:newLabel.trim(),amount:Number(newAmt.replace(/\D/g,'')),type:newType})},token);
      setItems(prev=>[...prev,item]);setNewLabel('');setNewAmt('');
    } catch(e){setError(e.message);}
    finally{setLoading(false);}
  };

  const saveEdit = async () => {
    setLoading(true);
    try {
      const updated = await apiFetch(`/real-balance/${editId}`,{method:'PUT',body:JSON.stringify({label:editRow.label,amount:Number((editRow.amtStr||'').replace(/\D/g,'')||0),type:editRow.type})},token);
      setItems(prev=>prev.map(i=>i.id===editId?updated:i));setEditId(null);
    } catch(e){setError(e.message);}
    finally{setLoading(false);}
  };

  const delItem = async id => {
    const r = await swalConfirm('Hapus baris ini?');
    if (!r.isConfirmed) return;
    try{await apiFetch(`/real-balance/${id}`,{method:'DELETE'},token);setItems(prev=>prev.filter(i=>i.id!==id));}
    catch(e){setError(e.message);}
  };

  const selisihAbs   = Math.abs(selisih);
  const isBalance    = selisihAbs < 1000;
  const selisihColor = isBalance ? '#6ee7b7' : selisih>0 ? '#fde68a' : '#fca5a5';
  const selisihLabel = isBalance ? '✅ Seimbang'
    : selisih>0 ? '⚠️ Aset lebih besar dari catatan'
    : '⚠️ Catatan lebih besar dari aset';

  return (
    <div>
      <h3 style={{marginBottom:4,fontSize:15,color:'var(--text)',fontWeight:700}}>💎 Saldo Real</h3>
      <p style={{fontSize:12,color:'var(--text-sub)',marginBottom:12}}>Ringkasan keuangan lengkap dari semua sumber</p>
      {error && <div style={s.err}>{error}</div>}

      {/* ══ PERHITUNGAN TOTAL — DI ATAS ══ */}
      <div style={s.summaryCard}>
        <div style={{fontSize:10,fontWeight:700,opacity:.55,marginBottom:12,letterSpacing:1.5}}>📊 PERHITUNGAN TOTAL</div>

        {/* Total Catatan */}
        <div style={s.sumBlock}>
          <div style={{fontSize:11,opacity:.6,marginBottom:4}}>📱 Total Catatan</div>
          <div style={{fontSize:11,opacity:.7,marginBottom:6,lineHeight:1.6}}>
            {wallets.map(w=>(
              <span key={w.id} style={{marginRight:10,display:'inline-block'}}>
                {w.label}: <span style={{color:walletSaldo(w)>=0?'#86efac':'#fca5a5',fontWeight:600}}>{fRp(walletSaldo(w))}</span>
              </span>
            ))}
            {hasTabConfig && (
              <span style={{display:'inline-block'}}>
                🏦 Tabungan: <span style={{color:'#93c5fd',fontWeight:600}}>{fRp(totalTabungan)}</span>
              </span>
            )}
          </div>
          <div style={{fontSize:20,fontWeight:800,color:'#fff'}}>{fRp(totalCatatan)}</div>
        </div>

        <div style={{textAlign:'center',fontSize:18,opacity:.4,margin:'2px 0'}}>−</div>

        {/* Total Aset & Hutang */}
        <div style={s.sumBlock}>
          <div style={{fontSize:11,opacity:.6,marginBottom:4}}>💼 Total Aset & Hutang</div>
          <div style={{fontSize:11,opacity:.7,marginBottom:6}}>
            Aset <span style={{color:'#86efac',fontWeight:600}}>{fRp(totalAsset)}</span>
            {' − '}
            Hutang <span style={{color:'#fca5a5',fontWeight:600}}>{fRp(totalDebt)}</span>
          </div>
          <div style={{fontSize:20,fontWeight:800,color:totalAsetHutang>=0?'#6ee7b7':'#fca5a5'}}>{fRp(totalAsetHutang)}</div>
        </div>

        <div style={{borderTop:'1px dashed rgba(255,255,255,.15)',margin:'12px 0'}}/>

        {/* SELISIH */}
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:11,opacity:.5,marginBottom:8}}>
            Selisih = Total Aset & Hutang − Total Catatan
            <span style={{marginLeft:6,opacity:.6}}>({fRp(totalAsetHutang)} − {fRp(totalCatatan)})</span>
          </div>
          <div style={{
            display:'inline-block',padding:'14px 32px',borderRadius:16,
            background:'rgba(255,255,255,.05)',border:`1px solid ${selisihColor}`,minWidth:200,
          }}>
            <div style={{fontSize:28,fontWeight:900,color:selisihColor,letterSpacing:-.5}}>
              {selisih>=0?'+':''}{fRp(selisih)}
            </div>
            <div style={{fontSize:12,color:selisihColor,marginTop:6,fontWeight:600}}>{selisihLabel}</div>
          </div>
        </div>
      </div>

      {/* ══ SALDO DARI APP ══ */}
      <div style={s.section}>
        <div style={s.secTitle}>📱 Total dari Catatan App</div>
        {wallets.map(w => {
          const sd = walletSaldo(w);
          return (
            <div key={w.id} style={s.row}>
              <span style={{fontSize:13}}>{w.label}</span>
              <span style={{fontWeight:700,color:sd>=0?'#22c55e':'#ef4444'}}>{fRp(sd)}</span>
            </div>
          );
        })}
        {hasTabConfig && (
          <div style={{...s.row,background:'rgba(34,197,94,0.06)',borderRadius:12,padding:'8px 12px',margin:'6px 0',border:'1px solid rgba(34,197,94,0.15)'}}>
            <span style={{fontSize:13,color:'var(--text)',fontWeight:600}}>🏦 Saldo Tabungan</span>
            <span style={{fontWeight:700,color:totalTabungan>=0?'#22c55e':'#ef4444'}}>{fRp(totalTabungan)}</span>
          </div>
        )}
        <div style={s.totalRow}>
          <span>Total Catatan</span>
          <span style={{color:'var(--text)',fontWeight:800}}>{fRp(totalCatatan)}</span>
        </div>
      </div>

      {/* ══ ASET & HUTANG MANUAL ══ */}
      <div style={s.section}>
        <div style={s.secTitle}>💼 Aset & Hutang Lainnya</div>
        <div style={{fontSize:12,color:'var(--text-sub)',marginBottom:12}}>Rekening bank, e-wallet, cash, hutang, dll</div>

        {items.map(item => (
          <div key={item.id} style={{...s.itemRow,borderLeft:`4px solid ${item.type==='asset'?'#22c55e':'#ef4444'}`}}>
            {!isReadOnly && editId===item.id ? (
              <div style={{flex:1}}>
                <div style={{display:'flex',gap:6,marginBottom:6,flexWrap:'wrap'}}>
                  <input style={{...s.input,flex:2,minWidth:100}} value={editRow.label} onChange={e=>setEditRow({...editRow,label:e.target.value})} placeholder="Keterangan"/>
                  <input style={{...s.input,flex:1,minWidth:80}} value={editRow.amtStr} onChange={e=>setEditRow({...editRow,amtStr:fmtInput(e.target.value)})} placeholder="Nominal"/>
                  <select style={{...s.input,minWidth:100}} value={editRow.type} onChange={e=>setEditRow({...editRow,type:e.target.value})}>
                    <option value="asset">➕ Aset</option>
                    <option value="debt">➖ Hutang</option>
                  </select>
                </div>
                <div style={{display:'flex',gap:6}}>
                  <button style={s.btnSave} onClick={saveEdit}>✅</button>
                  <button style={s.btnCancel} onClick={()=>setEditId(null)}>✕</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600}}>{item.label}</div>
                  <div style={{fontSize:11,color:'var(--text-sub)'}}>{item.type==='asset'?'➕ Aset':'➖ Hutang'}</div>
                </div>
                <span style={{fontWeight:700,fontSize:13,color:item.type==='asset'?'#22c55e':'#ef4444',marginRight:8,whiteSpace:'nowrap'}}>
                  {item.type==='asset'?'+':'−'} {fRp(item.amount)}
                </span>
                {!isReadOnly && <button style={s.btnEdit} onClick={()=>{setEditId(item.id);setEditRow({label:item.label,amtStr:Number(item.amount).toLocaleString('id-ID'),type:item.type});}}>✏️</button>}
                {!isReadOnly && <button style={s.btnDel} onClick={()=>delItem(item.id)}>🗑️</button>}
              </>
            )}
          </div>
        ))}

        {items.length > 0 && (
          <div style={{margin:'8px 0 4px'}}>
            <div style={{display:'flex',justifyContent:'space-between',padding:'8px 12px',background:'rgba(34,197,94,0.06)',border:'1px solid rgba(34,197,94,0.1)',borderRadius:12,fontSize:13,marginBottom:6}}>
              <span>➕ Total Aset</span><span style={{color:'#22c55e',fontWeight:700}}>{fRp(totalAsset)}</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',padding:'8px 12px',background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.1)',borderRadius:12,fontSize:13}}>
              <span>➖ Total Hutang</span><span style={{color:'#ef4444',fontWeight:700}}>{fRp(totalDebt)}</span>
            </div>
          </div>
        )}

        <div style={{marginTop:12,paddingTop:12,borderTop:'1px dashed var(--border)'}}>
          {!isReadOnly && (
            <>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text-sub)',marginBottom:8}}>➕ Tambah rekening / hutang</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
                <input style={{...s.input,flex:2,minWidth:120}} placeholder="Contoh: Mandiri, BCA..." value={newLabel} onChange={e=>setNewLabel(e.target.value)}/>
                <input style={{...s.input,flex:1,minWidth:90}} placeholder="Nominal" inputMode="numeric" value={newAmt} onChange={e=>setNewAmt(fmtInput(e.target.value))}/>
                <select style={{...s.input,minWidth:110}} value={newType} onChange={e=>setNewType(e.target.value)}>
                  <option value="asset">➕ Rekening</option>
                  <option value="debt">➖ Hutang</option>
                </select>
              </div>
              <button style={s.btnAdd} onClick={addItem} disabled={loading}>{loading?'⏳':'➕ Tambah Baris'}</button>
            </>
          )}
          {isReadOnly && items.length === 0 && (
            <div style={{textAlign:'center',color:'var(--text-sub)',fontSize:13,padding:12}}>Belum ada aset & hutang</div>
          )}
        </div>

        <div style={s.totalRow}>
          <span>Total Aset & Hutang</span>
          <span style={{color:totalAsetHutang>=0?'#22c55e':'#ef4444',fontWeight:800}}>{fRp(totalAsetHutang)}</span>
        </div>
      </div>
    </div>
  );
}

const s = {
  section:   {background:'var(--bg-section)',borderRadius:18,padding:16,marginBottom:12,border:'1px solid var(--border)'},
  secTitle:  {fontWeight:700,fontSize:14,marginBottom:8,color:'var(--text)'},
  row:       {display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 4px',borderBottom:'1px solid var(--row-border)',fontSize:13,color:'var(--text)'},
  totalRow:  {display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 4px',marginTop:8,borderTop:'2px solid var(--border)',fontWeight:700,fontSize:13,color:'var(--text)'},
  itemRow:   {display:'flex',alignItems:'center',gap:8,padding:'10px 12px',background:'var(--bg-card)',borderRadius:14,marginBottom:7,boxShadow:'var(--shadow-sm)',border:'1px solid var(--border)',color:'var(--text)'},
  input:     {padding:'9px 11px',border:'1px solid var(--border)',borderRadius:12,fontSize:13,background:'var(--bg-input)',color:'var(--text)',outline:'none'},
  btnAdd:    {width:'100%',background:'var(--primary)',color:'#111',border:'none',padding:'11px',borderRadius:18,fontSize:13,fontWeight:700,cursor:'pointer',boxShadow:'0 4px 12px rgba(255,210,51,0.2)'},
  btnEdit:   {background:'var(--primary-light)',color:'var(--text)',border:'none',padding:'5px 9px',borderRadius:8,fontSize:12,cursor:'pointer',fontWeight:600},
  btnDel:    {background:'rgba(239,68,68,0.1)',color:'#ef4444',border:'none',padding:'5px 9px',borderRadius:8,fontSize:12,cursor:'pointer',fontWeight:600},
  btnSave:   {background:'var(--primary)',color:'#111',border:'none',padding:'7px 14px',borderRadius:10,fontSize:13,cursor:'pointer',fontWeight:700},
  btnCancel: {background:'var(--border)',color:'var(--text)',border:'none',padding:'7px 14px',borderRadius:10,fontSize:13,cursor:'pointer'},
  err:       {background:'#fee2e2',color:'#991b1b',padding:'9px 12px',borderRadius:12,fontSize:13,marginBottom:12},
  summaryCard:{background:'#0f1115',padding:20,borderRadius:24,marginBottom:16,color:'#fff',boxShadow:'0 16px 36px rgba(0,0,0,0.18)',position:'relative',overflow:'hidden',border:'1px solid rgba(255,255,255,0.08)'},
  sumBlock:  {background:'rgba(255,255,255,.05)',borderRadius:16,padding:'12px 14px',marginBottom:10,border:'1px solid rgba(255,255,255,.03)'},
};
