'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// ── Constants ──
const MODELS = [
  { id: 'gemini-2.5-flash-preview-image', label: 'Nano Banana', sub: '2.5 Flash', price: '$0.039', maxRes: '1K' },
  { id: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2', sub: '3.1 Flash', price: '$0.067', maxRes: '2K' },
  { id: 'gemini-3-pro-image-preview', label: 'Nano Banana Pro', sub: 'Pro', price: '$0.134', maxRes: '2K' },
];

const EFFECTS = [
  { id: 'original', label: 'Original', sub: 'Full color', filter: 'none', overlay: null },
  { id: 'dramatic', label: 'Dramatic B&W', sub: 'Heavy contrast + vignette', filter: 'grayscale(100%) contrast(1.6) brightness(0.9)', overlay: 'radial-gradient(circle, transparent 25%, rgba(0,0,0,0.75) 100%)' },
  { id: 'vintage', label: 'Vintage', sub: 'Sepia + faded', filter: 'sepia(35%) contrast(1.1) brightness(0.92) saturate(0.75)', overlay: 'linear-gradient(180deg, rgba(255,200,120,0.08) 0%, transparent 40%, rgba(0,0,0,0.2) 100%)' },
  { id: 'military', label: 'Military', sub: 'Olive green tint, gritty', filter: 'sepia(30%) hue-rotate(70deg) saturate(0.8) contrast(1.1) brightness(0.95)', overlay: null },
];

const BOOST_FILTER = 'brightness(1.08) saturate(1.12) contrast(1.05)';
const YT_W = 1280;
const YT_H = 720;
const MAX_REFS = 3;

export default function Home() {
  // ── State ──
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState('idle');
  const [model, setModel] = useState(MODELS[1].id);
  const [resolution, setResolution] = useState('1K');
  const [prompt, setPrompt] = useState('');
  const [spaceDir, setSpaceDir] = useState('none');
  const [refImages, setRefImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [image, setImage] = useState(null);
  const [usedModel, setUsedModel] = useState(null);
  const [boostStates, setBoostStates] = useState({});
  const [lightbox, setLightbox] = useState(null);
  const [theme, setTheme] = useState('dark');
  const fileInputRef = useRef(null);

  const selectedModel = MODELS.find((m) => m.id === model);
  const canUse2K = selectedModel?.maxRes === '2K';
  const activeRes = canUse2K ? resolution : '1K';

  // ── Persist API key & theme ──
  useEffect(() => {
    const savedKey = localStorage.getItem('tw-api-key');
    const savedTheme = localStorage.getItem('tw-theme');
    if (savedKey) { setApiKey(savedKey); setKeyStatus('idle'); }
    if (savedTheme) setTheme(savedTheme);
  }, []);

  useEffect(() => {
    if (apiKey) localStorage.setItem('tw-api-key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('tw-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // ── Price calc ──
  const getPrice = () => {
    if (model === MODELS[0].id) return '$0.039';
    if (activeRes === '2K') return model === MODELS[1].id ? '$0.101' : '$0.134';
    return selectedModel?.price || '$0.067';
  };

  // ── Test key ──
  const testKey = useCallback(async () => {
    if (!apiKey.trim()) { setKeyStatus('invalid'); return; }
    setKeyStatus('testing');
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`);
      const data = await res.json();
      setKeyStatus(data.error ? 'invalid' : 'valid');
    } catch { setKeyStatus('invalid'); }
  }, [apiKey]);

  // ── Reference images ──
  const addRefImage = (file) => {
    if (refImages.length >= MAX_REFS) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRefImages((prev) => [...prev, {
        base64: ev.target.result.split(',')[1],
        mimeType: file.type,
        preview: ev.target.result,
      }]);
    };
    reader.readAsDataURL(file);
  };

  const handleRefInput = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((f) => addRefImage(f));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeRef = (index) => {
    setRefImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOutputDragStart = (e) => {
    if (!image) return;
    e.dataTransfer.setData('text/plain', 'output-image');
  };

  const handleRefDrop = (e) => {
    e.preventDefault();
    const isOutput = e.dataTransfer.getData('text/plain') === 'output-image';
    if (isOutput && image && refImages.length < MAX_REFS) {
      const mimeMatch = image.match(/data:(.+?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      const base64 = image.split(',')[1];
      setRefImages((prev) => [...prev, { base64, mimeType, preview: image }]);
      return;
    }
    const files = Array.from(e.dataTransfer.files || []);
    files.slice(0, MAX_REFS - refImages.length).forEach((f) => {
      if (f.type.startsWith('image/')) addRefImage(f);
    });
  };

  const handleRefDragOver = (e) => e.preventDefault();

  // ── Generate ──
  const generate = useCallback(async () => {
    if (!apiKey.trim()) { setError('Please enter your Gemini API key'); return; }
    if (!prompt.trim()) { setError('Please enter a prompt'); return; }
    setError(''); setLoading(true); setImage(null); setBoostStates({});

    let fullPrompt = `Generate an image: ${prompt}.`;
    fullPrompt += ' Make it suitable as a YouTube thumbnail at exactly 16:9 aspect ratio (1280x720 pixels).';
    fullPrompt += ' Bold, eye-catching, high quality, cinematic lighting.';

    if (spaceDir === 'left') fullPrompt += ' Compose the subject on the RIGHT side, leaving LEFT side empty for text overlay.';
    else if (spaceDir === 'right') fullPrompt += ' Compose the subject on the LEFT side, leaving RIGHT side empty for text overlay.';

    const parts = [];
    refImages.forEach((ref) => {
      parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } });
    });
    if (refImages.length > 0) fullPrompt += ' Use the provided reference image(s) as visual guidance for the subject/style.';
    parts.push({ text: fullPrompt });

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
          }),
        }
      );
      const data = await res.json();
      if (data.error) { setError(data.error.message || 'API error'); setLoading(false); return; }
      const resParts = data.candidates?.[0]?.content?.parts || [];
      const imgPart = resParts.find((p) => p.inlineData);
      if (imgPart) {
        setImage(`data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`);
        setUsedModel(selectedModel);
      } else {
        setError('No image returned. Try rephrasing your prompt.');
      }
    } catch (e) { setError(`Request failed: ${e.message}`); }
    setLoading(false);
  }, [apiKey, model, prompt, spaceDir, refImages, selectedModel]);

  // ── Boost toggle ──
  const toggleBoost = (id) => setBoostStates((p) => ({ ...p, [id]: !p[id] }));

  // ── Download ──
  const download = useCallback((effect, isBoosted) => {
    if (!image) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = YT_W; canvas.height = YT_H;
      const ctx = canvas.getContext('2d');
      const ir = img.width / img.height, cr = YT_W / YT_H;
      let sx, sy, sw, sh;
      if (ir > cr) { sh = img.height; sw = sh * cr; sx = (img.width - sw) / 2; sy = 0; }
      else { sw = img.width; sh = sw / cr; sx = 0; sy = (img.height - sh) / 2; }
      let f = '';
      if (effect.filter !== 'none') f += effect.filter;
      if (isBoosted) f += (f ? ' ' : '') + BOOST_FILTER;
      if (f) ctx.filter = f;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, YT_W, YT_H);
      ctx.filter = 'none';
      if (effect.overlay?.includes('radial')) {
        const g = ctx.createRadialGradient(YT_W / 2, YT_H / 2, YT_W * 0.15, YT_W / 2, YT_H / 2, YT_W * 0.65);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.75)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, YT_W, YT_H);
      }
      if (effect.overlay?.includes('linear')) {
        const g = ctx.createLinearGradient(0, 0, 0, YT_H);
        g.addColorStop(0, 'rgba(255,200,120,0.08)'); g.addColorStop(0.4, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.2)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, YT_W, YT_H);
      }
      const link = document.createElement('a');
      link.download = `thumbnail-${effect.id}${isBoosted ? '-boost' : ''}-1280x720.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = image;
  }, [image]);

  // ── Lightbox ──
  const openLightbox = (effect, isBoosted) => {
    let combinedFilter = effect.filter;
    if (isBoosted) combinedFilter = (effect.filter !== 'none' ? effect.filter + ' ' : '') + BOOST_FILTER;
    setLightbox({ src: image, filter: combinedFilter, overlay: effect.overlay });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate();
    if (e.key === 'Escape') setLightbox(null);
  };

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="app" data-theme={theme}>
      {/* ── Header ── */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M20.4 14.5L16 10 4 20" />
            </svg>
          </div>
          <h1>Thumbnail Workshop <span className="badge">v2</span></h1>
        </div>
        <div className="header-right">
          <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} type="button" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
          <div className="status">
            <div className={`status-dot ${keyStatus === 'valid' ? 'connected' : ''}`} />
            {keyStatus === 'valid' ? 'Connected' : keyStatus === 'testing' ? 'Testing...' : keyStatus === 'invalid' ? 'Invalid key' : 'No API key'}
          </div>
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="main-layout">
        {/* ── Left: Settings ── */}
        <aside className="settings-col">
          <div className="panel">
            <div className="panel-label">API key</div>
            <div className="api-key-wrapper">
              <input type={showKey ? 'text' : 'password'} className="input-field mono" placeholder="Paste your Gemini key..." value={apiKey} onChange={(e) => { setApiKey(e.target.value); setKeyStatus('idle'); }} />
              <button className="input-icon-btn" onClick={() => setShowKey(!showKey)} type="button">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {showKey ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><line x1="1" y1="1" x2="23" y2="23" /></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>}
                </svg>
              </button>
            </div>
            <div className="api-actions">
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="link-sm">Get key</a>
              <button className={`btn-sm ${keyStatus === 'valid' ? 'btn-valid' : ''} ${keyStatus === 'invalid' ? 'btn-invalid' : ''}`} onClick={testKey} disabled={!apiKey.trim() || keyStatus === 'testing'} type="button">
                {keyStatus === 'testing' ? 'Testing...' : keyStatus === 'valid' ? '✓ Valid' : keyStatus === 'invalid' ? '✗ Invalid' : 'Test'}
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-label">Model</div>
            <div className="btn-group-v">
              {MODELS.map((m) => (
                <button key={m.id} className={`model-btn ${model === m.id ? 'active' : ''}`} onClick={() => setModel(m.id)} type="button">
                  <div><div className="model-name">{m.label}</div><div className="model-sub">{m.sub}</div></div>
                  <div className="model-price">{m.price}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-label">Resolution</div>
            <div className="btn-group-h">
              {['1K', '2K'].map((r) => {
                const dis = r === '2K' && !canUse2K;
                return <button key={r} className={`toggle-btn ${activeRes === r ? 'active' : ''} ${dis ? 'disabled' : ''}`} onClick={() => !dis && setResolution(r)} disabled={dis} type="button">{r}</button>;
              })}
            </div>
            {!canUse2K && <div className="hint">2K needs Nano Banana 2 or Pro</div>}
          </div>

          <div className="panel">
            <div className="panel-label">Text space</div>
            <div className="btn-group-h">
              {[{ id: 'none', l: 'Center' }, { id: 'left', l: '← Left' }, { id: 'right', l: 'Right →' }].map((s) => (
                <button key={s.id} className={`toggle-btn ${spaceDir === s.id ? 'active' : ''}`} onClick={() => setSpaceDir(s.id)} type="button">{s.l}</button>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Right: Workspace ── */}
        <div className="workspace-col">
          <div className="prompt-area">
            <div className="prompt-left">
              <textarea className="prompt-textarea" placeholder={"Describe your thumbnail...\nCtrl+Enter to generate"} value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={handleKeyDown} rows={3} />
              <button className="generate-btn" onClick={generate} disabled={loading} type="button">
                {loading ? (
                  <><div className="spinner" /> Generating...</>
                ) : (
                  <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg> Generate — {getPrice()}</>
                )}
              </button>
            </div>
            <div className="ref-area" onDrop={handleRefDrop} onDragOver={handleRefDragOver}>
              <div className="panel-label">Reference <span className="dim">({refImages.length}/{MAX_REFS})</span></div>
              <div className="ref-slots">
                {refImages.map((ref, i) => (
                  <div key={i} className="ref-thumb">
                    <img src={ref.preview} alt={`Ref ${i + 1}`} />
                    <button className="ref-remove" onClick={() => removeRef(i)} type="button">✕</button>
                  </div>
                ))}
                {refImages.length < MAX_REFS && (
                  <button className="ref-add" onClick={() => fileInputRef.current?.click()} type="button">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                  </button>
                )}
              </div>
              <div className="hint">Drop images or drag outputs here</div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleRefInput} style={{ display: 'none' }} />
            </div>
          </div>

          {error && <div className="error-bar">{error}</div>}

          <div className="results-area">
            {usedModel && image && (
              <div className="results-header">
                <span className="results-title">Results — 1280×720</span>
                <span className="cost-badge">{usedModel.label} — {getPrice()}</span>
              </div>
            )}
            <div className="results-grid">
              {EFFECTS.map((fx) => {
                const boosted = !!boostStates[fx.id];
                let cf = fx.filter;
                if (boosted) cf = (fx.filter !== 'none' ? fx.filter + ' ' : '') + BOOST_FILTER;
                return (
                  <div key={fx.id} className={`card ${!image ? 'card-empty' : ''}`}>
                    {image ? (
                      <>
                        <div className="card-img" onDoubleClick={() => openLightbox(fx, boosted)} draggable onDragStart={handleOutputDragStart} title="Double-click to zoom • Drag to reference">
                          <img src={image} alt={fx.label} style={{ filter: cf !== 'none' ? cf : undefined }} />
                          {fx.overlay && <div className="card-overlay" style={{ background: fx.overlay }} />}
                        </div>
                        <div className="card-footer">
                          <div className="card-info">
                            <div className="card-label">{fx.label}</div>
                            <div className="card-sub">{fx.sub}</div>
                          </div>
                          <div className="card-actions">
                            <button className={`btn-boost ${boosted ? 'active' : ''}`} onClick={() => toggleBoost(fx.id)} type="button">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                              Boost
                            </button>
                            <button className="btn-dl" onClick={() => download(fx, boosted)} type="button">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="card-placeholder">
                        <div className="placeholder-label">{fx.label}</div>
                        {loading && fx.id === 'original' && <div className="spinner spinner-sm" />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-img-wrap">
              <img src={lightbox.src} alt="Zoomed" style={{ filter: lightbox.filter !== 'none' ? lightbox.filter : undefined }} />
              {lightbox.overlay && <div className="card-overlay" style={{ background: lightbox.overlay }} />}
            </div>
            <button className="lightbox-close" onClick={() => setLightbox(null)} type="button">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
