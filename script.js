/* ══════════════════════════════════════════════════════════════════
   KHASI IASOH — AI Pipeline Script
   Pipeline:
     Khasi input  →  Gradio (Kha→Eng)  →  Gemini  →  Gradio (Eng→Kha)
     English input →  Gemini  →  Gradio (Eng→Kha)
   ══════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────
   CONFIGURATION — Update these values
   ───────────────────────────────────────── */
const CONFIG = {
  GRADIO_URL:   "https://9fc44640515555505b.gradio.live",  // Your gradio.live URL
  GEMINI_KEY:   "AIzaSyCvcYbOijYKfhNn0j-_m0WPcyPf730IiKo",               // Gemini API key
  GEMINI_MODEL: "gemini-2.0-flash",                         // Free flash model
};

/* ─────────────────────────────────────────
   LOGGING
   ───────────────────────────────────────── */
const log = (tag, ...a) => console.log(
  `%c[${tag}]`, 'color:#d4a017;font-weight:bold;font-size:11px', ...a
);
const err = (tag, ...a) => console.error(
  `%c[${tag}]`, 'color:#e03030;font-weight:bold;font-size:11px', ...a
);

/* ─────────────────────────────────────────
   STATE
   ───────────────────────────────────────── */
let busy              = false;
let inputLang         = 'khasi';   // 'khasi' | 'english'
let geminiHistory     = [];
let workingGradioPath = null;

/* ─────────────────────────────────────────
   DOM REFERENCES
   ───────────────────────────────────────── */
const chatEl         = document.querySelector('.messages');
const welcomeEl      = document.getElementById('welcome');
const typingEl       = document.getElementById('typing');
const inputEl        = document.getElementById('input');
const sendBtn        = document.getElementById('sendBtn');
const dot            = document.getElementById('dot');
const statusLabel    = document.getElementById('statusLabel');
const clearBtn       = document.getElementById('clearBtn');
const btnKhasi       = document.getElementById('btnKhasi');
const btnEnglish     = document.getElementById('btnEnglish');
const inputLangChip  = document.getElementById('inputLangChip');
const pipelineEl     = document.getElementById('pipelineIndicator');
const step1El        = document.getElementById('step1');
const step2El        = document.getElementById('step2');
const step3El        = document.getElementById('step3');

/* ═══════════════════════════════════════════════════
   PARTICLES — ambient floating gold specks
════════════════════════════════════════════════════ */
function spawnParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 4 + 2;
    p.style.cssText = `
      width:${size}px;height:${size}px;
      left:${Math.random()*100}%;
      bottom:${Math.random()*20}%;
      animation-duration:${Math.random()*15+10}s;
      animation-delay:${Math.random()*10}s;
    `;
    container.appendChild(p);
  }
}

/* ═══════════════════════════════════════════════════
   LANGUAGE TOGGLE
════════════════════════════════════════════════════ */
function setInputLanguage(lang) {
  inputLang = lang;

  // Update button states
  btnKhasi.classList.toggle('active',   lang === 'khasi');
  btnEnglish.classList.toggle('active', lang === 'english');
  btnKhasi.setAttribute('aria-pressed',   String(lang === 'khasi'));
  btnEnglish.setAttribute('aria-pressed', String(lang === 'english'));

  // Update chip label
  inputLangChip.textContent = lang === 'khasi' ? 'KHA' : 'ENG';
  inputLangChip.style.background = lang === 'khasi'
    ? 'rgba(34,160,80,0.25)'
    : 'rgba(60,100,180,0.25)';

  // Update placeholder
  inputEl.placeholder = lang === 'khasi'
    ? 'Thoh hajan… (Type in Khasi)'
    : 'Type your question in English…';

  log('LANG', `Input language → ${lang.toUpperCase()}`);
}

btnKhasi.addEventListener('click',   () => setInputLanguage('khasi'));
btnEnglish.addEventListener('click', () => setInputLanguage('english'));

/* ═══════════════════════════════════════════════════
   PIPELINE PROGRESS UI
════════════════════════════════════════════════════ */
function pipelineShow(activeStep, doneSteps = []) {
  pipelineEl.classList.remove('hidden');
  typingEl.classList.add('hidden');

  [step1El, step2El, step3El].forEach((el, i) => {
    const stepNum = i + 1;
    el.classList.remove('active', 'done');
    if (doneSteps.includes(stepNum)) el.classList.add('done');
    else if (stepNum === activeStep)  el.classList.add('active');
  });
}

