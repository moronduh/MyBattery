import { registerPlugin, Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";

export { CapacitorApp };

const SharedData = registerPlugin("SharedData");

const isNative = () => Capacitor.isNativePlatform();

export async function getEnergyLevel() {
  if (!isNative()) return -1;
  try {
    const { level } = await SharedData.getEnergyLevel();
    return level ?? -1;
  } catch {
    return -1;
  }
}

export async function syncEnergyLevel(level) {
  console.log("[SharedData] syncEnergyLevel called, isNative =", isNative(), "level =", level);
  if (!isNative()) return;
  const clamped = Math.round(Math.max(0, Math.min(100, level)));
  try {
    const result = await SharedData.setEnergyLevel({ level: clamped });
    console.log("[SharedData] setEnergyLevel ok", result);
  } catch (err) {
    console.error("[SharedData] setEnergyLevel failed:", err);
  }
}

export async function syncTasks(tasks) {
  if (!isNative()) return;
  const tierMap = { must: "Must", should: "Should", could: "Could" };
  const widgetTasks = (tasks || [])
    .filter(t => !t.done)
    .map(t => ({
      id: String(t.id),
      title: t.name || t.title || "",
      tier: tierMap[t.bucket] ?? "Should",
      estimatedEnergy: Math.abs(t.energyImpact ?? t.estimatedEnergy ?? 10),
    }));
  console.log("[SharedData] syncTasks →", widgetTasks.length, "tasks");
  try {
    await SharedData.setTasks({ tasks: widgetTasks });
    console.log("[SharedData] setTasks ok");
  } catch (err) {
    console.error("[SharedData] setTasks failed:", err);
  }
}

export async function getPendingTask() {
  if (!isNative()) return "";
  try {
    const { title } = await SharedData.getPendingTask();
    return title ?? "";
  } catch {
    return "";
  }
}

export async function clearPendingTask() {
  if (!isNative()) return;
  try {
    await SharedData.clearPendingTask();
  } catch {}
}

export async function getPendingDeepLink() {
  if (!isNative()) return "";
  try {
    const { url } = await SharedData.getPendingDeepLink();
    return url ?? "";
  } catch {
    return "";
  }
}

export async function clearPendingDeepLink() {
  if (!isNative()) return;
  try {
    await SharedData.clearPendingDeepLink();
  } catch {}
}

