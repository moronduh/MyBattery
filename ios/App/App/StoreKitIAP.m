#import <Capacitor/CAPBridgedPlugin.h>
#import <Capacitor/CAPPlugin.h>

CAP_PLUGIN(StoreKitIAPPlugin, "StoreKitIAP",
    CAP_PLUGIN_METHOD(getProducts, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(purchaseProduct, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getActiveSubscriptions, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(restorePurchases, CAPPluginReturnPromise);
)
