import UIKit
import Capacitor

// iOS 27 requires UIScene lifecycle (the app crashes at launch without it). Capacitor 8 has no
// scene support, so URL and universal-link events that used to reach AppDelegate arrive here
// and are forwarded to Capacitor's ApplicationDelegateProxy.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        // The window and root view controller come from the Main storyboard (UISceneStoryboardFile).

        // Cold launch from a widget URL: store it so JS can pick it up via SharedData.getPendingDeepLink().
        if let url = connectionOptions.urlContexts.first?.url {
            let suite = UserDefaults(suiteName: "group.app.web.mindfulstillflow")
            suite?.set(url.absoluteString, forKey: "pendingDeepLink")
            suite?.synchronize()
        }

        if let activity = connectionOptions.userActivities.first {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: activity, restorationHandler: { _ in })
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for context in URLContexts {
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: context.url, options: [:])
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
    }
}
