import UIKit
import Capacitor
import WidgetKit
import FirebaseCore

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        _ = StoreKitIAPPlugin.self

        // Configure Firebase before its messaging swizzler runs (the push plugin would otherwise do it later)
        if FirebaseApp.app() == nil { FirebaseApp.configure() }

        let suite = UserDefaults(suiteName: "group.app.web.mindfulstillflow")

        // If launched cold from a widget URL, store it so JS can pick it up via SharedData.getPendingDeepLink().
        if let url = launchOptions?[UIApplication.LaunchOptionsKey.url] as? URL {
            suite?.set(url.absoluteString, forKey: "pendingDeepLink")
            suite?.synchronize()
        }

        if #available(iOS 14.0, *) { WidgetCenter.shared.reloadAllTimelines() }

        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}

    func applicationDidEnterBackground(_ application: UIApplication) {}

    func applicationWillEnterForeground(_ application: UIApplication) {}

    // On every foreground, reload widget timelines immediately. The React layer
    // handles the Firebase re-sync and calls SharedDataPlugin to write fresh values,
    // which triggers another reloadAllTimelines — this call just makes widgets
    // feel responsive before the JS round-trip completes.
    func applicationDidBecomeActive(_ application: UIApplication) {
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    func applicationWillTerminate(_ application: UIApplication) {}

    // mybattery:// deep links are forwarded to Capacitor's App plugin,
    // which surfaces them to React via the appUrlOpen listener.
    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    // Push notifications — forward APNs registration to @capacitor-firebase/messaging,
    // which hands the token to Firebase and returns an FCM token to JS.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        NotificationCenter.default.post(name: Notification.Name("didReceiveRemoteNotification"), object: completionHandler, userInfo: userInfo)
    }
}
