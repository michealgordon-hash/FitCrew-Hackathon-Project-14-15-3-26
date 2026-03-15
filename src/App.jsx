import { useState, useRef, useCallback, useEffect } from "react";

const LIFESTYLES = ["Vegan", "Vegetarian", "Keto", "Gluten-Free", "Dairy-Free", "Omnivore"];
const ALLERGIES  = ["Nuts", "Shellfish", "Dairy", "Eggs", "Soy", "Wheat", "Fish", "Sesame"];

const encode = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(",")[1]);
    r.onerror = () => rej(new Error("Read failed"));
    r.readAsDataURL(file);
  });

async function claudeVision(base64, mediaType, userProfile) {
  const profile = `Lifestyle: ${userProfile.lifestyle.join(", ") || "None"} | Allergies: ${userProfile.allergies.join(", ") || "None"}`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: `Analyse this image. Return ONLY valid JSON (no markdown, no backticks):
{
  "ingredients": ["..."],
  "nonFoodObjects": ["..."],
  "confidence": "high|medium|low",
  "hasNonFood": true|false,
  "error": null
}
Rules: ingredients = edible food items only. nonFoodObjects = non-food items visible. If no food visible set error to "No food detected." User profile: ${profile}` }
        ]
      }]
    })
  });
  const data = await res.json();
  const text = data.content?.map(b => b.text || "").join("");
  try { return JSON.parse(text.replace(/```json|```/g, "").trim()); }
  catch { return { ingredients: [], nonFoodObjects: [], hasNonFood: false, error: "Could not analyse image.", confidence: "low" }; }
}

async function claudeRecipe(ingredients, userProfile) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      messages: [{
        role: "user",
        content: `You are an authentic Jamaican chef. Generate a traditional Jamaican recipe using some or all of these ingredients: ${ingredients.join(", ")}.
User — Lifestyle: ${userProfile.lifestyle.join(", ") || "None"} | Allergies: ${userProfile.allergies.join(", ") || "None"}

Return ONLY valid JSON (no markdown, no backticks):
{
  "recipeName": "...",
  "jamaicanContext": "One sentence on this dish in Jamaican culture",
  "prepTime": "X mins",
  "cookTime": "X mins",
  "servings": 2,
  "difficulty": "Easy|Medium|Hard",
  "usedIngredients": ["..."],
  "additionalIngredients": ["..."],
  "steps": ["Step 1...", "Step 2..."],
  "nutritionNote": "brief note",
  "allergyWarning": "any warnings or None"
}`
      }]
    })
  });
  const data = await res.json();
  const text = data.content?.map(b => b.text || "").join("");
  try { return JSON.parse(text.replace(/```json|```/g, "").trim()); }
  catch { return null; }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function Phone({ children, bg = "#0a0f07" }) {
  return (
    <div style={{ maxWidth: 390, margin: "0 auto", minHeight: "100vh", background: bg, position: "relative", overflow: "hidden", fontFamily: "'Syne', sans-serif" }}>
      {children}
    </div>
  );
}

function StatusBar() {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 22px 0" }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", opacity: 0.8 }}>9:41</span>
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
        {[3,5,7,9].map((h,i) => <div key={i} style={{ width: 3, height: h, background: "#fff", borderRadius: 2, opacity: 0.8 }} />)}
        <div style={{ width: 20, height: 11, border: "1.5px solid rgba(255,255,255,0.7)", borderRadius: 3, marginLeft: 4, position: "relative", display: "flex", alignItems: "center", paddingLeft: 2 }}>
          <div style={{ position: "absolute", right: -4, top: "50%", transform: "translateY(-50%)", width: 3, height: 5, background: "rgba(255,255,255,0.7)", borderRadius: "0 2px 2px 0" }} />
          <div style={{ width: "65%", height: 6, background: "#fff", borderRadius: 1 }} />
        </div>
      </div>
    </div>
  );
}

