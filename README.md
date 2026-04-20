# CareerCanvas

**CareerCanvas** — A dynamic personal portfolio template with a Telegram bot admin panel. Edit every section of your site — projects, experience, skills, colors and more — in real time via chat, no code required. Built with vanilla JS, Firebase Firestore, and Node.js. Deploy the frontend to GitHub Pages and the bot to Render in minutes.

> **Author:** Anthony Kuiau

---

## How It Works

```
frontend/     → GitHub Pages (static site, reads from Firestore)
bot/          → Render (Node.js Telegram bot, writes to Firestore)
firebase/     → Seed script + security rules
```

The frontend has no build step — it's plain HTML, CSS, and a single ES module JS file that fetches all content from Firestore on load. The Telegram bot is the only way to write data, keeping your site secure without a traditional CMS.

---

## Project Structure

```
CareerCanvas/
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       └── app.js               ← Firebase config + all render logic
├── bot/
│   ├── index.js                 ← main bot entry point + command router
│   ├── package.json
│   ├── .env.example
│   ├── commands/
│   │   ├── portfolio.js         ← portfolio section handler
│   │   ├── cv.js                ← experience + skills handler
│   │   └── sections.js          ← hero, about, contact, colors, settings
│   └── utils/
│       ├── firebase.js          ← Admin SDK init (reads Secret File or env var)
│       ├── keyboards.js         ← inline keyboard builders
│       └── state.js             ← multi-step conversation state
├── firebase/
│   ├── seed.js                  ← run once to populate Firestore
│   ├── firestore.rules          ← public read, no client writes
│   └── storage.rules
├── .github/
│   └── workflows/
│       └── deploy.yml           ← GitHub Actions: deploys frontend/ to Pages
└── render.yaml                  ← Render deployment blueprint
```

---

## 1. Firebase Setup

### Create a project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project
3. Enable **Firestore Database** — start in **production mode**
4. No Firebase Storage needed — images use external URLs

### Get your frontend config
- Firebase Console → Project Settings → Your apps → Add app (Web)
- Copy the `firebaseConfig` object
- Open `frontend/js/app.js` and paste your values into the `firebaseConfig` block at the top
- **Do not** add a separate `firebase-config.js` — config lives inside `app.js` only

### Get your service account key (for the bot)
- Firebase Console → Project Settings → Service accounts → **Generate new private key**
- Download `serviceAccountKey.json` — **never commit this file**

