import Foundation
import Capacitor
import StoreKit

@objc(StoreKitIAPPlugin)
public class StoreKitIAPPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StoreKitIAPPlugin"
    public let jsName = "StoreKitIAP"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchaseProduct", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getActiveSubscriptions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
    ]

    @objc func getProducts(_ call: CAPPluginCall) {
        guard let ids = call.getArray("productIds") as? [String], !ids.isEmpty else {
            call.reject("productIds required")
            return
        }
        Task {
            do {
                let products = try await Product.products(for: Set(ids))
                let result: [[String: Any]] = products.map { p -> [String: Any] in
                    var dict: [String: Any] = [
                        "productId":    p.id,
                        "displayName":  p.displayName,
                        "displayPrice": p.displayPrice,
                        "price":        Double(truncating: p.price as NSDecimalNumber),
                    ]
                    if let sub = p.subscription {
                        switch sub.subscriptionPeriod.unit {
                        case .month: dict["period"] = "month"
                        case .year:  dict["period"] = "year"
                        case .week:  dict["period"] = "week"
                        case .day:   dict["period"] = "day"
                        @unknown default: dict["period"] = "unknown"
                        }
                    }
                    return dict
                }
                call.resolve(["products": result])
            } catch {
                call.reject("getProducts failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func purchaseProduct(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("productId required")
            return
        }
        Task {
            do {
                let products = try await Product.products(for: [productId])
                guard let p = products.first else {
                    call.reject("Product not found: \(productId)")
                    return
                }
                let result = try await p.purchase()
                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let tx):
                        await tx.finish()
                        call.resolve(["success": true, "productId": tx.productID])
                    case .unverified(_, let err):
                        call.reject("Unverified: \(err.localizedDescription)")
                    }
                case .userCancelled:
                    call.reject("cancelled")
                case .pending:
                    call.reject("pending")
                @unknown default:
                    call.reject("unknown")
                }
            } catch {
                call.reject("Purchase failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func getActiveSubscriptions(_ call: CAPPluginCall) {
        Task {
            var active: [String] = []
            for await result in Transaction.currentEntitlements {
                if case .verified(let tx) = result, tx.revocationDate == nil {
                    active.append(tx.productID)
                }
            }
            call.resolve(["activeSubscriptions": active])
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                var active: [String] = []
                for await result in Transaction.currentEntitlements {
                    if case .verified(let tx) = result, tx.revocationDate == nil {
                        active.append(tx.productID)
                    }
                }
                call.resolve(["activeSubscriptions": active])
            } catch {
                call.reject("Restore failed: \(error.localizedDescription)")
            }
        }
    }
}
