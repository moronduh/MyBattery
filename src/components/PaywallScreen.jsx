import { useState } from "react";
import { Capacitor } from "@capacitor/core";

const PRO_FEATURES = [
  { icon: "✦", label: "AI Coach", desc: "Unlimited multi-turn chat with your energy coach" },
  { icon: "✦", label: "AI Task Breakdown", desc: "Instantly split any task into bite-sized steps" },
  { icon: "✦", label: "Smart Scheduling", desc: "AI plans your day around your energy map" },
  { icon: "✦", label: "Full Journal History", desc: "Every entry, forever — not just the last 30 days" },
  { icon: "✦", label: "Analytics & Patterns", desc: "Weekly energy charts and burnout pattern tracking" },
  { icon: "✦", label: "Recurring Events", desc: "Book repeating activities in your calendar" },
  { icon: "✦", label: "Calendar Export", desc: "Download your schedule as a .ics file" },
];

export default function PaywallScreen({ packages = [], offeringsError, onRetry, onPurchase, onRestore, onClose }) {
  const monthlyPkg = packages.find(p => p.period === "month" || p.productId?.includes("monthly"));
  const annualPkg  = packages.find(p => p.period === "year"  || p.productId?.includes("yearly") || p.productId?.includes("annual"));

  const [selectedPkg, setSelectedPkg] = useState(() => annualPkg ?? packages[0] ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isNative = Capacitor.isNativePlatform();

  async function handlePurchase() {
    if (!selectedPkg || !onPurchase) return;
    setLoading(true);
    setError("");
    try {
      const success = await onPurchase(selectedPkg);
      if (success) { onClose(); return; }
      setError("Purchase could not be completed. Please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore() {
    setLoading(true);
    setError("");
    try {
      const success = await onRestore?.();
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
          <div className="paywall-sub">AI-powered energy management. 14 days free, then just {monthlyPkg?.displayPrice ?? "$6.99"}/mo.</div>
        </div>

        <div className="paywall-features">
          {PRO_FEATURES.map(f => (
            <div key={f.label} className="paywall-feature-row">
              <span className="paywall-feature-icon">✦</span>
              <div>
                <span className="paywall-feature-label">{f.label}</span>
                <span className="paywall-feature-desc"> — {f.desc}</span>
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
                    {annualPkg.displayPrice ?? "$39.99"}<span className="paywall-plan-per"> / yr</span>
                  </div>
                  <div className="paywall-plan-note">~${annualPkg.price ? (annualPkg.price / 12).toFixed(2) : "3.33"}/mo</div>
                </button>
              )}
              {monthlyPkg && (
                <button
                  className={`paywall-plan${selectedPkg === monthlyPkg ? " active" : ""}`}
                  onClick={() => setSelectedPkg(monthlyPkg)}
                >
                  <div className="paywall-plan-name">Monthly</div>
                  <div className="paywall-plan-price">
                    {monthlyPkg.displayPrice ?? "$6.99"}<span className="paywall-plan-per"> / mo</span>
                  </div>
                  <div className="paywall-plan-note">Billed monthly</div>
                </button>
              )}
            </div>

            {error && <div className="paywall-error">{error}</div>}

            <button className="paywall-cta" onClick={handlePurchase} disabled={loading || !selectedPkg}>
              {loading ? "Processing…" : "Start 14-day free trial"}
            </button>

            <div className="paywall-legal">
              Payment charged to your Apple ID after the free trial. Cancel anytime in Settings&nbsp;→&nbsp;Subscriptions.
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
                ? `Couldn't load subscription options. (${offeringsError})`
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
      </div>
    </div>
  );
}
