#import <Capacitor/CAPBridgedPlugin.h>
#import <Capacitor/CAPPlugin.h>

CAP_PLUGIN(SharedDataPlugin, "SharedData",
    CAP_PLUGIN_METHOD(setEnergyLevel,   CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(setTasks,         CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getPendingTask,   CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(clearPendingTask, CAPPluginReturnPromise);
)
