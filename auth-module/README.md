# Auth & Authorization Module (Week 13)

A production-style Authentication and Role-Based Authorization (RBAC) module built with a Node/Express + TypeScript + MongoDB backend and a React + TypeScript + Vite + Tailwind CSS frontend.

---

## 1. What the Project Is

This project demonstrates secure session management, in-memory token storage, atomic refresh token rotation, token reuse detection, and client-side UI authorization coupled with authoritative server-side role enforcement (Admin, Manager, Viewer).

---

## 2. Setup & Installation

### Prerequisites
- Node.js v18+ (tested on Node.js v24)
- A running MongoDB instance:
  - **Local MongoDB**: Ensure `mongod` service is running locally (`mongodb://127.0.0.1:27017/auth-module`).
  - **MongoDB Atlas**: Or provide your MongoDB Atlas connection string in `server/.env`.
  - *Note: On first startup, if the users collection is empty, 3 demo accounts are seeded automatically.*

### Server Setup
```bash
cd server
npm install
cp .env.example .env
# Replace secrets in server/.env with random values using: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# Edit .env if needed (default values connect to local MongoDB or Atlas)
npm run dev
```
The server will start on `http://localhost:4000`.

### Client Setup
```bash
cd client
npm install
cp .env.example .env
npm run dev
```
The client will start on `http://localhost:5173`.

---

## 3. Environment Variables

### Server (`server/.env.example`)
| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `4000` | Port for Express server |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/auth-module` | MongoDB connection string |
| `ACCESS_TOKEN_SECRET` | *(secret string)* | Signing secret for short-lived access JWT |
| `REFRESH_TOKEN_SECRET` | *(secret string)* | Signing secret for refresh JWT |
| `ACCESS_TOKEN_TTL` | `15m` | Lifetime of access token (e.g. `15m`, `30s`) |
| `REFRESH_TOKEN_TTL` | `7d` | Lifetime of refresh token (e.g. `7d`) |

### Client (`client/.env.example`)
| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `http://localhost:4000` | Backend API base URL (no secrets in client env) |

---

## 4. Demo Credentials

The database automatically seeds these 3 accounts on first launch:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@example.com` | `Admin@123` | `dashboard:view`, `users:read`, `users:delete` |
| **Manager** | `manager@example.com` | `Manager@123` | `dashboard:view`, `users:read` |
| **Viewer** | `viewer@example.com` | `Viewer@123` | `dashboard:view` |

*Tip: The login screen features quick-fill buttons for instant testing.*

---

## 5. How to Demo Token Expiry & Silent Refresh

1. Open `server/.env` and update:
   ```env
   ACCESS_TOKEN_TTL=30s
   ```
2. Restart the server (`npm run dev`).
3. Log in through the client UI (`admin@example.com`).
4. Watch the browser network tab:
   - Notice the initial login returns `{ accessToken, user }`.
   - The client decodes `exp` and schedules a silent refresh ~21-25 seconds in.
   - A `POST /auth/refresh` fires automatically in the background without user intervention, rotating the tokens.
   - Automatic logout happens when the refresh fails (refresh token expired, revoked, or reuse detected), displaying the banner: *"Session expired, please log in again"*.

---

## 6. Auth Flow (in 7 Lines)

1. **Session Restore**: On page load, client calls `POST /auth/refresh` (cookie attached) then `GET /auth/me` to seamlessly restore user state.
2. **Login**: Client posts credentials $\rightarrow$ server validates bcrypt hash $\rightarrow$ returns `{ accessToken, user }` and sets `refreshToken` in `httpOnly`, `SameSite=Strict` cookie.
3. **Access**: Access token is held in JS memory only; attached as `Bearer` header on all API requests.
4. **Silent Refresh**: Client schedules a silent refresh ~30s before access token expiry to maintain continuous active session.
5. **Single-Flight Interceptor**: On 401, a single-flight mutex calls `POST /auth/refresh` with `X-Requested-With: XMLHttpRequest` and cookie; concurrent requests queue and await the same call.
6. **Rotation & Replay Defense**: Server atomically deletes old token hash and issues a new pair; if an already-consumed token is re-sent, all user sessions are revoked (`REFRESH_REUSED`).
7. **Retry / Logout**: Intercepted requests are retried with the new access token; if refresh fails (expired/revoked/reused), user state is cleared and redirected to `/login`.

---

## 7. Key Technical Decisions

- **In-Memory Access Tokens**: Zero storage in `localStorage` or `sessionStorage` reduces token exposure: nothing is persisted or readable from browser storage.
- **Hashed Refresh Tokens with TTL Index**: Raw refresh tokens are never persisted; only SHA-256 hashes are stored in MongoDB with `{ expireAfterSeconds: 0 }` for automatic database cleanup.
- **Single-Flight Mutex**: Prevents race conditions and multiple refresh requests during concurrent 401s or React 18 StrictMode double-mounting.
- **CSRF Defense In Depth**: Combines `SameSite=Strict` cookies, `path=/auth` scoping, and mandatory custom header `X-Requested-With: XMLHttpRequest`.
- **RBAC Enforcement**: Client components (`<Can>`, `useCan`) conditionally adapt the UI for UX purposes, while server middleware (`requireRole`) acts as the authoritative gatekeeper.
