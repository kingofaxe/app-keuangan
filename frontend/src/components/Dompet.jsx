import { swalConfirm } from '../swal.js';
import React, { useState, useRef } from 'react';
import { apiFetch, fRp } from '../api';

const EMOJIS = [
  '👤','👨','👩','👴','👵','🧑','👦','👧',
  '🐹','🐱','🐶','🐰','🦊','🐸','🐯','🦁',
  '💰','💵','💴','💶','💷','💸','💳','🪙','💎',
  '🏦','🏧','🏆','⭐','🌟','🎯','🎁','🔥',
  '🏠','🏡','🚗','✈️','🎓','📚','🛒','❤️',
  '🌈','🍀','⚡','🎪','🎨','🎭','🎬','🎵',
];

export default function Dompet({ wallets, token, onRefresh }) {
  const [newName,      setNewName]      = useState('');
  const [newLabel,     setNewLabel]     = useState('');
  const [newEmoji,     setNewEmoji]     = useState('👤');
  const [newBalance,   setNewBalance]   = useState('');
  const [showEmoji,    setShowEmoji]    = useState(false);
  const [editW,        setEditW]        = useState(null);
  const [showEditEmoji,setShowEditEmoji]= useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [dragIdx,      setDragIdx]      = useState(null);
  const dragOver = useRef(null);

  const fmtAmt = v => {
    const r = v.replace(/\D/g,'');
    return r ? Number(r).toLocaleString('id-ID') : '';
  };

  const add = async () => {
    if (!newName.trim()) { setError('ID dompet wajib diisi'); return; }
    const displayLabel = `${newEmoji} ${(newLabel||newName).trim()}`;
    setLoading(true); setError('');
    try {
      await apiFetch('/wallets', { method:'POST', body: JSON.stringify({
        name: newName.trim().toLowerCase().replace(/\s+/g,'-'),
        label: displayLabel,
        initial_balance: Number(newBalance.replace(/\D/g,'')||0),
      })}, token);
      setNewName(''); setNewLabel(''); setNewBalance(''); setNewEmoji('👤');
      setShowEmoji(false);
      onRefresh();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const save = async () => {
    if (!editW) return;
    const displayLabel = `${editW.emoji} ${editW.labelText}`.trim();
    setLoading(true);
    try {
      await apiFetch(`/wallets/${editW.id}`, { method:'PUT', body: JSON.stringify({
        name: editW.name,
        label: displayLabel,
        initial_balance: Number((editW.balanceStr||'').replace(/\D/g,'')||0),
      })}, token);
      setEditW(null); setShowEditEmoji(false); onRefresh();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const del = async id => {
    const r = await swalConfirm('Hapus dompet ini? Semua transaksi ikut terhapus!');
    if (!r.isConfirmed) return;
    setLoading(true);
    try { await apiFetch(`/wallets/${id}`, { method:'DELETE' }, token); onRefresh(); }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const parseLabel = label => {
    const m = label?.match(/^(\S+)\s+(.+)$/);
    return m ? { emoji:m[1], text:m[2] } : { emoji:'👛', text:label||'' };
  };

  const onDragStart = i => { setDragIdx(i); };
  const onDragEnter = i => { dragOver.current = i; };
  const onDragOver  = e => e.preventDefault();
  const onDragEnd   = async () => {
    const from = dragIdx;
    const to   = dragOver.current;
    setDragIdx(null); dragOver.current = null;
    if (from===null || to===null || from===to) return;
    const newOrder = [...wallets];
    const [moved]  = newOrder.splice(from, 1);
    newOrder.splice(to, 0, moved);
    try {
      await apiFetch('/wallets/reorder', { method:'PUT', body: JSON.stringify({ order: newOrder.map(w=>w.id) }) }, token);
      onRefresh();
    } catch(e) { setError(e.message); }
  };

  return (
    <div>
      <h3 style={{marginBottom:4,fontSize:16,fontWeight:800,color:'var(--text)'}}>👛 Kelola Dompet</h3>
      <p style={{fontSize:12,color:'var(--text-sub)',marginBottom:16}}>Tambah, edit, dan atur urutan dompet kamu</p>

      {error && <div style={s.err}>{error}</div>}

      {/* FORM TAMBAH */}
      <div style={s.card}>
        <div style={{fontWeight:700,fontSize:13,marginBottom:14,color:'var(--text)'}}>➕ Tambah Dompet Baru</div>

        <div style={s.fg}>
          <label style={s.label}>Pilih Emoji</label>
          <div style={{position:'relative'}}>
            <button style={s.emojiBtn} type="button" onClick={()=>setShowEmoji(!showEmoji)}>
              <span style={{fontSize:24}}>{newEmoji}</span>
              <span style={{fontSize:12,color:'var(--text-sub)',marginLeft:10,flex:1,textAlign:'left'}}>
                Klik untuk ganti ▾
              </span>
            </button>
            {showEmoji && (
              <div style={s.emojiPicker}>
                {EMOJIS.map(e=>(
                  <button key={e} type="button"
                    style={{...s.emojiOpt, background:e===newEmoji?'var(--primary-light)':'transparent'}}
                    onClick={()=>{setNewEmoji(e);setShowEmoji(false);}}>
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={s.fg}>
          <label style={s.label}>Nama Dompet (tampil di tombol)</label>
          <input style={s.input} placeholder="contoh: Pribadi" value={newLabel}
            onChange={e=>setNewLabel(e.target.value)}/>
        </div>

        <div style={s.fg}>
          <label style={s.label}>ID Unik (huruf kecil, tanpa spasi)</label>
          <input style={s.input} placeholder="contoh: pribadi" value={newName}
            onChange={e=>setNewName(e.target.value.toLowerCase().replace(/\s+/g,'-'))}/>
        </div>

        <div style={s.fg}>
          <label style={s.label}>Saldo Awal (Rp) <span style={{color:'var(--text-muted)',fontWeight:400}}>(opsional)</span></label>
          <input style={s.input} placeholder="0" inputMode="numeric" value={newBalance}
            onChange={e=>setNewBalance(fmtAmt(e.target.value))}/>
          <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>Saldo sebelum mulai mencatat di app ini</div>
        </div>

        {/* PREVIEW */}
        <div style={s.preview}>
          <span style={{fontSize:12,color:'var(--text-sub)'}}>Preview: </span>
          <strong style={{fontSize:14,color:'var(--text)'}}>{newEmoji} {newLabel||newName||'Nama Dompet'}</strong>
        </div>

        <button style={s.btnAdd} onClick={add} disabled={loading}>
          {loading ? '⏳ Menyimpan...' : '➕ Tambah Dompet'}
        </button>
      </div>

      {/* LIST DOMPET */}
      <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
        <span>⠿</span> <span>Drag untuk ubah urutan</span>
      </div>

      {wallets.map((w, i) => {
        const parsed     = parseLabel(w.label);
        const isDragging = dragIdx === i;
        return (
          <div key={w.id}
            draggable
            onDragStart={()=>onDragStart(i)}
            onDragEnter={()=>onDragEnter(i)}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            style={{
              ...s.walletItem,
              opacity:   isDragging ? 0.4 : 1,
              background:isDragging ? 'var(--primary-light)' : 'var(--bg-card)',
              transform: isDragging ? 'scale(0.98)' : 'scale(1)',
            }}>

            {editW?.id === w.id ? (
              <div style={{flex:1,padding:'4px 0'}}>
                {/* Edit emoji */}
                <div style={{position:'relative',marginBottom:10}}>
                  <button style={s.emojiBtn} type="button" onClick={()=>setShowEditEmoji(!showEditEmoji)}>
                    <span style={{fontSize:22}}>{editW.emoji}</span>
                    <span style={{fontSize:12,color:'var(--text-sub)',marginLeft:10}}>Ganti emoji ▾</span>
                  </button>
                  {showEditEmoji && (
                    <div style={s.emojiPicker}>
                      {EMOJIS.map(e=>(
                        <button key={e} type="button"
                          style={{...s.emojiOpt,background:e===editW.emoji?'var(--primary-light)':'transparent'}}
                          onClick={()=>{setEditW({...editW,emoji:e});setShowEditEmoji(false);}}>
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                  <div>
                    <label style={s.label}>Nama Dompet</label>
                    <input style={s.input} value={editW.labelText}
                      onChange={e=>setEditW({...editW,labelText:e.target.value})}/>
                  </div>
                  <div>
                    <label style={s.label}>Saldo Awal (Rp)</label>
                    <input style={s.input} value={editW.balanceStr} inputMode="numeric"
                      onChange={e=>setEditW({...editW,balanceStr:fmtAmt(e.target.value)})}/>
                  </div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button style={s.btnSave}   onClick={save}>✅ Simpan</button>
                  <button style={s.btnCancel} onClick={()=>{setEditW(null);setShowEditEmoji(false);}}>✕ Batal</button>
                </div>
              </div>
            ) : (
              <>
                <span style={{fontSize:20,cursor:'grab',marginRight:4,color:'var(--text-muted)'}}>⠿</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:15,color:'var(--text)'}}>{w.label}</div>
                  <div style={{fontSize:12,color:'var(--text-sub)',marginTop:2}}>
                    ID: {w.name} · Saldo awal: {fRp(w.initial_balance||0)} · No.{i+1}
                  </div>
                </div>
                <div style={{display:'flex',gap:6}}>
                  <button style={s.btnEdit}
                    onClick={()=>setEditW({...w, emoji:parsed.emoji, labelText:parsed.text, balanceStr:Number(w.initial_balance||0).toLocaleString('id-ID')})}>
                    ✏️
                  </button>
                  <button style={{...s.btnDel,opacity:wallets.length<=1?0.4:1}}
                    onClick={()=>del(w.id)} disabled={wallets.length<=1}>
                    🗑️
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}

      <div style={{fontSize:12,color:'var(--text-muted)',textAlign:'center',marginTop:10}}>
        {wallets.length} dompet terdaftar · Minimal harus ada 1
      </div>
    </div>
  );
}

const s = {
  card:       {background:'var(--bg-section)',padding:16,borderRadius:18,marginBottom:18,border:'1px solid var(--border)'},
  fg:         {marginBottom:12},
  label:      {display:'block',marginBottom:4,fontWeight:600,fontSize:12,color:'var(--text-sub)'},
  input:      {width:'100%',padding:'11px 13px',border:'1.5px solid var(--border)',borderRadius:12,fontSize:14,background:'var(--bg-card)',outline:'none',boxSizing:'border-box',color:'var(--text)'},
  emojiBtn:   {display:'flex',alignItems:'center',padding:'10px 13px',border:'1.5px solid var(--border)',borderRadius:12,background:'var(--bg-card)',cursor:'pointer',width:'100%'},
  emojiPicker:{position:'absolute',top:'calc(100% + 4px)',left:0,zIndex:200,background:'var(--bg-card)',border:'1.5px solid var(--border)',borderRadius:14,padding:10,display:'flex',flexWrap:'wrap',gap:4,width:280,boxShadow:'0 8px 24px rgba(0,0,0,.15)'},
  emojiOpt:   {fontSize:22,padding:5,borderRadius:7,border:'none',cursor:'pointer',transition:'background .1s'},
  preview:    {background:'var(--primary-light)',border:'1.5px solid var(--primary)',padding:'10px 14px',borderRadius:12,marginBottom:12},
  btnAdd:     {width:'100%',background:'var(--primary)',color:'#111',border:'none',padding:'12px',borderRadius:12,fontSize:14,fontWeight:700,cursor:'pointer'},
  walletItem: {border:'1.5px solid var(--border)',borderRadius:16,padding:'13px 15px',marginBottom:10,display:'flex',alignItems:'center',gap:10,cursor:'default',transition:'all .15s'},
  btnEdit:    {background:'var(--bg-section)',color:'var(--text)',border:'1.5px solid var(--border)',padding:'7px 13px',borderRadius:10,fontSize:14,cursor:'pointer'},
  btnDel:     {background:'#fee2e2',color:'#dc2626',border:'none',padding:'7px 13px',borderRadius:10,fontSize:14,cursor:'pointer'},
  btnSave:    {background:'var(--primary)',color:'#111',border:'none',padding:'9px 18px',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer'},
  btnCancel:  {background:'var(--bg-section)',color:'var(--text-sub)',border:'1.5px solid var(--border)',padding:'9px 18px',borderRadius:10,fontSize:13,cursor:'pointer'},
  err:        {background:'#fee2e2',color:'#991b1b',padding:'10px 14px',borderRadius:12,fontSize:13,marginBottom:14},
};
