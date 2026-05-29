// ============================================================
// DESIGN SYSTEM — Catatan Keuangan
// Semua komponen import dari sini untuk tampilan seragam
// ============================================================

// ─── COLORS ─────────────────────────────────────────────────
export const C = {
  // Brand
  primary:      '#ffd233', // Canary Yellow from image
  primaryDark:  '#e6bc2b',
  secondary:    '#111111', // Charcoal/Dark Gray

  // Semantic
  income:       '#22c55e',
  incomeBg:     '#e8fbf0',
  incomeText:   '#15803d',
  expense:      '#ef4444',
  expenseBg:    '#fef2f2',
  expenseText:  '#b91c1c',
  warning:      '#eab308',
  info:         '#3b82f6',

  // Tabungan / Real (biru teal)
  teal:         '#06b6d4',
  tealDark:     '#0891b2',

  // Neutrals
  white:        '#ffffff',
  gray50:       '#fafaf9',
  gray100:      '#f5f5f4',
  gray200:      '#e7e5e4',
  gray300:      '#d6d3d1',
  gray400:      '#a8a29e',
  gray500:      '#78716c',
  gray700:      '#44403c',
  gray800:      '#292524',
  gray900:      '#1c1917',
};

// ─── GRADIENTS ───────────────────────────────────────────────
export const G = {
  primary:   'linear-gradient(135deg, #ffd233 0%, #ffc107 100%)',
  teal:      'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
  dark:      'linear-gradient(135deg, #1c1917 0%, #292524 100%)',
  darkPage:  'linear-gradient(180deg, #111115 0%, #1c1c24 100%)',
};

// ─── CHART COLORS (sama di semua dashboard) ──────────────────
export const CHART_COLORS = [
  '#667eea','#22c55e','#f59e0b','#ef4444','#8b5cf6',
  '#0ea5e9','#ec4899','#14b8a6','#f97316','#6366f1',
  '#84cc16','#06b6d4','#a855f7','#fb923c',
];

// ─── SPACING ─────────────────────────────────────────────────
export const S = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  28,
};

// ─── RADIUS ──────────────────────────────────────────────────
export const R = {
  sm:   6,
  md:   10,
  lg:   14,
  xl:   18,
  xxl:  24,
  full: 9999,
};

// ─── SHADOWS ─────────────────────────────────────────────────
export const SH = {
  sm:  '0 1px 3px rgba(0,0,0,.08)',
  md:  '0 2px 8px rgba(0,0,0,.10)',
  lg:  '0 4px 16px rgba(0,0,0,.12)',
  xl:  '0 8px 32px rgba(0,0,0,.15)',
};

// ─── TYPOGRAPHY ──────────────────────────────────────────────
export const T = {
  xs:   10,
  sm:   11,
  base: 13,
  md:   14,
  lg:   16,
  xl:   20,
  xxl:  26,
};

// ─── REUSABLE STYLE BLOCKS ───────────────────────────────────

// Section card (background abu abu)
export const sSection = {
  background:   'var(--bg-section)',
  borderRadius:  R.lg,
  padding:       S.lg,
  marginBottom:  S.md,
};

// White card
export const sCard = {
  background:   'var(--bg-card)',
  borderRadius:  R.md,
  boxShadow:     SH.sm,
  overflow:     'hidden',
};

// Summary card gradient primary
export const sSummaryCard = (gradient = G.primary) => ({
  background:   gradient,
  color:        '#fff',
  padding:      S.xl,
  borderRadius:  R.lg,
  marginBottom:  S.md,
  textAlign:    'center',
});

// Summary card inner row
export const sSummaryRow = {
  display:             'grid',
  gridTemplateColumns: '1fr 1fr',
  gap:                  S.sm,
  marginTop:            S.sm,
};

// Summary card item
export const sSummaryItem = {
  background:   'rgba(255,255,255,.18)',
  padding:      `${S.sm}px ${S.md}px`,
  borderRadius:  R.sm,
  fontSize:      T.sm,
  display:      'flex',
  flexDirection: 'column',
  gap:           3,
};

// Section title
export const sSecTitle = {
  fontWeight:    700,
  fontSize:      T.md,
  marginBottom:  S.sm,
  color:        'var(--text)',
};

