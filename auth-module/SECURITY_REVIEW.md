# Security Review & Threat Analysis

This document provides a comprehensive security review of the Week 13 Auth & Authorization Module, analyzing the implemented defenses, mitigations, and production gaps across the 8 required security dimensions.

---

## 1. Token Storage

- **Risk**: 
  Storing tokens in browser `localStorage` or `sessionStorage` exposes them directly to JavaScript execution. Any Cross-Site Scripting (XSS) vulnerability or malicious third-party dependency can steal the access token or refresh token via `window.localStorage.getItem(...)` and exfiltrate it to an attacker-controlled server.
- **Mitigation Implemented**: 
  - **Access Token**: Kept exclusively in private module-scoped closure memory (`tokenStore.ts`). It is never written to `localStorage`, `sessionStorage`, cookies, or global window objects. When the tab is closed or navigated away, the token is destroyed from memory.
  - **Refresh Token**: Sent and stored strictly in an `httpOnly`, `SameSite=Strict` cookie (`path=/auth`). JavaScript running in the browser has zero access to read this cookie via `document.cookie`.
- **Remaining Gap / Production Considerations**: 
  Memory-stored access tokens do not survive hard page reloads by default, which is mitigated by our initial session restore (`POST /auth/refresh` on application mount). In multi-tab scenarios, tabs don't share memory, so each tab fetches a refreshed access token on initial load.
  In-memory storage and httpOnly cookies reduce token theft but do not make XSS harmless: script running in the page can still call the API as the logged-in user and can call `POST /auth/refresh` (the browser attaches the cookie and the script can set `X-Requested-With`). XSS prevention (escaping, CSP, dependency hygiene) remains the primary defense.

---

## 2. Cross-Site Scripting (XSS)

- **Risk**: 
  If user inputs or server error messages are rendered dynamically without escaping (e.g., using `dangerouslySetInnerHTML` or `innerHTML`), attackers can inject and execute arbitrary JavaScript scripts within the user's session context.
- **Mitigation Implemented**: 
  - Strict code policy forbidding `dangerouslySetInnerHTML`.
  - All dynamic data, error messages, and server error codes are rendered as standard React JSX text nodes, which automatically escape HTML entities.
  - Tokens are never logged to `console.log` or embedded in URL query parameters/fragments (preventing leakage via browser history, referer headers, or server access logs).
- **Remaining Gap / Production Considerations**: 
  Third-party npm packages can introduce supply chain vulnerabilities. Production deployments require automated dependency audits (`npm audit` / Snyk) and strict subresource integrity (SRI) for external scripts.
  In-memory storage and httpOnly cookies reduce token theft but do not make XSS harmless: script running in the page can still call the API as the logged-in user and can call `POST /auth/refresh` (the browser attaches the cookie and the script can set `X-Requested-With`). XSS prevention (escaping, CSP, dependency hygiene) remains the primary defense.

---

## 3. Cross-Site Request Forgery (CSRF)

- **Risk**: 
  Because the refresh token is stored in a cookie, a malicious website visited in another tab could potentially induce the victim's browser to send state-changing requests to `/auth/refresh` or `/auth/logout` with credentials automatically included.
- **Mitigation Implemented**: 
  - **`SameSite=Strict` Cookie Flag**: Prevents the browser from sending the `refreshToken` cookie on any cross-site request, even on top-level navigation links.
  - **Custom Request Header Defense**: The server strictly mandates the custom header `X-Requested-With: XMLHttpRequest` on both `POST /auth/refresh` and `POST /auth/logout`. Standard HTML `<form>` submissions cannot set custom headers. The custom-header defense works together with the CORS lock: a cross-origin request carrying `X-Requested-With` triggers a preflight, and the preflight fails because only `CLIENT_ORIGIN` is allowed.
  - **Scoped Cookie Path**: The cookie is scoped strictly to `path=/auth`, meaning it is never attached to general requests like `/users` or `/dashboard`.
- **Remaining Gap / Production Considerations**: 
  Older legacy browsers with partial `SameSite` compliance rely primarily on the custom header defense. In enterprise multi-subdomain environments, explicit anti-CSRF synchronizer tokens or double-submit cookies can be used if subdomains share cookies.
  `SameSite=Strict` with `path=/auth` requires the frontend and API to be same-site in production (e.g. `app.example.com` and `api.example.com`); on different registrable domains the refresh cookie would not be sent.

---

## 4. Cross-Origin Resource Sharing (CORS)

- **Risk**: 
  Permissive or wildcard CORS configurations (`Access-Control-Allow-Origin: *` with credentials) allow arbitrary external origins to read sensitive authenticated responses and perform unauthorized requests.
- **Mitigation Implemented**: 
  - CORS origin is strictly restricted to `CLIENT_ORIGIN` (configured via server environment variable, defaults to `http://localhost:5173`).
  - `credentials: true` is enabled only for the explicit trusted origin.
  - No wildcard `*` origins are permitted.
  - For non-whitelisted origins the browser blocks the response (and the preflighted request) because the CORS headers do not allow that origin.
  - CORS is enforced only by browsers and does not protect against curl/Postman or server-to-server calls, so server-side authentication and authorization remain the real protection.
- **Remaining Gap / Production Considerations**: 
  If multiple frontends (e.g., web dashboard, mobile web app, admin portal) need access, origin validation should match against an explicit whitelist array rather than reflecting the incoming `Origin` header dynamically.

---

## 5. Content Security Policy (CSP)

- **Risk**: 
  Without CSP, a browser will execute scripts from any domain and allow outgoing network connections (data exfiltration) to arbitrary IP addresses.
