# 💻 Esprit Web Dashboard (Next.js)

The modern, responsive web interface. Built for speed and visual clarity.

## 🛠 Tech Stack
* **Framework:** Next.js (App Router)
* **Styling:** Tailwind CSS + Shadcn/UI
* **Icons:** Lucide React
* **Backend:** Supabase (for real-time data syncing)

## 🎨 Theme Configuration (`globals.css`)
We use CSS variables to handle the exact hex codes provided.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Light Mode (Default or Toggled) */
    --background: 240 14% 95%;  /* #F5F3ED converted to HSL approx */
    --foreground: 0 0% 4%;      /* #0A0A0A */
    
    --card: 0 0% 100%;          /* #FFFFFF */
    --card-foreground: 0 0% 4%; /* #0A0A0A */
    
    --primary: 6 78% 48%;       /* #DD3118 */
    --primary-foreground: 45 20% 95%; /* #F5F3ED (Button Text) */

    --border: 0 0% 90%;
  }

  .dark {
    /* Dark Mode (Soft Black) */
    --background: 0 0% 4%;      /* #0A0A0A */
    --foreground: 45 20% 95%;   /* #F5F3ED */

    --card: 0 0% 10%;           /* #1A1A1A */
    --card-foreground: 45 20% 95%; /* #F5F3ED */

    --primary: 6 78% 48%;       /* #DD3118 (Unchanged) */
    --primary-foreground: 45 20% 95%; /* #F5F3ED */

    --border: 0 0% 20%;
  }
}

/* Force specific hex codes if HSL approximation is off */
.bg-background { background-color: #F5F3ED; }
.dark .bg-background { background-color: #0A0A0A; }

.bg-card { background-color: #FFFFFF; }
.dark .bg-card { background-color: #1A1A1A; }

.text-foreground { color: #0A0A0A; }
.dark .text-foreground { color: #F5F3ED; }

.bg-primary { background-color: #DD3118; }