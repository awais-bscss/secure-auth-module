# Week 13 - API Architecture & Frontend Security

Production-style Authentication and Role-Based Authorization (RBAC) Module built with an **Express + TypeScript + MongoDB** backend and a **React 18 + TypeScript + Vite + Tailwind CSS** frontend.

---

## Repository Structure & Documentation Links

- **Security Audit & Threat Analysis**: [SECURITY_REVIEW.md](./auth-module/SECURITY_REVIEW.md)
- **Module Documentation & Setup**: [auth-module/README.md](./auth-module/README.md)
- **Frontend Documentation**: [client/README.md](./auth-module/client/README.md)
- **Backend Service**: [auth-module/server/](./auth-module/server)
- **Frontend Application**: [auth-module/client/](./auth-module/client)

---

## Quickstart

### 1. Server Setup (Backend)
```bash
cd auth-module/server
npm install
cp .env.example .env
# Configure MONGODB_URI in .env (Local MongoDB or MongoDB Atlas)
npm run dev
```
> The Express API runs on: **`http://localhost:4000`**

### 2. Client Setup (Frontend)
```bash
cd auth-module/client
npm install
cp .env.example .env
npm run dev
```
> The React SPA runs on: **`http://localhost:5173`**

---

## Demo Credentials (Auto-Seeded)

The database automatically seeds these 3 accounts on first launch:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@example.com` | `Admin@123` | Full access (`dashboard:view`, `users:read`, `users:delete`) |
| **Manager** | `manager@example.com` | `Manager@123` | View dashboard & read users (`dashboard:view`, `users:read`) |
| **Viewer** | `viewer@example.com` | `Viewer@123` | View dashboard only (`dashboard:view`) |

---

## Key Architectural Highlights

1. **Dual-Token System**: Short-lived Access Token in JS memory only (not persisted or readable from browser storage; XSS can still use the session while the page is open) + long-lived Refresh Token in `httpOnly`, `SameSite=Strict`, `path=/auth` cookie.
2. **Atomic Token Rotation & Reuse Detection**: Refresh tokens are stored as SHA-256 hashes in MongoDB with a TTL index. Reusing an already-consumed token triggers instant revocation of all active sessions for that user (`REFRESH_REUSED`).
3. **Single-Flight Refresh Mutex**: Axios response interceptor queues concurrent 401 requests onto a single in-flight refresh promise, preventing race conditions.
4. **CSRF Protection**: Enforces custom header `X-Requested-With: XMLHttpRequest` alongside strict CORS origin locking (`CLIENT_ORIGIN`) for cookie-dependent endpoints.
5. **RBAC & Silent Refresh**: Client automatically restores session on mount and schedules a silent refresh ~30s before access token expiration. Route guards and `<Can>` / `useCan` enforce UI authorization.
