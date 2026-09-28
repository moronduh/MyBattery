import UIKit
import Capacitor

class ViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(StoreKitIAPPlugin())
        bridge?.registerPluginInstance(SharedDataPlugin())
    }
}
