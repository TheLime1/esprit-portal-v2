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

interface CacheStatus {
  source: "cache" | "supabase" | "portal" | null
  isRefreshing: boolean
  lastUpdated: string | null
}

// Inject a floating info card into the page
const StudentInfoCard = () => {
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMinimized, setIsMinimized] = useState(false)
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>({
    source: null,
    isRefreshing: false,
    lastUpdated: null
  })

  useEffect(() => {
    loadCachedDataFirst()
  }, [])

  /**
   * Multi-layer caching flow:
   * 1. Immediately show data from chrome.storage.local (instant)
   * 2. If data is stale (>4hrs), trigger background refresh
   * 3. Update UI when fresh data arrives
   */
  const loadCachedDataFirst = async () => {
    try {
      setLoading(true)
      setError(null)

      // Step 1: Get cached data from chrome.storage.local immediately
      const result = await chrome.storage.local.get([
        "studentData",
        "allGrades",
        "cacheTimestamp",
        "cachedCredentials"
      ])

      if (result.studentData && result.studentData.name) {
        // Show cached data immediately
        const profile = result.studentData
        const allGrades = result.allGrades

        setStudentInfo({
          name: profile.name || "Unknown",
          className: profile.className || "N/A",
          languageLevel: allGrades?.languageLevels?.francais
            ? `FR: ${allGrades.languageLevels.francais}`
            : "N/A"
        })

        // Calculate cache age
        const cacheTimestamp = result.cacheTimestamp || profile.lastFetched
        setCacheStatus({
          source: "cache",
          isRefreshing: false,
          lastUpdated: cacheTimestamp
        })

        // Check if cache is stale (>4 hours)
        const isStale = checkIfStale(cacheTimestamp)

        if (isStale && result.cachedCredentials) {
          console.log("Cache is stale, triggering background refresh...")
          setCacheStatus((prev) => ({ ...prev, isRefreshing: true }))
          triggerBackgroundRefresh()
        }

        setLoading(false)
      } else {
        // No cached data, show error
        setError("No student data found. Please login first.")
        setLoading(false)
      }
    } catch (err) {
      console.error("Failed to load cached data:", err)
      setError(err.message || "Failed to load student data")
      setLoading(false)
    }
  }

  /**
   * Check if cached data is stale (older than 4 hours)
   */
  const checkIfStale = (timestamp: string | undefined): boolean => {
    if (!timestamp) return true

    const fetchedTime = new Date(timestamp).getTime()
    const now = Date.now()
    const hoursDiff = (now - fetchedTime) / (1000 * 60 * 60)

    return hoursDiff >= 4
  }

  /**
   * Trigger background refresh via service worker
   * This fetches fresh data from the portal without blocking UI
   */
  const triggerBackgroundRefresh = async () => {
    try {
      // Send message to background script to refresh data
      chrome.runtime.sendMessage(
        { action: "BACKGROUND_REFRESH" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error("Background refresh error:", chrome.runtime.lastError)
            setCacheStatus((prev) => ({ ...prev, isRefreshing: false }))
            return
          }

          if (response?.success) {
            console.log("Background refresh completed, updating UI...")

            // Update UI with fresh data
            const freshData = response.data
            if (freshData) {
              setStudentInfo({
                name: freshData.name || "Unknown",
                className: freshData.className || "N/A",
                languageLevel: freshData.allGrades?.languageLevels?.francais
                  ? `FR: ${freshData.allGrades.languageLevels.francais}`
                  : "N/A"
              })

              setCacheStatus({
                source: "portal",
                isRefreshing: false,
                lastUpdated: new Date().toISOString()
              })
            }
          } else {
            console.log("Background refresh failed:", response?.error)
            setCacheStatus((prev) => ({ ...prev, isRefreshing: false }))
          }
        }
      )
    } catch (e) {
      console.error("Failed to trigger background refresh:", e)
      setCacheStatus((prev) => ({ ...prev, isRefreshing: false }))
    }
  }

  /**
   * Force refresh - fetches fresh data from portal
   */
  const forceRefresh = async () => {
    setCacheStatus((prev) => ({ ...prev, isRefreshing: true }))
    await triggerBackgroundRefresh()
  }

  /**
   * Format last updated time for display
   */
  const formatLastUpdated = (timestamp: string | null): string => {
    if (!timestamp) return "Never"

    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
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
            onClick={forceRefresh}
            disabled={cacheStatus.isRefreshing}
            style={{
              marginTop: "8px",
              background: cacheStatus.isRefreshing
                ? "rgba(255,255,255,0.1)"
                : "rgba(255,255,255,0.2)",
              border: "none",
              padding: "10px",
              borderRadius: "8px",
              color: "white",
              cursor: cacheStatus.isRefreshing ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "600",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              width: "100%"
            }}
            onMouseOver={(e) => {
              if (!cacheStatus.isRefreshing) {
                e.currentTarget.style.background = "rgba(255,255,255,0.3)"
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = cacheStatus.isRefreshing
                ? "rgba(255,255,255,0.1)"
                : "rgba(255,255,255,0.2)"
            }}>
            {cacheStatus.isRefreshing ? (
              <>
                <div
                  style={{
                    width: "14px",
                    height: "14px",
                    border: "2px solid white",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite"
                  }}
                />
                Refreshing...
              </>
            ) : (
              "🔄 Refresh"
            )}
          </button>

          {/* Cache status indicator */}
          <div
            style={{
              marginTop: "8px",
              fontSize: "11px",
              opacity: 0.7,
              textAlign: "center"
            }}>
            {cacheStatus.source === "cache" && "📦 From cache"}
            {cacheStatus.source === "supabase" && "☁️ From cloud"}
            {cacheStatus.source === "portal" && "🌐 Fresh data"}
            {cacheStatus.lastUpdated && (
              <span style={{ marginLeft: "4px" }}>
                • {formatLastUpdated(cacheStatus.lastUpdated)}
              </span>
            )}
          </div>
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
