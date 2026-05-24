import Icon from "./Icon.jsx";

const PRIVACY_CONTENT = [
  {
    heading: "What we collect",
    body: `MyBattery stores the following data in your personal Firebase account:
• Energy levels and battery readings you enter each day
• Tasks you create, including names, buckets, and completion status
• Mood and journal entries
• Mental health screening responses (PHQ-9, GAD-7)
• Notification preferences and schedule
• Anonymous usage analytics (errors, crashes)

Task names and health notes are encrypted on your device before being stored. We cannot read them.`,
  },
  {
    heading: "How we use it",
    body: `Your data is used only to operate the app — to show you your history, generate AI suggestions, and send your scheduled notifications. It is never sold, shared with advertisers, or used to train AI models.

The AI Coach sends your task list and current battery level to Google Gemini to generate responses. Task content reaches Google's servers. If you prefer not to share task details with the AI, do not use the AI Coach feature.`,
  },
  {
    heading: "Data storage & security",
    body: `All data is stored in Google Firebase (Firestore), hosted in the United States (nam5 region). Firebase is SOC 2 Type II certified and GDPR-compliant.

Sensitive fields (task names, journal entries, health notes) are encrypted client-side using AES-GCM-256 with a key derived from your account. Only you can decrypt them.`,
  },
  {
    heading: "Mental health data",
    body: `MyBattery includes mental health screening tools (PHQ-9, GAD-7) and mood tracking. This data is treated with the same encryption and access controls as all other personal data. It is never shared with third parties.

MyBattery is not a medical device. It is not a substitute for professional mental health care. If you are in crisis, please contact a qualified professional or use the emergency resources available in the app's SOS section.`,
  },
  {
    heading: "Notifications",
    body: `If you enable push notifications, your device's FCM token is stored in Firebase to route messages to your device. Notification times are processed on our servers to send reminders at the times you configure. Disabling notifications in Settings removes your token from our servers.`,
  },
  {
    heading: "Your rights",
    body: `You can delete all your data at any time from Settings → Account → Delete My Account. This permanently removes your Firestore documents and Firebase Authentication account.

You can export a copy of your history from Settings → General → Download history.

For questions or requests, contact: privacy@mybatteryapp.com`,
  },
  {
    heading: "Changes",
    body: `We will notify you within the app if this policy changes in a material way. Continued use after notice constitutes acceptance.

Last updated: May 2026`,
  },
];

const TERMS_CONTENT = [
  {
    heading: "What MyBattery is",
    body: `MyBattery is a personal productivity and wellness tracking app designed for people managing variable energy capacity. It helps you plan tasks, track energy, and build sustainable routines.`,
  },
  {
    heading: "What MyBattery is not",
    body: `MyBattery is not a medical device, a clinical tool, or a substitute for professional mental health care or medical advice. The mental health screenings (PHQ-9, GAD-7) are self-administered educational tools — they do not constitute a diagnosis.

If you are experiencing a mental health crisis, please call or text 988 (US) or contact a qualified professional immediately.`,
  },
  {
    heading: "Your account",
    body: `You are responsible for maintaining the security of your account credentials. You must be 13 years or older to use MyBattery. By creating an account, you confirm that the information you provide is accurate.`,
  },
  {
    heading: "Acceptable use",
    body: `You agree not to:
• Attempt to reverse-engineer, exploit, or abuse the service
• Use the AI features to generate harmful content
• Attempt to access other users' data
• Use automated scripts to make excessive API calls`,
  },
  {
    heading: "AI-generated content",
    body: `The AI Coach and schedule generator produce suggestions based on your inputs. These suggestions are not guaranteed to be accurate, complete, or appropriate for your specific situation. Use your own judgment. MyBattery is not liable for decisions made based on AI output.`,
  },
  {
    heading: "Service availability",
    body: `MyBattery is provided as-is. We make reasonable efforts to keep the service available but do not guarantee uptime. The service may change, be interrupted, or be discontinued with notice.`,
  },
  {
    heading: "Limitation of liability",
    body: `To the maximum extent permitted by law, MyBattery and its developers are not liable for any indirect, incidental, or consequential damages arising from your use of the app.`,
  },
  {
    heading: "Contact",
    body: `For questions about these terms: legal@mybatteryapp.com

Last updated: May 2026`,
  },
];

function LegalContent({ sections }) {
  return (
    <div style={{ fontSize: 14, lineHeight: 1.7, color: "var(--ink-soft)" }}>
      {sections.map(s => (
        <div key={s.heading} style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 500, color: "var(--ink)", marginBottom: 6, fontSize: 13 }}>{s.heading}</div>
          <div style={{ whiteSpace: "pre-line" }}>{s.body}</div>
        </div>
      ))}
    </div>
  );
}

export function PrivacyPolicyModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 2000 }}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexShrink: 0 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 400 }}>Privacy Policy</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", padding: 4 }}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          <LegalContent sections={PRIVACY_CONTENT} />
        </div>
      </div>
    </div>
  );
}

export function TermsModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 2000 }}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexShrink: 0 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 400 }}>Terms of Service</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", padding: 4 }}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          <LegalContent sections={TERMS_CONTENT} />
        </div>
      </div>
    </div>
  );
}
