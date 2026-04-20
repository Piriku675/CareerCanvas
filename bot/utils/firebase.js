/**
 * utils/firebase.js
 * Initializes Firebase Admin SDK once.
 *
 * Credential lookup order:
 *   1. Render Secret File → /etc/secrets/serviceAccountKey.json
 *   2. FIREBASE_SERVICE_KEY env var (full JSON string — handles whitespace/quotes)
 *   3. Local serviceAccountKey.json in /bot directory (dev only)
 */

const admin = require("firebase-admin");
const path  = require("path");
const fs    = require("fs");

let initialized = false;

function loadServiceAccount() {
  // ── 1. Render Secret File ──────────────────────────────────────────────────
  const secretPath = "/etc/secrets/serviceAccountKey.json";
  if (fs.existsSync(secretPath)) {
    console.log("🔑  Loading Firebase credentials from Secret File:", secretPath);
    try {
      const raw = fs.readFileSync(secretPath, "utf8").trim();
      return JSON.parse(raw);
    } catch (e) {
      console.error("❌  Failed to parse Secret File JSON:", e.message);
      // fall through to next method
    }
  }

  // ── 2. Environment variable ────────────────────────────────────────────────
  const envKey = process.env.FIREBASE_SERVICE_KEY;
  if (envKey && envKey.trim().length > 0) {
    console.log("🔑  Loading Firebase credentials from FIREBASE_SERVICE_KEY env var");
    try {
      // Strip surrounding quotes if the whole value was wrapped (common Render gotcha)
      let cleaned = envKey.trim();
      if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
          (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
        cleaned = cleaned.slice(1, -1);
      }
      // Replace escaped newlines that some platforms inject
      cleaned = cleaned.replace(/\\n/g, "\n");
      return JSON.parse(cleaned);
    } catch (e) {
      console.error("❌  Failed to parse FIREBASE_SERVICE_KEY env var:", e.message);
      console.error("    Make sure the value is valid JSON (no wrapping quotes, no extra escaping).");
      // fall through to next method
    }
  } else {
    console.warn("⚠️   FIREBASE_SERVICE_KEY env var is empty or not set.");
  }

  // ── 3. Local file (development) ────────────────────────────────────────────
  const localPaths = [
    path.join(__dirname, "..", "serviceAccountKey.json"),
    path.join(__dirname, "..", "..", "serviceAccountKey.json"),
    path.join(process.cwd(), "serviceAccountKey.json"),
  ];

  for (const localPath of localPaths) {
    if (fs.existsSync(localPath)) {
      console.log("🔑  Loading Firebase credentials from local file:", localPath);
      try {
        return JSON.parse(fs.readFileSync(localPath, "utf8"));
      } catch (e) {
        console.error("❌  Failed to parse local key file:", localPath, e.message);
      }
    }
  }

  // ── Nothing worked ─────────────────────────────────────────────────────────
  console.error("\n❌  Could not load Firebase credentials. Checked:");
  console.error("      • Secret File:  /etc/secrets/serviceAccountKey.json");
  console.error("      • Env var:      FIREBASE_SERVICE_KEY");
  console.error("      • Local files:  bot/serviceAccountKey.json");
  console.error("\n  On Render: add the key as a Secret File");
  console.error("  Dashboard → Service → Environment → Secret Files");
  console.error("  Filename: serviceAccountKey.json");
  console.error("  Mount path: /etc/secrets/serviceAccountKey.json\n");
  process.exit(1);
}

function initFirebase() {
  if (initialized) return;

  const serviceAccount = loadServiceAccount();

  if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
    console.error("❌  Loaded JSON does not look like a valid Firebase service account.");
    console.error("    Download it from: Firebase Console → Project Settings → Service Accounts → Generate new private key");
    process.exit(1);
  }

  console.log(`✅  Firebase project: ${serviceAccount.project_id}`);

  try {
    admin.initializeApp({
      credential:    admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  } catch (e) {
    if (e.code === "app/duplicate-app") {
      console.warn("⚠️   Firebase already initialized — reusing existing app.");
    } else {
      console.error("❌  Firebase initializeApp failed:", e.message);
      process.exit(1);
    }
  }

  initialized = true;
}

initFirebase();

module.exports = {
  db:      admin.firestore(),
  storage: admin.storage(),
  admin,
};