function Spinner({ label = "Thinking…" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "36px 0" }}>
      <div style={{ width: 40, height: 40, border: "3px solid rgba(255,210,0,0.15)", borderTop: "3px solid #FFD200", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: 0 }}>{label}</p>
    </div>
  );
}

function Pill({ label, active, onClick, accent = "#FFD200" }) {
  return (
    <button onClick={onClick} style={{ padding: "8px 16px", borderRadius: 99, border: `1.5px solid ${active ? accent : "rgba(255,255,255,0.13)"}`, background: active ? accent : "rgba(255,255,255,0.05)", color: active ? "#0a0f07" : "rgba(255,255,255,0.65)", fontSize: 13, fontFamily: "'Syne', sans-serif", fontWeight: active ? 700 : 400, cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" }}>
      {label}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SCREEN 1 — Profile
// ══════════════════════════════════════════════════════════════════════════
function ProfileScreen({ onComplete }) {
  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [lifestyle, setLifestyle] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [step, setStep]           = useState(1);

  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  const canGo  = name.trim() && email.trim();

  const inp = { width: "100%", padding: "15px 16px", background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.11)", borderRadius: 14, color: "#fff", fontFamily: "'Syne', sans-serif", fontSize: 15, outline: "none", boxSizing: "border-box" };

  return (
    <Phone>
      <StatusBar />
      <div style={{ padding: "22px 24px 0", textAlign: "center" }}>
        <div style={{ fontSize: 46, marginBottom: 8 }}>🇯🇲</div>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, color: "#FFD200", margin: 0, lineHeight: 1.1 }}>Ackee & AI</h1>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: "6px 0 0" }}>Authentic Jamaican meal planning</p>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 6, padding: "20px 0 8px" }}>
        {[1,2].map(s => <div key={s} style={{ height: 4, borderRadius: 99, background: s <= step ? "#FFD200" : "rgba(255,255,255,0.1)", width: s === step ? 28 : 14, transition: "all 0.3s" }} />)}
      </div>

      <div style={{ padding: "12px 24px 48px" }}>
        {step === 1 && (
          <>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Your profile</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
              <input value={name}  onChange={e => setName(e.target.value)}  placeholder="Your name"      style={inp} />
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address"  type="email" style={inp} />
            </div>
            <button onClick={() => canGo && setStep(2)} disabled={!canGo} style={{ width: "100%", padding: "16px", borderRadius: 14, background: canGo ? "#FFD200" : "rgba(255,210,0,0.18)", color: canGo ? "#0a0f07" : "rgba(255,255,255,0.25)", border: "none", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, cursor: canGo ? "pointer" : "default" }}>
              Continue
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Dietary lifestyle</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 26 }}>
              {LIFESTYLES.map(l => <Pill key={l} label={l} active={lifestyle.includes(l)} onClick={() => toggle(lifestyle, setLifestyle, l)} />)}
            </div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Allergies</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32 }}>
              {ALLERGIES.map(a => <Pill key={a} label={a} active={allergies.includes(a)} onClick={() => toggle(allergies, setAllergies, a)} accent="#FF6B35" />)}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: "15px", borderRadius: 14, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", border: "1.5px solid rgba(255,255,255,0.1)", fontFamily: "'Syne', sans-serif", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>Back</button>
              <button onClick={() => onComplete({ name, email, lifestyle, allergies })} style={{ flex: 2, padding: "15px", borderRadius: 14, background: "#FFD200", color: "#0a0f07", border: "none", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                Enter Kitchen
              </button>
            </div>
          </>
        )}
      </div>
    </Phone>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SCREEN 2 — Camera
