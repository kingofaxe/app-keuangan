import React, { useState, useEffect, useRef, useMemo } from 'react';
import Swal from 'sweetalert2';
import { apiFetch } from '../api';

export default function TambahForm({ data, token, wallet, editTx, onRefresh, onDone }) {
  const isEdit = !!editTx;
  const [amount,   setAmount]   = useState('');
  const [catId,    setCatId]    = useState('');
  const [subCatId, setSubCatId] = useState('');
  const [date,     setDate]     = useState(today());
  const [remark,   setRemark]   = useState('');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [file,     setFile]     = useState(null);
  const [uploading,setUploading]= useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showCalc, setShowCalc] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    if (wallet && token) {
      apiFetch(`/templates?wallet_id=${wallet.id}`, {}, token)
        .then(res => setTemplates(res.slice(0, 5)))
        .catch(err => console.error(err));
    }
  }, [wallet, token]);
  const [calcExpression, setCalcExpression] = useState('');
  const fileRef = useRef();

  useEffect(() => {
    if (editTx) {
      setAmount(Number(editTx.amount).toLocaleString('id-ID'));
      setCatId(String(editTx.category_id||''));
      setSubCatId(String(editTx.sub_category_id||''));
      setDate(editTx.date?.slice(0,10)||today());
      setRemark(editTx.remark||'');
    } else {
      setAmount(''); setCatId(''); setSubCatId(''); setDate(today()); setRemark(''); setFile(null);
    }
  }, [editTx]);

  // Generate preview URL for newly selected file
  useEffect(() => {
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [file]);

  // Build auto file name: DDMMYY keterangan nominal
  const autoFileName = useMemo(() => {
    const d = date || today();
    const parts = d.split('-'); // YYYY-MM-DD
    const dd = parts[2] || '01';
    const mm = parts[1] || '01';
    const yy = (parts[0] || '2026').slice(-2);
    const datePart = `${dd}${mm}${yy}`;
    const remarkPart = (remark || '').trim() || 'lampiran';
    const rawAmt = Number(amount.replace(/\D/g, '')) || 0;
    const nominalPart = rawAmt.toLocaleString('id-ID');
    return `${datePart} ${remarkPart} ${nominalPart}`;
  }, [date, remark, amount]);

  const selectedCat = data.categories.find(c=>String(c.id)===catId);
  const subCats     = selectedCat?.sub_categories||[];
  const handleAmount = e => { const r=e.target.value.replace(/\D/g,''); setAmount(r?Number(r).toLocaleString('id-ID'):''); };
  const getRaw = () => Number(amount.replace(/\D/g,''))||0;

  const evaluateExpression = (expr) => {
    if (!expr) return 0;
    const lines = expr.split('\n');
    let total = 0;
    for (let line of lines) {
      let cleaned = line.trim();
      if (!cleaned) continue;

      // Remove Indonesian thousands separator dots (e.g., 50.000 -> 50000)
      cleaned = cleaned.replace(/\.(\d{3})\b/g, '$1');

      // Replace comma with dot for decimal handling
      cleaned = cleaned.replace(/,/g, '.');

      // Restrict characters to valid math inputs only
      cleaned = cleaned.replace(/[^0-9+\-*/().]/g, '');

      if (!cleaned) continue;

      try {
        const res = new Function(`return (${cleaned})`)();
        if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
          total += res;
        }
      } catch (e) {
        // Ignore math expression syntax errors per line
      }
    }
    return Math.round(total);
  };

  const applyCalc = () => {
    const total = evaluateExpression(calcExpression);
    if (total > 0) {
      setAmount(total.toLocaleString('id-ID'));
    }
    setShowCalc(false);
  };

  const save = async () => {
    const nominal=getRaw();
    if (!nominal||nominal<=0) { setError('Masukkan nominal yang valid'); return; }
    if (!catId)   { setError('Pilih kategori dulu'); return; }
    if (!date)    { setError('Pilih tanggal'); return; }
    if (!wallet)  { setError('Wallet tidak ditemukan'); return; }
    setError(''); setSaving(true);
    try {
      const payload = { wallet_id:wallet.id, category_id:catId, sub_category_id:subCatId||null, type:selectedCat?.type||'expense', amount:nominal, date, remark };
      let tx;
      if (isEdit) tx = await apiFetch(`/transactions/${editTx.id}`, { method:'PUT', body:JSON.stringify(payload) }, token);
      else        tx = await apiFetch('/transactions', { method:'POST', body:JSON.stringify(payload) }, token);

      // Upload file jika ada — rename file sesuai format auto
      if (file && tx?.id) {
        setUploading(true);
        const ext = file.name.substring(file.name.lastIndexOf('.'));
        const renamedFile = new File([file], autoFileName + ext, { type: file.type });
        const fd = new FormData();
        fd.append('file', renamedFile);
        await apiFetch(`/transactions/${tx.id}/upload`, { method:'POST', body:fd }, token);
        setUploading(false);
      }

      // Simpan sebagai template jika dicentang
      if (saveAsTemplate && !isEdit && tx?.id) {
        try {
          const { value: templateName } = await Swal.fire({
            title: 'Simpan sebagai Template',
            input: 'text',
            inputLabel: 'Nama Template Cepat',
            inputValue: (selectedCat?.name || '') + ' ' + amount,
            showCancelButton: true,
            confirmButtonColor: 'var(--primary)',
            confirmButtonText: 'Simpan',
            cancelButtonText: 'Batal',
            inputValidator: (value) => {
              if (!value) return 'Nama template wajib diisi!';
            }
          });

          if (templateName) {
            await apiFetch('/templates', {
              method: 'POST',
              body: JSON.stringify({
                wallet_id: wallet.id,
                category_id: Number(catId),
                sub_category_id: subCatId ? Number(subCatId) : null,
                name: templateName,
                icon: '⚡',
                type: selectedCat?.type || 'expense',
                amount: nominal,
                remark: remark
              })
            }, token);
          }
        } catch (err) {
          console.error('Gagal menyimpan template:', err);
        }
      }

      onRefresh();
      if (!isEdit) { 
        setAmount(''); setCatId(''); setSubCatId(''); setDate(today()); setRemark(''); setFile(null); setSaveAsTemplate(false);
        // Refresh templates list
        apiFetch(`/templates?wallet_id=${wallet.id}`, {}, token)
          .then(res => setTemplates(res.slice(0, 5)))
          .catch(err => console.error(err));
      }
      onDone();
    } catch(e) { setError(e.message); setUploading(false); }
    finally { setSaving(false); }
  };

  const removeFile = async () => {
    if (!isEdit || !editTx?.file_path) { setFile(null); return; }
    try { await apiFetch(`/transactions/${editTx.id}/upload`, { method:'DELETE' }, token); onRefresh(); }
    catch(e) { setError(e.message); }
  };

  const incCats = data.categories.filter(c=>c.type==='income');
  const expCats = data.categories.filter(c=>c.type==='expense');
  const hasFile = isEdit && editTx?.file_path;

  return (
    <div style={isEdit?{}:s.card}>
      {!isEdit && <h3 style={{marginBottom:14,fontSize:15}}>➕ Tambah Transaksi</h3>}
      
      {!isEdit && templates.length > 0 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10, marginBottom: 12, scrollbarWidth: 'none' }}>
          {templates.map(t => (
            <button
              key={t.id}
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 12px',
                borderRadius: 20,
                border: '1.5px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
              onClick={() => {
                setAmount(Number(t.amount).toLocaleString('id-ID'));
                setCatId(String(t.category_id));
                setSubCatId(String(t.sub_category_id || ''));
                setRemark(t.remark || '');
              }}
            >
              <span>{t.icon || '⚡'}</span>
              <span>{t.name}</span>
            </button>
          ))}
        </div>
      )}

      {error && <div style={s.err}>{error}</div>}

      <div style={s.fg}>
        <label style={s.label}>Nominal (Rp)</label>
        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          <input style={{...s.input,fontSize:16,fontWeight:700,flex:1}} type="text" inputMode="numeric"
            placeholder="0" value={amount} onChange={handleAmount} autoComplete="off"/>
          <button
            type="button"
            style={{
              ...s.btnCalcTrigger,
              background: showCalc ? 'var(--primary)' : 'var(--bg-section)',
              color: showCalc ? '#111' : 'var(--text)',
              border: '2px solid var(--border)'
            }}
            onClick={() => setShowCalc(!showCalc)}
            title="Kalkulator Nota"
          >
            🧮
          </button>

          {showCalc && (
            <div style={s.calcPopover}>
              <div style={s.calcHeader}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>🧮 Kalkulator Nota</span>
                <button
                  type="button"
                  style={s.calcCloseBtn}
                  onClick={() => setShowCalc(false)}
                >
                  ✕
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 8, textAlign: 'left', lineHeight: 1.3 }}>
                Ketik nominal per baris atau tulis rumus matematika (misal: 10000 + 25000).
              </p>
              <textarea
                style={s.calcTextarea}
                placeholder="Contoh:&#10;50000&#10;25000 + 15000&#10;2 * 12500"
                value={calcExpression}
                onChange={e => setCalcExpression(e.target.value)}
                rows={4}
              />
              
              {calcExpression.trim() && (
                <div style={{
                  maxHeight: 70,
                  overflowY: 'auto',
                  background: 'var(--bg-section)',
                  padding: '6px 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  color: 'var(--text-sub)',
                  marginTop: 6,
                  border: '1px solid var(--border)',
                  textAlign: 'left'
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 10, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Pratinjau Nota:</div>
                  {calcExpression.split('\n').map((line, idx) => {
                    const val = evaluateExpression(line);
                    if (!val && val !== 0) return null;
                    return (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', padding: '1px 0' }}>
                        <span>Nota #{idx + 1}:</span>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>Rp {val.toLocaleString('id-ID')}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={s.calcFooter}>
                <div style={s.calcResult}>
                  <div style={{ fontSize: 10, color: 'var(--text-sub)', textAlign: 'left' }}>Total:</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                    Rp {evaluateExpression(calcExpression).toLocaleString('id-ID')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    style={{ ...s.calcBtn, background: 'var(--border)', color: 'var(--text)' }}
                    onClick={() => setCalcExpression('')}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    style={{ ...s.calcBtn, background: 'var(--primary)', color: '#111' }}
                    onClick={applyCalc}
                  >
                    Terapkan
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={s.fg}>
        <label style={s.label}>Kategori</label>
        <select style={s.input} value={catId} onChange={e=>{setCatId(e.target.value);setSubCatId('');}}>
          <option value="">— Pilih Kategori —</option>
          {incCats.length>0 && <optgroup label="💰 Pemasukan">{incCats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
          {expCats.length>0 && <optgroup label="💸 Pengeluaran">{expCats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
        </select>
        {selectedCat && (
          <div style={{...s.badge,background:selectedCat.type==='income'?'#dcfce7':'#fee2e2',color:selectedCat.type==='income'?'#166534':'#991b1b'}}>
            {selectedCat.type==='income'?'💰':'💸'} {selectedCat.type==='income'?'Pemasukan':'Pengeluaran'}
          </div>
        )}
      </div>

      {subCats.length>0 && (
        <div style={s.fg}>
          <label style={s.label}>Sub Kategori <span style={{color:'#9ca3af',fontWeight:400}}>(opsional)</span></label>
          <select style={s.input} value={subCatId} onChange={e=>setSubCatId(e.target.value)}>
            <option value="">— Pilih Sub Kategori —</option>
            {subCats.map(sc=><option key={sc.id} value={sc.id}>{sc.name}</option>)}
          </select>
        </div>
      )}

      <div style={s.fg}>
        <label style={s.label}>Tanggal</label>
        <input style={s.input} type="date" value={date} onChange={e=>setDate(e.target.value)}/>
      </div>

      <div style={s.fg}>
        <label style={s.label}>Keterangan <span style={{color:'#9ca3af',fontWeight:400}}>(opsional)</span></label>
        <input style={s.input} type="text" placeholder="Catatan tambahan..." value={remark} onChange={e=>setRemark(e.target.value)}/>
      </div>

      {/* FILE UPLOAD */}
      <div style={s.fg}>
        <label style={s.label}>Lampiran <span style={{color:'#9ca3af',fontWeight:400}}>(foto struk / PDF, max 10MB)</span></label>
        {hasFile && !file ? (
          /* ── Edit mode: show existing attachment as preview ── */
          <div style={s.attachPreviewWrap}>
            {editTx.file_name?.match(/\.(pdf)$/i) ? (
              <a href={editTx.file_path} target="_blank" rel="noreferrer" style={s.pdfPreview}>
                <span style={{fontSize:36}}>📄</span>
                <span style={{fontSize:11,color:'var(--text-sub)',marginTop:4}}>PDF Document</span>
              </a>
            ) : (
              <a href={editTx.file_path} target="_blank" rel="noreferrer" style={{display:'block'}}>
                <img src={editTx.file_path} alt="Lampiran" style={s.imgPreview} />
              </a>
            )}
            <button style={s.fileDelFloat} onClick={removeFile} title="Hapus lampiran">✕</button>
          </div>
        ) : file ? (
          /* ── Newly selected file: preview ── */
          <div style={s.attachPreviewWrap}>
            {file.type.includes('pdf') ? (
              <div style={s.pdfPreview}>
                <span style={{fontSize:36}}>📄</span>
                <span style={{fontSize:11,color:'var(--text-sub)',marginTop:4}}>PDF Document</span>
              </div>
            ) : previewUrl ? (
              <img src={previewUrl} alt="Preview" style={s.imgPreview} />
            ) : null}
            <button style={s.fileDelFloat} onClick={()=>setFile(null)} title="Hapus lampiran">✕</button>
          </div>
        ) : (
          <div style={s.uploadArea} onClick={()=>fileRef.current.click()}>
            <div style={{fontSize:24,marginBottom:4}}>📎</div>
            <div style={{fontSize:13,color:'#6b7280'}}>Klik untuk pilih foto atau PDF</div>
            <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>JPG, PNG, PDF · Max 10MB</div>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/jpg,application/pdf"
          style={{display:'none'}} onChange={e=>{ if(e.target.files[0]) setFile(e.target.files[0]); }}/>
      </div>

      {!isEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <input 
            type="checkbox" 
            id="saveAsTemplate" 
            checked={saveAsTemplate} 
            onChange={e => setSaveAsTemplate(e.target.checked)}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          <label htmlFor="saveAsTemplate" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sub)', cursor: 'pointer', userSelect: 'none' }}>
            💾 Simpan juga sebagai template cepat
          </label>
        </div>
      )}

      <button style={{...s.btn,opacity:(saving||uploading)?0.7:1}} onClick={save} disabled={saving||uploading}>
        {uploading?'⏳ Mengupload file...' : saving?'⏳ Menyimpan...' : isEdit?'💾 Update':'💾 Simpan'}
      </button>
    </div>
  );
}

function today() {
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

const s={
  card:        {background:'var(--bg-section)',padding:18,borderRadius:18,border:'1px solid var(--border)'},
  fg:          {marginBottom:14},
  label:       {display:'block',marginBottom:5,fontWeight:600,fontSize:12,color:'var(--text-sub)'},
  input:       {width:'100%',padding:'11px 13px',border:'1.5px solid var(--border)',borderRadius:12,fontSize:14,background:'var(--bg-card)',outline:'none',color:'var(--text)'},
  badge:       {display:'inline-flex',alignItems:'center',gap:4,marginTop:5,padding:'4px 12px',borderRadius:20,fontSize:11,fontWeight:700},
  btn:         {background:'var(--primary)',color:'#111',width:'100%',padding:14,fontSize:14,fontWeight:700,border:'none',borderRadius:14},
  err:         {background:'#fee2e2',color:'#991b1b',padding:'10px 14px',borderRadius:12,fontSize:13,marginBottom:14},
  uploadArea:  {border:'2px dashed var(--border)',borderRadius:14,padding:'20px 16px',textAlign:'center',cursor:'pointer',background:'var(--bg-section)'},
  attachPreviewWrap: {position:'relative',display:'inline-block',borderRadius:14,overflow:'hidden',border:'1.5px solid var(--border)',background:'var(--bg-section)'},
  imgPreview:  {display:'block',maxWidth:'100%',maxHeight:220,borderRadius:12,objectFit:'cover'},
  pdfPreview:  {display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'28px 40px',background:'var(--bg-section)',borderRadius:12,textDecoration:'none'},
  fileDelFloat:{position:'absolute',top:8,right:8,background:'rgba(220,38,38,0.9)',color:'#fff',border:'none',width:28,height:28,borderRadius:'50%',fontSize:14,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 8px rgba(0,0,0,0.2)'},
  btnCalcTrigger: {padding:'10px 14px',borderRadius:12,fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s ease'},
  calcPopover: {position:'absolute',top:'100%',right:0,zIndex:100,width:'100%',maxWidth:320,background:'var(--bg-card)',border:'1.5px solid var(--border)',borderRadius:16,boxShadow:'var(--shadow-lg)',padding:14,marginTop:6},
  calcHeader: {display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8},
  calcCloseBtn: {background:'none',border:'none',fontSize:12,color:'var(--text-sub)',cursor:'pointer',padding:4},
  calcTextarea: {width:'100%',padding:'10px 12px',border:'1.5px solid var(--border)',borderRadius:10,fontSize:13,background:'var(--bg-input)',color:'var(--text)',outline:'none',resize:'vertical',fontFamily:'monospace'},
  calcFooter: {display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)'},
  calcResult: {display:'flex',flexDirection:'column'},
  calcBtn: {border:'none',borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:600,cursor:'pointer'},
};
