// Pro access granted by hand (testers, press, friends) via a `proGrants/{uid}` doc.
// Created in the Firebase console only; Firestore rules make the collection read-only for clients.
//   pro:   true            required
//   until: Timestamp|string optional; the grant stops working after this moment
export function isProGrantActive(data, now = Date.now()) {
  if (!data || data.pro !== true) return false;
  if (data.until == null) return true;
  const untilMs = typeof data.until?.toMillis === "function"
    ? data.until.toMillis()
    : new Date(data.until).getTime();
  return Number.isFinite(untilMs) && untilMs > now;
}
