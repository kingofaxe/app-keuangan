import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }  from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiFetch } from '../api';
import { G, S, R, T, SH }  from '../theme';
import Dashboard     from '../components/Dashboard';
import Mingguan      from '../components/Mingguan';
import Tabungan      from '../components/Tabungan';
import Bulanan       from '../components/Bulanan';
import Riwayat       from '../components/Riwayat';
import TambahForm    from '../components/TambahForm';
import Kategori      from '../components/Kategori';
import Dompet        from '../components/Dompet';
import Settings      from '../components/Settings';
import DashboardReal from '../components/DashboardReal';

const MENU = [
  { id:'dashboard', icon:'📊', label:'Tahunan'  },
  { id:'mingguan',  icon:'📆', label:'Mingguan' },
  { id:'real',      icon:'💎', label:'Saldo'    },
  { id:'tabungan',  icon:'🏦', label:'Tabungan' },
  { id:'bulanan',   icon:'📅', label:'Bulanan'  },
  { id:'tambah',    icon:'➕', label:'Tambah'   },
  { id:'riwayat',   icon:'📋', label:'Riwayat'  },
  { id:'kategori',  icon:'🏷️', label:'Kategori' },
  { id:'dompet',    icon:'👛', label:'Dompet'   },
  { id:'settings',  icon:'⚙️', label:'Settings' },
];
const NON_HIDEABLE = ['tambah','settings'];
const DEFAULT_ORDER = MENU.map(m => m.id);

