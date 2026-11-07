import { useState, useEffect } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase.js";
import { isProGrantActive } from "../proGrant.js";

const PRODUCT_IDS = ["mybattery_monthly", "mybattery_yearly"];
const BYPASS_PAYWALL = false;

const StoreKitIAP = registerPlugin("StoreKitIAP", {
  web: () => ({
    getProducts: async () => ({ products: [] }),
    purchaseProduct: async () => { throw new Error("Not available on web"); },
    getActiveSubscriptions: async () => ({ activeSubscriptions: [] }),
    restorePurchases: async () => ({ activeSubscriptions: [] }),
  }),
});

function isActiveProduct(activeSubscriptions) {
  return PRODUCT_IDS.some(id => activeSubscriptions.includes(id));
}

export function useSubscription(userId) {
  const [isPro, setIsPro]         = useState(false);
  const [granted, setGranted]     = useState(false);
  const [loading, setLoading]     = useState(true);
  const [packages, setPackages]   = useState([]);
  const [offeringsError, setOfferingsError] = useState(null);

  // Hand-granted Pro (see proGrant.js). Live-updates, so a grant or revoke applies without a relaunch.
  // A missing doc, a denied read, or being signed out all just mean "not granted".
  useEffect(() => {
    if (!userId) { setGranted(false); return; }
    return onSnapshot(
      doc(db, "proGrants", userId),
      snap => setGranted(snap.exists() && isProGrantActive(snap.data())),
      () => setGranted(false),
    );
  }, [userId]);

  useEffect(() => {
    if (BYPASS_PAYWALL || !Capacitor.isNativePlatform()) { setLoading(false); return; }

    async function init() {
      try {
        const { products } = await StoreKitIAP.getProducts({ productIds: PRODUCT_IDS });
        console.log("[IAP] products:", JSON.stringify(products?.map(p => p.productId)));
        if (!products || products.length === 0) {
          console.warn("[IAP] No products returned — check product IDs in App Store Connect");
          setOfferingsError("no_products");
        } else {
          setPackages(products);
          setOfferingsError(null);
        }
      } catch (e) {
        console.error("[IAP] getProducts failed:", e);
        setOfferingsError(e?.message ?? "fetch_failed");
      }

      try {
        const { activeSubscriptions } = await StoreKitIAP.getActiveSubscriptions();
        console.log("[IAP] active subscriptions:", activeSubscriptions);
        setIsPro(isActiveProduct(activeSubscriptions));
      } catch (e) {
        console.error("[IAP] getActiveSubscriptions failed:", e);
      }

      setLoading(false);
    }

    init();

    // Re-check when app comes back to foreground (e.g. after purchase sheet closes)
    function onFocus() {
      StoreKitIAP.getActiveSubscriptions()
        .then(({ activeSubscriptions }) => setIsPro(isActiveProduct(activeSubscriptions)))
        .catch(() => {});
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Returns { ok: true } on success, otherwise { ok: false, reason, message } so the paywall can say
  // why. reason: "cancelled" | "pending" | "failed".
  async function purchasePackage(product) {
    const productId = typeof product === "string" ? product : product?.productId;
    if (!productId) return { ok: false, reason: "failed", message: "No product selected." };
    // Pro includes AI features that need a signed-in account, so guests can't subscribe.
    if (!userId) return { ok: false, reason: "account", message: "Create a free account to subscribe." };
    try {
      const { success } = await StoreKitIAP.purchaseProduct({ productId });
      if (success) {
        setIsPro(true);
        return { ok: true };
      }
      return { ok: false, reason: "failed", message: "The App Store did not confirm the purchase." };
    } catch (e) {
      const message = String(e?.message ?? e ?? "");
      if (message === "cancelled") return { ok: false, reason: "cancelled" };
      if (message === "pending") return { ok: false, reason: "pending", message };
      console.error("[IAP] purchase failed:", e);
      // The purchase may have gone through even though the call reported an error: re-check.
      try {
        const { activeSubscriptions } = await StoreKitIAP.getActiveSubscriptions();
        if (isActiveProduct(activeSubscriptions)) { setIsPro(true); return { ok: true }; }
      } catch { /* fall through */ }
      return { ok: false, reason: "failed", message };
    }
  }

  async function restorePurchases() {
    try {
      const { activeSubscriptions } = await StoreKitIAP.restorePurchases();
      const pro = isActiveProduct(activeSubscriptions);
      setIsPro(pro);
      return pro;
    } catch (e) {
      console.error("[IAP] restore failed:", e);
      return false;
    }
  }

  async function presentCustomerCenter() {
    try { window.open("https://apps.apple.com/account/subscriptions", "_system"); } catch { /* no-op */ }
  }

  function signOut() { setIsPro(false); }

  return {
    // Pro needs an account (AI features run server-side per user); a guest sees the paywall.
    isPro: BYPASS_PAYWALL || (!!userId && (granted || isPro)),
    loading: BYPASS_PAYWALL ? false : loading,
    packages: BYPASS_PAYWALL ? [] : packages,
    offeringsError,
    purchasePackage,
    restorePurchases,
    presentCustomerCenter,
    signOut,
  };
}
