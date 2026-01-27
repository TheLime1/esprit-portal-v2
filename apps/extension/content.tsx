// Import the logo asset - Plasmo will handle the URL
import logoUrl from "data-base64:~assets/icon.png"
import type { PlasmoCSConfig } from "plasmo"
import { useState } from "react"

export const config: PlasmoCSConfig = {
  matches: [
    "https://esprit-tn.com/*",
    "https://*.esprit-tn.com/*",
    "https://app.espritads.site/*"
  ],
  all_frames: false
}

// Promo banner component - shows in bottom right corner
const PromoBanner = () => {
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible) return null

  const handleClick = () => {
    window.open("https://portal.espritads.site", "_blank")
  }

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsVisible(false)
  }

  return (
    <div
      onClick={handleClick}
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 16px",
        backgroundColor: "#0f0f10",
        borderRadius: "12px",
        boxShadow:
          "0 4px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)",
        cursor: "pointer",
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        maxWidth: "300px"
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)"
        e.currentTarget.style.boxShadow =
          "0 6px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.15)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)"
        e.currentTarget.style.boxShadow =
          "0 4px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)"
      }}>
      {/* Logo */}
      <img
        src={logoUrl}
        alt="ESPRIT Logo"
        style={{
          width: "28px",
          height: "28px",
          flexShrink: 0,
          objectFit: "contain"
        }}
      />

      {/* Text content */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            color: "#fafafa",
            fontSize: "13px",
            fontWeight: 600,
            marginBottom: "2px"
          }}>
          Try the new ESPRIT Portal
        </div>
        <div
          style={{
            color: "#a1a1aa",
            fontSize: "11px"
          }}>
          Modern dashboard • Better experience
        </div>
      </div>

      {/* Arrow */}
      <div
        style={{
          color: "#e54c2e",
          fontSize: "18px",
          fontWeight: "bold"
        }}>
        →
      </div>

      {/* Close button */}
      <button
        onClick={handleClose}
        style={{
          position: "absolute",
          top: "-6px",
          right: "-6px",
          width: "20px",
          height: "20px",
          borderRadius: "50%",
          backgroundColor: "#1a1a1c",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          color: "#a1a1aa",
          fontSize: "12px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          lineHeight: 1
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#2a2a2c"
          e.currentTarget.style.color = "#fafafa"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "#1a1a1c"
          e.currentTarget.style.color = "#a1a1aa"
        }}>
        ×
      </button>
    </div>
  )
}

export default PromoBanner
