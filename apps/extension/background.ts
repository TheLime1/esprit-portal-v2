import { Esprit } from "@lime1/esprit-ts"

console.log("Esprit Portal Extension - Ready")

interface LoginCredentials {
  id: string
  password: string
}

// Handle messages from the website
chrome.runtime.onMessageExternal.addListener(
  (request, sender, sendResponse) => {
    console.log("Message received from website:", request)
    
    if (request.action === "LOGIN") {
      handleLogin(request.credentials)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }))
      return true // Keep the message channel open for async response
    }
    
    return false
  }
)

async function handleLogin(credentials: LoginCredentials) {
  try {
    console.log("Starting login process for:", credentials.id)
    
    // Initialize Esprit API (uses browser cookies automatically)
    const api = new Esprit()
    
    // Login to Esprit portal
    console.log("Logging in to Esprit portal...")
    await api.login(credentials.id, credentials.password)
    console.log("Login successful!")
    
    // Fetch student data
    console.log("Fetching grades...")
    const grades = await api.getGrades()
    
    console.log("Fetching profile...")
    const profile = await api.getProfile()
    
    const studentData = {
      id: credentials.id,
      profile,
      grades,
      lastFetched: new Date().toISOString()
    }
    
    console.log("Data fetched successfully:", studentData)
    
    // Store in local storage
    await chrome.storage.local.set({ studentData })
    console.log("Data saved to local storage")
    
    // TODO: Add Supabase integration to sync across devices
    
    return studentData
  } catch (error) {
    console.error("Login error:", error)
    throw error
  }
}

chrome.action.onClicked.addListener(() => {
  console.log("Extension clicked")
})

/* Note if you're building for firefox or mv2 in general, chrome.action will be undefined so you have to do something like this:

@see https://stackoverflow.com/questions/70216500/chrome-action-is-undefined-migrating-to-v3-manifest

const handleClick = (tab) => {
  console.log("clicked", tab.id);
  if (!tab.id) throw new Error("tab id not found");
  chrome.tabs.sendMessage(tab.id, {
    name: "show-dialog"
  });
};

if (chrome.action != undefined) {
  chrome.action.onClicked.addListener(handleClick);
} else {
  chrome.browserAction.onClicked.addListener(handleClick);
}
*/


chrome.commands.onCommand.addListener((command) => {
  if (command === "test") {
    console.log(`test command: ${generateMnemonic()}`)
  }
})
