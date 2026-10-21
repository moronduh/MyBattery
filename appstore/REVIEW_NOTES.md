# MyBattery — App Review Notes
> Paste the "Notes" block into App Store Connect → App Review Information → Notes.
> Fill in the demo account before submitting (create it in the app, then keep the password here only in App Store Connect, not in git).

## Notes (paste this)
```
MyBattery is an energy-aware task planner. Users set a daily "battery" level and the app adapts their task load.

HOW TO TEST WITHOUT AN ACCOUNT
Tap "Try without an account" on the sign-in screen to use the full app (tasks, battery, calendar, wellness tools). Guest data stays on the device.

DEMO ACCOUNT (for AI features, sync, account deletion)
Email: <demo email>
Password: <set in App Store Connect only>
Sign-in is email + password only. There is no third-party / social login in the iOS app, so Sign in with Apple is not required (Guideline 4.8).

SUBSCRIPTION (Guideline 3.1)
"MyBattery Pro" auto-renewable subscription, monthly ($4.99) and yearly ($29.99), with a 14-day free trial.
Open Settings → "Unlock Pro" (or tap any locked Pro feature) to see the paywall. The paywall shows price, length, auto-renewal terms, Restore Purchases, and links to the Privacy Policy and Terms of Use.
Pro features: AI Coach, AI task breakdown, smart scheduling, full journal history, analytics, recurring events, calendar export.

MENTAL HEALTH CONTENT (Guidelines 1.4.1 and 5.1.3)
- MyBattery is a wellness and productivity tool, not a medical device. It does not diagnose, treat, or claim to treat any condition.
- Optional PHQ-9 and GAD-7 self-screening questionnaires (public-domain instruments) are in Wellness. Before starting, the user must acknowledge that it is an educational self-screening tool, not a clinical diagnosis.
- Results always recommend speaking with a qualified professional. Severe scores, and any answer to PHQ-9 question 9 (thoughts of self-harm), show the 988 Suicide & Crisis Lifeline, Crisis Text Line (text HOME to 741741) and an international crisis directory.
- An SOS button (top right) opens free crisis lines at any time.
- No clinical claims are made in the listing, screenshots, or app.

AI FEATURES (Guideline 5.1.2(i))
AI Coach, task breakdown, brain dump and smart scheduling send task names, battery level and typed text to Google Gemini via our Firebase backend. The app asks for explicit permission ("Share with Google Gemini?") before the first AI request, and the user can decline and keep using the rest of the app.

DATA & DELETION (Guideline 5.1.1(v))
Settings → Account → "Delete My Account" permanently deletes the Firebase Auth account and all stored data (re-enters password to confirm). Settings also has "Delete all my data".

PERMISSIONS
Calendar/Reminders: optional, requested only when the user turns on calendar sync. Camera/Photos: optional, only to attach an image to feedback. Notifications: optional, requested from Settings.
```

## Pre-submission checklist (things only you can do)
- [ ] App Store Connect → Subscriptions: create group "MyBattery Pro" with `mybattery_monthly` and `mybattery_yearly`; add the 14-day free-trial introductory offer; add localized display names + a review screenshot of the paywall.
- [ ] Attach both subscriptions to the app version being submitted ("In-App Purchases and Subscriptions" section).
- [ ] Paid Apps Agreement + tax/banking active.
- [ ] Test purchase + Restore with a sandbox Apple ID on a TestFlight build (paywall bypass is now OFF).
- [ ] App Privacy questionnaire matches `ios/App/App/PrivacyInfo.xcprivacy`: Email, User ID, Device ID (push token), Health (mood/energy/PHQ-9/GAD-7), Other User Content (tasks/journal/AI text), Customer Support (feedback). None used for tracking.
- [ ] Deploy the updated website (`npm run deploy:live`) so https://mindfulstillflow.web.app/privacy matches the in-app policy (analytics line removed, AI consent sentence added).
- [ ] Privacy Policy URL, Support URL, and info@mybatteryapp.com all load/receive mail.
- [ ] Add the subscription terms block from LISTING.md to the App Description.
- [ ] Fill in demo account above; confirm it can sign in and delete itself.
