# Khasi Iasoh — Ka Jingkynmaw AI 🌿

> An AI-powered conversational assistant for the Khasi people of Meghalaya, India.  
> Ask questions in **Khasi** or **English** — all replies come in beautiful **Khasi**.

---

## 🌄 Features

- **Beautiful Meghalaya UI** — Lush green hills background, glassmorphism chat panel, Khasi golden diamond motifs
- **Dual Language Input** — Toggle between Khasi and English input modes
- **Smart Translation Pipeline** — Powered by the Advanced F1 NLLB model + Gemini 2.0 Flash
- **Live Pipeline Progress** — See each step of the 3-stage translation pipeline in real time
- **Responsive Design** — Works on mobile, tablet, and desktop
- **Vercel Ready** — Deploy as a static site in one click

---

## 🔄 Translation Pipeline

### Khasi Input Mode (3 steps)
```
User Khasi Text
  ↓  Step 1: Gradio API (Khasi → English)
  ↓  Step 2: Gemini 2.0 Flash (English → English response, max 220 words)
  ↓  Step 3: Gradio API (English → Khasi)
  → Display response in Khasi
```

### English Input Mode (2 steps)
```
User English Text
  ↓  Step 2: Gemini 2.0 Flash (English → English response, max 220 words)
  ↓  Step 3: Gradio API (English → Khasi)
  → Display response in Khasi
```

---

## ⚙️ Configuration

Open `script.js` and update the `CONFIG` object at the top:

```javascript
const CONFIG = {
  GRADIO_URL:   "https://YOUR_GRADIO_LIVE_URL.gradio.live",  // Your Gradio server URL
  GEMINI_KEY:   "YOUR_GEMINI_API_KEY",                        // Google Gemini API key
  GEMINI_MODEL: "gemini-2.0-flash",                           // Free flash model
};
```

### Getting Your Gradio URL

1. Run `advanced_translate_server.py` on your GPU machine
2. Copy the `gradio.live` URL printed in the terminal
3. Paste it into `CONFIG.GRADIO_URL` in `script.js`

### Getting Your Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a free API key
3. Paste it into `CONFIG.GEMINI_KEY` in `script.js`

---

## 🚀 Deploying to Vercel

### Option 1: Vercel Dashboard (GitHub)
1. Push this repo to GitHub
2. Visit [vercel.com](https://vercel.com) → **New Project**
3. Import your GitHub repository
4. Leave all settings as default (it auto-detects as a static site)
5. Click **Deploy**

### Option 2: Vercel CLI
```bash
npm i -g vercel
cd khasi_chatbot
vercel --prod
```

---

## 📁 Project Structure

```
khasi_chatbot/
├── index.html          ← Main chat UI
├── style.css           ← Premium Meghalaya-themed styles
├── script.js           ← AI pipeline + API integration
├── meghalaya_bg.png    ← Background image
├── vercel.json         ← Vercel deployment config
└── README.md           ← This file
```

---

## 🏔️ About the Khasi Language

The Khasi language (Ka Ktien Khasi) is spoken by the indigenous Khasi people of Meghalaya, India — known as "The Abode of Clouds." It is an Austroasiatic language, related to Mon-Khmer languages of Southeast Asia, making it unique in the Indian subcontinent.

This project uses the **Advanced F1** fine-tuned NLLB-200 model, trained specifically on Khasi-English parallel corpora.

---

*Khublei Shibun! — Thank you very much!* 🙏
