# esprit-portal-v2

🗺️ Project Roadmap: Esprit Companion Portal

🎯 Goal

Build a modern, fast React dashboard for Esprit students that uses a "Companion" Chrome Extension to fetch data securely from the legacy university portal (esprit.tn), bypassing IP blocks and CORS restrictions without handling user passwords.

🏗️ Phase 1: Project Setup & Monorepo Structure

Objective: Create a clean workspace where the Extension and the Website live side-by-side.

[ ] Folder Structure Setup
Create a root folder esprit-companion-app with two sub-folders:

/extension (The Chrome Extension)

/web (The React Website)

[ ] Initialize Git

Run git init in the root.

Create a .gitignore (ignore node_modules, .env, dist, build).

🧩 Phase 2: The Chrome Extension (The "Bridge")

Objective: Build the extension that acts as a secure tunnel between the browser and the university.

Step 2.1: The Manifest (V3)

[ ] Create manifest.json in /extension.

[ ] Permissions: Add "cookies", "activeTab".

[ ] Host Permissions: Add *://esprit.tn/* and *://esprit-tn.com/*.

[ ] Externally Connectable: crucial! Add http://localhost:3000/* (for dev) and your future Cloudflare domain.

Step 2.2: Background Service Worker

[ ] Create background.js.

[ ] Implement chrome.runtime.onMessageExternal listener.

[ ] Action Handler: Create a switch case for FETCH_GRADES, FETCH_SCHEDULE, PING.

[ ] Fetch Logic: Implement the fetch() call with { credentials: 'include' } to use the student's existing session.

[ ] Error Handling: Handle cases where the student is not logged in (detect redirect to login page).

Step 2.3: Testing the Bridge

[ ] Open Chrome -> Extensions -> Developer Mode (Toggle ON).

[ ] Click "Load Unpacked" and select the /extension folder.

[ ] Copy the Extension ID (e.g., abcdef...). You will need this for Phase 3.

[ ] Test with a simple curl or console command if possible, or wait for Phase 3.

💻 Phase 3: The React Website (The "Dashboard")

Objective: Build the UI that students actually use.

Step 3.1: Scaffolding

[ ] Initialize React (Vite recommended): npm create vite@latest web -- --template react

[ ] Install dependencies: npm install lucide-react (icons), tailwindcss (styling).

[ ] Env Variable: Create .env.local and add VITE_EXTENSION_ID=your_copied_id_here.

Step 3.2: The "Bridge" Hook

[ ] Create hooks/useEspritExtension.js.

[ ] Implement the Ping Loop: On mount, try to message the extension to see if it's installed.

[ ] State Management: Return { isInstalled, isLoading, fetchGrades }.

Step 3.3: Porting Logic (Python to JS)

[ ] The Core Task: We cannot run esprit-py (Python) in the browser. We must rewrite its logic in JavaScript.

[ ] Analyze Python Code: Look at esprit-py source code to find:

The exact URLs it hits (e.g., /Etudiant/Notes).

The HTML IDs/Classes it looks for (e.g., <table id="ContentPlaceHolder1_GridView1">).

[ ] Create utils/parser.js:

Implement the logic using DOMParser to convert raw HTML strings into DOM objects.

Re-implement the parsing logic (extracting grades, coefficients, averages) using querySelector.

Step 3.4: Basic UI Components

[ ] Install Prompt: If isInstalled is false, show a beautiful "Download Extension" card.

[ ] Login Prompt: If extension returns "Not Logged In", show a "Please log into Esprit in a new tab" button.

[ ] Dashboard: A simple table to display the JSON data from Step 3.3.

💾 Phase 4: Data Strategy (Caching & Sync)

Objective: Make it feel "instant" and work offline/on phone.

Step 4.1: Local Strategy (The "Cache")

[ ] Logic: When data arrives from the extension -> Save to localStorage with a timestamp.

[ ] Load Logic: On page load, check localStorage first.

If data is < 24 hours old -> Show immediately (Instant load).

If data is > 24 hours old -> Show old data while fetching new data in the background (Stale-while-revalidate).

Step 4.2: Cloud Sync (Optional but Recommended)

[ ] Setup Firebase: Create a free Firebase project.

[ ] Auth: Use "Anonymous Auth" or "Google Auth" for the dashboard.

[ ] Database: Create a Firestore collection students/{userId}/grades.

[ ] Sync Logic: - When the Extension fetches new grades -> Push to Firestore.

[ ] Mobile Benefit: Now, if the student opens your website on their iPhone, they can pull data from Firestore (which was uploaded by their PC).

🚀 Phase 5: Deployment & Release

Objective: Get it into students' hands.

Step 5.1: Deploy Website

[ ] Push code to GitHub.

[ ] Connect repo to Cloudflare Pages.

[ ] Important: Get the final Domain (e.g., esprit-dashboard.pages.dev).

Step 5.2: Finalize Extension

[ ] Update manifest.json: Add your Cloudflare domain to externally_connectable (otherwise the deployed site can't talk to the extension!).

[ ] Pack Extension: In Chrome, click "Pack Extension" to get a .crx file OR just zip the folder.

Step 5.3: Distribution

[ ] The "Hacker" Way: Host the .zip file on your website. Tell students to "Enable Developer Mode" and drag it in.

[ ] The Official Way: Pay $5 to Google and publish to the Chrome Web Store (Takes 1-2 days for approval).

⚠️ Known Risks & mitigations

Risk

Mitigation

Esprit changes HTML

Your parser breaks. You update parser.js and deploy. Users get fix instantly.

Esprit blocks extension

Very hard for them to do since requests look like normal user browsing.

User not logged in

The extension can't log them in. You must redirect them to esprit.tn to login first.
