# Auth Module - Client Application

Production-style Single Page Application (SPA) built with **React 18**, **TypeScript**, **Vite**, and **Tailwind CSS**, demonstrating secure in-memory session management, Axios single-flight token refresh, and Role-Based Access Control (RBAC).

---

## Technology Stack

- **Framework**: React 18 with TypeScript
- **Bundler & Dev Server**: Vite 6
- **Routing**: React Router v6
- **HTTP Client**: Axios with custom interceptors
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

---

## Getting Started

### 1. Prerequisites
- Node.js v18+ (tested on Node.js v24)
- Running backend server on `http://localhost:4000`

### 2. Installation
```bash
# From the project root or client folder
cd auth-module/client
npm install
```

### 3. Environment Configuration
Create a `.env` file from the example:
```bash
cp .env.example .env
```

Ensure `VITE_API_URL` points to your running backend:
```env
VITE_API_URL=http://localhost:4000
```
> [!NOTE]
> Client environment variables contain **zero secrets**. Only public runtime URLs are configured here.

### 4. Running Locally
```bash
# Start Vite development server
npm run dev
```
The application will be available at: **`http://localhost:5173`**

### 5. Production Build
```bash
# Type-check and bundle production assets
npm run build

# Preview production build locally
npm run preview
```

---

## Architecture & Folder Structure

```
client/src/
├── api/
│   ├── client.ts         # Axios instances, request/response interceptors & single-flight refresh mutex
│   ├── auth.ts           # Authentication API service methods (login, refresh, logout, me, getUsers, deleteUser)
│   ├── tokenStore.ts     # In-memory access token storage (module-scoped variable)
│   └── errors.ts         # Centralized AppError normalization & request cancellation helper
├── auth/
│   ├── AuthProvider.tsx  # Auth context provider, session restore on load & silent refresh scheduler
│   ├── useAuth.ts        # Custom hook for consuming AuthContext
│   ├── permissions.ts    # Role-based permissions matrix & hasPermission validator
│   ├── ProtectedRoute.tsx# Route guard handling loading, unauthenticated, and 403 Forbidden states
│   └── Can.tsx           # <Can> UI wrapper component and useCan hook for authorization
├── pages/
│   ├── Login.tsx         # Responsive login interface with quick-fill demo credentials
│   ├── Dashboard.tsx     # Identity card, assigned permissions, navigation & logout
│   ├── Users.tsx         # User directory with AbortController and RBAC-controlled delete action
│   └── Forbidden.tsx     # 403 Access Denied screen
├── App.tsx               # Client routes configuration
└── main.tsx              # React DOM entry point
```

---

## Key Frontend Security Implementations

### 1. In-Memory Token Storage (`api/tokenStore.ts`)
- The access token is held strictly inside a private module-scoped closure variable.
- It is **never** persisted to `localStorage`, `sessionStorage`, or cookies.
- This design completely eliminates the risk of token extraction via Cross-Site Scripting (XSS).

### 2. Single-Flight Refresh Mutex (`api/client.ts`)
- Handles the race condition where multiple concurrent API calls fail with `401 TOKEN_EXPIRED`.
- Instead of triggering multiple simultaneous refresh requests (which would cause false-positive token reuse alerts), all concurrent 401s await the **exact same in-flight refresh promise**.
- Once refreshed, all queued requests are transparently retried with the new access token.
- Refresh requests are sent via a separate bare Axios client attaching the required custom header: `X-Requested-With: XMLHttpRequest`.

### 3. Automatic Session Restore & Silent Refresh (`auth/AuthProvider.tsx`)
- **Session Restore**: On initial page load/mount, the application issues `POST /auth/refresh` (browser automatically attaches the `httpOnly` cookie) followed by `GET /auth/me` to seamlessly restore user state.
- **Silent Refresh**: Decodes the expiration time (`exp`) from the access token and schedules an automatic background refresh ~30 seconds before expiration, avoiding abrupt session termination for active users.
- **Auto-Logout on Expiry**: If a refresh fails (expired refresh token, revoked session, or token reuse), user state is cleared, and the user is redirected to `/login` with an informative banner.

### 4. Role-Based Access Control (RBAC) UI
- **`<Can permission="...">`**: Conditionally renders UI elements (e.g. hides the "Manage Users" link for `viewer` accounts).
- **`useCan(permission)`**: Returns a boolean allowing action buttons to be disabled with explanatory tooltips (e.g. Delete button in `/users` is disabled for `manager` accounts with tooltip: *"Requires admin permission to delete"*).
- **Route Guard (`<ProtectedRoute>`)**: Verifies required permissions before rendering child routes, redirecting unauthorized users to `/403`.

---

## Demo Test Accounts

The login interface includes **Quick Fill** buttons for immediate testing:

| Role | Email | Password | Allowed Capabilities |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@example.com` | `Admin@123` | Full access (`dashboard:view`, `users:read`, `users:delete`) |
| **Manager** | `manager@example.com` | `Manager@123` | View dashboard & read users (`dashboard:view`, `users:read`) |
| **Viewer** | `viewer@example.com` | `Viewer@123` | View dashboard only (`dashboard:view`) |
