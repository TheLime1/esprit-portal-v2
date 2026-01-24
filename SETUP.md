# Setup Instructions

## Prerequisites
- Node.js >= 18
- pnpm (included via corepack)
- Chrome or Edge browser

## Quick Start

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start Development Servers

**Terminal 1 - Extension:**
```bash
cd apps/extension
pnpm run dev
```

**Terminal 2 - Website:**
```bash
cd apps/web
pnpm run dev
```

### 3. Install the Extension in Chrome

1. Extension builds to: `apps/extension/build/chrome-mv3-dev`
2. Open `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `apps/extension/build/chrome-mv3-dev` folder
6. **Copy the Extension ID** (e.g., `abcdefghijklmnopqrstuvwxyz123456`)

### 4. Update Website with Extension ID

Open [apps/web/src/app/login/page.tsx](apps/web/src/app/login/page.tsx) and replace:
```typescript
const extensionId = "YOUR_EXTENSION_ID"
```
with:
```typescript
const extensionId = "abcdefghijklmnopqrstuvwxyz123456" // Your actual ID
```

### 5. Test the Flow

1. Open http://localhost:3000
2. Click "Get Started"
3. Enter test credentials:
   - Student ID: `test123`
   - Password: `anything`
4. Click "Login via Extension"
5. The extension will process the login (currently using mock data)
6. Data will be displayed on the page and stored in the extension's local storage

## Current Status

✅ **Working:**
- Extension builds and runs
- Website builds and runs
- Communication between website and extension
- Mock data flow for testing
- Local storage in extension

⏳ **TODO:**
- Fix `@lime1/esprit-ts` build issue (math-intrinsics dependency conflict with Plasmo)
- Add Supabase integration for cloud storage
- Replace mock data with real Esprit portal API calls

## Troubleshooting

### Extension not receiving messages
- Check that the extension ID in the website matches the installed extension
- Verify `externally_connectable` in manifest includes `http://localhost:3000/*`
- Check browser console and extension console for errors

### Build issues
- Try deleting `node_modules` and `pnpm-lock.yaml`, then run `pnpm install`
- Make sure you're using pnpm, not npm or yarn
- Check that all workspace packages are correctly linked
