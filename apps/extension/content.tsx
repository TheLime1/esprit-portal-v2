import type { PlasmoCSConfig } from "plasmo"
import { useEffect, useState } from "react"

export const config: PlasmoCSConfig = {
  matches: ["https://esprit-tn.com/*", "https://*.esprit-tn.com/*"],
  all_frames: false
}

interface StudentInfo {
  name: string
  className: string
  languageLevel: string
}

// Inject a floating info card into the page
const StudentInfoCard = () => {
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMinimized, setIsMinimized] = useState(false)

  useEffect(() => {
    fetchStudentData()
  }, [])

  const fetchStudentData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get stored credentials or trigger login
      const result = await chrome.storage.local.get(["studentData"])
      
      if (result.studentData && result.studentData.profile) {
        const profile = result.studentData.profile
        
        setStudentInfo({
          name: profile.fullName || profile.name || "Unknown",
          className: profile.class || profile.className || "N/A",
          languageLevel: profile.languageLevel || profile.language || "N/A"
        })
      } else {
        setError("No student data found. Please login first.")
      }
    } catch (err) {
      setError(err.message || "Failed to fetch student data")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div
        style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "white",
          padding: "16px",
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          zIndex: 999999,
          fontFamily: "system-ui, -apple-system, sans-serif",
          minWidth: "250px"
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "16px",
              height: "16px",
              border: "2px solid white",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 1s linear infinite"
            }}
          />
          Loading student info...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          background: "#ef4444",
          color: "white",
          padding: "16px",
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          zIndex: 999999,
          fontFamily: "system-ui, -apple-system, sans-serif",
          minWidth: "250px"
        }}>
        <div style={{ fontWeight: "600", marginBottom: "8px" }}>⚠️ Error</div>
        <div style={{ fontSize: "14px", opacity: 0.9 }}>{error}</div>
        <button
          onClick={fetchStudentData}
          style={{
            marginTop: "12px",
            background: "rgba(255,255,255,0.2)",
            border: "none",
            padding: "8px 16px",
            borderRadius: "6px",
            color: "white",
            cursor: "pointer",
            fontSize: "14px"
          }}>
          Retry
        </button>
      </div>
    )
  }

  if (!studentInfo) return null

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "white",
        padding: isMinimized ? "12px 16px" : "20px",
        borderRadius: "12px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        zIndex: 999999,
        fontFamily: "system-ui, -apple-system, sans-serif",
        minWidth: isMinimized ? "auto" : "280px",
        transition: "all 0.3s ease"
      }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: isMinimized ? "0" : "16px"
        }}>
        <div style={{ fontWeight: "700", fontSize: "16px" }}>
          {isMinimized ? "👤" : "🎓 Student Info"}
        </div>
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          style={{
            background: "rgba(255,255,255,0.2)",
            border: "none",
            color: "white",
            cursor: "pointer",
            padding: "4px 8px",
            borderRadius: "6px",
            fontSize: "12px"
          }}>
          {isMinimized ? "+" : "−"}
        </button>
      </div>

      {!isMinimized && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <div
              style={{
                fontSize: "12px",
                opacity: 0.8,
                marginBottom: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
              Name
            </div>
            <div style={{ fontSize: "16px", fontWeight: "600" }}>
              {studentInfo.name}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: "12px",
                opacity: 0.8,
                marginBottom: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
              Class
            </div>
            <div style={{ fontSize: "16px", fontWeight: "600" }}>
              {studentInfo.className}
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: "12px",
                opacity: 0.8,
                marginBottom: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
              Language Level
            </div>
            <div style={{ fontSize: "16px", fontWeight: "600" }}>
              {studentInfo.languageLevel}
            </div>
          </div>

          <button
            onClick={fetchStudentData}
            style={{
              marginTop: "8px",
              background: "rgba(255,255,255,0.2)",
              border: "none",
              padding: "10px",
              borderRadius: "8px",
              color: "white",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              transition: "all 0.2s"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.3)"
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.2)"
            }}>
            🔄 Refresh
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default StudentInfoCard
