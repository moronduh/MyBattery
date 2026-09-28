import { useState, useEffect } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";

const PRODUCT_IDS = ["mybattery_monthly", "mybattery_yearly"];
const BYPASS_PAYWALL = true;

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

export function useSubscription(_userId) {
  const [isPro, setIsPro]         = useState(false);
  const [loading, setLoading]     = useState(true);
  const [packages, setPackages]   = useState([]);
  const [offeringsError, setOfferingsError] = useState(null);

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

  async function purchasePackage(product) {
    const productId = typeof product === "string" ? product : product?.productId;
    if (!productId) return false;
    try {
      const { success } = await StoreKitIAP.purchaseProduct({ productId });
      if (success) {
        setIsPro(true);
        return true;
      }
      return false;
    } catch (e) {
      if (e?.message === "cancelled") return false;
      console.error("[IAP] purchase failed:", e);
      return false;
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
    isPro: BYPASS_PAYWALL ? true : isPro,
    loading: BYPASS_PAYWALL ? false : loading,
    packages: BYPASS_PAYWALL ? [] : packages,
    offeringsError,
    purchasePackage,
    restorePurchases,
    presentCustomerCenter,
    signOut,
  };
}