- **Mitigation Implemented**: 
  - Note: `helmet()` only sets headers on API responses and does not protect the SPA. No CSP is enforced on the client in development, and the production CSP below is the recommended configuration (not implemented).
- **Production Implementation Requirement**: 
  In production, the web server (Nginx/Cloudflare) or Express backend must enforce the following HTTP response header:
  ```http
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.yourdomain.com; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';
  ```

---

## 6. Environment Variables and Frontend Secrets

- **Risk**: 
  Leaking JWT secrets, database connection credentials, or private API keys into client-side bundles allows anyone inspecting the browser bundle to forge admin tokens or access the database directly.
- **Mitigation Implemented**: 
  - **Zero Secrets on Client**: The client `.env` contains strictly non-sensitive configuration (`VITE_API_URL=http://localhost:4000`). No signing keys, private keys, or database credentials exist on the frontend.
  - **Server Secrets**: Signing keys (`ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`) and database credentials (`MONGODB_URI`) are read strictly from backend process environment variables.
  - **Fail-Fast Validation**: The server terminates on boot (`process.exit(1)`) if any required secret or configuration variable is missing.
  - `.gitignore` configured to prevent committing `.env` files into source control.
- **Remaining Gap / Production Considerations**: 
  Production secrets should be injected via a secret manager (e.g., AWS Secrets Manager, HashiCorp Vault, Doppler, or GitHub Secrets) with automated rotation policies.

---

## 7. Refresh Token Rotation and Reuse Detection

- **Risk**: 
  Long-lived refresh tokens can be intercepted or stolen from a compromised device. If an attacker uses a stolen refresh token, they could maintain indefinite access.
- **Mitigation Implemented**: 
  - **One-Time Use Token Rotation**: Every time `POST /auth/refresh` is called, the old refresh token is atomically consumed and deleted (`RefreshToken.findOneAndDelete({ tokenHash })`), and a completely new pair of access and refresh tokens is issued.
  - **Hashed Storage**: Raw refresh tokens are never persisted in the database; only their cryptographic SHA-256 hash (`crypto.createHash('sha256')`) is stored. If the database is breached, attackers cannot use the stored hashes as tokens.
  - **Unique UUID JTI**: Each issued refresh token contains a cryptographically unique `jti` generated via Node's native `crypto.randomUUID()`.
  - **Reuse Detection**: If an incoming refresh token has a valid cryptographic JWT signature but its hash is no longer found in the database (indicating it has already been consumed by an attacker or victim), the server flags an active token replay attack:
    1. Immediately revokes **all** active refresh tokens belonging to that user (`RefreshToken.deleteMany({ userId: payload.sub })`).
    2. Clears the refresh token cookie.
    3. Returns `401 REFRESH_REUSED`.
- **Remaining Gap / Production Considerations**: 
  The single-flight mutex is per browser tab (JS memory). It prevents duplicate refreshes inside one tab and React StrictMode double mounts, but two tabs refreshing at the same instant with the same cookie can still trigger reuse detection and log the user out. Production options: a short server-side grace window, or cross-tab coordination (Web Locks API or BroadcastChannel).

---

## 8. Implementation Notes and Production Gaps

- **Implementation Highlights**:
  - Refresh tokens are stored hashed (SHA-256) in MongoDB with a TTL index (`expiresAt` with `expireAfterSeconds: 0`), guaranteeing automatic database cleanup of expired sessions.
  - Atomic `findOneAndDelete({ tokenHash })` ensures concurrency safety and prevents double-consumption.
  - Client utilizes a single-flight mutex: concurrent 401 API requests await the identical in-flight refresh promise, preventing duplicate refresh attempts and accidental reuse detection triggers during React `StrictMode` development.
- **Known Production Gaps & Recommendations**:
  1. **Rate Limiting & Account Lockout**: Implement IP and account-based rate limiting (e.g., `express-rate-limit`) on `/auth/login` to thwart brute-force password guessing attacks.
  2. **Account Lifecycle**: Add self-service user registration, email verification, password reset flows, and multi-factor authentication (MFA/TOTP).
  3. **Transport Security**: Require HTTPS (`Secure` cookie flag enabled, HSTS headers enforced) in production environments.
  4. **Redis Revocation Cache**: For distributed horizontal scaling across multiple server instances, store active token hashes or revocation blocklists in Redis for sub-millisecond lookups.
  5. **Client-Side Authorization Scope**: Client-side UI permission checks (`<Can>`, `useCan`) are designed solely for user experience (preventing confusing dead ends). All authorization is strictly and authoritatively validated by server middleware (`verifyToken`, `requireRole`).
  6. **Access Token Revocation & Role Latency**: Access tokens cannot be revoked before they expire (up to `ACCESS_TOKEN_TTL`) and the role is embedded in the JWT, so role changes apply only at the next refresh.
  7. **Sliding Session Lifetime**: Each refresh rotation issues a fresh `REFRESH_TOKEN_TTL`, so a session can slide indefinitely while the user is active, and production should enforce an absolute maximum session lifetime.
  8. **Database Access Security**: MongoDB Atlas network access is open to `0.0.0.0/0` for development only; production should allowlist server IPs and use a database user with least privilege scoped to this database.
  9. **Hardcoded Demo Credentials**: Demo credentials are hardcoded in the Login quick-fill buttons and README for demo purposes only and must be removed in production.
  10. **React Router Dependency Advisories**: npm audit reports moderate advisories in react-router 6.x (open redirect via backslash in Link/useNavigate; an SSR-hydration issue that does not apply to this SPA); the app never navigates to user-controlled paths, and the fix needs a planned major upgrade.
