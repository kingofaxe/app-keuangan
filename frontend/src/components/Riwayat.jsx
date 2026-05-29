import { swalConfirm } from '../swal.js';
import React, { useState } from 'react';
import { apiFetch, fRp, MONTHS, NOW } from '../api';

export default function Riwayat({ data, token, wallet, onRefresh, onEdit }) {
  const [month,    setMonth]    = useState(NOW.getMonth());
  const [year,     setYear]     = useState(NOW.getFullYear());
  const [search,   setSearch]   = useState('');
  const [deleting, setDeleting] = useState(null);

  const changeMonth = d => {
    let m = month + d, y = year;
    if (m > 11) { m = 0; y++; }
    if (m < 0)  { m = 11; y--; }
    setMonth(m); setYear(y);
    setSearch('');
  };

  const txs = data.transactions
    .filter(t => {
      const d = new Date(t.date);
      return d.getMonth()===month && d.getFullYear()===year;
    })
    .sort((a,b) => new Date(b.date)-new Date(a.date));

  const filtered = !search.trim() ? txs : txs.filter(t => {
    const q = search.toLowerCase();
    return [t.sub_category_name, t.category_name, t.remark, t.date, String(t.amount)]
      .some(v => (v||'').toLowerCase().includes(q));
  });

  const deleteTx = async (id) => {
    const r = await swalConfirm('Hapus transaksi ini?');
    if (!r.isConfirmed) return;
    setDeleting(id);
    try {
      await apiFetch(`/transactions/${id}`, { method: 'DELETE' }, token);
      onRefresh();
    } catch(e) { alert('Gagal hapus: ' + e.message); }
    finally { setDeleting(null); }
  };

  /* ── Hitung total bulan ini ── */
  const totInc = filtered.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
  const totExp = filtered.filter(t=>t.type!=='income').reduce((s,t)=>s+Number(t.amount),0);

  return (
    <div>
      {/* MONTH NAV */}
      <div style={s.nav}>
        <button style={s.arrow} onClick={()=>changeMonth(-1)}>←</button>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:18,fontWeight:800,color:'var(--text)',letterSpacing:'-0.3px'}}>
            {MONTHS[month]}
          </div>
          <div style={{fontSize:12,color:'var(--text-sub)',marginTop:2}}>{year}</div>
        </div>
        <button style={s.arrow} onClick={()=>changeMonth(1)}>→</button>
      </div>

      {/* SUMMARY STRIP */}
      <div style={s.strip}>
        <div style={s.stripItem}>
          <span style={{fontSize:10,color:'var(--text-sub)',display:'block',marginBottom:2}}>💰 Pemasukan</span>
          <strong style={{fontSize:13,color:'#22c55e'}}>{fRp(totInc)}</strong>
        </div>
        <div style={{width:1,background:'var(--border)'}}/>
        <div style={s.stripItem}>
          <span style={{fontSize:10,color:'var(--text-sub)',display:'block',marginBottom:2}}>💸 Pengeluaran</span>
          <strong style={{fontSize:13,color:'#ef4444'}}>{fRp(totExp)}</strong>
        </div>
        <div style={{width:1,background:'var(--border)'}}/>
        <div style={s.stripItem}>
          <span style={{fontSize:10,color:'var(--text-sub)',display:'block',marginBottom:2}}>📊 Selisih</span>
          <strong style={{fontSize:13,color:(totInc-totExp)>=0?'#22c55e':'#ef4444'}}>{fRp(totInc-totExp)}</strong>
        </div>
      </div>

      {/* SEARCH */}
      <div style={s.searchWrap}>
        <span style={s.searchIcon}>🔍</span>
        <input style={s.searchInput} type="text" placeholder="Cari transaksi, kategori, keterangan..."
          value={search} onChange={e=>setSearch(e.target.value)} autoComplete="off"/>
        {search && <button style={s.clearBtn} onClick={()=>setSearch('')}>×</button>}
      </div>
      {search && (
        <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:10}}>
          Ditemukan {filtered.length} dari {txs.length} transaksi
        </div>
      )}

      {!filtered.length && (
        <div style={s.empty}>
          {search ? 'Tidak ada transaksi yang cocok.' : `Belum ada transaksi di ${MONTHS[month]} ${year}`}
        </div>
      )}

      {filtered.map(t => {
        const display = t.sub_category_name || t.remark || t.category_name;
        const isInc   = t.type === 'income';
        const accentColor = isInc ? '#22c55e' : '#ef4444';
        const dotBg       = isInc ? '#dcfce7' : '#fee2e2';
        /* Format tanggal jadi lebih besar & readable */
        const dateObj = new Date(t.date);
        const day     = dateObj.getDate();
        const mon     = MONTHS[dateObj.getMonth()].slice(0,3);
        return (
          <div key={t.id} style={s.txItem}>
            {/* DATE BADGE */}
            <div style={{...s.dateBadge, background: dotBg, color: accentColor}}>
              <span style={{fontSize:20,fontWeight:900,lineHeight:1}}>{day}</span>
              <span style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px'}}>{mon}</span>
            </div>

            {/* INFO */}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:700,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                {display}
              </div>
              <div style={{fontSize:11,color:'var(--text-sub)',marginTop:2}}>
                {t.category_name}
                {t.remark && t.remark!==display ? ' · '+t.remark : ''}
              </div>
            </div>

            {/* AMOUNT + ACTIONS */}
            <div style={s.txRight}>
              <span style={{fontWeight:800,fontSize:14,color:accentColor,whiteSpace:'nowrap'}}>
                {isInc?'+':'−'} {fRp(t.amount)}
              </span>
              <div style={{display:'flex',gap:4,marginTop:4}}>
                <button style={s.editBtn} onClick={()=>onEdit(t)}>✏️</button>
                <button style={s.delBtn}  onClick={()=>deleteTx(t.id)} disabled={deleting===t.id}>
                  {deleting===t.id ? '⏳' : '🗑️'}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const s = {
  nav:         {display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,padding:'14px 18px',background:'var(--bg-section)',borderRadius:18,border:'1px solid var(--border)'},
  arrow:       {width:38,height:38,border:'2px solid var(--border)',background:'var(--bg-card)',borderRadius:12,fontSize:16,fontWeight:'bold',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text)'},
  strip:       {display:'flex',background:'var(--bg-card)',borderRadius:16,border:'1px solid var(--border)',marginBottom:14,overflow:'hidden'},
  stripItem:   {flex:1,padding:'12px 10px',textAlign:'center'},
  searchWrap:  {position:'relative',marginBottom:12},
  searchIcon:  {position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',fontSize:15,pointerEvents:'none'},
  searchInput: {width:'100%',padding:'12px 44px 12px 42px',border:'2px solid var(--border)',borderRadius:14,fontSize:14,background:'var(--bg-card)',outline:'none',color:'var(--text)',boxSizing:'border-box'},
  clearBtn:    {position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',fontSize:20,color:'var(--text-muted)',cursor:'pointer'},
  txItem:      {background:'var(--bg-card)',padding:'12px 14px',borderRadius:16,marginBottom:8,display:'flex',alignItems:'center',gap:12,boxShadow:'0 1px 4px rgba(0,0,0,.05)',border:'1px solid var(--border)'},
  dateBadge:   {width:46,minWidth:46,height:54,borderRadius:12,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:1},
  txRight:     {display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2,marginLeft:4},
  editBtn:     {background:'var(--bg-section)',color:'var(--text)',padding:'4px 8px',fontSize:12,borderRadius:8,border:'1px solid var(--border)',cursor:'pointer'},
  delBtn:      {background:'#fee2e2',color:'#dc2626',padding:'4px 8px',fontSize:12,borderRadius:8,border:'none',cursor:'pointer'},
  empty:       {textAlign:'center',padding:32,color:'var(--text-muted)',fontSize:13},
};
