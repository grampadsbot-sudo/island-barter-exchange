# Island Barter Exchange — Deployment Guide

## Option B: GitHub + Vercel Auto-Deploy

### Step 1: Create GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Repository name: `island-barter-exchange`
3. Make it **Public** or **Private** (your choice)
4. **DO NOT** initialize with README (we already have one)
5. Click "Create repository"

### Step 2: Push Local Code to GitHub

Run these commands in your terminal:

```bash
cd ~/.openclaw/workspace/island-barter-redesign

# Add the GitHub remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/island-barter-exchange.git

# Push the code
git branch -M main
git push -u origin main
```

### Step 3: Connect to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Import Git Repository"
3. Select `island-barter-exchange` from the list
4. Vercel auto-detects settings:
   - Framework: **Other** (static HTML)
   - Root Directory: `./`
   - Build Command: (leave empty)
   - Output Directory: `./`
5. Click "Deploy"

### Step 4: Done! 🎉

- **Live URL:** Vercel provides a `.vercel.app` domain
- **Custom Domain:** Add your own in Vercel dashboard
- **Auto-deploy:** Every push to `main` branch auto-deploys

---

## Alternative: Netlify (Even Simpler)

If Vercel setup is too complex:

1. Go to [netlify.com](https://netlify.com)
2. Drag and drop the `island-barter-redesign` folder
3. Site live instantly

---

## Next Steps (After Deploy)

- [ ] Replace placeholder emoji images with real photos
- [ ] Update contact email if needed
- [ ] Test on mobile devices
- [ ] Share URL for feedback

---

## Files in This Repo

| File | Purpose |
|------|---------|
| `index.html` | Main webpage (all sections) |
| `src/style.css` | Responsive styles |
| `src/main.js` | Mobile menu, smooth scroll, FAQ accordion |
| `README.md` | Documentation |

---

Questions? The site is ready to go live!
