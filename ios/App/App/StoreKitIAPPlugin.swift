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

    private var updatesTask: Task<Void, Never>?

    // Finish transactions that complete outside purchaseProduct (Ask to Buy approvals, interrupted
    // purchases, renewals) so they never stay unfinished.
    public override func load() {
        updatesTask = Task.detached {
            for await update in Transaction.updates {
                if case .verified(let tx) = update { await tx.finish() }
            }
        }
    }

    deinit { updatesTask?.cancel() }

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

    // Products are cached so a purchase doesn't depend on a second network round trip.
    private var productCache: [String: Product] = [:]

    private func product(for id: String) async throws -> Product? {
        if let cached = productCache[id] { return cached }
        let fetched = try await Product.products(for: [id])
        if let p = fetched.first { productCache[id] = p }
        return fetched.first
    }

    @MainActor
    private func foregroundScene() -> UIWindowScene? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first
    }

    private func isEntitled(_ productId: String) async -> Bool {
        for await result in Transaction.currentEntitlements {
            if case .verified(let tx) = result, tx.productID == productId, tx.revocationDate == nil {
                return true
            }
        }
        return false
    }

    @objc func purchaseProduct(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("productId required")
            return
        }
        Task {
            do {
                guard let p = try await product(for: productId) else {
                    call.reject("Product not found: \(productId)")
                    return
                }

                // The app runs on the UIScene lifecycle, so tell StoreKit which scene should show the
                // purchase sheet (required on iOS 17+/iPad; a bare purchase() can fail to present).
                let result: Product.PurchaseResult
                if #available(iOS 17.0, *), let scene = await foregroundScene() {
                    result = try await p.purchase(confirmIn: scene)
                } else {
                    result = try await p.purchase()
                }

                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let tx):
                        await tx.finish()
                        call.resolve(["success": true, "productId": tx.productID])
                    case .unverified(let tx, let err):
                        // Apple charged the purchase but local JWS verification failed (can happen in the
                        // sandbox). Finish the transaction so it doesn't loop, and report it clearly.
                        await tx.finish()
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
                // If the purchase actually went through but something threw afterwards, don't tell the
                // user it failed.
                if await isEntitled(productId) {
                    call.resolve(["success": true, "productId": productId])
                } else {
                    call.reject("Purchase failed: \(error.localizedDescription)")
                }
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