### Grant Firestore access to your service account
- Go to [Google Cloud IAM](https://console.cloud.google.com/iam-admin/iam)
- Find the service account email (matches `client_email` in your JSON key)
- Add the role **Firebase Admin** (or **Owner** for simplicity during setup)
- Wait 60 seconds for IAM to propagate before running the seed

### Temporarily open Firestore rules for seeding
Before running seed.js, go to Firebase Console → Firestore → Rules and set:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```
Run the seed, then deploy the real rules (see below).

### Seed the database
```bash
cd bot
npm install
# Place serviceAccountKey.json in the bot/ folder (local only, gitignored)
node ../firebase/seed.js
```

### Deploy security rules
```bash
npm install -g firebase-tools
firebase login
firebase init   # select Firestore only, point rules file to firebase/firestore.rules
firebase deploy --only firestore:rules
```

---

## 2. Telegram Bot Setup

1. Message [@BotFather](https://t.me/BotFather) → `/newbot` → copy the token
2. Get your numeric Telegram user ID from [@userinfobot](https://t.me/userinfobot)

---

## 3. Local Development

```bash
cd bot
cp .env.example .env
# Fill in TELEGRAM_BOT_TOKEN, ADMIN_CHAT_ID, FIREBASE_STORAGE_BUCKET
# Place serviceAccountKey.json in bot/ folder
npm install
npm run dev
```

---

## 4. Deploy Bot to Render

1. Push the full project to GitHub
2. Go to [render.com](https://render.com) → New → **Web Service**
3. Connect your repo, set root directory to `bot/`, build command `npm install`, start command `npm start`

### Environment variables (Render dashboard → Environment):
| Key | Value |
|-----|-------|
| `TELEGRAM_BOT_TOKEN` | from BotFather |
| `ADMIN_CHAT_ID` | your Telegram numeric user ID |
| `FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` |

### Service account as a Secret File:
- Render dashboard → your service → Environment → **Secret Files**
- Filename: `serviceAccountKey.json`
- Mount path: `/etc/secrets/serviceAccountKey.json`
- Paste the full JSON contents

> The bot's `firebase.js` checks for the Secret File first, then the `FIREBASE_SERVICE_KEY` env var, then a local file — in that order.

---

## 5. Deploy Frontend to GitHub Pages

The repo includes a GitHub Actions workflow at `.github/workflows/deploy.yml` that automatically deploys the `frontend/` folder to GitHub Pages on every push to `main`.

1. Push to `main`
2. Go to repo → **Settings → Pages** → Source: **GitHub Actions**
3. The workflow runs automatically — check the **Actions** tab for status
4. Site goes live at `https://yourusername.github.io/repo-name`

> **Important:** Make sure `frontend/js/app.js` has your real Firebase config values before pushing. Do not add a separate `firebase-config.js` — it causes a duplicate import error.

### deploy.yml (must be at `.github/workflows/deploy.yml`):
```yaml
name: Deploy Frontend to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./frontend
      - uses: actions/deploy-pages@v4
```

---

## 6. Using the Bot

Send `/start` or `/menu` to your bot on Telegram.

### Commands
| Command | Action |
|---------|--------|
| `/start` | Open main menu |
| `/menu` | Return to main menu from anywhere |
| `/goto` | Quick-jump keyboard to any section |
| `/cancel` | Cancel current input and return to main menu |

### Main Menu
| Button | What you can manage |
|--------|-------------------|
| 🖼 Portfolio | Add / edit / delete projects, set image URL, set YouTube video, toggle visibility |
| 👤 About | Edit bio, heading, stats, set profile photo URL, remove photo |
| 🦸 Hero | Edit name, tagline, subtitle, CTA buttons, set/remove nav logo image |
| 💼 Experience | Add / edit / delete CV timeline entries |
| 🛠 Skills | Add / remove skill groups and individual skills |
| 📬 Contact | Edit email, CV URL, social media links |
| 🎨 Colors | Edit all 10 color variables including text colors, reset to defaults |
| ⚙️ Settings | Edit site title, meta description, owner name |

### Navigation
Every action has a **⬅️ Back** button to return to the parent section and a **🏠 Main Menu** button to jump back to the top. Use `/goto` at any time to jump directly to any section without pressing back repeatedly.

### Portfolio Projects
- **Images** — paste any external image URL (Imgur, Cloudinary, your own host, etc.)
- **Videos** — paste a YouTube URL and the frontend auto-embeds it as an iframe
- **Visibility** — toggle items hidden or visible without deleting them
- **Categories** — branding / print / digital / identity (filter buttons on site update automatically)

### About Section
- **Profile photo** — paste any external image URL; renders in a styled offset-border frame beside the bio
- **Remove photo** — reverts to the two-column layout without a photo

### Hero / Nav Logo
- **Set nav logo URL** — paste an image URL to replace the text name in the nav with a logo
- **Remove logo** — reverts to showing the text name

---

## 7. Colors

The 🎨 Colors menu has 10 editable variables:

| Variable | Controls |
|----------|---------|
| `paper` | Main background |
| `warm` | Alternate section background |
| `accent` | Highlight color (buttons, dots, underlines) |
| `line` | Borders and dividers |
| `ink` | Headings and primary text |
| `muted` | Labels, nav links, secondary text |
| `heroText` | Hero section name color |
| `navText` | Navigation link color |
| `bodyText` | Body paragraph color |
| `footerText` | Footer text color |

All values are hex (e.g. `#C8441B`). Use **🔄 Reset to defaults** to restore the original palette instantly.

---

## 8. Security

| What | Location | Secret? |
|------|----------|---------|
| Firebase client config | `frontend/js/app.js` (hardcoded) | ❌ Public by design |
| Firebase service account | `/etc/secrets/serviceAccountKey.json` on Render | ✅ Secret File |
| Telegram bot token | Render env var | ✅ Secret |
| Admin chat ID | Render env var | ✅ Secret |

Firestore rules allow public **read** only. All writes go through the bot's Admin SDK which bypasses client rules entirely. The bot rejects all messages from anyone whose Telegram ID doesn't match `ADMIN_CHAT_ID`.

---

## 9. Migrating / Resetting Data

All content lives in Firestore so migrations are straightforward:

```bash
# Export
firebase firestore:export gs://your-bucket/backup/

# Import
firebase firestore:import gs://your-bucket/backup/

# Reset to seed defaults (re-run seed)
node firebase/seed.js
```

The seed data uses a generic placeholder (`Alex Morgan`) — update `firebase/seed.js` with your own content before running it.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS, Firebase JS SDK v10 (CDN) |
| Database | Firebase Firestore |
| Bot | Node.js, node-telegram-bot-api |
| Frontend hosting | GitHub Pages via GitHub Actions |
| Bot hosting | Render (free tier web service) |

---

*Built by Anthony Kuiau*