export default function MainPage() {
  const { token, user, logout } = useAuth();
  const { dark, toggle: toggleDark } = useTheme();
  const navigate = useNavigate();

  const [wallets,    setWallets]    = useState([]);
  const [wallet,     setWallet]     = useState(null);
  const [section,    setSection]    = useState('dashboard');
  const [allData,    setAllData]    = useState({});
  const [activeData, setActiveData] = useState({ categories:[], transactions:[] });
  const [status,     setStatus]     = useState({ msg:'⏳ Memuat...', type:'syncing' });
  const [loading,    setLoading]    = useState(false);
  const [editTx,     setEditTx]     = useState(null);
  const [prefs,      setPrefs]      = useState({
    menuOrder: DEFAULT_ORDER, hiddenSections:[], tabInCats:[], tabOutCats:[]
  });

  const loadWallets = useCallback(async () => {
    try {
      const ws = await apiFetch('/wallets', {}, token);
      setWallets(ws);
      return ws;
    } catch { logout(); navigate('/login'); return []; }
  }, [token]);

  const loadPrefs = useCallback(async (allCats) => {
    try {
      const p = await apiFetch('/preferences', {}, token);
      const saved = p.menuOrder?.length ? p.menuOrder : DEFAULT_ORDER;
      const merged = [...saved, ...DEFAULT_ORDER.filter(id => !saved.includes(id))];
      setPrefs({ ...p, menuOrder: merged, _allCats: allCats || [] });
    } catch {}
  }, [token]);

  const loadOneWallet = useCallback(async (w) => {
    const [cats, txs] = await Promise.all([
      apiFetch(`/categories?wallet_id=${w.id}`, {}, token),
      apiFetch(`/transactions/all?wallet_id=${w.id}`, {}, token),
    ]);
    return { categories: cats, transactions: txs };
  }, [token]);

  const loadAllWallets = useCallback(async (ws) => {
    const map = {}; const allCatsMap = {};
    for (const w of ws) {
      const d = await loadOneWallet(w);
      map[w.id] = d;
      // Update allData per wallet agar section yg sudah load bisa langsung render
      setAllData(prev => ({ ...prev, [w.id]: d }));
      d.categories.forEach(cat => {
        const key = cat.name + '_' + cat.type;
        if (!allCatsMap[key]) allCatsMap[key] = cat;
      });
    }
    return { map, allCats: Object.values(allCatsMap) };
  }, [loadOneWallet]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const ws = await loadWallets();
        if (!ws.length) return;
        setWallet(ws[0]);
        const { map, allCats } = await loadAllWallets(ws);
        setActiveData(map[ws[0].id] || { categories:[], transactions:[] });
        await loadPrefs(allCats);
        setStatus({ msg:'✅ Terhubung', type:'' });
      } catch { setStatus({ msg:'❌ Gagal koneksi', type:'error' }); }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!wallet) return;
    // Kalau sudah ada di cache, langsung pakai
    if (allData[wallet.id]) {
      setActiveData(allData[wallet.id]);
      return;
    }
    // Kalau belum ada (wallet baru), fetch dulu
    setLoading(true);
    loadOneWallet(wallet).then(d => {
      setAllData(prev => ({ ...prev, [wallet.id]: d }));
      setActiveData(d);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [wallet]);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setStatus({ msg:'🔄 Menyinkron...', type:'syncing' });
    try {
      const ws = await loadWallets();
      const { map } = await loadAllWallets(ws);
      const w = ws.find(x => x.id===wallet.id) || ws[0];
      setWallet(w);
      setActiveData(map[w.id] || { categories:[], transactions:[] });
      setStatus({ msg:'✅ Tersinkron', type:'' });
    } catch { setStatus({ msg:'⚠️ Gagal sinkron', type:'error' }); }
    finally { setLoading(false); }
  }, [wallet, loadWallets, loadAllWallets]);

  const refreshWallets = async () => {
    const ws = await loadWallets();
    if (ws.length) {
      const { map } = await loadAllWallets(ws);
      setActiveData(map[wallet?.id || ws[0].id] || { categories:[], transactions:[] });
    }
  };

  const menuOrder  = prefs.menuOrder || DEFAULT_ORDER;
  const hidden     = prefs.hiddenSections || [];
  const visibleIds = menuOrder.filter(id => NON_HIDEABLE.includes(id) || !hidden.includes(id));
  const visibleMenu = visibleIds.map(id => MENU.find(m => m.id===id)).filter(Boolean);

  const statusBg  = status.type==='error' ? '#fee2e2' : status.type==='syncing' ? '#fef3c7' : '#dcfce7';
  const statusClr = status.type==='error' ? '#991b1b' : status.type==='syncing' ? '#92400e' : '#166534';

  const isAdmin = user?.isAdmin===true || user?.isAdmin==='true';

  return (
    <div style={st.page}>
      {loading && <div style={st.topBar}/>}

      {/* ══ MAIN CONTAINER ══ */}
      <div style={st.container}>

        {/* HEADER */}
        <div style={{ ...st.header, background: 'var(--bg-app)', color: 'var(--text)', borderBottom: '1px solid var(--border)', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--primary-light)', border: '2px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              👤
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-sub)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Welcome back,</div>
              <div style={{ fontSize: 14, fontWeight: 800, textTransform: 'capitalize', color: 'var(--text)', letterSpacing: '-0.3px' }}>{user?.displayName || 'User'}</div>
            </div>
          </div>
          <div style={st.headerActions}>
            <button style={st.iconBtn} onClick={toggleDark} title={dark?'Mode Terang':'Mode Gelap'}>
              {dark ? '☀️' : '🌙'}
            </button>
            {isAdmin && (
              <button style={{...st.headerBtn, background:'var(--primary)', border:'none', color: '#111'}}
                onClick={() => navigate('/admin')}>
                ⚙️ Admin
              </button>
            )}
            <button style={{ ...st.headerBtn, background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border)' }} onClick={() => { logout(); navigate('/login'); }}>
              Keluar
            </button>
          </div>
        </div>

        {/* STATUS BAR */}
        <div style={{padding:'5px 16px', fontSize:11, background:statusBg, color:statusClr, letterSpacing:.2}}>
          {status.msg}
        </div>

        {/* WALLET TABS */}
        <div style={{ ...st.walletRow, background: 'var(--bg-page)', padding: '12px 16px', gap: 10 }}>
          {wallets.map(w => (
            <button key={w.id}
              onClick={() => setWallet(w)}
              style={{
                ...st.walletBtn,
                borderRadius: 16,
                padding: '10px 14px',
                border: wallet?.id===w.id ? '2px solid var(--primary)' : '2px solid var(--border)',
                background: wallet?.id===w.id ? 'var(--primary)' : 'var(--bg-card)',
                color: 'var(--text)',
                boxShadow: wallet?.id===w.id ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}>
              👛 {w.label}
            </button>
          ))}
        </div>

        {/* BOTTOM NAV */}
        <div style={{ 
          ...st.nav, 
          background: 'var(--bg-card)', 
          borderBottom: 'none', 
          borderTop: '1px solid var(--border)', 
          padding: '8px 12px', 
          display: 'flex', 
          gap: 6,
          justifyContent: 'space-around',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.03)'
        }}>
          {visibleMenu.map(m => {
            const isActive = section === m.id;
            return (
              <button key={m.id}
                style={{
                  ...st.navBtn,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 12px',
                  borderRadius: 16,
                  background: isActive ? 'var(--primary-light)' : 'transparent',
                  color: isActive ? 'var(--text)' : 'var(--text-muted)',
                  borderBottom: 'none',
                  minWidth: 56,
                  transition: 'all 0.2s ease',
                  transform: isActive ? 'scale(1.05)' : 'none',
                  fontWeight: isActive ? '800' : '500'
                }}
                onClick={() => setSection(m.id)}>
                <span style={{ fontSize: 18, display: 'block', marginBottom: 2 }}>{m.icon}</span>
                <span style={{ fontSize: 9, display: 'block', letterSpacing: '-0.1px' }}>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* CONTENT */}
        <div style={st.content}>
          {section==='dashboard' && <Dashboard    data={activeData}/>}
          {section==='mingguan'  && <Mingguan     data={activeData}/>}
          {section==='real'      && <DashboardReal token={token} wallets={wallets} allData={allData} prefs={prefs}/>}
          {section==='tabungan'  && <Tabungan     wallets={wallets} allData={allData} prefs={prefs}/>}
          {section==='bulanan'   && <Bulanan      data={activeData}/>}
          {section==='riwayat'   && <Riwayat      data={activeData} token={token} wallet={wallet} onRefresh={refresh} onEdit={setEditTx}/>}
          {section==='tambah'    && <TambahForm   data={activeData} token={token} wallet={wallet} onRefresh={refresh} onDone={()=>setSection('tambah')}/>}
          {section==='kategori'  && <Kategori     data={activeData} token={token} wallet={wallet} onRefresh={refresh}/>}
          {section==='dompet'    && <Dompet       wallets={wallets} token={token} onRefresh={refreshWallets}/>}
          {section==='settings'  && <Settings     token={token} allCategories={prefs._allCats||[]} prefs={prefs} onPrefsChange={p=>{
            const merged = [...(p.menuOrder||DEFAULT_ORDER), ...DEFAULT_ORDER.filter(id=>!(p.menuOrder||[]).includes(id))];
            setPrefs({...p, menuOrder:merged});
          }}/>}
        </div>
      </div>

      {/* EDIT MODAL */}
      {editTx && (
        <div style={st.overlay} onClick={() => setEditTx(null)}>
          <div style={st.modal} onClick={e => e.stopPropagation()}>
            <div style={st.modalHead}>
              <span style={{fontWeight:700, fontSize:15, color:'var(--text)'}}>✏️ Edit Transaksi</span>
              <button style={{background:'none',border:'none',fontSize:22,color:'var(--text-muted)',cursor:'pointer'}}
                onClick={() => setEditTx(null)}>×</button>
            </div>
            <TambahForm data={activeData} token={token} wallet={wallet} editTx={editTx}
              onRefresh={refresh} onDone={() => setEditTx(null)}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────
const st = {
  page:       { minHeight:'100vh', padding:'12px 12px 20px', background:'var(--bg-page)' },
  topBar:     { position:'fixed', top:0, left:0, width:'100%', height:3, background:'var(--primary)', zIndex:9999 },
  container:  { maxWidth:680, margin:'0 auto', background:'var(--bg-app)', borderRadius:R.xl, boxShadow:'var(--shadow-app)', overflow:'hidden' },
  header:     { background:G.primary, color:'#111', padding:`${S.lg}px ${S.xl}px`, display:'flex', justifyContent:'space-between', alignItems:'center', gap:S.sm },
  headerTitle:{ fontSize:16, fontWeight:800, letterSpacing:-.3 },
  headerSub:  { fontSize:11, opacity:.75, marginTop:2 },
  headerActions:{ display:'flex', gap:S.sm, alignItems:'center', flexShrink:0 },
  iconBtn:    { background:'rgba(0,0,0,.06)', border:'1px solid rgba(0,0,0,.08)', color:'#111', width:34, height:34, borderRadius:R.sm, fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' },
  headerBtn:  { background:'rgba(0,0,0,.06)', border:'1px solid rgba(0,0,0,.08)', color:'#111', padding:`${S.xs}px ${S.sm}px`, borderRadius:R.sm, fontSize:12, fontWeight:600 },
  walletRow:  { display:'flex', gap:S.sm, padding:`${S.md}px ${S.lg}px`, background:'var(--wallet-bg)', borderBottom:'1px solid var(--nav-border)' },
  walletBtn:  { flex:1, padding:`${S.sm}px ${S.xs}px`, border:'2px solid var(--border)', background:'var(--bg-card)', color:'var(--text)', borderRadius:R.md, fontSize:13, fontWeight:700 },
  walletBtnActive: { background:G.primary, color:'#111', borderColor:'transparent' },
  nav:        { display:'flex', background:'var(--nav-bg)', borderBottom:'2px solid var(--nav-border)', overflowX:'auto' },
  navBtn:     { flex:'0 0 auto', minWidth:52, padding:`${S.sm}px ${S.xs}px`, border:'none', borderBottom:'3px solid transparent', background:'transparent', color:'var(--text-muted)', textAlign:'center', cursor:'pointer' },
  navBtnActive: { color:'#111', borderBottomColor:'var(--primary)' },
  content:    { padding:S.lg, minHeight:300, background:'var(--bg-app)' },
  overlay:    { position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,.5)', zIndex:3000, display:'flex', alignItems:'flex-end', justifyContent:'center' },
  modal:      { background:'var(--bg-app)', padding:S.xl, borderRadius:`${R.xl}px ${R.xl}px 0 0`, width:'100%', maxWidth:680, maxHeight:'90vh', overflowY:'auto' },
  modalHead:  { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:S.lg },
};
