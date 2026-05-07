import { useState, useEffect, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer } from 'recharts';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from 'html2canvas';

// --- CONFIG ---
const API_BASE = 'https://ilham121-drone-lab-api.hf.space'

// --- HELPER FUNCTIONS ---
const extractSize = (name) => {
  const match = name.match(/(\d+(\.\d+)?)/); 
  return match ? parseFloat(match[0]) : 5;
};
const extractS = (name) => parseInt(name.match(/(\d+)S/i)?.[1] || 4);
const extractMah = (name) => parseInt(name.match(/(\d+)mAh/i)?.[1] || 0);

// --- UI COMPONENTS ---
const Tooltip = ({ text, children, theme }) => {
  const [show, setShow] = useState(false);
  const isDark = theme === 'dark';
  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%' }} 
         onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div style={{
          position: 'absolute', bottom: '115%', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: isDark ? '#1e293b' : '#fff', color: isDark ? '#00f2ff' : '#0369a1',
          padding: '10px', borderRadius: '12px', fontSize: '0.7rem', width: '180px', zIndex: 9999,
          border: `1px solid ${isDark ? '#00f2ff' : '#0369a1'}`, boxShadow: '0 8px 25px rgba(0,0,0,0.2)', textAlign: 'center'
        }}>{text}</div>
      )}
    </div>
  );
};

const ModeToggle = ({ isCustom, setIsCustom, color, theme }) => (
  <div onClick={() => setIsCustom(!isCustom)} style={{ 
    width: '120px', height: '32px', background: theme === 'dark' ? '#000' : '#ddd', 
    borderRadius: '20px', position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 5px'
  }}>
    <div style={{ position: 'absolute', left: isCustom ? '62px' : '4px', width: '54px', height: '22px', background: `linear-gradient(45deg, ${color}, #8b5cf6)`, borderRadius: '15px', transition: '0.3s ease-in-out', zIndex: 1 }} />
    <span style={{ flex: 1, textAlign: 'center', fontSize: '0.55rem', fontWeight: 'bold', zIndex: 2, color: !isCustom ? '#fff' : '#888' }}>DB</span>
    <span style={{ flex: 1, textAlign: 'center', fontSize: '0.55rem', fontWeight: 'bold', zIndex: 2, color: isCustom ? '#fff' : '#888' }}>MANUAL</span>
  </div>
);

const HalfGauge = ({ value, max, label, color }) => {
  const percent = Math.min(value / max, 1);
  const circumference = Math.PI * 40;
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <svg width="85" height="55" viewBox="0 0 100 60">
        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(128,128,128,0.2)" strokeWidth="10" strokeLinecap="round" />
        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke={color} strokeWidth="10" 
              strokeDasharray={`${percent * circumference} ${circumference}`} strokeLinecap="round" 
              style={{ transition: '1.5s ease-out', filter: `drop-shadow(0 0 5px ${color})` }} />
        <text x="50" y="45" textAnchor="middle" fill="currentColor" fontSize="16" fontWeight="900">{value}</text>
      </svg>
      <div style={{ fontSize: '0.6rem', opacity: 0.5, fontWeight: 'bold', marginTop: '5px' }}>{label}</div>
    </div>
  );
};

