import { swalConfirm } from '../swal.js';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch, fRp, MONTHS, NOW } from '../api';
import { G, R, S, T, SH, sSection, sSecTitle, sRow, sTotalRow, sNavBar, sArrowBtn, sSummaryCard, sSummaryRow, sSummaryItem } from '../theme';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import DashboardReal from '../components/DashboardReal';

const COLORS = ['#667eea','#22c55e','#f59e0b','#ef4444','#8b5cf6','#0ea5e9','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16','#06b6d4'];

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
    <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:8,padding:'8px 12px',fontSize:12,boxShadow:'0 4px 12px rgba(0,0,0,.12)'}}>
      <div style={{fontWeight:700,marginBottom:2}}>{item.name}</div>
      <div style={{color:item.fill,fontWeight:600}}>{fRp(item.value)}</div>
    </div>
  );
};

// ─── ADMIN DASHBOARD NAVIGATOR ───────────────
// ─── HELPERS ──────────────────────────────────

function getMondayAdmin(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff); d.setHours(0,0,0,0); return d;
}
function addDaysAdmin(date, n) { const d = new Date(date); d.setDate(d.getDate()+n); return d; }
function formatTglAdmin(date) { return date.toLocaleDateString('id-ID',{day:'2-digit',month:'short'}); }
// Pakai string lokal supaya tidak kena timezone offset saat filter
function toLocalStr(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ─── ADMIN DASHBOARD NAV ──────────────────────
function AdminDashboardNav({ transactions, wallets, allData, realBalanceItems, prefs }) {
  const TABS = ['📅 Bulanan','📆 Mingguan','💎 Saldo Real'];
  const [tabIdx, setTabIdx] = useState(0);

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',background:'#f8f9fa',borderRadius:10,marginBottom:12}}>
        <button style={{width:32,height:32,border:'2px solid #e5e7eb',background:'#fff',borderRadius:7,fontSize:14,fontWeight:'bold',cursor:'pointer'}}
          onClick={()=>setTabIdx(i=>Math.max(0,i-1))} disabled={tabIdx===0}>←</button>
        <div style={{fontWeight:700,fontSize:14}}>{TABS[tabIdx]}</div>
        <button style={{width:32,height:32,border:'2px solid #e5e7eb',background:'#fff',borderRadius:7,fontSize:14,fontWeight:'bold',cursor:'pointer'}}
          onClick={()=>setTabIdx(i=>Math.min(TABS.length-1,i+1))} disabled={tabIdx===TABS.length-1}>→</button>
      </div>
      <div style={{display:'flex',justifyContent:'center',gap:6,marginBottom:12}}>
        {TABS.map((_,i)=>(
          <div key={i} style={{width:8,height:8,borderRadius:'50%',background:i===tabIdx?'#667eea':'#e5e7eb',cursor:'pointer',transition:'all .2s'}} onClick={()=>setTabIdx(i)}/>
        ))}
      </div>
      {tabIdx===0 && <AdminBulanan transactions={transactions} wallets={wallets} allData={allData}/>}
      {tabIdx===1 && <AdminMingguan transactions={transactions} wallets={wallets} allData={allData}/>}
      {tabIdx===2 && <DashboardReal wallets={wallets} allData={allData} prefs={prefs} readOnlyItems={realBalanceItems}/>}
    </div>
  );
}

