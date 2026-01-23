# 🗺️ Esprit Portal V2 - Master Roadmap

USE TURBOREPO
**Project Goal:** A unified, anti-fragile student portal that bypasses geo-blocking by utilizing the user's own devices as secure proxies, synchronized via a central cloud database.

## 🎨 Design System & Theme
We support both Dark (Default) and Light modes. The "Accent" remains constant to preserve brand identity.

| Role | Dark Mode (Default) | Light Mode | Usage |
| :--- | :--- | :--- | :--- |
| **Background** | `#0A0A0A` | `#F5F3ED` | Main app background |
| **Container** | `#1A1A1A` | `#FFFFFF` | Cards, Modals, Navbars |
| **Accent** | `#DD3118` | `#DD3118` | Buttons, Active States (Unchanged) |
| **Foreground** | `#F5F3ED` | `#0A0A0A` | Primary text content |
| **Button Text**| `#F5F3ED` | `#F5F3ED` | Text inside Accent buttons |

---

## 🏗️ Architecture: The "Hybrid Sync" Model

### The Ecosystem
1.  **The Database (Supabase/Firebase):** The Single Source of Truth.
2.  **The Mobile App (Expo):** The **Primary Fetcher**. Runs natively in Tunisia.
3.  **The Website (Next.js):** The **Viewer**. Displays cached data.
4.  **The Extension (Plasmo):** The **Bridge**. Allows PC users to fetch data if they don't have their phone.

### 🔄 The Synchronization Logic (The "24h Rule")

#### Scenario A: The "Morning Check" (Mobile)
1.  **Instant Load:** App reads from `AsyncStorage`.
2.  **Freshness Check:** If `last_fetched > 24h` -> Trigger Fetch.
3.  **The Fetch:** `esprit-ts` (wrapped with `tough-cookie`) scrapes the portal.
4.  **The Sync:** Save to Local Storage + **PUSH** to Cloud Database.

#### Scenario B: The "Study Session" (PC/Web)
1.  **Instant Load:** Website subscribes to Cloud Database.
2.  **Stale Check:** If data is old, UI shows "Refresh via Extension" button.
3.  **The Bridge:**
    * Website sends `FETCH_REQ` to Plasmo Extension.
    * Extension executes `api.getGrades()` using browser cookies.
    * Extension **UPDATES** the Cloud Database directly.
4.  **Auto-Update:** Website detects DB change and refreshes UI.

---

## 📅 Development Phases

### Phase 1: Core Logic (`esprit-ts`)
- [x] Port Python logic to TypeScript.
- [x] Publish to NPM.

### Phase 2: Mobile (Expo)
- [ ] Initialize Expo with NativeWind.
- [ ] Implement `Axios CookieJar` wrapper.
- [ ] Build "Grades" screen with Dark/Light mode toggle.

### Phase 3: Web & Extension (Next.js + Plasmo)
- [ ] Build Next.js Dashboard with the Color Palette variables.
- [ ] Initialize Plasmo project.
- [ ] Implement `externally_connectable` to allow the website to talk to Plasmo.

## notes :
1. **For your Browser Extension:**
You will initialize it like this: `const api = new Esprit();`
It will use the default Axios, which automatically piggybacks on the browser's active session (cookies).
2. **For your Expo Project:**
You will initialize it like this:
```typescript
// In Expo, you pass the jar wrapper
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import axios from 'axios';

const jar = new CookieJar();
const client = wrapper(axios.create({ jar })); 

const api = new Esprit(client); // Pass the cookie-enabled client!

```