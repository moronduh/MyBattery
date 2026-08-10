import Foundation
import Capacitor
import WidgetKit

@objc(SharedDataPlugin)
public class SharedDataPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SharedDataPlugin"
    public let jsName = "SharedData"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setEnergyLevel",       returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getEnergyLevel",       returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setTasks",             returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPendingTask",       returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearPendingTask",     returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPendingDeepLink",   returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearPendingDeepLink", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPendingEnergyLogs", returnType: CAPPluginReturnPromise),
    ]

    private let suite = UserDefaults(suiteName: "group.app.web.mindfulstillflow")

    @objc func setEnergyLevel(_ call: CAPPluginCall) {
        guard let level = call.getInt("level") else {
            call.reject("level is required")
            return
        }
        let clamped = max(0, min(100, level))
        suite?.set(clamped, forKey: "energyLevel")
        suite?.set(Date().timeIntervalSince1970, forKey: "lastUpdated")
        suite?.synchronize()
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve(["level": clamped])
    }

    @objc func getEnergyLevel(_ call: CAPPluginCall) {
        guard suite?.object(forKey: "energyLevel") != nil else {
            call.resolve(["level": -1])
            return
        }
        call.resolve(["level": suite?.integer(forKey: "energyLevel") ?? -1])
    }

    @objc func getPendingTask(_ call: CAPPluginCall) {
        let title = suite?.string(forKey: "pendingTask") ?? ""
        call.resolve(["title": title])
    }

    @objc func clearPendingTask(_ call: CAPPluginCall) {
        suite?.removeObject(forKey: "pendingTask")
        suite?.synchronize()
        call.resolve()
    }

    @objc func getPendingDeepLink(_ call: CAPPluginCall) {
        let url = suite?.string(forKey: "pendingDeepLink") ?? ""
        call.resolve(["url": url])
    }

    @objc func clearPendingDeepLink(_ call: CAPPluginCall) {
        suite?.removeObject(forKey: "pendingDeepLink")
        suite?.synchronize()
        call.resolve()
    }

    // Reads the full pending-logs array and clears it atomically so no race condition
    // can cause the same entries to be processed twice if the app is backgrounded again.
    @objc func getPendingEnergyLogs(_ call: CAPPluginCall) {
        // DIAG-2: confirm the plugin's suite points to the same App Group
        print("[SharedDataPlugin] getPendingEnergyLogs called, suite=\(suite == nil ? "NIL" : "ok")")

        guard let data = suite?.data(forKey: "pendingEnergyLogs") else {
            // DIAG-2: distinguish "key absent" from "suite nil"
            let allKeys = suite?.dictionaryRepresentation().keys.sorted() ?? []
            print("[SharedDataPlugin] pendingEnergyLogs key NOT FOUND. All keys in suite: \(allKeys)")
            call.resolve(["logs": []])
            return
        }

        guard let logs = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            let rawStr = String(data: data, encoding: .utf8) ?? "<binary>"
            print("[SharedDataPlugin] pendingEnergyLogs data found but JSON decode failed. raw=\(rawStr)")
            call.resolve(["logs": []])
            return
        }

        // DIAG-2: print what we're about to return before clearing
        let jsonStr = String(data: data, encoding: .utf8) ?? "<encode error>"
        print("[SharedDataPlugin] pendingEnergyLogs FOUND count=\(logs.count) json=\(jsonStr)")

        suite?.removeObject(forKey: "pendingEnergyLogs")
        suite?.synchronize()
        print("[SharedDataPlugin] pendingEnergyLogs cleared, resolving to JS")
        call.resolve(["logs": logs])
    }

    @objc func setTasks(_ call: CAPPluginCall) {
        guard let tasks = call.getArray("tasks") else {
            call.reject("tasks is required")
            return
        }
        do {
            let data = try JSONSerialization.data(withJSONObject: tasks, options: [])
            suite?.set(data, forKey: "todayTasks")
            suite?.synchronize()
            if #available(iOS 14.0, *) {
                WidgetCenter.shared.reloadAllTimelines()
            }
            call.resolve()
        } catch {
            call.reject("Failed to encode tasks: \(error.localizedDescription)")
        }
    }
}
