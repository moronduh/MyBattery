import { useState } from "react";
import Icon from "./Icon.jsx";
import { Capacitor } from "@capacitor/core";
import { PrivacyPolicyModal, TermsModal } from "./LegalModal.jsx";

const PRO_FEATURES = [
  { icon: "sparkle", label: "AI Coach", desc: "Unlimited multi-turn chat with your energy coach" },
  { icon: "layout", label: "AI Task Breakdown", desc: "Instantly split any task into bite-sized steps" },
  { icon: "bolt", label: "Smart Scheduling", desc: "AI plans your day around your energy map" },
  { icon: "book", label: "Full Journal History", desc: "Every entry, forever — not just the last 30 days" },
  { icon: "chart", label: "Analytics & Patterns", desc: "Weekly energy charts and burnout pattern tracking" },
  { icon: "history", label: "Recurring Events", desc: "Book repeating activities in your calendar" },
  { icon: "calendar", label: "Calendar Export", desc: "Download your schedule as a .ics file" },
];

export default function PaywallScreen({ packages = [], offeringsError, onRetry, onPurchase, onRestore, onClose, needsAccount = false, onCreateAccount }) {
  const monthlyPkg = packages.find(p => p.period === "month" || p.productId?.includes("monthly"));
  const annualPkg  = packages.find(p => p.period === "year"  || p.productId?.includes("yearly") || p.productId?.includes("annual"));

  const [selectedPkg, setSelectedPkg] = useState(() => annualPkg ?? packages[0] ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms,   setShowTerms]   = useState(false);

  const isNative = Capacitor.isNativePlatform();

  async function handlePurchase() {
    if (needsAccount) { onCreateAccount?.(); return; }
    if (!selectedPkg || !onPurchase) return;
    setLoading(true);
    setError("");
    try {
      const res = await onPurchase(selectedPkg);
      if (res?.ok) { onClose(); return; }
      if (res?.reason === "cancelled") return;
      if (res?.reason === "pending") {
        setError("Your purchase is waiting for approval. Pro will unlock as soon as it's approved.");
        return;
      }
      const detail = res?.message ? ` (${res.message.replace(/^Purchase failed:\s*/, "").slice(0, 140)})` : "";
      setError(`Purchase could not be completed${detail}. Please try again.`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore() {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const success = await onRestore?.();
      if (success && needsAccount) {
        setNotice("We found your subscription. Sign in or create a free account to use Pro.");
        return;
      }
      if (success) { onClose(); return; }
      setError("No active subscription found for this Apple ID.");
    } catch {
      setError("Restore failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="paywall-overlay" onClick={onClose}>
      <div className="paywall-sheet" onClick={e => e.stopPropagation()}>
        <button className="paywall-close" onClick={onClose} aria-label="Close">×</button>

        <div className="paywall-header">
          <div className="paywall-eyebrow">MyBattery</div>
          <div className="paywall-title">Unlock Pro</div>
          <div className="paywall-sub">AI-powered energy management. {monthlyPkg?.displayPrice ? `14 days free, then just ${monthlyPkg.displayPrice}/mo.` : "Start with 14 days free."}</div>
        </div>

        <div className="paywall-features">
          {PRO_FEATURES.map(f => (
            <div key={f.label} className="paywall-feature-row">
              <span className="paywall-feature-icon"><Icon name={f.icon} size={16} /></span>
              <div className="paywall-feature-text">
                <span className="paywall-feature-label">{f.label}</span>
                <span className="paywall-feature-desc">{f.desc}</span>
              </div>
            </div>
          ))}
        </div>

        {packages.length > 0 && !offeringsError ? (
          <>
            <div className="paywall-plans">
              {annualPkg && (
                <button
                  className={`paywall-plan${selectedPkg === annualPkg ? " active" : ""}`}
                  onClick={() => setSelectedPkg(annualPkg)}
                >
                  <div className="paywall-plan-badge">Best value</div>
                  <div className="paywall-plan-name">Annual</div>
                  <div className="paywall-plan-price">
                    {annualPkg.displayPrice}<span className="paywall-plan-per"> / yr</span>
                  </div>
                  <div className="paywall-plan-note">Billed yearly</div>
                </button>
              )}
              {monthlyPkg && (
                <button
                  className={`paywall-plan${selectedPkg === monthlyPkg ? " active" : ""}`}
                  onClick={() => setSelectedPkg(monthlyPkg)}
                >
                  <div className="paywall-plan-name">Monthly</div>
                  <div className="paywall-plan-price">
                    {monthlyPkg.displayPrice}<span className="paywall-plan-per"> / mo</span>
                  </div>
                  <div className="paywall-plan-note">Billed monthly</div>
                </button>
              )}
            </div>

            {error && <div className="paywall-error">{error}</div>}
            {notice && <div className="paywall-legal" style={{ marginBottom: 10, textAlign: "center" }}>{notice}</div>}

            {needsAccount && (
              <div className="paywall-legal" style={{ marginBottom: 10, textAlign: "center" }}>
                Pro's AI features run on your account, so you'll need a free account to subscribe. It only takes a moment.
              </div>
            )}

            <button className="paywall-cta" onClick={handlePurchase} disabled={loading || !selectedPkg}>
              {loading ? "Processing…" : needsAccount ? "Create a free account to subscribe" : "Start 14-day free trial"}
            </button>

            <div className="paywall-legal">
              {selectedPkg?.displayPrice ? `${selectedPkg.displayPrice} per ${selectedPkg === annualPkg ? "year" : "month"} after the 14-day free trial. ` : ""}
              Payment is charged to your Apple ID at the end of the trial. The subscription renews automatically unless canceled at least 24 hours before the end of the current period. Manage or cancel anytime in Settings&nbsp;→&nbsp;Apple&nbsp;ID&nbsp;→&nbsp;Subscriptions.
            </div>

            <div className="paywall-footer-links">
              <button className="paywall-restore-btn" onClick={handleRestore} disabled={loading}>
                Restore purchases
              </button>
              <span className="paywall-footer-sep">·</span>
              <button className="paywall-dismiss-btn" onClick={onClose}>No thanks</button>
            </div>
          </>
        ) : (
          <div className="paywall-no-native">
            {!isNative
              ? "Subscriptions are available in the iOS app."
              : offeringsError
                ? "We couldn't load the subscription options right now. Please check your connection and try again."
                : "Loading subscription options…"}
            {isNative && offeringsError && onRetry && (
              <button className="paywall-cta" style={{ marginTop: 20 }} onClick={onRetry}>
                Try again
              </button>
            )}
            {!isNative && (
              <button className="paywall-dismiss-btn" style={{ marginTop: 16, display: "block" }} onClick={onClose}>
                Close
              </button>
            )}
          </div>
        )}

        <div className="paywall-footer-links" style={{ marginTop: 14 }}>
          <button className="paywall-dismiss-btn" onClick={() => setShowPrivacy(true)}>Privacy Policy</button>
          <span className="paywall-footer-sep">·</span>
          <button className="paywall-dismiss-btn" onClick={() => setShowTerms(true)}>Terms of Use</button>
        </div>
      </div>
      {showPrivacy && <PrivacyPolicyModal onClose={() => setShowPrivacy(false)} />}
      {showTerms   && <TermsModal         onClose={() => setShowTerms(false)}   />}
    </div>
  );
}
