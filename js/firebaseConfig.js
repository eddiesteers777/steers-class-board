// ==========================================
// Anchor Board - Firebase web settings (one copy for the whole site)
//
// These values are PUBLIC by design. Every Firebase website ships them to the
// browser, so anyone can read them from the live pages. They name the project;
// they do not unlock it. What protects the data is firestore.rules, plus the
// restrictions on this API key in Google Cloud (allowed websites and allowed APIs).
//
// Real secrets never go in this repo. They live in:
//   - GitHub repository secrets (FIREBASE_TOKEN, CLOUDFLARE_API_TOKEN,
//     GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ALLOWED_EMAIL)
//   - Firebase Functions secrets (ANTHROPIC_API_KEY)
//   - each teacher's own account in Firestore (their YouTube search key)
//
// If this key is ever replaced, change it here and in connector/wrangler.jsonc.
// ==========================================
export const firebaseConfig = {
  apiKey: "AIzaSyA8kAei_AJMU66EePYQyI8nlVJeLes5HLY",
  // Rolled back 2026-10-26: a custom auth domain broke Google sign-in.
  // Start on the default *.firebaseapp.com auth domain.
  authDomain: "steers-class-board.firebaseapp.com",
  projectId: "steers-class-board",
  storageBucket: "steers-class-board.firebasestorage.app",
  messagingSenderId: "997357619072",
  appId: "1:997357619072:web:8e47464df7c4e329fd2365"
  // No measurementId: Google Analytics is OFF for this project.
};
