# 📱 Esprit Mobile (Expo)

The native Android/iOS application.

## 🛠 Tech Stack
* **Framework:** Expo (Managed Workflow)
* **Styling:** NativeWind (Tailwind)
* **Logic:** `esprit-ts` + `tough-cookie`

## 🎨 Theme Config (`tailwind.config.js`)
NativeWind handles dark mode via the `className="dark"` on a parent view or system preference.

```javascript
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: 'class', // allows manual toggling
  theme: {
    extend: {
      colors: {
        // Semantic names mapped to your palette
        background: {
          light: "#F5F3ED",
          dark: "#0A0A0A"
        },
        surface: {
          light: "#FFFFFF",
          dark: "#1A1A1A"
        },
        primary: "#DD3118", // Red
        text: {
          light: "#0A0A0A",
          dark: "#F5F3ED"
        },
        // Specialized button text color (always light)
        "btn-text": "#F5F3ED" 
      }
    }
  }
}