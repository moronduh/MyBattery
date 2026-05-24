# MyBattery — Setup & Deployment Guide

## Prerequisites

- Node.js 22+ (`node --version`)
- Firebase CLI (`npm install -g firebase-tools`)
- A Firebase project with the following services enabled:
  - Authentication (Google + Anonymous providers)
  - Firestore (Native mode, `nam5` region)
  - Cloud Functions (2nd gen)
  - Firebase Hosting
  - Cloud Messaging (FCM)

## Local Development

```bash
# Install dependencies
npm install
cd functions && npm install && cd ..

# Start the dev server (port 5179)
npm run dev
```

The app will be available at `http://localhost:5179`.

The main component lives **outside** the repo at `~/Downloads/mindful-productivity.jsx` and is symlinked into the Vite build. Edits there are picked up by HMR.

## Firebase Setup

### 1. Link the project

```bash
firebase login
firebase use --add   # select your Firebase project
```

### 2. Set the Gemini API key secret

The AI Coach and schedule generator require a Gemini API key stored in Firebase Secret Manager — it is never in source code.

```bash
firebase functions:secrets:set GEMINI_API_KEY
# paste your key when prompted
```

To verify it's set:
```bash
firebase functions:secrets:access GEMINI_API_KEY
```

### 3. Deploy Firestore rules and indexes

```bash
firebase deploy --only firestore
```

## Building & Deploying

```bash
# Full deploy (build + hosting + functions + firestore rules)
npm run deploy

# Deploy only functions (faster after Cloud Function changes)
firebase deploy --only functions

# Deploy only hosting (faster after UI changes)
npm run build && firebase deploy --only hosting
```

CI auto-deploys on merge to `main` via `.github/workflows/firebase-hosting-merge.yml`.

## Environment & Configuration

The Firebase client config (API key, project ID, etc.) is intentionally hardcoded in `src/firebase.js` — Firebase client keys are public by design and safe to commit. Real secrets (Gemini API key) use Firebase Secret Manager.

There is no `.env` file required for local development. The app works against the live Firebase project in dev mode.

## Architecture Notes

- **Client encryption:** Task names and health notes are encrypted client-side with AES-GCM-256 before writing to Firestore. Key is derived from the user's Firebase UID via PBKDF2. See `src/firebase.js` for the full contract.
- **Notifications:** FCM tokens and user prefs are stored in `notifPrefs/{uid}`. The three scheduled Cloud Functions (`sendCheckin`, `sendStillness`, `sendWinddown`) iterate all docs in that collection every minute. Scheduled times are UTC — users in other time zones will receive notifications offset from their local time.
- **Single-tenant assumption:** The app is designed for personal use. Firestore rules scope all data to the authenticated user's UID.

## Rollback

### Hosting
Firebase Hosting keeps a full version history. To roll back:
1. Firebase Console → Hosting → Release history
2. Find the previous release → click the overflow menu → **Roll back**

### Cloud Functions
```bash
git checkout <previous-commit>
firebase deploy --only functions
```

### Firestore Rules
Firebase Console → Firestore → Rules → click the clock icon to view and restore previous rule versions.

### Firestore Data
There is no automated data rollback. Firestore has point-in-time recovery available in the Firebase Console under **Backups** (requires Blaze plan and manual setup).

## Known Limitations

- Notification times are evaluated in UTC. A future improvement would store the user's time zone in `notifPrefs/{uid}` and convert before comparing.
- The app is single-page with one large component (`mindful-productivity.jsx`). No test suite exists yet.
- Firebase project ID is hardcoded — swapping to a production project requires editing `src/firebase.js` and rebuilding.
