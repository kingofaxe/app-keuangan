import React, { useState } from 'react';
import { fRp, MONTHS } from '../api';

export default function Tabungan({ wallets, allData, prefs }) {
  const tabInCats  = prefs?.tabInCats  || [];
  const tabOutCats = prefs?.tabOutCats || [];
  const hasConfig  = tabInCats.length > 0 || tabOutCats.length > 0;

  const isTabIn  = t => tabInCats.some(k  => (t.sub_category_name||t.category_name||'').toLowerCase().trim()===k.toLowerCase().trim());
  const isTabOut = t => tabOutCats.some(k => (t.sub_category_name||t.category_name||'').toLowerCase().trim()===k.toLowerCase().trim());

  const allTxs = wallets.flatMap(w => {
    const txs = allData[w.id]?.transactions || [];
    return txs.map(t => ({ ...t, _walletLabel: w.label }));
  });

  const tabTxs = allTxs.filter(t => isTabIn(t) || isTabOut(t));
  let totalIn = 0, totalOut = 0;
  tabTxs.forEach(t => {
    if (isTabIn(t))  totalIn  += Number(t.amount);
    if (isTabOut(t)) totalOut += Number(t.amount);
  });
  const totalTab = totalIn - totalOut;

  const monthMap = {};
  tabTxs.forEach(t => {
    const d   = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!monthMap[key]) monthMap[key] = { year:d.getFullYear(), month:d.getMonth(), in:0, out:0, txs:[] };
    if (isTabIn(t))  monthMap[key].in  += Number(t.amount);
    if (isTabOut(t)) monthMap[key].out += Number(t.amount);
    monthMap[key].txs.push(t);
  });

  let cum = 0;
  const months = Object.keys(monthMap).sort().map(k => {
    const m = monthMap[k];
    cum += m.in - m.out;
    return { ...m, key: k, saldoAkhir: cum };
  }).reverse();

  const [open, setOpen] = useState({});
  const toggle = k => setOpen(prev => ({ ...prev, [k]: !prev[k] }));

  const walletNames = wallets.map(w => w.label.replace(/^\S+\s/, '')).join(' + ');

  return (
    <div>
      {/* HERO CARD */}
      <div style={s.hero}>
        <div style={s.heroLabel}>🏦 Tabungan Gabungan</div>
        <div style={{fontSize:11,color:'var(--text-sub)',marginBottom:8}}>{walletNames}</div>
        <div style={{...s.amount, color: totalTab >= 0 ? '#22c55e' : '#ef4444'}}>{fRp(totalTab)}</div>
        <div style={s.row}>
          <div style={s.item}>
            <span style={{fontSize:10,color:'var(--text-sub)'}}>📥 Total Masuk</span>
            <strong style={{fontSize:14,color:'#22c55e'}}>{fRp(totalIn)}</strong>
          </div>
          <div style={{width:1,background:'var(--border)'}}/>
          <div style={s.item}>
            <span style={{fontSize:10,color:'var(--text-sub)'}}>📤 Total Keluar</span>
            <strong style={{fontSize:14,color:'#ef4444'}}>{fRp(totalOut)}</strong>
          </div>
        </div>
      </div>

      {!hasConfig && (
        <div style={s.warning}>
          <div style={{fontSize:20,marginBottom:6}}>⚙️</div>
          <strong>Belum ada kategori tabungan yang dipilih</strong>
          <br/>
          <small>Pergi ke menu ⚙️ Settings → pilih kategori mana yang masuk/keluar tabungan</small>
        </div>
      )}
      {hasConfig && !months.length && (
        <div style={s.empty}>
          Belum ada transaksi yang cocok dengan kategori tabungan yang dipilih.
        </div>
      )}

      {months.map(m => (
        <div key={m.key} style={s.monthItem}>
          <div style={s.monthHeader} onClick={()=>toggle(m.key)}>
            <div>
              <span style={{fontWeight:700,fontSize:15,color:'var(--text)'}}>{MONTHS[m.month]}</span>
              <span style={{fontSize:12,color:'var(--text-sub)',marginLeft:6}}>{m.year}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {(m.in > 0 || m.out > 0) && (
                <span style={{fontSize:12,fontWeight:600,color:(m.in-m.out)>=0?'#22c55e':'#ef4444',background:(m.in-m.out)>=0?'#dcfce7':'#fee2e2',padding:'3px 8px',borderRadius:8}}>
                  {(m.in-m.out)>=0?'+':''}{fRp(m.in-m.out)}
                </span>
              )}
              <span style={{fontWeight:700,fontSize:13,color:m.saldoAkhir>=0?'#22c55e':'#ef4444'}}>
                = {fRp(m.saldoAkhir)}
              </span>
              <span style={{fontSize:14,color:'var(--text-muted)',transition:'transform 0.2s',transform:open[m.key]?'rotate(180deg)':'rotate(0deg)'}}>▾</span>
            </div>
          </div>
          {open[m.key] && (
            <div style={s.detail}>
              {m.in>0  && <div style={s.row2}><span>📥 Masuk</span><span style={{color:'#22c55e',fontWeight:700}}>{fRp(m.in)}</span></div>}
              {m.out>0 && <div style={s.row2}><span>📤 Keluar</span><span style={{color:'#ef4444',fontWeight:700}}>{fRp(m.out)}</span></div>}
              <div style={{fontSize:11,color:'var(--text-muted)',padding:'6px 0 2px'}}>Transaksi:</div>
              {m.txs.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(t=>{
                const ii=isTabIn(t);
                return (
                  <div key={t.id} style={s.row2}>
                    <span style={{fontSize:12,color:'var(--text-sub)'}}>{t._walletLabel} · {t.date} · {t.sub_category_name||t.category_name}</span>
                    <span style={{color:ii?'#22c55e':'#ef4444',fontWeight:700,fontSize:12}}>{ii?'+':'−'} {fRp(t.amount)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const s = {
  hero:       {background:'var(--bg-card)',border:'1.5px solid var(--border)',padding:20,borderRadius:20,marginBottom:16,textAlign:'center',boxShadow:'var(--shadow-sm)'},
  heroLabel:  {fontSize:16,fontWeight:800,color:'var(--text)',marginBottom:2},
  amount:     {fontSize:30,fontWeight:900,marginBottom:14,letterSpacing:'-0.5px'},
  row:        {display:'flex',background:'var(--bg-section)',borderRadius:14,overflow:'hidden',border:'1px solid var(--border)'},
  item:       {flex:1,padding:'12px 10px',display:'flex',flexDirection:'column',gap:3,alignItems:'center'},
  warning:    {background:'var(--primary-light)',color:'var(--text)',borderRadius:16,padding:18,marginBottom:14,textAlign:'center',border:'1.5px solid var(--primary)'},
  monthItem:  {background:'var(--bg-card)',borderRadius:16,boxShadow:'var(--shadow-sm)',marginBottom:10,overflow:'hidden',border:'1px solid var(--border)'},
  monthHeader:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'13px 16px',cursor:'pointer',background:'var(--bg-section)'},
  detail:     {padding:'12px 16px 14px',borderTop:'1px solid var(--border)'},
  row2:       {display:'flex',justifyContent:'space-between',padding:'6px 0',fontSize:13,borderBottom:'1px solid var(--row-border)'},
  empty:      {textAlign:'center',padding:32,color:'var(--text-muted)',fontSize:13,lineHeight:1.6},
};
