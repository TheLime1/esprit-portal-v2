import { useEffect, useState } from "react"
import "./popup.css"

interface StudentData {
  id: string
  profile: any
  grades: any[]
  lastFetched: string
}

function IndexPopup() {
  const [studentData, setStudentData] = useState<StudentData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStudentData()
  }, [])

  const loadStudentData = async () => {
    try {
      const result = await chrome.storage.local.get(["studentData"])
      if (result.studentData) {
        setStudentData(result.studentData)
        console.log("Student data:", result.studentData)
      }
    } catch (error) {
      console.error("Error loading student data:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="popup-container">
        <div className="loading">Loading...</div>
      </div>
    )
  }

  if (!studentData) {
    return (
      <div className="popup-container">
        <h2>Esprit Extension</h2>
        <p>No student data found. Please login from the web app.</p>
      </div>
    )
  }

  return (
    <div className="popup-container">
      <h2>🎓 Esprit Student Info</h2>
      
      <div className="info-section">
        <h3>Profile Data (Debug)</h3>
        <pre>{JSON.stringify(studentData.profile, null, 2)}</pre>
      </div>

      <div className="info-section">
        <p className="label">Student ID</p>
        <p className="value">{studentData.id}</p>
      </div>

      <div className="info-section">
        <p className="label">Last Updated</p>
        <p className="value">{new Date(studentData.lastFetched).toLocaleString()}</p>
      </div>

      <button onClick={loadStudentData} className="refresh-btn">
        🔄 Refresh
      </button>
    </div>
  )
}

export default IndexPopup
