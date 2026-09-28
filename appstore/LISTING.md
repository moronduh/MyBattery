# MyBattery — App Store Listing Copy
> Paste each section directly into App Store Connect.

---

## APP NAME
```
MyBattery
```

---

## SUBTITLE (30 chars max — currently 26)
```
Energy-aware task planning
```

---

## PROMOTIONAL TEXT (170 chars max — changeable any time without a new build)
```
Tap your battery anytime to log how you're feeling. Your tasks adjust to match what you actually have today.
```

---

## DESCRIPTION (4,000 chars max)

```
MyBattery is a productivity app built for people with variable energy — whether you're navigating burnout, ADHD, chronic illness, or just want a more honest relationship with your capacity.

Instead of a static to-do list, MyBattery gives you a live energy battery. Set your level each morning, and the app adapts your task load to match what you actually have.

TASK PLANNING THAT WORKS WITH YOUR ENERGY
• Sort tasks into Must Do, Should Do, and Could Do — so your most important work gets your best energy, not your leftovers
• Energy impact scores show which tasks charge you up and which drain you
• Move tasks to tomorrow in one tap when your list gets too heavy
• Subtasks, durations, and due dates — all optional, never overwhelming

TRACK YOUR ENERGY THROUGHOUT THE DAY
• Tap your battery icon anytime to log how you're feeling
• See your top energy drains and recharges over time
• Battery mascot reflects your current level at a glance
• Daily check-in builds awareness of what actually affects your energy

CALENDAR & SCHEDULING
• Hourly day view with peak, dip, and wind-down time blocks
• Power Mode unlocks auto-scheduling and ICS calendar export
• Recurring events and task due dates shown in context

BUILT-IN WELLNESS TOOLS
• Grounding exercises for anxiety spikes (5-4-3-2-1, box breathing, body scan)
• Guided breathwork and cold-water reset
• Pomodoro focus timer to protect deep work
• Private journal with reflective micro-prompts
• PHQ-9 and GAD-7 self-screening tools (educational, not clinical)
• SOS panel with crisis resources including the 988 Lifeline

YOUR DATA, YOUR CONTROL
• All sensitive fields encrypted on your device with AES-GCM-256 before storage
• Works offline — syncs to your private Firebase account when connected
• Guest mode available — try the full app with no account required
• Delete all your data at any time from Settings

DESIGNED FOR HOW YOU ACTUALLY FEEL
MyBattery doesn't assume you have full capacity every day. It's built for people who need to be strategic about energy — not just time.

---
MyBattery is a wellness and productivity tool, not a medical device. It is not a substitute for professional mental health care. If you are in crisis, please call or text 988.
```

---

## KEYWORDS (100 chars max, comma-separated, no spaces)
```
energy,task manager,burnout,ADHD,chronic illness,pacing,wellness,productivity,battery,fatigue
```
*(93 chars)*

---

## SUPPORT URL
```
https://mindfulstillflow.web.app
```
*(Update this to a dedicated support page or email link when available — e.g. https://mindfulstillflow.web.app/support)*

---

## PRIVACY POLICY URL
```
https://mindfulstillflow.web.app/privacy
```

---

## MARKETING URL (optional)
```
https://mindfulstillflow.web.app
```

---

## AGE RATING — What to select in App Store Connect

Go to **App Store Connect → Your App → App Information → Age Rating**.
Click "Edit" and set the following:

| Content Category | Setting |
|---|---|
| Medical/Treatment Information | **Infrequent/Mild** |
| Contests | None |
| Alcohol, Tobacco, or Drug Use | None |
| Gambling | None |
| Sexual Content or Nudity | None |
| Horror/Fear Themes | None |
| Mature/Suggestive Themes | None |
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Prolonged Graphic Violence | None |

**Expected result: 12+**

The PHQ-9/GAD-7 screening tools trigger the "Medical/Treatment Information" flag. Selecting Infrequent/Mild is correct because they are educational self-assessments, not treatment tools. The 988 crisis resource triggers nothing on its own.

---

## PRIMARY CATEGORY
```
Health & Fitness
```

## SECONDARY CATEGORY
```
Productivity
```

---

## APP STORE CONNECT — BUNDLE ID SETUP

1. Go to https://developer.apple.com/account
2. Click **Certificates, Identifiers & Profiles**
3. Click **Identifiers** → **+** (top left)
4. Select **App IDs** → **App** → Continue
5. Fill in:
   - **Description:** MyBattery
   - **Bundle ID:** Explicit → `app.web.mindfulstillflow`
6. Under Capabilities, enable:
   - **Push Notifications**
   - **Sign in with Apple** (if you want to add Apple login later)
7. Click **Continue** → **Register**
8. Back in App Store Connect (https://appstoreconnect.apple.com):
   - Click **My Apps** → **+** → **New App**
   - Platform: iOS
   - Name: MyBattery
   - Primary Language: English (U.S.)
   - Bundle ID: select `app.web.mindfulstillflow`
   - SKU: `mybattery-ios-001` (any unique string)

---

## SCREENSHOTS — REQUIRED SIZES

Apple requires at least **iPhone 6.9"** screenshots (1320 × 2868 px).
The 5 preview screenshots in this folder are reference drafts at 393×852.

**To get final-resolution screenshots:**
1. Open Xcode → Simulator → iPhone 16 Pro Max
2. Run `npx cap sync && npx cap open ios` to open the Xcode project
3. Build & run on the simulator
4. Use **Device → Take Screenshot** (Cmd+S) for each screen
5. Screenshots save to your Desktop at full resolution

**Screens to capture (in this order):**
1. Dashboard — today view with MUST/SHOULD/COULD tabs
2. Log Energy modal — battery tap → slider
3. Calendar — hourly day view
4. Wellness Hub — grounding exercises
5. Settings — customisation options

---

*Generated for MyBattery v0.0.1 · June 2026*
