# Middleton Painting — Job Board
### PWA · Mobile-Installable · Full-Stack Web App

Post sold painting jobs. Crews bid. You award. Works on any phone like a native app.

---

## 🚀 Deploy Live in 10 Minutes (Free)

### Option A: Railway (Recommended — Easiest)

1. **Create a GitHub account** at github.com if you don't have one
2. **Upload this folder to GitHub:**
   - Go to github.com → click **"New repository"**
   - Name it `brushpass-jobboard` → click **Create**
   - Click **"uploading an existing file"** → drag this entire folder in → click **Commit**
3. **Deploy on Railway:**
   - Go to **railway.app** → Sign up with GitHub
   - Click **"New Project"** → **"Deploy from GitHub repo"**
   - Select `brushpass-jobboard`
   - Railway auto-detects Node.js and deploys in ~60 seconds
   - Click your project → **Settings** → **Domains** → **Generate Domain**
   - ✅ Your live URL appears — share it with crews!

### Option B: Render (Also Free)

1. Upload folder to GitHub (same steps as above)
2. Go to **render.com** → New → **Web Service**
3. Connect your GitHub repo
4. Build command: `npm install`  
   Start command: `node server.js`
5. Click **Create Web Service** → live in ~2 minutes

---

## 📱 How Crews Install It on Their Phone

### iPhone (Safari):
1. Open the app URL in **Safari**
2. Tap the **Share** button (box with arrow)
3. Tap **"Add to Home Screen"**
4. Tap **"Add"**
5. App icon appears on home screen — opens like a native app

### Android (Chrome):
1. Open the app URL in **Chrome**
2. Tap the **three-dot menu** (⋮)
3. Tap **"Add to Home Screen"** or **"Install app"**
4. Tap **"Install"**
5. App icon appears — works offline too

---

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin (Stephen) | stephen@middletonpainting.com | admin123 |
| Crew 1 | crew@profinish.com | crew123 |
| Crew 2 | crew@midsouth.com | crew123 |
| Crew 3 | crew@truecoat.com | crew123 |

---

## Features

**Admin (you):**
- Post closed, scoped, scheduled jobs to the board
- View all bids per job — crew name, company, star rating, amount, note
- Award jobs with one tap
- Approve new contractor accounts
- Stats: open jobs, total bids, awarded, dollar volume
- Remove jobs from the board

**Contractors (crews):**
- Browse and search open jobs
- View full scope of work
- Submit bid with amount and note
- See their own submitted bid status
- Request account (you approve)

**PWA / Mobile:**
- Installable on iPhone and Android home screen
- Works offline (cached shell loads without internet)
- Mobile-optimized layout with bottom navigation
- Full desktop layout on wider screens
- Auto "Add to Home Screen" install prompt

---

## Customizing

Open `server.js` and find the `seed()` function to change:
- Admin email/password
- Pre-loaded demo jobs

Open `public/index.html` and search/replace:
- `#2D4A3E` → your brand color
- `0.12` → your fee percentage (currently 12%)
- `0.70` → crew payout percentage (currently 70%)
- `Middleton Painting` → your company name
- `(901) 352-0202` → your phone number

---

## File Structure

```
brushpass/
├── server.js           ← Express API + auth + all routes
├── package.json
├── railway.toml        ← Railway deployment config
├── render.yaml         ← Render deployment config
├── Procfile            ← Heroku deployment config
├── .gitignore
└── public/
    ├── index.html      ← Full PWA single-page app
    ├── manifest.json   ← PWA install metadata
    ├── sw.js           ← Service worker (offline support)
    ├── icon-192.png    ← App icon (home screen)
    └── icon-512.png    ← App icon (splash screen)
```

---

Built for Middleton Painting · Memphis, TN · (901) 352-0202
