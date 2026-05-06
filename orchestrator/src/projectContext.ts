export const projectContext = {
  name: "Whiteboard Capture",
  goal: "Students photograph a whiteboard on mobile and copy the image instantly on web.",
  priorities: [
    "Speed on the mobile -> upload -> web hot path",
    "Security around OAuth, JWT, websocket access, and storage",
    "Stable local testing through run.bat / stop.bat / mobile-stop.bat",
  ],
  modules: {
    frontend: "web/** (React + TypeScript)",
    rust: "backend-fast/** (upload hot path, websocket fan-out, FIFO cleanup)",
    java: "backend-core/** (auth, JWT, user accounts, OAuth)",
    mobile: "mobile/** (Android Kotlin, CameraX, JWT login, upload flow)",
  },
  contracts: [
    "JWT_SECRET_KEY is mandatory for Spring and Rust.",
    "The web app reads VITE_API_BASE_URL and VITE_REALTIME_WS_URL.",
    "Rust reads PUBLIC_BASE_URL and ALLOWED_WEB_ORIGINS.",
    "The local Docker PostgreSQL test database lives on localhost:5433.",
    "Users may keep at most 100 images; oldest entries are evicted first.",
  ],
  mandatoryPolicies: [
    "If a request touches login, OAuth, JWT, auth, or social sign-in, Java must participate in implementation.",
    "If a request touches login, OAuth, JWT, auth, or social sign-in, Rust must participate at least in review mode because backend-fast validates JWT and guards websocket/upload contracts.",
    "If a request touches design, UI, UX, layout, style, or theme changes, frontend should participate in implementation by default.",
    "If a request touches Redis, cache, session-store, or queue infrastructure, backend-core should participate in implementation by default.",
    "If a Redis/cache request is explicitly about upload hot paths, websocket fan-out, realtime delivery, or low-latency image routing, backend-fast should participate directly in implementation.",
    "If a request touches realtime, websocket, WSS, live updates, or fan-out delivery, backend-fast and frontend should participate directly and backend-core should review auth/contracts.",
    "Touched areas should prefer real existing files from the repository snapshot. Do not invent paths when an extension of an existing file is enough.",
    "When a module is skipped, the planner must explain why it is safe to skip it.",
  ],
  verification: [
    ".skills/verify-web.ps1",
    ".skills/verify-fast.ps1",
    ".skills/verify-core.ps1",
    ".skills/verify-mobile.ps1",
    ".skills/verify-all.ps1",
  ],
};