// ─── ADMIN BULANAN (hanya bulan ini, tidak bisa pindah) ───
function AdminBulanan({ transactions, wallets, allData }) {
  // Locked ke bulan ini saja
  const thisMonth = NOW.getMonth();
  const thisYear  = NOW.getFullYear();

  // Filter bulan ini, per wallet
  const txsThisMonth = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });

  // Hitung total semua wallet
  let totInc = 0, totExp = 0;
  txsThisMonth.forEach(t => {
    if (t.type === 'income') totInc += Number(t.amount);
    else totExp += Number(t.amount);
  });
  const saldo = totInc - totExp;

  // Kelompokkan per wallet
  const walletStats = wallets.map(w => {
    const wtxs = txsThisMonth.filter(t => t.wallet_id === w.id);
    let wInc = 0, wExp = 0;
    const incCat = {}, expCat = {};
    wtxs.forEach(t => {
      const cat = t.sub_category_name || t.category_name || 'Lainnya';
      if (t.type === 'income') { incCat[cat] = (incCat[cat]||0)+Number(t.amount); wInc += Number(t.amount); }
      else { expCat[cat] = (expCat[cat]||0)+Number(t.amount); wExp += Number(t.amount); }
    });
    return { wallet: w, txs: wtxs, incCat, expCat, totInc: wInc, totExp: wExp, saldo: wInc - wExp };
  }).filter(ws => ws.txs.length > 0);

  const incData = Object.entries(
    txsThisMonth.filter(t=>t.type==='income').reduce((acc,t)=>{const c=t.sub_category_name||t.category_name||'Lainnya';acc[c]=(acc[c]||0)+Number(t.amount);return acc;},{})
  ).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);

  const expData = Object.entries(
    txsThisMonth.filter(t=>t.type==='expense').reduce((acc,t)=>{const c=t.sub_category_name||t.category_name||'Lainnya';acc[c]=(acc[c]||0)+Number(t.amount);return acc;},{})
  ).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);

  return (
    <div>
      {/* HEADER — bulan ini, tidak ada tombol navigasi */}
      <div style={{padding:'10px 14px',background:'#f8f9fa',borderRadius:10,marginBottom:12,textAlign:'center'}}>
        <div style={{fontSize:13,fontWeight:700,color:'#374151'}}>📅 {MONTHS[thisMonth]} {thisYear}</div>
        <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>Semua Dompet — Bulan Ini</div>
      </div>

      {/* SUMMARY CARD */}
      <div style={{background:'linear-gradient(135deg,#667eea,#764ba2)',color:'#fff',padding:18,borderRadius:14,marginBottom:14,textAlign:'center'}}>
        <div style={{fontSize:11,opacity:.75,marginBottom:3}}>Saldo Bulan Ini</div>
        <div style={{fontSize:26,fontWeight:800,marginBottom:10,color:saldo>=0?'#fff':'#fca5a5'}}>{fRp(saldo)}</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <div style={{background:'rgba(255,255,255,.18)',padding:'9px 10px',borderRadius:9,fontSize:11,display:'flex',flexDirection:'column',gap:2}}>
            <span>💰 Pemasukan</span><strong>{fRp(totInc)}</strong>
          </div>
          <div style={{background:'rgba(255,255,255,.18)',padding:'9px 10px',borderRadius:9,fontSize:11,display:'flex',flexDirection:'column',gap:2}}>
            <span>💸 Pengeluaran</span><strong>{fRp(totExp)}</strong>
          </div>
        </div>
      </div>

      {/* PIE CHARTS gabungan semua dompet */}
      {txsThisMonth.length > 0 && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
          {[['💰 Pemasukan', incData, 0], ['💸 Pengeluaran', expData, 4]].map(([title, data, off]) => (
            <div key={title} style={{background:'#fff',borderRadius:11,boxShadow:'0 1px 5px rgba(0,0,0,.08)',padding:'12px 10px'}}>
              <div style={{fontSize:11,fontWeight:700,marginBottom:6,color:'#374151'}}>{title}</div>
              {data.length ? (
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={data} cx="50%" cy="50%" outerRadius={60} dataKey="value" labelLine={false} label={<PieLabel/>}>
                      {data.map((_,i) => <Cell key={i} fill={COLORS[(i+off)%COLORS.length]}/>)}
                    </Pie>
                    <Tooltip content={<CustomTooltip/>}/>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{textAlign:'center',color:'#9ca3af',fontSize:12,padding:20}}>Belum ada</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* RINCIAN PER DOMPET */}
      {walletStats.length === 0 && (
        <div style={{textAlign:'center',color:'#9ca3af',fontSize:13,padding:20}}>Belum ada transaksi bulan ini</div>
      )}
      {walletStats.map(({ wallet: w, incCat, expCat, totInc: wInc, totExp: wExp, saldo: wSaldo }) => (
        <div key={w.id} style={{border:'2px solid #e5e7eb',borderRadius:12,marginBottom:12,overflow:'hidden'}}>
          {/* Wallet header */}
          <div style={{background:'linear-gradient(135deg,#667eea,#764ba2)',color:'#fff',padding:'8px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontWeight:700,fontSize:13}}>👛 {w.label}</span>
            <span style={{fontSize:12,fontWeight:600,color:wSaldo>=0?'#fff':'#fca5a5'}}>Saldo: {fRp(wSaldo)}</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:0}}>
            {[['💰 Pemasukan', incCat, wInc, 'income'], ['💸 Pengeluaran', expCat, wExp, 'expense']].map(([label, map, total, type]) => {
              const keys = Object.keys(map).sort((a,b)=>map[b]-map[a]);
              const color = type==='income'?'#22c55e':'#ef4444';
              const bg    = type==='income'?'#dcfce7':'#fee2e2';
              const tc    = type==='income'?'#166534':'#991b1b';
              return (
                <div key={label} style={{borderRight:type==='income'?'1px solid #e5e7eb':'none'}}>
                  <div style={{fontSize:11,fontWeight:700,padding:'6px 10px',background:bg,color:tc}}>{label}</div>
                  {!keys.length && <div style={{textAlign:'center',color:'#9ca3af',fontSize:11,padding:8}}>-</div>}
                  {keys.map(c=>(
                    <div key={c} style={{display:'flex',justifyContent:'space-between',padding:'5px 10px',borderBottom:'1px solid #f3f4f6',fontSize:11}}>
                      <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginRight:4}}>{c}</span>
                      <span style={{color,fontWeight:700,whiteSpace:'nowrap'}}>{fRp(map[c])}</span>
                    </div>
                  ))}
                  {keys.length > 0 && (
                    <div style={{display:'flex',justifyContent:'space-between',padding:'6px 10px',fontWeight:700,fontSize:11,background:color,color:'#fff'}}>
                      <span>Total</span><span>{fRp(total)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── ADMIN MINGGUAN (navigasi dibatasi dalam bulan ini) ───
function AdminMingguan({ transactions, wallets, allData }) {
  const thisMonth = NOW.getMonth();
  const thisYear  = NOW.getFullYear();
  const [weekStart, setWeekStart] = useState(() => getMondayAdmin(NOW));
  const weekEnd = addDaysAdmin(weekStart, 6);

  // Cek apakah boleh ke minggu sebelumnya/berikutnya (masih di bulan ini)
  const prevMonday = addDaysAdmin(weekStart, -7);
  const nextMonday = addDaysAdmin(weekStart, 7);
  const canPrev = prevMonday.getMonth() === thisMonth && prevMonday.getFullYear() === thisYear
                  || weekStart.getMonth() === thisMonth; // masih bisa mundur kalau minggu ini masih di bulan ini
  // Lebih tepat: cek apakah ada hari dari minggu sebelumnya yang masih di bulan ini
  const canGoPrev = addDaysAdmin(weekStart, -1).getMonth() === thisMonth;
  const canGoNext = addDaysAdmin(weekEnd, 1).getMonth() === thisMonth;

  const prevWeek = () => { if (canGoPrev) setWeekStart(p => addDaysAdmin(p, -7)); };
  const nextWeek = () => { if (canGoNext) setWeekStart(p => addDaysAdmin(p, 7)); };

  // Set tanggal lokal dalam minggu ini
  const weekDates = new Set();
  for (let i = 0; i < 7; i++) weekDates.add(toLocalStr(addDaysAdmin(weekStart, i)));

  // Filter: hanya transaksi minggu ini (dan bulan ini)
  const txsWeek = transactions.filter(t => {
    const ds = toLocalStr(t.date);
    const d  = new Date(t.date);
    return weekDates.has(ds) && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });

  // Hitung total semua dompet
  let totInc = 0, totExp = 0;
  txsWeek.forEach(t => {
    if (t.type === 'income') totInc += Number(t.amount);
    else totExp += Number(t.amount);
  });
  const saldo = totInc - totExp;

  // Kelompokkan per dompet
  const walletStats = wallets.map(w => {
    const wtxs = txsWeek.filter(t => t.wallet_id === w.id);
    let wInc = 0, wExp = 0;
    const expBySub = {};
    wtxs.forEach(t => {
      if (t.type === 'income') { wInc += Number(t.amount); }
      else {
        const k = t.sub_category_name || t.category_name || 'Lainnya';
        expBySub[k] = (expBySub[k]||0) + Number(t.amount);
        wExp += Number(t.amount);
      }
    });
    return { wallet: w, txs: wtxs, expBySub, totInc: wInc, totExp: wExp, saldo: wInc - wExp };
  }).filter(ws => ws.txs.length > 0);

  const weekLabel = `${formatTglAdmin(weekStart)} - ${formatTglAdmin(weekEnd)} ${weekEnd.getFullYear()}`;

  return (
    <div>
      {/* NAV — dengan indikator apakah bisa navigasi */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,padding:'10px 14px',background:'#f8f9fa',borderRadius:10}}>
        <button
          style={{width:34,height:34,border:'2px solid #e5e7eb',background:canGoPrev?'#fff':'#f3f4f6',borderRadius:8,fontSize:15,fontWeight:'bold',cursor:canGoPrev?'pointer':'not-allowed',opacity:canGoPrev?1:0.4}}
          onClick={prevWeek}>←</button>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:13,fontWeight:700}}>📆 Mingguan</div>
          <div style={{fontSize:11,color:'#9ca3af'}}>{weekLabel}</div>
          <div style={{fontSize:10,color:'#667eea',marginTop:2}}>Semua Dompet — {MONTHS[thisMonth]} {thisYear}</div>
        </div>
        <button
          style={{width:34,height:34,border:'2px solid #e5e7eb',background:canGoNext?'#fff':'#f3f4f6',borderRadius:8,fontSize:15,fontWeight:'bold',cursor:canGoNext?'pointer':'not-allowed',opacity:canGoNext?1:0.4}}
          onClick={nextWeek}>→</button>
      </div>

      {/* SUMMARY CARD — warna seragam */}
      <div style={{background:'linear-gradient(135deg,#667eea,#764ba2)',color:'#fff',padding:16,borderRadius:14,marginBottom:12,textAlign:'center'}}>
        <div style={{fontSize:11,opacity:.8,marginBottom:2}}>Pengeluaran Minggu Ini (Semua Dompet)</div>
        <div style={{fontSize:24,fontWeight:800,marginBottom:8}}>{fRp(totExp)}</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
          <div style={{background:'rgba(255,255,255,.2)',padding:'7px 8px',borderRadius:8,fontSize:11,display:'flex',flexDirection:'column',gap:2}}>
            <span>💰 Masuk</span><strong>{fRp(totInc)}</strong>
          </div>
          <div style={{background:'rgba(255,255,255,.2)',padding:'7px 8px',borderRadius:8,fontSize:11,display:'flex',flexDirection:'column',gap:2}}>
            <span>🏦 Saldo</span><strong style={{color:saldo>=0?'#fff':'#fca5a5'}}>{fRp(saldo)}</strong>
          </div>
        </div>
      </div>

      {/* RINCIAN PER DOMPET */}
      {walletStats.length === 0 && (
        <div style={{textAlign:'center',color:'#9ca3af',fontSize:13,padding:20}}>Belum ada transaksi minggu ini</div>
      )}
      {walletStats.map(({ wallet: w, expBySub, totInc: wInc, totExp: wExp, saldo: wSaldo }) => {
        const expEntries = Object.entries(expBySub).sort((a,b)=>b[1]-a[1]);
        return (
          <div key={w.id} style={{border:'2px solid #e5e7eb',borderRadius:12,marginBottom:12,overflow:'hidden'}}>
            {/* Wallet header */}
            <div style={{background:'linear-gradient(135deg,#667eea,#764ba2)',color:'#fff',padding:'8px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:700,fontSize:13}}>👛 {w.label}</span>
              <div style={{fontSize:11,textAlign:'right'}}>
                <div>Masuk: {fRp(wInc)} · Keluar: {fRp(wExp)}</div>
                <div style={{color:wSaldo>=0?'#fff':'#fca5a5',fontWeight:700}}>Saldo: {fRp(wSaldo)}</div>
              </div>
            </div>
            <div style={{padding:10}}>
              {expEntries.length === 0 && (
                <div style={{textAlign:'center',color:'#9ca3af',fontSize:12,padding:8}}>Belum ada pengeluaran</div>
              )}
              {expEntries.map(([name, val]) => (
                <div key={name} style={{display:'flex',justifyContent:'space-between',padding:'6px 4px',borderBottom:'1px solid #f3f4f6',fontSize:12}}>
                  <span>{name}</span>
                  <span style={{color:'#ef4444',fontWeight:700}}>{fRp(val)}</span>
                </div>
              ))}
              {expEntries.length > 0 && (
                <div style={{display:'flex',justifyContent:'space-between',padding:'7px 4px',fontWeight:700,fontSize:12,marginTop:4,color:'#ef4444'}}>
                  <span>Total Pengeluaran</span><span>{fRp(wExp)}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── ADMIN SALDO RINGKAS ───────────────────────
function AdminSaldoRingkas({ wallets, allData, prefs }) {
  const walletSaldo = w => {
    const txs = (allData[w.id]?.transactions || []);
    let t = Number(w.initial_balance || 0);
    txs.forEach(tx => { t += tx.type==='income' ? Number(tx.amount) : -Number(tx.amount); });
    return t;
  };

  const tabInCats  = prefs?.tabInCats  || [];
  const tabOutCats = prefs?.tabOutCats || [];
  const hasTab = tabInCats.length > 0 || tabOutCats.length > 0;

  const totalTabungan = (() => {
    if (!hasTab) return 0;
    let tin=0,tout=0;
    wallets.forEach(w=>{
      (allData[w.id]?.transactions||[]).forEach(t=>{
        const name=(t.sub_category_name||t.category_name||'').toLowerCase().trim();
        if(tabInCats.some(k=>name===k.toLowerCase().trim())) tin+=Number(t.amount);
        if(tabOutCats.some(k=>name===k.toLowerCase().trim())) tout+=Number(t.amount);
      });
    });
    return tin-tout;
  })();

  const totalDompet  = wallets.reduce((s,w) => s+walletSaldo(w), 0);
  const totalCatatan = totalDompet + (hasTab ? totalTabungan : 0);

  return (
    <div>
      {/* Summary card */}
      <div style={{background:G.teal,color:'#fff',padding:S.xl,borderRadius:R.lg,marginBottom:S.md,textAlign:'center'}}>
        <div style={{fontSize:11,opacity:.75,marginBottom:4}}>💎 Total Saldo Catatan</div>
        <div style={{fontSize:26,fontWeight:800,color:totalCatatan>=0?'#fff':'#fca5a5'}}>{fRp(totalCatatan)}</div>
      </div>

      {/* Per dompet */}
      <div style={sSection}>
        <div style={sSecTitle}>📱 Per Dompet</div>
        {wallets.map(w => {
          const sd = walletSaldo(w);
          return (
            <div key={w.id} style={sRow}>
              <span>{w.label}</span>
              <span style={{fontWeight:700,color:sd>=0?'#22c55e':'#ef4444'}}>{fRp(sd)}</span>
            </div>
          );
        })}
        {hasTab && (
          <div style={{...sRow, background:'#ecfdf5', borderRadius:R.sm, padding:'7px 10px', margin:'4px 0', border:'1px solid #6ee7b7'}}>
            <span style={{color:'#065f46',fontWeight:600}}>🏦 Saldo Tabungan</span>
            <span style={{fontWeight:700,color:totalTabungan>=0?'#059669':'#ef4444'}}>{fRp(totalTabungan)}</span>
          </div>
        )}
        <div style={sTotalRow}>
          <span>Total</span>
          <span style={{color:'#0ea5e9'}}>{fRp(totalCatatan)}</span>
        </div>
      </div>
    </div>

  );
}


export default function AdminPage() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [users,    setUsers]    = useState([]);
  const [viewUser, setViewUser] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [form,     setForm]     = useState({ username:'', password:'', display_name:'', is_admin:false });
  const [editUser, setEditUser] = useState(null);
  const [tab,      setTab]      = useState('users');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const loadUsers = async () => {
    try { setUsers(await apiFetch('/admin/users', {}, token)); }
    catch(e) { setError(e.message); }
  };

  useEffect(() => { loadUsers(); }, []);

  const addUser = async () => {
    if (!form.username||!form.password||!form.display_name) { setError('Semua field wajib diisi'); return; }
    setLoading(true); setError('');
    try {
      await apiFetch('/admin/users', { method:'POST', body: JSON.stringify(form) }, token);
      setForm({ username:'', password:'', display_name:'', is_admin:false });
      setTab('users'); loadUsers();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const updateUser = async () => {
    setLoading(true); setError('');
    try {
      const payload = {};
      if (editUser.password)     payload.password     = editUser.password;
      if (editUser.display_name) payload.display_name = editUser.display_name;
      payload.is_admin = editUser.is_admin;
      await apiFetch(`/admin/users/${editUser.id}`, { method:'PUT', body: JSON.stringify(payload) }, token);
      setEditUser(null); loadUsers();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const deleteUser = async (id) => {
    const r = await swalConfirm('Hapus user ini beserta semua datanya?');
    if (!r.isConfirmed) return;
    try { await apiFetch(`/admin/users/${id}`, { method:'DELETE' }, token); loadUsers(); }
    catch(e) { setError(e.message); }
  };

  const viewUserData = async (u) => {
    setViewUser(u); setViewData(null);
    try {
      const d = await apiFetch(`/admin/users/${u.id}/data`, {}, token);
      const allDataMap = {};
      d.wallets.forEach(w => {
        allDataMap[w.id] = { transactions: d.transactions.filter(t=>t.wallet_id===w.id) };
      });
      setViewData({ ...d, allData: allDataMap });
    } catch(e) { setError(e.message); }
  };

  return (
    <div style={{minHeight:'100vh',padding:'12px 12px 20px',background:'var(--bg-page)'}}>
      <div style={s.container}>
        <div style={s.header}>
          <div>
            <div style={{fontSize:18,fontWeight:800}}>⚙️ Admin Panel</div>
            <div style={{fontSize:12,opacity:.8}}>👤 {user?.displayName}</div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button style={s.btn2} onClick={()=>navigate('/')}>← App</button>
            <button style={s.btn2} onClick={()=>{logout();navigate('/login');}}>Keluar</button>
          </div>
        </div>

        {error && <div style={s.err}>{error}</div>}

        {/* TABS */}
        <div style={{display:'flex',borderBottom:'2px solid #e9ecef'}}>
          {[['users','👥 Users'],['add','➕ Tambah User']].map(([id,label])=>(
            <button key={id} style={{...s.tabBtn,...(tab===id?s.tabBtnActive:{})}} onClick={()=>setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        <div style={{padding:16}}>
          {/* USER LIST */}
          {tab==='users' && (
            <div>
              {users.map(u => (
                <div key={u.id} style={s.userCard}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      <span style={{fontWeight:700,fontSize:15}}>{u.display_name}</span>
                      {u.is_admin && <span style={s.adminBadge}>ADMIN</span>}
                    </div>
                    <div style={{fontSize:12,color:'#6b7280'}}>@{u.username}</div>
                    <div style={{fontSize:12,color:'#9ca3af',marginTop:2}}>
                      {u.wallet_count} dompet · {u.tx_count} transaksi · Bergabung {new Date(u.created_at).toLocaleDateString('id-ID')}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}>
                    <button style={s.btnView} onClick={()=>viewUserData(u)}>📊 Data</button>
                    <button style={s.btnEdit} onClick={()=>setEditUser({...u,password:''})}>✏️</button>
                    <button style={s.btnDel}  onClick={()=>deleteUser(u.id)} disabled={u.id===user?.id}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAMBAH USER */}
          {tab==='add' && (
            <div style={s.formCard}>
              <h3 style={{marginBottom:14,fontSize:15}}>➕ Tambah User Baru</h3>
              {[
                ['display_name','Nama Lengkap','text','contoh: Budi Santoso'],
                ['username','Username','text','contoh: budi (huruf kecil)'],
                ['password','Password','password','minimal 6 karakter'],
              ].map(([field,label,type,ph])=>(
                <div key={field} style={s.fg}>
                  <label style={s.label}>{label}</label>
                  <input style={s.input} type={type} placeholder={ph}
                    value={form[field]} onChange={e=>setForm({...form,[field]:e.target.value})}/>
                </div>
              ))}
              <div style={{...s.fg,display:'flex',alignItems:'center',gap:10}}>
                <input type="checkbox" id="isAdminCheck" checked={form.is_admin}
                  onChange={e=>setForm({...form,is_admin:e.target.checked})}/>
                <label htmlFor="isAdminCheck" style={{fontSize:14,fontWeight:600}}>Jadikan Admin</label>
              </div>
              <button style={s.btnPrimary} onClick={addUser} disabled={loading}>
                {loading ? '⏳ Menyimpan...' : '💾 Buat User'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* EDIT USER MODAL */}
      {editUser && (
        <div style={s.overlay} onClick={()=>setEditUser(null)}>
          <div style={s.modal} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
              <span style={{fontWeight:700}}>✏️ Edit: {editUser.display_name}</span>
              <button style={{background:'none',border:'none',fontSize:22,color:'#9ca3af'}} onClick={()=>setEditUser(null)}>×</button>
            </div>
            <div style={s.fg}>
              <label style={s.label}>Nama Lengkap</label>
              <input style={s.input} value={editUser.display_name} onChange={e=>setEditUser({...editUser,display_name:e.target.value})}/>
            </div>
            <div style={s.fg}>
              <label style={s.label}>Password Baru <span style={{color:'#9ca3af',fontWeight:400}}>(kosongkan jika tidak diganti)</span></label>
              <input style={s.input} type="password" placeholder="Password baru..." value={editUser.password} onChange={e=>setEditUser({...editUser,password:e.target.value})}/>
            </div>
            <div style={{...s.fg,display:'flex',alignItems:'center',gap:10}}>
              <input type="checkbox" id="editAdminCheck" checked={editUser.is_admin}
                onChange={e=>setEditUser({...editUser,is_admin:e.target.checked})}/>
              <label htmlFor="editAdminCheck" style={{fontSize:14,fontWeight:600}}>Admin</label>
            </div>
            <button style={s.btnPrimary} onClick={updateUser} disabled={loading}>
              {loading ? '⏳' : '💾 Simpan Perubahan'}
            </button>
          </div>
        </div>
      )}

      {/* VIEW USER DATA MODAL — tampilan dashboard bulanan */}
      {viewUser && (
        <div style={s.overlay} onClick={()=>{setViewUser(null);setViewData(null);}}>
          <div style={{...s.modal,maxHeight:'90vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <div>
                <span style={{fontWeight:700,fontSize:15}}>📊 {viewUser.display_name}</span>
                <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>Dashboard Bulanan</div>
              </div>
              <button style={{background:'none',border:'none',fontSize:22,color:'#9ca3af'}} onClick={()=>{setViewUser(null);setViewData(null);}}>×</button>
            </div>
            {!viewData && <div style={{textAlign:'center',color:'#9ca3af',padding:40}}>⏳ Memuat data...</div>}
            {viewData && <AdminDashboardNav transactions={viewData.transactions} wallets={viewData.wallets} allData={viewData.allData||{}} realBalanceItems={viewData.realBalance||[]} prefs={viewData.prefs||{tabInCats:[],tabOutCats:[]}}/>}
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  container:   {maxWidth:680,margin:'0 auto',background:'var(--bg-app)',borderRadius:20,boxShadow:'var(--shadow-app)',overflow:'hidden'},
  header:      {background:'linear-gradient(135deg,#764ba2,#667eea)',color:'#fff',padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'},
  btn2:        {background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.25)',color:'#fff',padding:'6px 12px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer'},
  tabBtn:      {flex:1,padding:'11px 8px',border:'none',borderBottom:'3px solid transparent',background:'var(--nav-bg)',fontSize:13,fontWeight:700,color:'var(--text-muted)',cursor:'pointer'},
  tabBtnActive:{color:'#667eea',borderBottomColor:'#667eea'},
  userCard:    {display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 16px',border:'2px solid var(--border)',borderRadius:12,marginBottom:10,gap:12,background:'var(--bg-card)'},
  adminBadge:  {background:'#fef3c7',color:'#92400e',fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:20},
  btnView:     {background:'#667eea',color:'#fff',border:'none',padding:'5px 10px',borderRadius:6,fontSize:12},
  btnEdit:     {background:'#0ea5e9',color:'#fff',border:'none',padding:'5px 10px',borderRadius:6,fontSize:12},
  btnDel:      {background:'#ef4444',color:'#fff',border:'none',padding:'5px 10px',borderRadius:6,fontSize:12},
  formCard:    {background:'#f8f9fa',padding:18,borderRadius:14},
  fg:          {marginBottom:13},
  label:       {display:'block',marginBottom:5,fontWeight:600,fontSize:12,color:'#374151'},
  input:       {width:'100%',padding:'10px 12px',border:'2px solid #e5e7eb',borderRadius:9,fontSize:14,background:'#fff',outline:'none'},
  btnPrimary:  {background:'linear-gradient(135deg,#667eea,#764ba2)',color:'#fff',width:'100%',padding:13,fontSize:14,fontWeight:700,border:'none',borderRadius:8},
  err:         {background:'#fee2e2',color:'#991b1b',padding:'9px 16px',fontSize:13},
  overlay:     {position:'fixed',top:0,left:0,width:'100%',height:'100%',background:'rgba(0,0,0,.45)',zIndex:3000,display:'flex',alignItems:'flex-end',justifyContent:'center'},
  modal:       {background:'#fff',padding:20,borderRadius:'18px 18px 0 0',width:'100%',maxWidth:700},
};


