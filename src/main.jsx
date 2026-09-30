import React, { useState, useEffect, Component } from "react";
import { Capacitor } from "@capacitor/core";
import ReactDOM from "react-dom/client";
import App from "./mindful-productivity.jsx";
import { useSubscription } from "./hooks/useSubscription.js";
import {
  requestNotificationPermission, onForegroundMessage, getIdToken,
  requestNativePushToken, onNativePushTap,
  createAccount, signIn, signInGoogle, handleGoogleRedirect, signOutUser, resetPassword, onAuthChange, friendlyAuthError,
  saveUserProfile, loadUserData, loadRecentDays,
  saveDailyRecord,
  saveJournalEntry, deleteJournalEntry,
  loadHistory,
  saveFeedback,
  saveCalendarDay,
  subscribeCalendarDay,
  clearUserData,
  deleteAccount,
  saveRecurringEvents,
  subscribeActiveTasks,
  addTaskDoc,
  updateTaskDoc,
  deleteTaskDoc,
  callAICoach,
  callScheduleGenerator,
  callJoinWaitlist,
} from "./firebase.js";

function Root() {
  const [user, setUser] = useState(undefined); // undefined = checking, null = signed out, object = signed in
  const [redirectError, setRedirectError] = useState(null);
  const { isPro, packages, offeringsError, purchasePackage, restorePurchases, presentCustomerCenter, signOut: rcSignOut } = useSubscription(user?.uid);

  useEffect(() => {
    const unsub = onAuthChange(setUser);
    // Handle Google redirect sign-in result (signInWithRedirect flow).
    // getRedirectResult resolves null when there's no pending redirect,
    // or rejects with a Firebase error (e.g. auth/unauthorized-domain).
    // Google redirect only applies on web — on native, gapi isn't available and
    // calling getRedirectResult triggers CORS errors that crash the WebView.
    if (!Capacitor.isNativePlatform()) {
      handleGoogleRedirect().catch(err => {
        // Suppress noise-only codes — these fire on every cold load with no pending redirect
        const silentCodes = [
          "auth/unauthorized-domain",   // localhost / dev domains not in Firebase allowlist
          "auth/cancelled-popup-request",
          "auth/popup-closed-by-user",
          null, undefined,
        ];
        console.error("[Auth] Google redirect error:", err.code, err.message);
        if (!silentCodes.includes(err.code)) {
          setRedirectError(friendlyAuthError(err.code) || err.message);
        }
      });
    }
    // Fallback: if auth state hasn't resolved in 5s, treat as signed out
    const timeout = setTimeout(() => setUser(u => u === undefined ? null : u), 5000);
    return () => { unsub(); clearTimeout(timeout); };
  }, []);

  const firebaseHelpers = {
    requestNotificationPermission,
    onForegroundMessage,
    requestNativePushToken,
    onNativePushTap,
    getIdToken,
    createAccount,
    signIn,
    signInGoogle,
    redirectError,
    signOutUser,
    resetPassword,
    friendlyAuthError,
    saveUserProfile,
    loadUserData,
    loadRecentDays,
    saveDailyRecord,
    saveJournalEntry,
    deleteJournalEntry,
    loadHistory,
    saveFeedback,
    saveCalendarDay,
    subscribeCalendarDay,
    clearUserData,
    deleteAccount,
    saveRecurringEvents,
    subscribeActiveTasks,
    addTaskDoc,
    updateTaskDoc,
    deleteTaskDoc,
    callAI: user ? callAICoach : null,
    callScheduleGenerator: user ? callScheduleGenerator : null,
    callJoinWaitlist,
    isPro,
    packages,
    offeringsError,
    purchasePackage,
    restorePurchases,
    presentCustomerCenter,
    rcSignOut,
  };

  if (user === undefined) {
    return (
      <div style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f7f5",
        fontFamily: "'DM Sans', sans-serif",
        color: "#4a5e4a",
        fontSize: "1rem",
        letterSpacing: "0.02em",
      }}>
        Loading…
      </div>
    );
  }

  return <App user={user} firebaseHelpers={firebaseHelpers} />;
}

// Last-resort boundary: if the whole app crashes while rendering, show the same calm
// fallback as index.html rather than a blank screen.
class RootBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) {
    console.error("RootBoundary caught:", error);
    if (window.showError) window.showError(error?.stack || String(error));
  }
  render() { return this.state.failed ? null : this.props.children; }
}

ReactDOM.createRoot(document.getElementById("root")).render(<RootBoundary><Root /></RootBoundary>);
