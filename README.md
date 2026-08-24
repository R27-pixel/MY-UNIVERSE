# 🌌 OUR UNIVERSE V2

> **Interactive 3D Multi-Tenant Celestial Application & Real-Time Experience Platform**

Our Universe V2 is a multi-tenant interactive 3D web application built with React, Three.js, and Supabase. It allows creators to build personalized digital universes featuring 3D star constellations, database-backed memories, custom narratives, real-time chat, voice notes, and role-based access control.

---

## 🌟 Key Features

### 🎨 **Interactive 3D Celestial Engine**
- **Three.js & React Three Fiber Canvas**: Dynamic 3D starfield with orbital mechanics, glowing celestial nodes, and constellation connections.
- **Raycasting & Spatial Interaction**: Click and hover interactions on 3D star nodes to inspect memories and trigger animations.
- **Custom Post-Processing & Aesthetic Overlays**: Cinematic bloom effects, camera transitions, and persistent film-grain aesthetic.

### 🔒 **Multi-Tenant Universes & Strict Isolation**
- **Creator-Owned Universes**: Create and manage isolated 3D universes with custom titles, slugs, and themes.
- **Role-Based Access Control (RBAC)**:
  - 👑 `OWNER`: Full universe management, memory authoring, story editing, and invitation generation.
  - ⚡ `ADMIN`: Content moderation, invitation generation, and administrative controls.
  - 🚀 `TRAVELER`: Interactive 3D celestial exploration and full chat access.
  - 👁️ `GUEST`: Read-only experience with restricted editing capabilities.

### ⭐ **12-Star Discovery Sequence & Persistence**
- **Sequential Star Exploration**: Interactive discovery tracking (1/12 → 12/12) backed by PostgreSQL database rows.
- **Memory Viewer**: Fullscreen modal displaying text, photo frames, audio notes, location pins, and custom dates per celestial node.
- **Hard Refresh State Persistence**: Session state, active universe, and discovery progress are restored via Supabase Auth and database tables.

### 🗝️ **Secret 13th Star & Portal Gateway**
- **Dynamic Portal Reveal**: Reaching 12/12 discoveries dynamically unlocks eligibility for the secret 13th Star.
- **Portal Modal & Hidden Cosmic Game**: Interactive portal transition leading to the final narrative choice and hidden cosmic game.

### 💬 **Real-Time Encrypted Chat & Voice Notes**
- **Supabase Realtime CDC**: Sub-second message delivery with Postgres Change Data Capture and cross-tab signal sync.
- **Rich Media & Attachments**: Photo/video previews, reply-to-message threading, emoji selector, and WebRTC voice message recording with fallbacks.

### 💌 **Invitation Link System**
- **Tokenized Invites**: Generate single-use or multi-use invitation tokens with optional expiration windows (`create_universe_invitation`).
- **URL Auto-Redemption**: Accessing `?invite=token` automatically redeems membership and switches the user to the target Universe.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Core** | React 19, TypeScript, Vite |
| **3D Rendering** | Three.js, `@react-three/fiber`, `@react-three/drei` |
| **State Management** | Zustand (Global experience, auth, and universe state) |
| **Backend & DB** | Supabase (Auth, PostgreSQL DB, Realtime CDC, Object Storage) |
| **Animations & Audio** | GSAP, Howler.js |
| **Deployment** | Vercel (SPA Rewrite Support) |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v18.0.0` or higher
- **npm** or **yarn** / **pnpm**
- **Supabase Project**: Active Supabase instance

---

### Local Installation & Setup

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/our-universe.git
   cd our-universe
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   # Supabase Credentials
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here

   # WebRTC / Call Credentials (Optional)
   VITE_TURN_URL=free.expressturn.com:3478
   VITE_TURN_USERNAME=your-username
   VITE_TURN_CREDENTIAL=your-credential
   ```

4. **Start Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📦 Project Structure

```text
MYUNIVERSE/
├── public/                # Static assets & textures
├── src/
│   ├── components/        # React UI components
│   │   ├── authoring/     # Memory, story, and invite modals
│   │   ├── chat/          # Real-time chat & voice notes component
│   │   ├── game/          # Hidden cosmic minigame
│   │   ├── HUD.tsx        # Floating heads-up display overlay
│   │   ├── IdentityModal.tsx # Auth & Universe selector/creation modal
│   │   └── MemoryViewer.tsx  # Celestial memory modal viewer
│   ├── config/            # Celestial memories & universe default configs
│   ├── hooks/             # Custom React hooks (device capability, WebRTC)
│   ├── services/          # Supabase client API & signaling services
│   ├── stores/            # Zustand experience & notification stores
│   ├── styles/            # CSS tokens & glassmorphism stylesheets
│   ├── three/             # Three.js 3D canvas scene & starfield logic
│   ├── types/             # TypeScript type definitions
│   ├── App.tsx            # Main application controller
│   └── main.tsx           # React DOM root entry
├── vercel.json            # Vercel SPA rewrite configuration
├── package.json           # Node dependencies & scripts
└── vite.config.ts         # Vite build configuration
```

---

## 🔗 Connecting to Git (Step-by-Step)

To initialize Git and push this repository to GitHub/GitLab:

```bash
# 1. Initialize Git repository
git init

# 2. Add files to staging
git add .

# 3. Create initial commit
git commit -m "feat: Our Universe V2 production release"

# 4. Rename main branch
git branch -M main

# 5. Add remote GitHub repository URL
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git

# 6. Push code to remote repository
git push -u origin main
```

---

## 🌐 Deploying to Vercel

Our Universe V2 is pre-configured for one-click Vercel deployments:

1. Connect your GitHub repository to [Vercel](https://vercel.com/new).
2. Add environment variables in Vercel Settings (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
3. Deploy! Vercel will automatically build the Vite production bundle and apply the SPA rewrite rules in `vercel.json`.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for details.