function pipelineHide() {
  pipelineEl.classList.add('hidden');
  typingEl.classList.add('hidden');
}

/* ═══════════════════════════════════════════════════
   TIMEOUT UTILITY
════════════════════════════════════════════════════ */
function fetchTimeout(url, opts, ms = 35000) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

/* ═══════════════════════════════════════════════════
   GRADIO TRANSLATION API
════════════════════════════════════════════════════ */
async function callGradio(text, direction, beams = 4) {
  const base = CONFIG.GRADIO_URL.replace(/\/+$/, '');
  const body = JSON.stringify({ data: [text, direction, beams] });
  const hdrs = { 'Content-Type': 'application/json' };

  log('GRADIO', `"${text.substring(0, 60)}" | direction: ${direction}`);

  // Use cached working path first
  if (workingGradioPath && workingGradioPath !== 'SSE') {
    try {
      const r = await tryGradioEndpoint(base, workingGradioPath, hdrs, body);
      if (r) return r;
    } catch (_) {
      workingGradioPath = null;
    }
  }

  // Try /run/predict endpoints
  const paths = ['/run/predict', '/api/predict', '/api/translate'];
  for (const p of paths) {
    try {
      const r = await tryGradioEndpoint(base, p, hdrs, body);
      if (r) { workingGradioPath = p; return r; }
    } catch (e) {
      log('GRADIO', `  ✗ ${p}: ${e.message}`);
    }
  }

  // Gradio 4.x SSE fallback
  try {
    log('GRADIO', '  Trying SSE endpoint...');
    const callRes = await fetchTimeout(`${base}/gradio_api/call/translate`, {
      method: 'POST', headers: hdrs, body
    }, 35000);

    if (callRes.ok) {
      const { event_id } = await callRes.json();
      const sseRes = await fetchTimeout(`${base}/gradio_api/call/translate/${event_id}`, {}, 35000);
      const raw    = await sseRes.text();

      for (const line of raw.split('\n')) {
        if (line.startsWith('data: ')) {
          try {
            const d = JSON.parse(line.slice(6));
            if (Array.isArray(d) && d[0]) {
              workingGradioPath = 'SSE';
              log('GRADIO', `✅ SSE: "${d[0]}"`);
              return d[0];
            }
          } catch (_) {}
        }
      }
    }
  } catch (e) {
    log('GRADIO', `  ✗ SSE: ${e.message}`);
  }

  throw new Error('Translation server unreachable. Check GRADIO_URL in script.js.');
}

async function tryGradioEndpoint(base, path, hdrs, body) {
  const res = await fetchTimeout(`${base}${path}`, { method: 'POST', headers: hdrs, body }, 35000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json?.data?.[0]) {
    log('GRADIO', `  ✅ ${path}: "${json.data[0].substring(0, 60)}"`);
    return json.data[0];
  }
  return null;
}

/* ═══════════════════════════════════════════════════
   GEMINI AI
════════════════════════════════════════════════════ */
async function callGemini(englishText) {
  log('GEMINI', `Query: "${englishText.substring(0, 80)}"`);

  const systemPrompt = `You are Khasi Iasoh, a friendly and knowledgeable AI assistant for the Khasi people of Meghalaya, India.
Your responses will be translated into the Khasi language by a machine translation model. Follow these strict rules:

1. RESPONSE LENGTH: Maximum 200-220 words. Be concise but complete.
2. LANGUAGE: Reply ONLY in plain, clear English. Never write Khasi words.
3. SENTENCES: Use SHORT, SIMPLE sentences. Avoid complex grammar.
4. VOCABULARY: Avoid idioms, slang, or culturally-specific references.
5. TONE: Be warm, helpful, respectful, and patient. Use "Ka Iasoh" (the assistant) voice.
6. TOPICS: Be knowledgeable about Meghalaya, Khasi culture, India, education, health, government, and daily life.
7. HONESTY: If you do not know something, say so clearly.
8. FORMAT: Do NOT use bullet points, numbered lists, or markdown. Write in plain paragraphs only — this translates better.

Remember: Every extra word costs translation time. Be precise.`;

  geminiHistory.push({ role: 'user', parts: [{ text: englishText }] });

  const url = `https://generativelanguage.googleapis.com/v1beta/${CONFIG.GEMINI_MODEL}:generateContent?key=${CONFIG.GEMINI_KEY}`;

  const res = await fetchTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: geminiHistory,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: 0.65,
        maxOutputTokens: 280,
        topP: 0.88,
        topK: 40,
      }
    })
  }, 30000);

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    const msg = errData?.error?.message || `Gemini error (HTTP ${res.status})`;
    throw new Error(msg);
  }

  const json  = await res.json();
  const reply = json?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!reply) throw new Error('Gemini returned an empty response. Please try again.');

  log('GEMINI', `✅ Reply (${reply.split(' ').length} words): "${reply.substring(0, 80)}…"`);
  geminiHistory.push({ role: 'model', parts: [{ text: reply }] });
  return reply;
}