// --- SLOT COMPONENT ---
const SlotComponent = ({ title, color, isCustom, setIsCustom, pState, setP, cState, setC, hasil, onHitung, db, onReset, theme }) => {
  const isDark = theme === 'dark';
  const inputStyle = { padding: '12px', background: isDark ? '#161b22' : '#f8fafc', color: isDark ? '#fff' : '#000', border: `1px solid ${isDark ? 'rgba(0,242,255,0.2)' : '#ccc'}`, borderRadius: '10px', fontSize: '0.9rem', width: '100%', outline: 'none' };
  const labelStyle = { fontSize: '0.65rem', color: color, marginBottom: '4px', display: 'block', fontWeight: 'bold' };

  const getSortedData = (cat) => {
    let items = db.filter(i => i.kategori === cat);
    if (cat === 'prop') {
      const frame = db.find(f => f.id === pState.frame_id);
      if (frame && frame.id !== 999) items = items.filter(p => extractSize(p.nama) <= (frame.max_prop + 0.1) && extractSize(p.nama) >= (frame.max_prop - 1.5));
      items.sort((a,b) => extractSize(a.nama) - extractSize(b.nama));
    } else if (cat === 'battery') {
      items.sort((a, b) => (extractS(a.nama) !== extractS(b.nama) ? extractS(a.nama) - extractS(b.nama) : extractMah(a.nama) - extractMah(b.nama)));
    }
    return items;
  };

  return (
    <div style={{ flex: '1 1 400px', background: isDark ? 'rgba(15, 23, 42, 0.85)' : '#fff', padding: '30px', borderRadius: '30px', border: `1px solid ${color}44`, boxShadow: '0 15px 40px rgba(0,0,0,0.1)', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <h3 style={{ margin: 0, color: color, fontSize: '1.4rem', fontWeight: '900' }}>{title}</h3>
        <Tooltip text="Klik untuk ganti mode Database atau Input Manual." theme={theme}><ModeToggle isCustom={isCustom} setIsCustom={setIsCustom} color={color} theme={theme} /></Tooltip>
      </div>

      {isCustom ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>FRAME WEIGHT (g)</label>
            <Tooltip text="Input berat kerangka drone dalam gram." theme={theme}><input type="number" value={cState.berat_f} onChange={e => setC({...cState, berat_f: parseInt(e.target.value)||0})} style={inputStyle} /></Tooltip>
          </div>
          <div><label style={labelStyle}>MOTOR KV</label><Tooltip text="Input nilai KV motor manual." theme={theme}><input type="number" value={cState.kv} onChange={e => setC({...cState, kv: parseInt(e.target.value)||0})} style={inputStyle} /></Tooltip></div>
          <div><label style={labelStyle}>PROP (in)</label><Tooltip text="Input ukuran baling-baling." theme={theme}><input type="number" step="0.1" value={cState.size} onChange={e => setC({...cState, size: parseFloat(e.target.value)||0})} style={inputStyle} /></Tooltip></div>
          <div style={{ gridColumn: "span 2", background: isDark ? "#000" : "#f1f5f9", padding: "15px", borderRadius: "15px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
                <Tooltip text="Pilih jumlah S (Voltase)." theme={theme}><select value={cState.sel} onChange={(e) => setC({...cState, sel: parseInt(e.target.value)})} style={inputStyle}>{[1,2,3,4,6,8].map(s => <option key={s} value={s}>{s}S</option>)}</select></Tooltip>
                <Tooltip text="Input kapasitas mAh manual." theme={theme}><input type="number" value={cState.mah} onChange={(e) => setC({...cState, mah: parseInt(e.target.value)||0})} style={inputStyle} placeholder="mAh" /></Tooltip>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {['frame', 'motor', 'battery', 'prop'].map(cat => (
            <div key={cat}>
                <label style={{fontSize:'0.6rem', opacity: 0.5, fontWeight:'bold'}}>{cat.toUpperCase()}</label>
                <Tooltip text={`Pilih ${cat} dari database.`} theme={theme}>
                <select value={pState[cat === 'frame' ? 'frame_id' : cat]} onChange={e => setP({...pState, [cat === 'frame' ? 'frame_id' : cat]: parseInt(e.target.value)})} style={inputStyle}>
                    {getSortedData(cat).map(i => <option key={i.id} value={i.id} style={{background: isDark ? '#0f172a' : '#fff'}}>{i.nama} --- Rp{i.harga.toLocaleString()}</option>)}
                </select>
                </Tooltip>
            </div>
          ))}
        </div>
      )}

      <button onClick={onHitung} style={{ width: '100%', padding: '20px', background: `linear-gradient(45deg, ${color}, #8b5cf6)`, border: 'none', borderRadius: '15px', fontWeight: '900', color: '#fff', marginTop: '30px', cursor: 'pointer', boxShadow: `0 10px 20px ${color}33` }}>ANALYZE UNIT</button>

      {hasil && (
        <div style={{ marginTop: '30px', padding: '20px', background: isDark ? 'rgba(0,0,0,0.3)' : '#f8fafc', borderRadius: '24px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}` }}>
          <div style={{ background: color, color: '#000', padding: '8px', fontSize: '0.8rem', fontWeight: '900', textAlign: 'center', marginBottom: '20px', borderRadius: '8px' }}>{hasil.style.toUpperCase()}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <HalfGauge value={hasil.twr} max={8} label="TWR RATIO" color={color} />
            <HalfGauge value={hasil.flight_time} max={25} label="FLIGHT TIME" color="#00ff88" />
          </div>
          <div style={{ textAlign: 'center', marginTop: '25px' }}>
             <div style={{ color: isDark ? '#ffea00' : '#b45309', fontWeight: '900', fontSize: '1.4rem' }}>Rp{hasil.total_harga_rp.toLocaleString()}</div>
             <div style={{ fontSize: '0.75rem', opacity: 0.5, color: isDark ? '#fff' : '#000' }}>WEIGHT: {hasil.berat_total}g</div>
             <Tooltip text="Reset slot ini." theme={theme}><button onClick={onReset} style={{ marginTop: '20px', padding: '10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '10px', width: '100%', fontWeight:'bold', cursor: 'pointer' }}>RESET</button></Tooltip>
          </div>
        </div>
      )}
    </div>
  );
};

// --- MAIN APP ---
export default function App() {
  const [halaman, setHalaman] = useState('home');
  const [theme, setTheme] = useState('dark');
  const [db, setDb] = useState([]);
  const [isBandingkan, setIsBandingkan] = useState(false);
  const [hA, setHA] = useState(null); const [hB, setHB] = useState(null);
  const chartRef = useRef(null);

  const initialP = { frame_id: 64, motor: 101, battery: 201, prop: 301 };
  const initialC = { berat_f: 50, kv: 2400, thrust: 1000, berat_m: 30, mah: 1300, sel: 4, berat_b: 150, size: 5, pitch: 40 };
  const [pA, setPA] = useState(initialP); const [cA, setCA] = useState(initialC); const [isCustomA, setIsCustomA] = useState(false);
  const [pB, setPB] = useState(initialP); const [cB, setCB] = useState(initialC); const [isCustomB, setIsCustomB] = useState(false);

  useEffect(() => { fetch(`${API_BASE}/list-komponen`).then(r => r.json()).then(data => setDb(data)); }, []);

  const hitung = async (slot) => {
    const isA = slot === 'A'; const isC = isA ? isCustomA : isCustomB;
    const p = isA ? (isC ? cA : pA) : (isC ? cB : pB);
    const url = isC ? `${API_BASE}/simulasi_custom?berat_f=${p.berat_f}&kv=${p.kv}&thrust=${p.thrust}&berat_m=${p.berat_m}&mah=${p.mah}&sel=${p.sel}&berat_b=${p.berat_b}&size=${p.size}&pitch=${p.pitch}` : `${API_BASE}/simulasi?id_frame=${p.frame_id}&id_motor=${p.motor}&id_battery=${p.battery}&id_prop=${p.prop}`;
    const res = await fetch(url); const data = await res.json();
    isA ? setHA(data) : setHB(data);
  };

  const exportPDF = async () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(22); doc.text("DRONE LAB ANALYSIS", 105, 20, { align: "center" });
      const getNames = (p, isC) => isC ? [["Mode", "Manual"]] : [["Frame", db.find(x => x.id === p.frame_id)?.nama], ["Motor", db.find(x => x.id === p.motor)?.nama], ["Battery", db.find(x => x.id === p.battery)?.nama], ["Propeller", db.find(x => x.id === p.prop)?.nama]];
      if (hA) autoTable(doc, { head: [["UNIT ALPHA", "MODEL"]], body: getNames(pA, isCustomA), startY: 40 });
      if (isBandingkan && hB) autoTable(doc, { head: [["UNIT BRAVO", "MODEL"]], body: getNames(pB, isCustomB), startY: doc.lastAutoTable.finalY + 10 });
      if (chartRef.current) {
        const canvas = await html2canvas(chartRef.current);
        doc.addPage(); doc.addImage(canvas.toDataURL('image/png'), 'PNG', 15, 30, 180, 100);
      }
      doc.save(`DroneLab_Report.pdf`);
    } catch (e) { alert(e.message); }
  };

  const isDark = theme === 'dark';

  return (
    <div style={{ minHeight: '100vh', background: isDark ? '#020617' : '#f8fafc', color: isDark ? '#fff' : '#0f172a', transition: '0.5s', fontFamily: 'Inter, sans-serif' }}>
      
      {/* NAVBAR STABIL */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 1000, background: isDark ? 'rgba(2,6,23,0.9)' : 'rgba(248,250,252,0.9)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(128,128,128,0.2)', padding: '15px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 15px' }}>
          <div onClick={() => setHalaman('home')} style={{ fontWeight: '900', letterSpacing: '2px', cursor: 'pointer', color: isDark ? '#00f2ff' : '#0369a1' }}>DRONE LAB</div>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <button onClick={() => setHalaman('home')} style={{ background: 'none', border: 'none', color: halaman === 'home' ? '#8b5cf6' : (isDark ? '#fff' : '#0f172a'), fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>HOME</button>
            <button onClick={() => setHalaman('designer')} style={{ background: 'none', border: 'none', color: halaman === 'designer' ? '#8b5cf6' : (isDark ? '#fff' : '#0f172a'), fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>DESIGN</button>
            <button onClick={() => setHalaman('support')} style={{ background: 'none', border: 'none', color: halaman === 'support' ? '#8b5cf6' : (isDark ? '#fff' : '#0f172a'), fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}>SUPPORT</button>
            <button onClick={() => setTheme(isDark ? 'light' : 'dark')} style={{ borderRadius: '20px', border: 'none', padding: '5px 12px', background: isDark ? '#1e293b' : '#ddd', cursor: 'pointer' }}>{isDark ? '🌙' : '☀️'}</button>
          </div>
        </div>
      </nav>

      <main style={{ padding: '20px 15px' }}>
        {halaman === 'home' && (
          <div style={{ textAlign: 'center', maxWidth: '1000px', margin: '40px auto' }}>
            <div style={{ marginBottom: '30px' }}>
               <span style={{ padding: '8px 20px', background: 'rgba(0,242,255,0.1)', border: '1px solid #00f2ff44', borderRadius: '30px', fontSize: '0.6rem', color: '#00f2ff', letterSpacing: '2px', fontWeight: 'bold' }}>NEXT-GEN UAV SIMULATOR</span>
            </div>
            <h1 style={{ fontSize: 'clamp(2.5rem, 8vw, 4rem)', fontWeight: '900', marginBottom: '20px', letterSpacing: '-2px', lineHeight: '1.1', color: isDark ? '#fff' : '#0f172a' }}>
              PRECISION <br/><span style={{ background: 'linear-gradient(45deg, #00f2ff, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>UAV DESIGN</span>
            </h1>
            <p style={{ opacity: 0.8, lineHeight: '1.8', fontSize: '1.1rem', marginBottom: '40px', maxWidth:'700px', margin:'0 auto 40px', color: isDark ? '#fff' : '#0f172a' }}>Simulator desain drone presisi pertama di Indonesia. Hitung parameter fisika unitmu secara real-time.</p>

            <button onClick={() => setHalaman('designer')} style={{ padding: '22px 60px', fontSize: '1.2rem', borderRadius: '60px', background: 'linear-gradient(45deg, #00f2ff, #8b5cf6)', color: '#fff', border: 'none', fontWeight: '900', cursor: 'pointer', boxShadow: '0 10px 30px rgba(0,242,255,0.3)', marginBottom: '80px' }}>START DESIGNING</button>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px', margin: '0 auto 80px', padding:'0 20px', textAlign: 'left' }}>
              <div style={{ padding: '40px', background: isDark ? 'rgba(255,255,255,0.02)' : '#fff', borderRadius: '30px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#eee'}` }}>
                <h3 style={{color: '#00f2ff'}}>🚀 Physics Core</h3>
                <p style={{fontSize: '0.9rem', opacity: 0.7, color: isDark ? '#fff' : '#0f172a' }}>Algoritma perhitungan Thrust-to-Weight Ratio dan Flight Time yang dikalibrasi sesuai hukum fisika.</p>
              </div>
              <div style={{ padding: '40px', background: isDark ? 'rgba(255,255,255,0.02)' : '#fff', borderRadius: '30px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#eee'}` }}>
                <h3 style={{color: '#a855f7'}}>📊 Battle Mode</h3>
                <p style={{fontSize: '0.9rem', opacity: 0.7, color: isDark ? '#fff' : '#0f172a' }}>Bandingkan dua spesifikasi berbeda secara head-to-head melalui grafik visual interaktif.</p>
              </div>
              <div style={{ padding: '40px', background: isDark ? 'rgba(255,255,255,0.02)' : '#fff', borderRadius: '30px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#eee'}` }}>
                <h3 style={{color: '#10b981'}}>📄 Pro Export</h3>
                <p style={{fontSize: '0.9rem', opacity: 0.7, color: isDark ? '#fff' : '#0f172a' }}>Hasilkan laporan dokumentasi teknis dalam format PDF lengkap dengan tabel komponen.</p>
              </div>
            </div>
          </div>
        )}

        {halaman === 'designer' && (
          <div style={{ width:'100%', padding: '0 40px 100px', boxSizing:'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '60px' }}>
              <button onClick={() => setIsBandingkan(!isBandingkan)} style={{ padding: '18px 45px', borderRadius: '60px', border: `2px solid ${isDark ? '#00f2ff' : '#0369a1'}`, background: isBandingkan ? 'rgba(0,242,255,0.1)' : 'transparent', color: isDark ? '#00f2ff' : '#0369a1', fontWeight: '900', cursor: 'pointer' }}>{isBandingkan ? 'EXIT BATTLE' : 'BATTLE MODE'}</button>
              {(hA || hB) && <button onClick={exportPDF} style={{ padding: '18px 45px', borderRadius: '60px', background: '#10b981', color: '#fff', border: 'none', fontWeight: '900', cursor: 'pointer' }}>📄 EXPORT REPORT</button>}
            </div>
            <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <SlotComponent title="UNIT ALPHA" color="#00f2ff" pState={pA} setP={setPA} cState={cA} setC={setCA} isCustom={isCustomA} setIsCustom={setIsCustomA} hasil={hA} onHitung={() => hitung('A')} onReset={() => setHA(null)} db={db} theme={theme} />
              {isBandingkan && <SlotComponent title="UNIT BRAVO" color="#a855f7" pState={pB} setP={setPB} cState={cB} setC={setCB} isCustom={isCustomB} setIsCustom={setIsCustomB} hasil={hB} onHitung={() => hitung('B')} onReset={() => setHB(null)} db={db} theme={theme} />}
            </div>
            {isBandingkan && hA && hB && (
              <div ref={chartRef} style={{ marginTop: '80px', background: isDark ? 'rgba(15, 23, 42, 0.5)' : '#fff', padding: '60px', borderRadius: '50px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#eee'}` }}>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={[{ name: 'TWR', a: hA.twr, b: hB.twr }, { name: 'FLIGHT', a: hA.flight_time, b: hB.flight_time }, { name: 'WEIGHT/10', a: hA.berat_total/10, b: hB.berat_total/10 }]}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.05)' : '#eee'} />
                    <XAxis dataKey="name" stroke="#666" />
                    <YAxis stroke="#666" />
                    <ChartTooltip contentStyle={{background: isDark ? '#0f172a' : '#fff'}} />
                    <Bar dataKey="a" fill="#00f2ff" radius={[15, 15, 0, 0]} name="Alpha" />
                    <Bar dataKey="b" fill="#a855f7" radius={[15, 15, 0, 0]} name="Bravo" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* HALAMAN SUPPORT */}
        {halaman === 'support' && (
          <div style={{ textAlign: 'center', padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ color: '#8b5cf6', fontSize: '2.5rem', marginBottom: '20px' }}>SUPPORT PROJECT</h2>
            <div style={{ background: isDark ? 'rgba(255,255,255,0.05)' : '#fff', padding: '40px', borderRadius: '30px', border: '1px solid rgba(128,128,128,0.2)' }}>
              <p style={{ marginBottom: '30px', lineHeight: '1.6' }}>Bantu pengembangan Drone Lab untuk mendukung kemajuan Engineer FPV di Indonesia.</p>
              <div style={{ padding: '20px', border: '2px dashed #8b5cf6', borderRadius: '24px', marginBottom: '25px' }}>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=DonasiDroneLab" alt="QRIS" style={{borderRadius: '10px'}} />
                <p style={{fontSize: '0.8rem', fontWeight: 'bold', marginTop: '15px'}}>SCAN QRIS TO DONATE</p>
              </div>
              <p style={{ opacity: 0.7 }}>Terima kasih, para Pilot Indonesia! 🚁</p>
            </div>
          </div>
        )}
      </main>

      <footer style={{ textAlign: 'center', padding: '60px 40px', opacity: 0.4, fontSize: '0.8rem', letterSpacing:'3px', color: isDark ? '#fff' : '#0f172a' }}>
        © 2026 Drone Lab. Engineering by Ilham Muhammad Yusuf.
      </footer>
    </div>
  );
}