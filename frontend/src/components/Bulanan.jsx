import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { fRp, MONTHS, NOW } from '../api';

const COLORS = ['#ffd233','#22c55e','#f59e0b','#ef4444','#8b5cf6','#0ea5e9','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16','#06b6d4'];

const PieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.06) return null;
  const R = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * R);
  const y = cy + r * Math.sin(-midAngle * R);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {(percent*100).toFixed(0)}%
    </text>
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:10,padding:'8px 14px',fontSize:12,boxShadow:'var(--shadow-md)'}}>
      <div style={{fontWeight:700,marginBottom:2,color:'var(--text)'}}>{item.name}</div>
      <div style={{color:item.fill,fontWeight:600}}>{fRp(item.value)}</div>
    </div>
  );
};

export default function Bulanan({ data }) {
  const [month, setMonth] = useState(NOW.getMonth());
  const [year,  setYear]  = useState(NOW.getFullYear());

  const changeMonth = d => {
    let m = month+d, y = year;
    if (m > 11) { m=0; y++; } if (m < 0) { m=11; y--; }
    setMonth(m); setYear(y);
  };

  const txs = data.transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth()===month && d.getFullYear()===year;
  });

  const incCat={}, expCat={};
  let totInc=0, totExp=0;
  txs.forEach(t => {
    const cat = t.category_name || 'Lainnya';
    if (t.type==='income') { incCat[cat]=(incCat[cat]||0)+Number(t.amount); totInc+=Number(t.amount); }
    else                   { expCat[cat]=(expCat[cat]||0)+Number(t.amount); totExp+=Number(t.amount); }
  });
  const saldo = totInc - totExp;

  const incData = Object.entries(incCat).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
  const expData = Object.entries(expCat).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);

  return (
    <div>
      {/* MONTH NAV */}
      <div style={s.nav}>
        <button style={s.arrow} onClick={()=>changeMonth(-1)}>←</button>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:18,fontWeight:800,color:'var(--text)',letterSpacing:'-0.3px'}}>{MONTHS[month]}</div>
          <div style={{fontSize:12,color:'var(--text-sub)',marginTop:2}}>{year}</div>
        </div>
        <button style={s.arrow} onClick={()=>changeMonth(1)}>→</button>
      </div>

      {/* SUMMARY CARD */}
      <div style={s.summaryCard}>
        <div style={{fontSize:10,color:'var(--text-sub)',textTransform:'uppercase',letterSpacing:'1px'}}>Saldo Bulanan</div>
        <div style={{fontSize:28,fontWeight:900,margin:'6px 0 14px',color:saldo>=0?'#22c55e':'#ef4444',letterSpacing:'-0.5px'}}>{fRp(saldo)}</div>
        <div style={s.statsRow}>
          <div style={s.statItem}>
            <span style={{fontSize:10,color:'var(--text-sub)',display:'block',marginBottom:2}}>💰 Pemasukan</span>
            <strong style={{fontSize:14,color:'#22c55e'}}>{fRp(totInc)}</strong>
          </div>
          <div style={{width:1,background:'var(--border)'}}/>
          <div style={s.statItem}>
            <span style={{fontSize:10,color:'var(--text-sub)',display:'block',marginBottom:2}}>💸 Pengeluaran</span>
            <strong style={{fontSize:14,color:'#ef4444'}}>{fRp(totExp)}</strong>
          </div>
        </div>
      </div>

      {/* PIE CHARTS */}
      {txs.length > 0 && (
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14}}>
          <PieSection title="💰 Pemasukan" data={incData} colorOffset={0}/>
          <PieSection title="💸 Pengeluaran" data={expData} colorOffset={4}/>
        </div>
      )}

      {/* DETAIL */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
        <CatList label="💰 Pemasukan" map={incCat} total={totInc} type="income"/>
        <CatList label="💸 Pengeluaran" map={expCat} total={totExp} type="expense"/>
      </div>
    </div>
  );
}

function PieSection({ title, data, colorOffset }) {
  if (!data.length) return (
    <div style={{...s.chartBox, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:180}}>
      <div style={{fontSize:24,marginBottom:4}}>{title.split(' ')[0]}</div>
      <div style={{fontSize:11,color:'var(--text-muted)'}}>Belum ada</div>
    </div>
  );
  return (
    <div style={s.chartBox}>
      <div style={{fontSize:11,fontWeight:700,marginBottom:6,color:'var(--text)'}}>{title}</div>
      <ResponsiveContainer width="100%" height={140}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" outerRadius={60} dataKey="value" labelLine={false} label={<PieLabel/>}>
            {data.map((_,i) => <Cell key={i} fill={COLORS[(i+colorOffset)%COLORS.length]}/>)}
          </Pie>
          <Tooltip content={<CustomTooltip/>}/>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function CatList({ label, map, total, type }) {
  const keys = Object.keys(map).sort((a,b)=>map[b]-map[a]);
  const accentColor = type==='income'?'#22c55e':'#ef4444';
  const headerBg    = type==='income'?'#dcfce7':'#fee2e2';
  const headerColor = type==='income'?'#166534':'#991b1b';
  return (
    <div style={s.catListBox}>
      <div style={{fontSize:12, fontWeight:700, padding:'10px 14px', background:headerBg, color:headerColor, display:'flex', alignItems:'center', gap:6}}>{label}</div>
      {!keys.length && <div style={{textAlign:'center', color:'var(--text-muted)', fontSize:12, padding:16}}>Belum ada</div>}
      {keys.map(c => (
        <div key={c} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom:'1px solid var(--row-border)', fontSize:12}}>
          <span style={{flex:1, marginRight:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text-sub)'}}>{c}</span>
          <span style={{color:'var(--text)', fontWeight:700, whiteSpace:'nowrap'}}>{fRp(map[c])}</span>
        </div>
      ))}
      {keys.length > 0 && (
        <div style={{display:'flex', justifyContent:'space-between', padding:'10px 14px', fontWeight:700, fontSize:12, background:'var(--bg-section)', borderTop:'1px solid var(--border)', color:'var(--text)'}}>
          <span>Total</span><span style={{color:accentColor}}>{fRp(total)}</span>
        </div>
      )}
    </div>
  );
}

const s = {
  nav:         {display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,padding:'14px 18px',background:'var(--bg-section)',borderRadius:18,border:'1px solid var(--border)'},
  arrow:       {width:38,height:38,border:'2px solid var(--border)',background:'var(--bg-card)',borderRadius:12,fontSize:16,fontWeight:'bold',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text)',cursor:'pointer'},
  summaryCard: {background:'var(--bg-card)',border:'1.5px solid var(--border)',padding:20,borderRadius:20,marginBottom:16,textAlign:'center',boxShadow:'var(--shadow-sm)'},
  statsRow:    {display:'flex',background:'var(--bg-section)',borderRadius:14,overflow:'hidden',border:'1px solid var(--border)'},
  statItem:    {flex:1,padding:'12px 10px',textAlign:'center'},
  chartBox:    {background:'var(--bg-card)',borderRadius:16,boxShadow:'var(--shadow-sm)',padding:'14px 12px',border:'1px solid var(--border)'},
  catListBox:  {background:'var(--bg-card)',borderRadius:16,border:'1px solid var(--border)',overflow:'hidden',boxShadow:'var(--shadow-sm)'},
};
