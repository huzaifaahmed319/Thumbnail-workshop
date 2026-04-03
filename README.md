# Thumbnail Workshop v2

AI-powered YouTube thumbnail generator using Google Gemini. Generate thumbnails with one click, get 4 style variations, iterate fast.

## Features

- **3 Models**: Nano Banana ($0.039), Nano Banana 2 ($0.067), Nano Banana Pro ($0.134)
- **4 Effects**: Original, Dramatic B&W, Vintage, Military (olive green)
- **Contrast Boost**: Per-card toggle with balanced midtone formula
- **Multiple References**: Up to 3 reference images, drag outputs back as references
- **Text Space**: Left/Right/Center toggle for text overlay composition
- **Resolution**: 1K / 2K toggle
- **API Key Memory**: Saved in browser, enter once
- **Image Zoom**: Double-click any result for fullscreen view
- **Dark/Light Mode**: Sun/Moon toggle, preference saved
- **Dot Grid Background**: Subtle graph paper aesthetic
- **YouTube Ready**: All downloads exactly 1280×720
- **Bring Your Own Key**: Each user provides their own Gemini API key
- **1 API call = 4 variants**: CSS filters create variations for free in your browser

## Deploy to Vercel (5 minutes)

### Step 1: Push to GitHub

1. Create a new repository on [github.com/new](https://github.com/new)
2. Name it `thumbnail-workshop` (or whatever you like)
3. Keep it public or private — your choice
4. Run these commands in your terminal:
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

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New Project"**
3. Import your `thumbnail-workshop` repository
4. Click **Deploy** — no settings to change, Vercel auto-detects Next.js
5. Wait ~60 seconds — you'll get a URL like `thumbnail-workshop.vercel.app`

Done! Your app is live.

## Update Existing Deployment

1. Edit files on GitHub (or re-upload)
2. Vercel auto-redeploys in ~30 seconds
3. Your live site updates automatically

## Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click "Create API Key"
3. Paste it into the app and click "Test"

Free tier gives you ~500 image generations per day.

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
| Colors / theme | CSS variables in `app/globals.css` |
| Max reference images | `MAX_REFS` constant in `app/page.js` |

After making changes, push to GitHub and Vercel auto-redeploys in ~30 seconds.

## What's New in v2

- Redesigned layout — settings left, workspace right
- Dark/Light mode with dot grid background
- API key persists in browser (enter once)
- Double-click any result for fullscreen zoom
- Drag outputs directly into reference slots
- Up to 3 reference images
- New Military effect (olive green tint)
- Balanced boost formula (no more lopsided contrast)
- Plain B&W removed, replaced with Military
