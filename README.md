# Thumbnail Workshop

AI-powered YouTube thumbnail generator using Google Gemini's image models. Generate thumbnails with one click and get 4 style variations instantly.

## Features

- **3 Models**: Nano Banana ($0.039), Nano Banana 2 ($0.067), Nano Banana Pro ($0.134)
- **4 Style Variations**: Original, Black & White, Dramatic B&W (high contrast + vignette), Vintage
- **Contrast Boost**: Per-card toggle for micro-contrast + saturation enhancement
- **Reference Image**: Upload a reference photo to guide Gemini's generation
- **Text Space**: Left/Right/Centered toggle — leaves empty space for text overlays
- **Resolution Toggle**: 1K (default) or 2K output
- **API Key Validation**: Test button verifies your key before generating
- **YouTube Ready**: All downloads are exactly 1280×720 pixels
- **Bring Your Own Key**: Each user provides their own Gemini API key
- **1 API call = 4 variants**: CSS filters create variations for free in your browser

## Deploy to Vercel (5 minutes)

### Step 1: Push to GitHub

1. Create a new repo at [github.com/new](https://github.com/new)
2. Name it `thumbnail-workshop`
3. Run:

```bash
cd thumbnail-workshop
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/thumbnail-workshop.git
git push -u origin main
```

### Step 2: Deploy on Vercel

1. Go to [vercel.com](https://vercel.com), sign in with GitHub
2. Click **"Add New Project"**
3. Import your `thumbnail-workshop` repo
4. Click **Deploy** — Vercel auto-detects Next.js
5. Your app is live at `thumbnail-workshop.vercel.app`

## Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click "Create API Key"
3. Paste it into the app and click "Test key"

Free tier: ~500 image generations per day.

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Customization

| What to change | Where |
|---|---|
| Effects / filters | `EFFECTS` array in `app/page.js` |
| Models | `MODELS` array in `app/page.js` |
| Boost intensity | `BOOST_FILTER` constant in `app/page.js` |
| Prompt template | `generate` function in `app/page.js` |
| Styling / theme | `app/globals.css` |

Push changes to GitHub → Vercel auto-redeploys in ~30 seconds.