// ══════════════════════════════════════════════════════════════════════════
function CameraScreen({ userProfile, onAnalyzed, onBack }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef   = useRef(null);

  const [camActive, setCamActive] = useState(false);
  const [camError,  setCamError]  = useState(null);
  const [snapshot,  setSnapshot]  = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [facing,    setFacing]    = useState("environment");

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCamActive(false);
  };

  const startCamera = useCallback(async (facingMode) => {
    const fm = facingMode || facing;
    setCamError(null);
    setSnapshot(null);
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: fm, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCamActive(true);
    } catch {
      setCamError("Camera unavailable. Use Browse Files below.");
    }
  }, [facing]);

  useEffect(() => { startCamera("environment"); return stopCamera; }, []);

  const flipCamera = async () => {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    await startCamera(next);
  };

  const capture = () => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    const dataUrl = c.toDataURL("image/jpeg", 0.92);
    stopCamera();
    setSnapshot({ dataUrl, base64: dataUrl.split(",")[1], mediaType: "image/jpeg" });
  };

  const handleFile = async (file) => {
    if (!file?.type.startsWith("image/")) { setError("Please select an image."); return; }
    setError(null); stopCamera();
    const b64 = await encode(file);
    setSnapshot({ dataUrl: URL.createObjectURL(file), base64: b64, mediaType: file.type });
  };

  const retake = () => { setSnapshot(null); setError(null); startCamera(); };

  const analyse = async () => {
    setLoading(true); setError(null);
    try {
      const result = await claudeVision(snapshot.base64, snapshot.mediaType, userProfile);
      if (result.error) { setError(result.error); setLoading(false); return; }
      onAnalyzed({ imagePreview: snapshot.dataUrl, ...result });
    } catch { setError("Analysis failed. Please try again."); }
    setLoading(false);
  };

  return (
    <Phone bg="#000">
      <div style={{ position: "relative", width: "100%", height: "100vh" }}>

        {/* ── Video / Snapshot fill ── */}
        <video ref={videoRef} autoPlay playsInline muted
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: snapshot || !camActive ? "none" : "block" }} />

        {snapshot && (
          <img src={snapshot.dataUrl} alt="capture"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}

        {!camActive && !snapshot && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: "#0a0f07" }}>
            <div style={{ fontSize: 52 }}>📷</div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", padding: "0 40px", lineHeight: 1.5 }}>{camError || "Starting camera…"}</p>
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* ── Top overlay ── */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: "linear-gradient(to bottom,rgba(0,0,0,0.7) 0%,transparent 100%)", paddingBottom: 40 }}>
          <StatusBar />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px 0" }}>
            <button onClick={onBack} style={{ width: 38, height: 38, borderRadius: 99, background: "rgba(0,0,0,0.4)", border: "none", color: "#fff", fontSize: 17, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontFamily: "'Fraunces', serif", color: "#FFD200", fontSize: 17, margin: 0, fontWeight: 700 }}>Scan Ingredients</p>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, margin: "2px 0 0" }}>Point at your ingredients</p>
            </div>
            {!snapshot && camActive
              ? <button onClick={flipCamera} style={{ width: 38, height: 38, borderRadius: 99, background: "rgba(0,0,0,0.4)", border: "none", color: "#fff", fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>🔄</button>
              : <div style={{ width: 38 }} />
            }
          </div>
        </div>

        {/* ── Viewfinder brackets ── */}
        {camActive && !snapshot && (() => {
          const size = 210;
          const bLen = 26;
          const corners = [
            { top: 0, left: 0, borderTop: "2.5px solid #FFD200", borderLeft: "2.5px solid #FFD200" },
            { top: 0, right: 0, borderTop: "2.5px solid #FFD200", borderRight: "2.5px solid #FFD200" },
            { bottom: 0, left: 0, borderBottom: "2.5px solid #FFD200", borderLeft: "2.5px solid #FFD200" },
            { bottom: 0, right: 0, borderBottom: "2.5px solid #FFD200", borderRight: "2.5px solid #FFD200" },
          ];
          return (
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-55%)", width: size, height: size }}>
              {corners.map((s, i) => <div key={i} style={{ position: "absolute", width: bLen, height: bLen, ...s }} />)}
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 1, height: 10, background: "rgba(255,210,0,0.5)" }} />
              </div>
            </div>
          );
        })()}

        {/* ── Bottom gradient ── */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 260, background: "linear-gradient(to top,rgba(0,0,0,0.9) 0%,transparent 100%)", pointerEvents: "none" }} />

        {/* ── Controls ── */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 28px 44px" }}>
          {error && (
            <div style={{ marginBottom: 14, padding: "11px 15px", background: "rgba(255,60,50,0.18)", border: "1px solid rgba(255,60,50,0.35)", borderRadius: 12 }}>
              <p style={{ color: "#ff6b5b", fontSize: 13, margin: 0 }}>⚠ {error}</p>
            </div>
          )}

          {loading ? <Spinner label="Identifying ingredients…" /> : snapshot ? (
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={retake} style={{ flex: 1, padding: "15px", borderRadius: 14, background: "rgba(255,255,255,0.1)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.18)", fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Retake</button>
              <button onClick={analyse} style={{ flex: 2, padding: "15px", borderRadius: 14, background: "#FFD200", color: "#0a0f07", border: "none", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Identify →</button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
              {/* Shutter */}
              <button onClick={capture} disabled={!camActive}
                style={{ width: 74, height: 74, borderRadius: "50%", background: camActive ? "#fff" : "rgba(255,255,255,0.2)", border: "5px solid rgba(255,255,255,0.35)", cursor: camActive ? "pointer" : "default", boxShadow: camActive ? "0 0 0 7px rgba(255,255,255,0.1)" : "none", transition: "all 0.15s", flexShrink: 0 }} />
              {/* Browse */}
              <button onClick={() => fileRef.current.click()} style={{ padding: "11px 32px", borderRadius: 12, background: "rgba(255,255,255,0.09)", border: "1.5px solid rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.75)", fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Browse Files
              </button>
            </div>
          )}
        </div>

        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
      </div>
    </Phone>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SCREEN 3 — Ingredients + Recipe
// ══════════════════════════════════════════════════════════════════════════
function RecipeScreen({ userProfile, analysisResult, onBack, onReset }) {
  const [recipe,      setRecipe]      = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [extra,       setExtra]       = useState("");
  const [ingredients, setIngredients] = useState(analysisResult.ingredients || []);

  const addExtra = () => { const t = extra.trim(); if (t && !ingredients.includes(t)) { setIngredients([...ingredients, t]); setExtra(""); } };
  const remove   = v => setIngredients(ingredients.filter(i => i !== v));

  const generate = async () => {
    if (!ingredients.length) return;
    setLoading(true); setError(null);
    try {
      const r = await claudeRecipe(ingredients, userProfile);
      if (!r) throw new Error();
      setRecipe(r);
    } catch { setError("Could not generate recipe. Please try again."); }
    setLoading(false);
  };

  const hasNonFood = analysisResult.hasNonFood && analysisResult.nonFoodObjects?.length > 0;

  if (recipe) return <RecipeCard recipe={recipe} userProfile={userProfile} onReset={onReset} onNew={() => setRecipe(null)} />;

  return (
    <Phone>
      <StatusBar />
      <div style={{ overflowY: "auto", padding: "14px 22px 52px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontFamily: "'Syne', sans-serif", fontSize: 13, padding: 0, marginBottom: 18 }}>← Retake photo</button>

        {analysisResult.imagePreview && (
          <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 22, height: 170 }}>
            <img src={analysisResult.imagePreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}

        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, color: "#FFD200", margin: "0 0 4px" }}>Ingredients Found</h2>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, margin: "0 0 18px" }}>
          Confidence: <span style={{ fontWeight: 700, color: analysisResult.confidence === "high" ? "#6FCF97" : "#F2994A" }}>{analysisResult.confidence}</span> — tap × to remove
        </p>

        {hasNonFood && (
          <div style={{ padding: "12px 14px", background: "rgba(255,200,0,0.08)", border: "1px solid rgba(255,200,0,0.25)", borderRadius: 12, marginBottom: 16, display: "flex", gap: 10 }}>
            <span>⚠️</span>
            <div>
              <p style={{ color: "#FFD200", fontWeight: 700, fontSize: 13, margin: "0 0 2px" }}>Non-food items ignored</p>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, margin: 0 }}>{analysisResult.nonFoodObjects.join(", ")}</p>
            </div>
          </div>
        )}

        {ingredients.length === 0 && (
          <div style={{ padding: "13px 14px", background: "rgba(255,60,50,0.1)", border: "1px solid rgba(255,60,50,0.28)", borderRadius: 12, marginBottom: 16 }}>
            <p style={{ color: "#ff6b5b", fontSize: 13, margin: 0 }}>No food detected. Add ingredients manually below.</p>
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {ingredients.map(ing => (
            <span key={ing} style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 13px", background: "rgba(255,210,0,0.09)", border: "1.5px solid rgba(255,210,0,0.25)", borderRadius: 99, color: "#FFD200", fontSize: 13, fontFamily: "'Syne', sans-serif" }}>
              {ing}
              <button onClick={() => remove(ing)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,210,0,0.4)", fontSize: 16, padding: 0, lineHeight: 1, marginTop: -1 }}>×</button>
            </span>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input value={extra} onChange={e => setExtra(e.target.value)} onKeyDown={e => e.key === "Enter" && addExtra()} placeholder="Add an ingredient…"
            style={{ flex: 1, padding: "12px 14px", background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#fff", fontFamily: "'Syne', sans-serif", fontSize: 14, outline: "none" }} />
          <button onClick={addExtra} style={{ padding: "12px 18px", borderRadius: 12, background: "rgba(255,210,0,0.12)", color: "#FFD200", border: "1.5px solid rgba(255,210,0,0.25)", fontFamily: "'Syne', sans-serif", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>+</button>
        </div>

        {userProfile.allergies.length > 0 && (
          <div style={{ padding: "10px 13px", background: "rgba(255,80,60,0.08)", border: "1px solid rgba(255,80,60,0.22)", borderRadius: 10, marginBottom: 22, fontSize: 12, color: "rgba(255,107,91,0.85)" }}>
            🚫 Avoiding: {userProfile.allergies.join(", ")}
          </div>
        )}

        {loading ? <Spinner label="Crafting your Jamaican recipe…" /> : (
          <>
            <button onClick={generate} disabled={!ingredients.length}
              style={{ width: "100%", padding: "16px", borderRadius: 14, background: ingredients.length ? "#FFD200" : "rgba(255,210,0,0.15)", color: ingredients.length ? "#0a0f07" : "rgba(255,255,255,0.2)", border: "none", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 15, cursor: ingredients.length ? "pointer" : "default" }}>
              Generate Jamaican Recipe ✨
            </button>
            {error && <p style={{ color: "#ff6b5b", fontSize: 13, marginTop: 10 }}>{error}</p>}
          </>
        )}
      </div>
    </Phone>
  );
}

function RecipeCard({ recipe, onReset, onNew }) {
  return (
    <Phone>
      <div style={{ overflowY: "auto", maxHeight: "100vh", paddingBottom: 48 }}>
        {/* Hero */}
        <div style={{ background: "linear-gradient(155deg,#1c3518 0%,#0e2009 100%)", padding: "14px 22px 26px", borderBottom: "1px solid rgba(255,210,0,0.12)" }}>
          <StatusBar />
          <div style={{ marginTop: 14 }}>
            <span style={{ fontSize: 11, color: "#FFD200", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>🇯🇲 Jamaican</span>
            <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 26, color: "#fff", margin: "6px 0 8px", lineHeight: 1.2 }}>{recipe.recipeName}</h2>
            {recipe.jamaicanContext && (
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, margin: "0 0 16px", lineHeight: 1.55, fontStyle: "italic" }}>{recipe.jamaicanContext}</p>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[{ l: "Prep", v: recipe.prepTime }, { l: "Cook", v: recipe.cookTime }, { l: "Serves", v: recipe.servings }, { l: "Level", v: recipe.difficulty }].map(({ l, v }) => (
                <div key={l} style={{ background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: "8px 13px", border: "1px solid rgba(255,255,255,0.09)" }}>
                  <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{l}</p>
                  <p style={{ color: "#FFD200", fontWeight: 700, fontSize: 14, margin: 0 }}>{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: "20px 22px" }}>
          {recipe.allergyWarning && recipe.allergyWarning !== "None" && (
            <div style={{ padding: "11px 13px", background: "rgba(255,60,50,0.09)", border: "1px solid rgba(255,60,50,0.27)", borderRadius: 12, marginBottom: 18, color: "#ff6b5b", fontSize: 13 }}>⚠ {recipe.allergyWarning}</div>
          )}

          <p style={{ color: "#FFD200", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 11px", fontWeight: 700 }}>Ingredients</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
            {(recipe.usedIngredients || []).map(i => <span key={i} style={{ padding: "6px 12px", background: "rgba(255,210,0,0.09)", border: "1px solid rgba(255,210,0,0.22)", borderRadius: 99, fontSize: 12, color: "#FFD200" }}>{i}</span>)}
          </div>
          {recipe.additionalIngredients?.length > 0 && (
            <>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", margin: "12px 0 8px" }}>Also needed</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 22 }}>
                {recipe.additionalIngredients.map(i => <span key={i} style={{ padding: "6px 12px", background: "rgba(255,255,255,0.05)", border: "1px dashed rgba(255,255,255,0.13)", borderRadius: 99, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{i}</span>)}
              </div>
            </>
          )}

          <p style={{ color: "#FFD200", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", margin: "6px 0 14px", fontWeight: 700 }}>Method</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 22 }}>
            {(recipe.steps || []).map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
                <span style={{ minWidth: 25, height: 25, borderRadius: "50%", background: "#FFD200", color: "#0a0f07", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0, marginTop: 2 }}>{i + 1}</span>
                <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 14, lineHeight: 1.65, margin: 0 }}>{s}</p>
              </div>
            ))}
          </div>

          {recipe.nutritionNote && (
            <div style={{ padding: "11px 13px", background: "rgba(111,207,151,0.07)", border: "1px solid rgba(111,207,151,0.18)", borderRadius: 12, marginBottom: 24, color: "#6FCF97", fontSize: 13 }}>🥗 {recipe.nutritionNote}</div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onNew} style={{ flex: 1, padding: "14px", borderRadius: 14, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1.5px solid rgba(255,255,255,0.1)", fontFamily: "'Syne', sans-serif", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>New Recipe</button>
            <button onClick={onReset} style={{ flex: 1, padding: "14px", borderRadius: 14, background: "#FFD200", color: "#0a0f07", border: "none", fontFamily: "'Syne', sans-serif", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>New Photo</button>
          </div>
        </div>
      </div>
    </Phone>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,         setScreen]         = useState("profile");
  const [userProfile,    setUserProfile]    = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,700;1,9..144,400&family=Syne:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
        body{background:#000;}
        input::placeholder{color:rgba(255,255,255,0.28);}
        ::-webkit-scrollbar{display:none;}
      `}</style>

      {screen === "profile" && <ProfileScreen onComplete={p => { setUserProfile(p); setScreen("camera"); }} />}
      {screen === "camera"  && userProfile && <CameraScreen userProfile={userProfile} onBack={() => setScreen("profile")} onAnalyzed={r => { setAnalysisResult(r); setScreen("recipe"); }} />}
      {screen === "recipe"  && userProfile && analysisResult && <RecipeScreen userProfile={userProfile} analysisResult={analysisResult} onBack={() => setScreen("camera")} onReset={() => setScreen("camera")} />}
    </>
  );
}
