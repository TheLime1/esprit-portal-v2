import "./popup.css"

function IndexPopup() {
  const handleOpenPortal = () => {
    chrome.tabs.create({ url: "https://portal.espritads.site" })
  }

  return (
    <div className="popup-container">
      <div className="popup-header">
        <span className="popup-logo">🎓</span>
        <h1 className="popup-title">ESPRIT Portal</h1>
      </div>
      <p className="popup-subtitle">Your modern student dashboard</p>
      <button onClick={handleOpenPortal} className="portal-btn">
        Open Portal
        <svg
          className="arrow-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}

export default IndexPopup
