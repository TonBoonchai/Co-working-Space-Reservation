// Google OAuth 2.0 authorization code flow with PKCE.
// Docs: https://developers.google.com/identity/protocols/oauth2/web-server
//
// The login starts at GET /api/v1/auth/google. The API sends the browser to
// Google. Google sends the browser back to GOOGLE_CALLBACK_URL with a code.
// The API changes the code for an access token, and uses the token to read the
// Google profile (sub, email, email_verified, name).

const crypto = require("crypto");

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

// The client id, the client secret and the callback URL must all be set
exports.isConfigured = () =>
  Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_CALLBACK_URL,
  );

const base64url = (buffer) => buffer.toString("base64url");

// A random state (against CSRF) and a PKCE verifier for one login attempt
exports.createLoginAttempt = () => {
  const state = base64url(crypto.randomBytes(32));
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(
    crypto.createHash("sha256").update(verifier).digest(),
  );

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_CALLBACK_URL,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });

  return { state, verifier, url: `${AUTH_URL}?${params}` };
};

// Compare two strings in constant time
exports.sameString = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

// Change the code for an access token, then read the Google profile.
// Throws when Google rejects a request.
exports.getProfile = async (code, verifier) => {
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      code_verifier: verifier,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_CALLBACK_URL,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Google token request failed (${tokenRes.status})`);
  }
  const { access_token: accessToken } = await tokenRes.json();

  const profileRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!profileRes.ok) {
    throw new Error(`Google profile request failed (${profileRes.status})`);
  }
  return profileRes.json();
};
