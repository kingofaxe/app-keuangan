import React, { useState } from 'react';
import { fRp, NOW } from '../api';

function getMondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0) ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toLocalDateStr(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatTgl(date) {
  return date.toLocaleDateString('id-ID', { day:'2-digit', month:'short' });
}

function formatFull(date) {
  return new Date(date).toLocaleDateString('id-ID', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
}

const DAY_NAMES = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const COLORS    = ['#ffd233','#ef4444','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16','#22c55e'];

export default function Mingguan({ data }) {
  const [weekStart, setWeekStart] = useState(() => getMondayOf(NOW));
  const weekEnd = addDays(weekStart, 6);

  const prevWeek = () => setWeekStart(prev => addDays(prev, -7));
  const nextWeek = () => setWeekStart(prev => addDays(prev, 7));

  const weekDates = new Set();
  for (let i = 0; i < 7; i++) weekDates.add(toLocalDateStr(addDays(weekStart, i)));

  const txs = (data.transactions || []).filter(t => weekDates.has(toLocalDateStr(t.date)));

  const expBySub = {};
  let totExp = 0;
  txs.forEach(t => {
    if (t.type === 'expense') {
      const key = t.sub_category_name || t.category_name || 'Lainnya';
      expBySub[key] = (expBySub[key] || 0) + Number(t.amount);
      totExp += Number(t.amount);
    }
  });
  const expEntries = Object.entries(expBySub).sort((a, b) => b[1] - a[1]);

  const dayMap = {};
  for (let i = 0; i < 7; i++) dayMap[toLocalDateStr(addDays(weekStart, i))] = 0;
  txs.forEach(t => {
    if (t.type === 'expense') {
      const key = toLocalDateStr(t.date);
      if (key in dayMap) dayMap[key] += Number(t.amount);
    }
  });

  const dayEntries = Object.entries(dayMap);
  const maxDay     = Math.max(...dayEntries.map(([,v]) => v), 1);
  const todayStr   = toLocalDateStr(NOW);
  const weekLabel  = `${formatTgl(weekStart)} – ${formatTgl(weekEnd)} ${weekEnd.getFullYear()}`;

  return (
    <div>
      {/* NAV */}
      <div style={s.nav}>
        <button style={s.arrow} onClick={prevWeek}>←</button>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:16,fontWeight:800,color:'var(--text)'}}>Mingguan</div>
          <div style={{fontSize:11,color:'var(--text-sub)',marginTop:2}}>{weekLabel}</div>
        </div>
        <button style={s.arrow} onClick={nextWeek}>→</button>
      </div>

      {/* SUMMARY CARD */}
      <div style={s.summaryCard}>
        <div style={{fontSize:10,color:'var(--text-sub)',textTransform:'uppercase',letterSpacing:'1px'}}>Pengeluaran Mingguan</div>
        <div style={{fontSize:28,fontWeight:900,margin:'6px 0 6px',color:'#ef4444',letterSpacing:'-0.5px'}}>{fRp(totExp)}</div>
        {totExp === 0 && (
          <div style={{fontSize:11, color: 'var(--text-muted)' }}>Belum ada pengeluaran minggu ini</div>
        )}
      </div>

      {/* BAR CHART HARIAN */}
      <div style={s.section}>
        <div style={s.secTitle}>📅 Pengeluaran per Hari</div>
        <div style={{display:'flex',gap:4,alignItems:'flex-end',height:80,padding:'0 4px'}}>
          {dayEntries.map(([dateStr, val]) => {
            const d       = new Date(dateStr + 'T00:00:00');
            const dayName = DAY_NAMES[d.getDay()];
            const isToday = dateStr === todayStr;
            const height  = val > 0 ? Math.max((val/maxDay)*64, 8) : 4;
            return (
              <div key={dateStr} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                <div style={{fontSize:9,color:val>0?'var(--text)':'var(--text-muted)',fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:36,textAlign:'center'}}>
                  {val>0 ? fRp(val).replace('Rp\u00a0','').replace('.000','rb') : ''}
                </div>
                <div style={{width:'100%',borderRadius:'4px 4px 0 0',background:isToday?'var(--primary)':'var(--text-sub)',height,opacity:val===0?0.15:1,transition:'height .3s'}}/>
                <div style={{fontSize:10,fontWeight:isToday?700:400,color:isToday?'var(--text)':'var(--text-muted)'}}>{dayName}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PENGELUARAN PER SUB KATEGORI */}
      <div style={s.section}>
        <div style={s.secTitle}>💸 Pengeluaran per Sub Kategori</div>
        {expEntries.length === 0 && (
          <div style={{textAlign:'center',color:'var(--text-muted)',fontSize:13,padding:'16px 0'}}>
            Belum ada pengeluaran minggu ini
          </div>
        )}
        {expEntries.map(([name, val], i) => {
          const pct = totExp > 0 ? (val/totExp*100).toFixed(0) : 0;
          return (
            <div key={name} style={s.expRow}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                <div style={{width:10,height:10,borderRadius:3,background:COLORS[i%COLORS.length],flexShrink:0}}/>
                <span style={{flex:1,fontSize:13,color:'var(--text)',fontWeight:500}}>{name}</span>
                <span style={{fontSize:13,fontWeight:700,color:'#ef4444',whiteSpace:'nowrap'}}>{fRp(val)}</span>
              </div>
              <div style={{height:5,background:'var(--row-border)',borderRadius:3,marginLeft:18}}>
                <div style={{height:'100%',borderRadius:3,background:COLORS[i%COLORS.length],width:`${pct}%`,transition:'width .3s'}}/>
              </div>
            </div>
          );
        })}
        {expEntries.length > 0 && (
          <div style={{display:'flex',justifyContent:'space-between',padding:'12px 14px',borderRadius:12,fontWeight:700,fontSize:13,background:'#fee2e2',color:'#991b1b',marginTop:12,border:'1px solid var(--border)'}}>
            <span>Total Pengeluaran</span><span>{fRp(totExp)}</span>
          </div>
        )}
      </div>

      {/* DETAIL TRANSAKSI PENGELUARAN */}
      {txs.filter(t=>t.type==='expense').length > 0 && (
        <div style={s.section}>
          <div style={s.secTitle}>📋 Detail Transaksi Pengeluaran</div>
          {txs.filter(t=>t.type==='expense').sort((a,b)=>new Date(b.date)-new Date(a.date)).map(t => {
            const label = t.sub_category_name || t.category_name || '-';
            return (
              <div key={t.id} style={s.txRow}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{label}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>{formatFull(t.date)}</div>
                </div>
                <span style={{fontWeight:700,fontSize:13,color:'#ef4444',whiteSpace:'nowrap'}}>
                  − {fRp(t.amount)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const s = {
  nav:         {display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,padding:'14px 18px',background:'var(--bg-section)',borderRadius:18,border:'1px solid var(--border)'},
  arrow:       {width:38,height:38,border:'2px solid var(--border)',background:'var(--bg-card)',color:'var(--text)',borderRadius:12,fontSize:16,fontWeight:'bold',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'},
  summaryCard: {background:'var(--bg-card)',border:'1.5px solid var(--border)',padding:20,borderRadius:20,marginBottom:16,textAlign:'center',boxShadow:'var(--shadow-sm)'},
  section:     {background:'var(--bg-card)',borderRadius:20,border:'1px solid var(--border)',padding:16,marginBottom:14,boxShadow:'var(--shadow-sm)'},
  secTitle:    {fontWeight:700,fontSize:14,marginBottom:12,color:'var(--text)'},
  expRow:      {padding:'8px 4px',borderBottom:'1px solid var(--row-border)'},
  txRow:       {display:'flex',alignItems:'center',gap:8,padding:'10px 12px',marginBottom:6,background:'var(--bg-section)',borderRadius:14,border:'1px solid var(--border)'},
};