// Row in a list
export const sRow = {
  display:       'flex',
  justifyContent:'space-between',
  alignItems:    'center',
  padding:       `${S.sm}px ${S.xs}px`,
  borderBottom:  '1px solid var(--row-border)',
  fontSize:       T.base,
};

// Total row
export const sTotalRow = {
  display:       'flex',
  justifyContent:'space-between',
  alignItems:    'center',
  padding:       `${S.md}px ${S.xs}px`,
  marginTop:      S.sm,
  borderTop:     '2px solid var(--nav-border)',
  fontWeight:     700,
  fontSize:       T.base,
};

// Nav bar (month/week nav)
export const sNavBar = {
  display:       'flex',
  justifyContent:'space-between',
  alignItems:    'center',
  marginBottom:   S.md,
  padding:       `${S.md}px ${S.lg}px`,
  background:   'var(--bg-section)',
  borderRadius:   R.md,
};

// Arrow button
export const sArrowBtn = {
  width:         34,
  height:        34,
  border:       '2px solid var(--border)',
  background:   'var(--bg-card)',
  color:        'var(--text)',
  borderRadius:  R.sm,
  fontSize:       T.lg,
  fontWeight:    'bold',
  cursor:        'pointer',
  display:      'flex',
  alignItems:   'center',
  justifyContent:'center',
};

// Primary button
export const sBtnPrimary = (gradient = G.primary) => ({
  width:         '100%',
  background:     gradient,
  color:         '#111',
  border:        'none',
  padding:       `${S.md}px`,
  borderRadius:   R.md,
  fontSize:       T.base,
  fontWeight:     700,
  cursor:        'pointer',
});

// Chip / pill badge
export const sChip = (active, color = C.primary) => ({
  fontSize:      T.sm,
  fontWeight:    600,
  padding:      `5px 12px`,
  borderRadius:  R.full,
  border:       `2px solid ${active ? color : C.gray200}`,
  background:    active ? color : 'var(--bg-section)',
  color:         active ? '#fff' : 'var(--text-sub)',
  cursor:       'pointer',
  transition:   'all .15s',
});

// Error box
export const sErr = {
  background:   C.expenseBg,
  color:        C.expenseText,
  padding:     `${S.sm}px ${S.md}px`,
  borderRadius:  R.md,
  fontSize:      T.base,
  marginBottom:  S.md,
};

// Input field
export const sInput = {
  padding:      `${S.sm}px ${S.md}px`,
  border:       '2px solid var(--border)',
  borderRadius:  R.md,
  fontSize:      T.base,
  background:   'var(--bg-input)',
  outline:      'none',
  color:        'var(--text)',
  width:        '100%',
};

// Action buttons
export const sBtnEdit   = { background:C.info,    color:'#fff', border:'none', padding:'5px 10px', borderRadius:R.sm, fontSize:T.sm, cursor:'pointer' };
export const sBtnDelete = { background:C.expense, color:'fff', border:'none', padding:'5px 10px', borderRadius:R.sm, fontSize:T.sm, cursor:'pointer' };
export const sBtnSave   = { background:C.income,  color:'#fff', border:'none', padding:'7px 14px', borderRadius:R.sm, fontSize:T.base, cursor:'pointer', fontWeight:600 };
export const sBtnCancel = { background:C.gray400, color:'#fff', border:'none', padding:'7px 14px', borderRadius:R.sm, fontSize:T.base, cursor:'pointer' };

// Kategori label strip
export const sCatLabel = (type) => ({
  fontSize:      T.sm,
  fontWeight:    700,
  padding:      `${S.xs}px ${S.md}px`,
  borderRadius:  R.sm,
  margin:       `${S.xs}px 0 ${S.sm}px`,
  display:      'inline-block',
  background:    type==='income' ? C.incomeBg  : C.expenseBg,
  color:         type==='income' ? C.incomeText : C.expenseText,
});

// Total footer strip
export const sTotalFooter = (type) => ({
  display:       'flex',
  justifyContent:'space-between',
  padding:      `${S.sm}px ${S.md}px`,
  borderRadius:   R.md,
  fontWeight:     700,
  fontSize:       T.base,
  background:     type==='income' ? C.income : C.expense,
  color:         '#fff',
  marginTop:      S.xs,
});
