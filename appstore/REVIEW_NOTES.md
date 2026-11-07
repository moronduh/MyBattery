# MyBattery — App Review Notes
> Paste the "Notes" block into App Store Connect → App Review Information → Notes.
> Put the demo account's email and password in App Store Connect → App Review Information → "Sign-in required" (never in git).
> Give the demo account Pro: Firebase console → Firestore → collection `proGrants` → document ID = its Auth UID → field `pro` (boolean) = true.

## Notes (paste this)
```
MyBattery is an energy-aware task planner. Users set a daily "battery" level and the app adapts their task load.

HOW TO TEST WITHOUT AN ACCOUNT
Tap "Try without an account" on the sign-in screen to use the free parts of the app (tasks, battery, calendar, wellness tools). Guest data stays on the device. Subscribing to Pro requires a free account, because Pro's AI features run on the user's account; in guest mode the paywall's button reads "Create a free account to subscribe".

DEMO ACCOUNT (for AI features, sync, account deletion)
Credentials are in the "Sign-in required" fields above. This account has MyBattery Pro enabled so every Pro feature (AI Coach, AI task breakdown, smart scheduling, analytics) can be tried without a purchase. To see the purchase flow itself, sign up a new free account in the app (email + password, no verification step), then open Settings → "Unlock Pro" — a new account is not Pro, so it shows the real paywall and App Store purchase sheet (sandbox).
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
- [x] App Store Connect → Subscriptions: create group "MyBattery Pro" with `mybattery_monthly` and `mybattery_yearly`; add the 14-day free-trial introductory offer; add localized display names + a review screenshot of the paywall.
- [ ] Attach both subscriptions to the app version being submitted ("In-App Purchases and Subscriptions" section).
- [x] Paid Apps Agreement + tax/banking active.
- [x] Test purchase with a sandbox Apple ID (real prices loaded on device, bypass is OFF).
- [x] App Privacy questionnaire (done earlier) — re-check it matches `ios/App/App/PrivacyInfo.xcprivacy`: Email, User ID, Device ID (push token), Health (mood/energy/PHQ-9/GAD-7), Other User Content (tasks/journal/AI text), Customer Support (feedback). None used for tracking.
- [x] Deploy the updated website (done 2026-10-20) so https://mybatteryapp.com/privacy matches the in-app policy (analytics line removed, AI consent sentence added).
- [x] Privacy Policy URL, Support URL, and info@mybatteryapp.com all load/receive mail.
- [ ] Add the subscription terms block from LISTING.md to the App Description.
- [ ] Create the demo account (email + password sign-up in the app), grant it Pro via `proGrants`, put its credentials in App Store Connect, and confirm it can sign in and delete itself.

## Final submission steps (in order)
1. [ ] Create the demo account in the app, grant it Pro (`proGrants/{uid}` → `pro: true`), and confirm it signs in.
2. [ ] App Store Connect → the version → select build **202611071** (wait until it finishes processing).
3. [ ] "In-App Purchases and Subscriptions" on the version: both subscriptions attached.
4. [ ] App Review Information → Sign-in required: demo email + password.
5. [ ] App Review Information → Notes: paste the "Notes" block above.
6. [ ] App Description: add the MyBattery Pro subscription terms block from LISTING.md (price, auto-renewal, Privacy Policy + Terms links).
7. [ ] Screenshots, subtitle, keywords and age rating present for the version.
8. [ ] Submit for Review.