/* ═══════════════════════════════════════════════════
   MAIN PIPELINE
════════════════════════════════════════════════════ */
async function handleMessage(userText) {
  if (busy) return;
  busy = true;

  // Hide welcome screen on first message
  if (welcomeEl && welcomeEl.style.display !== 'none') {
    welcomeEl.style.opacity = '0';
    welcomeEl.style.transform = 'scale(0.95)';
    welcomeEl.style.transition = 'all 0.3s ease';
    setTimeout(() => {
      welcomeEl.style.display = 'none';
    }, 300);
  }

  addMsg(userText, 'user');
  scrollDown();

  console.log('\n' + '═'.repeat(70));
  log('PIPELINE', `🚀 START — Input: "${userText.substring(0,60)}" [${inputLang.toUpperCase()}]`);

  try {
    let englishInput;

    // ══ STEP 1: Translate input to English (only if Khasi) ══
    if (inputLang === 'khasi') {
      pipelineShow(1);
      log('PIPELINE', 'Step 1 — Khasi → English (Gradio)');

      try {
        englishInput = await callGradio(userText, 'Khasi → English', 4);
        log('PIPELINE', `Step 1 ✅ English: "${englishInput.substring(0,80)}"`);
      } catch (e) {
        log('PIPELINE', `⚠️ Step 1 failed, using raw text: ${e.message}`);
        englishInput = userText;
      }
      pipelineShow(2, [1]);

    } else {
      // English input — skip Step 1
      englishInput = userText;
      log('PIPELINE', 'Step 1 — Skipped (English input)');
      pipelineShow(2, [1]);
    }

    // ══ STEP 2: Gemini AI ══
    log('PIPELINE', `Step 2 — Gemini AI (English): "${englishInput.substring(0,80)}"`);
    const geminiReply = await callGemini(englishInput);
    log('PIPELINE', `Step 2 ✅ Gemini: "${geminiReply.substring(0,80)}"`);

    // ══ STEP 3: Translate Gemini reply to Khasi ══
    pipelineShow(3, [1, 2]);
    log('PIPELINE', 'Step 3 — English → Khasi (Gradio)');

    let khasiReply;
    try {
      khasiReply = await callGradio(geminiReply, 'English → Khasi', 4);
      log('PIPELINE', `Step 3 ✅ Khasi: "${khasiReply.substring(0,80)}"`);
    } catch (e) {
      err('PIPELINE', `Step 3 failed: ${e.message}`);
      throw new Error('Failed to translate the AI response to Khasi. ' + e.message);
    }

    // ══ DONE ══
    pipelineHide();
    addMsg(khasiReply, 'bot');

    console.table({
      'Input Lang':       inputLang.toUpperCase(),
      'User Input':       userText,
      '→ English':        englishInput,
      '→ Gemini Reply':   geminiReply.substring(0, 120) + '…',
      '→ Khasi Output':   khasiReply,
    });
    log('PIPELINE', '🏁 DONE');

  } catch (e) {
    pipelineHide();
    addError(e.message, userText);
    err('PIPELINE', `❌ FAILED: ${e.message}`);
  }

  console.log('═'.repeat(70) + '\n');
  scrollDown();
  busy = false;
}

