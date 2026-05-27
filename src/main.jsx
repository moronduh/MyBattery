import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "../../mindful-productivity.jsx";
import {
  requestNotificationPermission, onForegroundMessage, getIdToken,
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
} from "./firebase.js";

function Root() {
  const [user, setUser] = useState(undefined); // undefined = checking, null = signed out, object = signed in
  const [redirectError, setRedirectError] = useState(null);

  useEffect(() => {
    const unsub = onAuthChange(setUser);
    // Handle Google redirect sign-in result (signInWithRedirect flow).
    // getRedirectResult resolves null when there's no pending redirect,
    // or rejects with a Firebase error (e.g. auth/unauthorized-domain).
    handleGoogleRedirect().catch(err => {
      console.error("[Auth] Google redirect error:", err.code, err.message);
      setRedirectError(friendlyAuthError(err.code) || err.message);
    });
    // Fallback: if auth state hasn't resolved in 5s, treat as signed out
    const timeout = setTimeout(() => setUser(u => u === undefined ? null : u), 5000);
    return () => { unsub(); clearTimeout(timeout); };
  }, []);

  const firebaseHelpers = {
    requestNotificationPermission,
    onForegroundMessage,
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
    callAI: callAICoach,
    callScheduleGenerator,
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

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
