// Tests for the AES-GCM encryption helpers in src/firebase.js.
// These functions use only Web Crypto (available in Node 22 natively) — no Firebase dependency.
// Import the pure functions directly, mocking out the Firebase module-level side-effects.

import { vi, describe, it, expect, beforeAll } from "vitest";

// Mock Firebase modules so firebase.js can be imported without a real project
vi.mock("firebase/app",       () => ({ initializeApp: vi.fn(), getApps: () => [], getApp: vi.fn() }));
vi.mock("firebase/auth",      () => ({ getAuth: vi.fn(() => ({})), createUserWithEmailAndPassword: vi.fn(), signInWithEmailAndPassword: vi.fn(), signOut: vi.fn(), onAuthStateChanged: vi.fn(), signInWithPopup: vi.fn(), getRedirectResult: vi.fn(() => null), GoogleAuthProvider: vi.fn(), sendPasswordResetEmail: vi.fn(), deleteUser: vi.fn() }));
vi.mock("firebase/firestore", () => ({ getFirestore: vi.fn(() => ({})), doc: vi.fn(), setDoc: vi.fn(), getDoc: vi.fn(), collection: vi.fn(), addDoc: vi.fn(), deleteDoc: vi.fn(), query: vi.fn(), orderBy: vi.fn(), limit: vi.fn(), getDocs: vi.fn(), serverTimestamp: vi.fn(), onSnapshot: vi.fn(), Timestamp: { now: vi.fn() } }));
vi.mock("firebase/functions", () => ({ getFunctions: vi.fn(() => ({})), httpsCallable: vi.fn() }));
vi.mock("firebase/messaging", () => ({ getMessaging: vi.fn(() => ({})), getToken: vi.fn(), onMessage: vi.fn() }));
vi.mock("@capacitor/core",    () => ({ Capacitor: { isNativePlatform: () => false } }));

const { encryptField, decryptField } = await import("../firebase.js");

const UID_A = "user-uid-aaaa-1234";
const UID_B = "user-uid-bbbb-5678";

describe("encryptField", () => {
  it("returns the original value unchanged when text is empty", async () => {
    expect(await encryptField("", UID_A)).toBe("");
  });

  it("returns the original value unchanged when uid is missing", async () => {
    expect(await encryptField("hello", null)).toBe("hello");
    expect(await encryptField("hello", "")).toBe("hello");
  });

  it("returns a base64 string different from the input", async () => {
    const result = await encryptField("Buy milk", UID_A);
    expect(typeof result).toBe("string");
    expect(result).not.toBe("Buy milk");
    // base64 characters only
    expect(result).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it("produces different ciphertext each call (random IV)", async () => {
    const a = await encryptField("Same text", UID_A);
    const b = await encryptField("Same text", UID_A);
    expect(a).not.toBe(b);
  });
});

describe("decryptField", () => {
  it("round-trips correctly", async () => {
    const plain     = "Plan my energy for today";
    const encrypted = await encryptField(plain, UID_A);
    const decrypted = await decryptField(encrypted, UID_A);
    expect(decrypted).toBe(plain);
  });

  it("returns the input unchanged when uid is missing", async () => {
    const encrypted = await encryptField("secret", UID_A);
    expect(await decryptField(encrypted, null)).toBe(encrypted);
    expect(await decryptField(encrypted, "")).toBe(encrypted);
  });

  it("returns the input unchanged for corrupted ciphertext (no crash)", async () => {
    const garbage = "dGhpcyBpcyBub3QgdmFsaWQgY2lwaGVydGV4dA==";
    const result  = await decryptField(garbage, UID_A);
    // should return the input, not throw
    expect(result).toBe(garbage);
  });

  it("returns the input unchanged when decrypting with the wrong uid (wrong key)", async () => {
    const encrypted = await encryptField("private note", UID_A);
    const result    = await decryptField(encrypted, UID_B);
    // wrong key → auth tag mismatch → fallback to returning ciphertext
    expect(result).toBe(encrypted);
    expect(result).not.toBe("private note");
  });

  it("returns plaintext as-is for legacy unencrypted values", async () => {
    // Simulates a task stored before encryption was introduced
    const legacy = "Walk the dog";
    const result = await decryptField(legacy, UID_A);
    // atob("Walk the dog") throws → fallback returns input
    expect(result).toBe(legacy);
  });

  it("handles unicode correctly", async () => {
    const plain     = "今日のタスク 🌿";
    const encrypted = await encryptField(plain, UID_A);
    const decrypted = await decryptField(encrypted, UID_A);
    expect(decrypted).toBe(plain);
  });
});