/* ═══════════════════════════════════════════════════
   UI HELPERS
════════════════════════════════════════════════════ */
function escHTML(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function fmtTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function addMsg(text, who) {
  const row = document.createElement('div');
  row.className = `msg ${who}`;

  const avatarHTML = `<div class="msg-avatar" aria-hidden="true">${who === 'bot' ? '🌿' : '👤'}</div>`;
  const timeHTML   = `<div class="bubble-time">${fmtTime()}</div>`;

  row.innerHTML = `
    ${avatarHTML}
    <div class="bubble"><p>${escHTML(text)}</p>${timeHTML}</div>`;

  chatEl.appendChild(row);
  scrollDown();
}

function addError(msg, originalText) {
  const row = document.createElement('div');
  row.className = 'msg bot';
  const id = 'retry_' + Date.now();

  row.innerHTML = `
    <div class="msg-avatar" aria-hidden="true">⚠️</div>
    <div class="bubble error-bubble">
      <p>${escHTML(msg)}</p>
      <button class="retry-btn" id="${id}">↻ Try Again</button>
    </div>`;

  chatEl.appendChild(row);
  document.getElementById(id).addEventListener('click', () => {
    row.remove();
    handleMessage(originalText);
  });
  scrollDown();
}

function scrollDown() {
  requestAnimationFrame(() => {
    chatEl.scrollTop = chatEl.scrollHeight;
  });
}

/* ═══════════════════════════════════════════════════
   HEALTH CHECK
════════════════════════════════════════════════════ */
async function checkHealth() {
  log('HEALTH', `Gradio: ${CONFIG.GRADIO_URL}`);
  log('HEALTH', `Gemini: ${CONFIG.GEMINI_MODEL}`);

  if (!CONFIG.GRADIO_URL || CONFIG.GRADIO_URL.includes('xxxxxxxxxx')) {
    setStatus('error', '⚠️ Set GRADIO_URL in script.js');
    return;
  }
  if (!CONFIG.GEMINI_KEY || CONFIG.GEMINI_KEY.includes('YOUR_')) {
    setStatus('error', '⚠️ Set GEMINI_KEY in script.js');
    return;
  }

  setStatus('checking', 'Connecting to servers…');

  try {
    const test = await callGradio('hello', 'English → Khasi', 1);
    log('HEALTH', `✅ Gradio alive → "${test}"`);
    setStatus('ok', 'Online — Ready to chat!');
  } catch (e) {
    err('HEALTH', `Gradio offline: ${e.message}`);
    setStatus('error', 'Translation server offline');
  }
}

function setStatus(state, text) {
  dot.className = 'status-dot' + (state === 'ok' ? ' ok' : state === 'error' ? ' err' : '');
  statusLabel.textContent = text;
}

/* ═══════════════════════════════════════════════════
   EVENT LISTENERS
════════════════════════════════════════════════════ */
sendBtn.addEventListener('click', send);

inputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

inputEl.addEventListener('input', () => {
  // Auto-grow textarea
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  sendBtn.disabled = !inputEl.value.trim() || busy;
});

// Suggestion chips
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const q = chip.dataset.q;
    // Auto-detect language for chips
    const isKhasi = /[a-z]/.test(q) && ['ku','la','ba','ka','ki','phi','ngi','jong'].some(w => q.toLowerCase().includes(w));
    // Chips that look like Khasi get Khasi mode, else English
    if (chip.dataset.q.match(/kumno|phi|ka |ki |ban |mynta/i)) {
      setInputLanguage('khasi');
    } else {
      setInputLanguage('english');
    }
    inputEl.value = q;
    sendBtn.disabled = false;
    send();
  });
});

// Clear chat
clearBtn.addEventListener('click', () => {
  chatEl.innerHTML = '';
  geminiHistory    = [];
  workingGradioPath = null;
  welcomeEl.style.display    = '';
  welcomeEl.style.opacity    = '1';
  welcomeEl.style.transform  = '';
  welcomeEl.style.transition = '';
  busy = false;
  sendBtn.disabled = true;
  inputEl.value = '';
  inputEl.style.height = 'auto';
  pipelineHide();
  log('CLEAR', 'Chat cleared, history reset.');
});

function send() {
  const t = inputEl.value.trim();
  if (!t || busy) return;
  inputEl.value = '';
  inputEl.style.height = 'auto';
  sendBtn.disabled = true;
  handleMessage(t);
}

/* ═══════════════════════════════════════════════════
   BOOT
════════════════════════════════════════════════════ */
log('BOOT', '🌿 Khasi Iasoh AI starting…');
log('BOOT', `Model: ${CONFIG.GEMINI_MODEL} | Gradio: ${CONFIG.GRADIO_URL}`);

spawnParticles();
setInputLanguage('khasi'); // default
checkHealth();