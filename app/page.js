'use client';

import { useState, useRef, useCallback } from 'react';

const MODELS = [
  { id: 'gemini-2.5-flash-preview-image', label: 'Nano Banana', sub: '2.5 Flash', price: '$0.039', maxRes: '1K' },
  { id: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2', sub: '3.1 Flash', price: '$0.067', maxRes: '2K' },
  { id: 'gemini-3-pro-image-preview', label: 'Nano Banana Pro', sub: 'Pro', price: '$0.134', maxRes: '2K' },
];

const RESOLUTIONS = [
  { id: '1K', label: '1K', desc: '1024px', pixels: 1024 },
  { id: '2K', label: '2K', desc: '2048px', pixels: 2048 },
];

const EFFECTS = [
  { id: 'original', label: 'Original', sub: 'Full color', filter: 'none', overlay: null },
  { id: 'bw', label: 'Black & White', sub: 'Clean grayscale', filter: 'grayscale(100%) contrast(1.05)', overlay: null },
  { id: 'dramatic', label: 'Dramatic B&W', sub: 'Heavy contrast + vignette', filter: 'grayscale(100%) contrast(1.6) brightness(0.9)', overlay: 'radial-gradient(circle, transparent 25%, rgba(0,0,0,0.75) 100%)' },
  { id: 'vintage', label: 'Vintage', sub: 'Sepia + faded', filter: 'sepia(35%) contrast(1.1) brightness(0.92) saturate(0.75)', overlay: 'linear-gradient(180deg, rgba(255,200,120,0.08) 0%, transparent 40%, rgba(0,0,0,0.2) 100%)' },
];

const BOOST_FILTER = 'contrast(1.15) saturate(1.1) brightness(1.02)';
const YT_WIDTH = 1280;
const YT_HEIGHT = 720;

export default function Home() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState('idle');
  const [model, setModel] = useState(MODELS[1].id);
  const [resolution, setResolution] = useState('1K');
  const [prompt, setPrompt] = useState('');
  const [spaceDir, setSpaceDir] = useState('none');
  const [refImage, setRefImage] = useState(null);
  const [refPreview, setRefPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [image, setImage] = useState(null);
  const [usedModel, setUsedModel] = useState(null);
  const [boostStates, setBoostStates] = useState({});
  const fileInputRef = useRef(null);

  const selectedModel = MODELS.find((m) => m.id === model);
  const canUse2K = selectedModel?.maxRes === '2K';
  const activeResolution = canUse2K ? resolution : '1K';

  const getPrice = () => {
    if (model === MODELS[0].id) return '$0.039';
    if (activeResolution === '2K') {
      if (model === MODELS[1].id) return '$0.101';
      if (model === MODELS[2].id) return '$0.134';
    }
    return selectedModel?.price || '$0.067';
  };

  // Test API key with a lightweight call
  const testKey = useCallback(async () => {
    if (!apiKey.trim()) { setKeyStatus('invalid'); return; }
    setKeyStatus('testing');
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`
      );
      const data = await res.json();
      setKeyStatus(data.error ? 'invalid' : 'valid');
    } catch {
      setKeyStatus('invalid');
    }
  }, [apiKey]);

  // Reference image upload
  const handleRefImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRefImage({ base64: ev.target.result.split(',')[1], mimeType: file.type });
      setRefPreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const clearRefImage = () => {
    setRefImage(null);
    setRefPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Generate thumbnail
  const generate = useCallback(async () => {
    if (!apiKey.trim()) { setError('Please enter your Gemini API key'); return; }
    if (!prompt.trim()) { setError('Please enter a prompt'); return; }
    setError(''); setLoading(true); setImage(null); setBoostStates({});

    let fullPrompt = `Generate an image: ${prompt}.`;
    fullPrompt += ' Make it suitable as a YouTube thumbnail at exactly 16:9 aspect ratio (1280x720 pixels).';
    fullPrompt += ' Bold, eye-catching, high quality, cinematic lighting.';

    if (spaceDir === 'left') {
      fullPrompt += ' Compose the subject on the RIGHT side of the image, leaving the LEFT side mostly empty for text overlay.';
    } else if (spaceDir === 'right') {
      fullPrompt += ' Compose the subject on the LEFT side of the image, leaving the RIGHT side mostly empty for text overlay.';
    }

    const parts = [];
    if (refImage) {
      parts.push({ inlineData: { mimeType: refImage.mimeType, data: refImage.base64 } });
      fullPrompt += ' Use the provided reference image as visual guidance for the subject/style.';
    }
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
      if (data.error) { setError(data.error.message || 'API error occurred'); setLoading(false); return; }

      const resParts = data.candidates?.[0]?.content?.parts || [];
      const imgPart = resParts.find((p) => p.inlineData);

      if (imgPart) {
        setImage(`data:${imgPart.inlineData.mimeType};base64,${imgPart.inlineData.data}`);
        setUsedModel(selectedModel);
      } else {
        setError('No image returned. Try rephrasing your prompt.');
      }
    } catch (e) {
      setError(`Request failed: ${e.message}`);
    }
    setLoading(false);
  }, [apiKey, model, prompt, spaceDir, refImage, selectedModel]);

  const toggleBoost = (effectId) => {
    setBoostStates((prev) => ({ ...prev, [effectId]: !prev[effectId] }));
  };

  // Download: applies effect + boost, crops to 1280x720
  const download = useCallback((effect, isBoosted) => {
    if (!image) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = YT_WIDTH;
      canvas.height = YT_HEIGHT;
      const ctx = canvas.getContext('2d');

      // Cover crop math
      const imgRatio = img.width / img.height;
      const canvasRatio = YT_WIDTH / YT_HEIGHT;
      let sx, sy, sw, sh;
      if (imgRatio > canvasRatio) {
        sh = img.height; sw = img.height * canvasRatio;
        sx = (img.width - sw) / 2; sy = 0;
      } else {
        sw = img.width; sh = img.width / canvasRatio;
        sx = 0; sy = (img.height - sh) / 2;
      }

      let filterStr = '';
      if (effect.filter !== 'none') filterStr += effect.filter;
      if (isBoosted) filterStr += (filterStr ? ' ' : '') + BOOST_FILTER;
      if (filterStr) ctx.filter = filterStr;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, YT_WIDTH, YT_HEIGHT);
      ctx.filter = 'none';

      if (effect.overlay?.includes('radial')) {
        const grad = ctx.createRadialGradient(YT_WIDTH / 2, YT_HEIGHT / 2, YT_WIDTH * 0.15, YT_WIDTH / 2, YT_HEIGHT / 2, YT_WIDTH * 0.65);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.75)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, YT_WIDTH, YT_HEIGHT);
      }
      if (effect.overlay?.includes('linear')) {
        const grad = ctx.createLinearGradient(0, 0, 0, YT_HEIGHT);
        grad.addColorStop(0, 'rgba(255,200,120,0.08)');
        grad.addColorStop(0.4, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.2)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, YT_WIDTH, YT_HEIGHT);
      }

      const link = document.createElement('a');
      link.download = `thumbnail-${effect.id}${isBoosted ? '-boosted' : ''}-1280x720.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = image;
  }, [image]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate();
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M20.4 14.5L16 10 4 20" />
            </svg>
          </div>
          <h1>Thumbnail Workshop<span>Beta</span></h1>
        </div>
        <div className="status">
          <div className={`status-dot ${keyStatus === 'valid' ? 'connected' : ''}`} />
          {keyStatus === 'valid' ? 'Connected' : keyStatus === 'testing' ? 'Testing...' : keyStatus === 'invalid' ? 'Invalid key' : 'No API key'}
        </div>
      </header>

      <div className="main-grid">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          {/* API Key */}
          <div className="panel">
            <div className="panel-label">
              <svg className="panel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
              API key
            </div>
            <div className="api-key-wrapper">
              <input
                type={showKey ? 'text' : 'password'}
                className="api-key-input"
                placeholder="Paste your Gemini key..."
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setKeyStatus('idle'); }}
              />
              <button className="toggle-visibility" onClick={() => setShowKey(!showKey)} type="button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {showKey ? (
                    <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>
                  ) : (
                    <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                  )}
                </svg>
              </button>
            </div>
            <div className="api-key-actions">
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="api-hint">
                Get key from Google AI Studio
              </a>
              <button
                className={`test-key-btn ${keyStatus === 'valid' ? 'valid' : ''} ${keyStatus === 'invalid' ? 'invalid' : ''}`}
                onClick={testKey}
                disabled={!apiKey.trim() || keyStatus === 'testing'}
                type="button"
              >
                {keyStatus === 'testing' ? <><div className="spinner-sm" /> Testing</> :
                 keyStatus === 'valid' ? '✓ Valid' :
                 keyStatus === 'invalid' ? '✗ Invalid' : 'Test key'}
              </button>
            </div>
          </div>

          {/* Model */}
          <div className="panel">
            <div className="panel-label">
              <svg className="panel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
              Model
            </div>
            <div className="model-toggles">
              {MODELS.map((m) => (
                <button key={m.id} className={`model-btn ${model === m.id ? 'active' : ''}`} onClick={() => setModel(m.id)} type="button">
                  <div>
                    <div className="model-name">{m.label}</div>
                    <div className="model-sub">{m.sub}</div>
                  </div>
                  <div className="model-price">{m.price}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          <div className="panel">
            <div className="panel-label">
              <svg className="panel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              Resolution
            </div>
            <div className="res-toggles">
              {RESOLUTIONS.map((r) => {
                const disabled = r.id === '2K' && !canUse2K;
                return (
                  <button
                    key={r.id}
                    className={`res-btn ${activeResolution === r.id ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                    onClick={() => !disabled && setResolution(r.id)}
                    disabled={disabled}
                    type="button"
                    title={disabled ? 'Only available with Nano Banana 2 or Pro' : ''}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
            {!canUse2K && <div className="panel-hint">2K requires Nano Banana 2 or Pro</div>}
          </div>

          {/* Prompt */}
          <div className="panel">
            <div className="panel-label">
              <svg className="panel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" />
                <line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" />
              </svg>
              Prompt
            </div>
            <textarea
              className="prompt-textarea"
              placeholder={"Describe your thumbnail...\n(Ctrl+Enter to generate)"}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={4}
            />
          </div>

          {/* Reference Image */}
          <div className="panel">
            <div className="panel-label">
              <svg className="panel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Reference image
              <span className="optional-tag">optional</span>
            </div>
            {refPreview ? (
              <div className="ref-preview">
                <img src={refPreview} alt="Reference" />
                <button className="ref-remove" onClick={clearRefImage} type="button">✕</button>
              </div>
            ) : (
              <button className="ref-upload-btn" onClick={() => fileInputRef.current?.click()} type="button">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M20.4 14.5L16 10 4 20" />
                </svg>
                <span>Click to upload</span>
                <span className="ref-hint">JPG, PNG — used as visual guidance</span>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleRefImage} style={{ display: 'none' }} />
          </div>

          {/* Text Space */}
          <div className="panel">
            <div className="panel-label">
              <svg className="panel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="12" y1="3" x2="12" y2="21" />
              </svg>
              Text space
            </div>
            <div className="space-toggles">
              {[{ id: 'none', label: 'Centered' }, { id: 'left', label: '← Left' }, { id: 'right', label: 'Right →' }].map((s) => (
                <button key={s.id} className={`space-btn ${spaceDir === s.id ? 'active' : ''}`} onClick={() => setSpaceDir(s.id)} type="button">
                  {s.label}
                </button>
              ))}
            </div>
            <div className="panel-hint">
              {spaceDir === 'none' ? 'Subject centered in frame' : `Empty space on ${spaceDir} for text overlay`}
            </div>
          </div>

          {/* Generate */}
          <button className="generate-btn" onClick={generate} disabled={loading} type="button">
            {loading ? (
              <><div className="spinner" /> Generating...</>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                Generate — {getPrice()}/image
              </>
            )}
          </button>
        </aside>

        {/* ── Content ── */}
        <main className="content">
          {error && (
            <div className="error-bar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          )}

          {!image && !loading && (
            <div className="empty-state">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                <rect x="2" y="2" width="20" height="20" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M20.4 14.5L16 10 4 20" />
              </svg>
              <h3>No thumbnails yet</h3>
              <p>Enter your API key, pick a model, describe your thumbnail and hit generate.</p>
              <div className="shortcut-hint">Ctrl+Enter to generate</div>
            </div>
          )}

          {loading && (
            <div className="empty-state">
              <div className="spinner spinner-lg" />
              <h3>Generating your thumbnail...</h3>
              <p>This usually takes 5–15 seconds depending on the model.</p>
            </div>
          )}

          {image && !loading && (
            <>
              <div className="results-header">
                <h2>Results <span className="results-dim">— 1280×720</span></h2>
                {usedModel && <span className="cost-badge">{usedModel.label} — {getPrice()}</span>}
              </div>

              <div className="results-grid">
                {EFFECTS.map((effect) => {
                  const isBoosted = !!boostStates[effect.id];
                  let combinedFilter = effect.filter;
                  if (isBoosted) {
                    combinedFilter = (effect.filter !== 'none' ? effect.filter + ' ' : '') + BOOST_FILTER;
                  }

                  return (
                    <div className="image-card" key={effect.id}>
                      <div className="image-wrapper">
                        <img src={image} alt={effect.label} style={{ filter: combinedFilter !== 'none' ? combinedFilter : undefined }} />
                        {effect.overlay && <div className="vignette-overlay" style={{ background: effect.overlay }} />}
                      </div>
                      <div className="card-footer">
                        <div>
                          <div className="card-label">{effect.label}</div>
                          <div className="card-sublabel">{effect.sub}</div>
                        </div>
                        <div className="card-actions">
                          <button className={`boost-btn ${isBoosted ? 'active' : ''}`} onClick={() => toggleBoost(effect.id)} type="button" title="Micro-contrast + saturation boost">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                            </svg>
                            Boost
                          </button>
                          <button className="download-btn" onClick={() => download(effect, isBoosted)} type="button">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Download
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
