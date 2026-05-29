import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }  from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiFetch } from '../api';
import { G, R, S, T, C } from '../theme';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  
  // PIN Mode States
  const [isPinMode, setIsPinMode] = useState(false);
  const [pinDigits, setPinDigits] = useState([]);
  const [cachedUser, setCachedUser] = useState('');

  const { login }  = useAuth();
  const { dark, toggle } = useTheme();
  const navigate   = useNavigate();

  // Check if PIN login is available on load
  useEffect(() => {
    const savedUser = localStorage.getItem('lastUsername');
    const pinSet = localStorage.getItem('hasPinSet') === 'true';
    if (savedUser && pinSet) {
      setCachedUser(savedUser);
      setIsPinMode(true);
    }
  }, []);

  const doLogin = async () => {
    if (!username || !password) return;
    setLoading(true); setError('');
    try {
      const data = await apiFetch('/login', {
        method: 'POST',
        body: JSON.stringify({ username: username.toLowerCase().trim(), password })
      });
      // Store last successfully logged-in user in localStorage
      localStorage.setItem('lastUsername', username.toLowerCase().trim());
      login(data.token, { displayName: data.displayName, isAdmin: data.isAdmin === true });
      navigate('/');
    } catch(e) { 
      setError(e.message || 'Username atau password salah'); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleKeyPress = (num) => {
    if (loading) return;
    if (pinDigits.length < 6) {
      const newDigits = [...pinDigits, num];
      setPinDigits(newDigits);
      if (newDigits.length === 6) {
        doPinLogin(newDigits.join(''));
      }
    }
  };

  const handleBackspace = () => {
    if (loading) return;
    setPinDigits(pinDigits.slice(0, -1));
  };

  const handleClear = () => {
    if (loading) return;
    setPinDigits([]);
  };

  const doPinLogin = async (pinValue) => {
    setLoading(true); setError('');
    try {
      const data = await apiFetch('/login/pin', {
        method: 'POST',
        body: JSON.stringify({ username: cachedUser, pin: pinValue })
      });
      login(data.token, { displayName: data.displayName, isAdmin: data.isAdmin === true });
      navigate('/');
    } catch(e) {
      setError(e.message || 'PIN salah');
      setPinDigits([]); // Clear on error
    } finally {
      setLoading(false);
    }
  };

  const switchAccount = () => {
    setIsPinMode(false);
    setPinDigits([]);
    setError('');
  };

  return (
    <div style={st.page}>
      {/* Dark mode toggle */}
      <button style={st.themeBtn} onClick={toggle} title={dark ? 'Mode Terang' : 'Mode Gelap'}>
        {dark ? '☀️' : '🌙'}
      </button>

      <div style={st.card}>
        {/* Logo area */}
        <div style={st.logoArea}>
          <div style={st.logoIcon}>💰</div>
          <h1 style={st.title}>Catatan Keuangan</h1>
          <p style={st.subtitle}>
            {isPinMode ? 'Masuk cepat dengan PIN Anda' : 'Masuk untuk melanjutkan'}
          </p>
        </div>

        {error && <div style={st.err}>{error}</div>}

        {isPinMode ? (
          // MODE A: PIN PAD
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div style={st.avatarArea}>
              <div style={st.avatar}>👤</div>
              <div style={st.avatarName}>{cachedUser}</div>
            </div>

            <div className="pin-dots">
              {[0, 1, 2, 3, 4, 5].map((idx) => (
                <div 
                  key={idx} 
                  className={`pin-dot ${idx < pinDigits.length ? 'active' : ''}`}
                />
              ))}
            </div>

            <div className="pin-pad-container">
              <div className="pin-grid">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button 
                    key={num} 
                    className="pin-btn" 
                    onClick={() => handleKeyPress(num)}
                    disabled={loading}
                  >
                    {num}
                  </button>
                ))}
                <button 
                  className="pin-btn action" 
                  onClick={handleClear}
                  disabled={loading}
                >
                  C
                </button>
                <button 
                  className="pin-btn" 
                  onClick={() => handleKeyPress(0)}
                  disabled={loading}
                >
                  0
                </button>
                <button 
                  className="pin-btn action" 
                  onClick={handleBackspace}
                  disabled={loading}
                >
                  ⌫
                </button>
              </div>
            </div>

            <button style={st.switchBtn} onClick={switchAccount} disabled={loading}>
              Masuk dengan Password?
            </button>
          </div>
        ) : (
          // MODE B: USERNAME + PASSWORD
          <>
            <div style={st.fg}>
              <label style={st.label}>Username</label>
              <input style={st.input} type="text" placeholder="Masukkan username"
                value={username} onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key==='Enter' && document.getElementById('pw').focus()}
                autoCapitalize="none" autoComplete="username" autoFocus/>
            </div>

            <div style={st.fg}>
              <label style={st.label}>Password</label>
              <div style={{position:'relative'}}>
                <input id="pw" style={{...st.input, paddingRight:44}}
                  type={showPass?'text':'password'} placeholder="Masukkan password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && doLogin()}
                  autoComplete="current-password"/>
                <button style={st.eyeBtn} type="button" onClick={() => setShowPass(!showPass)}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button style={{...st.submitBtn, opacity: loading?0.7:1}} onClick={doLogin} disabled={loading}>
              {loading ? '⏳ Masuk...' : '🔐 Masuk'}
            </button>
            
            {cachedUser && localStorage.getItem('hasPinSet') === 'true' && (
              <button style={st.switchBtn} onClick={() => setIsPinMode(true)}>
                Masuk dengan PIN 👤
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const st = {
  page:      { display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', padding:S.lg, background:'var(--bg-page)', position:'relative' },
  themeBtn:  { position:'absolute', top:S.xl, right:S.xl, background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.3)', color:'#fff', width:38, height:38, borderRadius:R.md, fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' },
  card:      { background:'var(--bg-app)', borderRadius:R.xxl, padding:`${S.xxl}px ${S.xl}px`, width:'100%', maxWidth:380, boxShadow:'var(--shadow-app)', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  logoArea:  { textAlign:'center', marginBottom:S.xl },
  logoIcon:  { fontSize:48, marginBottom:S.sm },
  title:     { fontSize:22, fontWeight:800, color:'var(--text)', letterSpacing:-.5 },
  subtitle:  { fontSize:13, color:'var(--text-muted)', marginTop:4 },
  err:       { background:'#fee2e2', color:'#991b1b', padding:`${S.sm}px ${S.md}px`, borderRadius:R.md, fontSize:13, marginBottom:S.md, width: '100%', textAlign: 'center' },
  fg:        { marginBottom:S.md, width: '100%' },
  label:     { display:'block', marginBottom:5, fontWeight:600, fontSize:12, color:'var(--text-sub)' },
  input:     { width:'100%', padding:`${S.md}px ${S.lg}px`, border:'2px solid var(--border)', borderRadius:R.md, fontSize:14, background:'var(--bg-input)', color:'var(--text)', outline:'none', transition:'border-color .2s' },
  eyeBtn:    { position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-muted)' },
  submitBtn: { width:'100%', padding:`${S.md}px`, marginTop:S.sm, border:'none', borderRadius:R.md, background:G.primary, color:'#111', fontSize:15, fontWeight:700, cursor:'pointer' },
  avatarArea: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 12 },
  avatar:    { width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-section)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 8 },
  avatarName: { fontWeight: 700, fontSize: 16, color: 'var(--text)', textTransform: 'capitalize' },
  switchBtn: { border: 'none', background: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 600, marginTop: 20, cursor: 'pointer' }
};
