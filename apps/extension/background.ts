/**
 * Esprit Portal Extension - Background Service Worker
 * 
 * This implements the Esprit portal login flow using browser-native APIs.
 * Based on the endpoints from @lime1/esprit-ts but adapted for browser extensions.
 * 
 * NOTE: Service workers don't have access to DOMParser, so we use regex for HTML parsing.
 */

console.log("Esprit Portal Extension - Ready")

// ============================================================================
// Constants - Esprit Portal URLs (from esprit-ts library)
// ============================================================================
const URLS = {
  LOGIN: "https://esprit-tn.com/esponline/online/default.aspx",
  HOME: "https://esprit-tn.com/esponline/Etudiants/Accueil.aspx",
  // Grade endpoints (matching esprit-ts library)
  REGULAR_GRADES: "https://esprit-tn.com/ESPOnline/Etudiants/Resultat2021.aspx",
  PRINCIPAL_RESULT: "https://esprit-tn.com/ESPOnline/Etudiants/ResultatPrincipale2021.aspx",
  RATTRAPAGE_GRADES: "https://esprit-tn.com/ESPOnline/Etudiants/noterat.aspx",
  RATTRAPAGE_RESULT: "https://esprit-tn.com/ESPOnline/Etudiants/ResultatRattrapage2021.aspx",
  LANGUAGE_LEVEL: "https://esprit-tn.com/ESPOnline/Etudiants/LANG2.aspx",
  RANKING: "https://esprit-tn.com/ESPOnline/Etudiants/ranking.aspx",
  // Other endpoints
  ABSENCES: "https://esprit-tn.com/ESPOnline/Etudiants/absenceetud.aspx",
  CREDITS: "https://esprit-tn.com/ESPOnline/Etudiants/Historique_Cr%C3%A9dit.aspx",
  SCHEDULES: "https://esprit-tn.com/ESPOnline/Etudiants/Emplois.aspx",
}

// ============================================================================
// Types
// ============================================================================
interface LoginCredentials {
  id: string
  password: string
}

interface ASPNetFormData {
  __VIEWSTATE: string
  __VIEWSTATEGENERATOR: string
  __EVENTVALIDATION: string
}

interface Grade {
  designation: string
  coefficient: number | null
  noteCC: number | null
  noteTP: number | null
  noteExam: number | null
}

interface StudentData {
  id: string
  name: string | null
  className: string | null
  grades: Grade[] | null
  lastFetched: string
}

// ============================================================================
// Regex-based HTML Parsing Utilities (for Service Worker compatibility)
// ============================================================================

/**
 * Extract value from an input element by ID using regex
 */
function extractInputValueById(html: string, id: string): string {
  // Match input with specific ID and capture value
  const regex = new RegExp(`<input[^>]*id=["']${id}["'][^>]*value=["']([^"']*)["']`, 'i')
  const altRegex = new RegExp(`<input[^>]*value=["']([^"']*)["'][^>]*id=["']${id}["']`, 'i')

  const match = html.match(regex) || html.match(altRegex)
  return match ? decodeHtmlEntities(match[1]) : ""
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
}

/**
 * Clean values that may contain &nbsp; or other empty representations
 * Returns null if the value is essentially empty
 */
function cleanEmptyValue(value: string | null | undefined): string | null {
  if (!value) return null

  // Decode HTML entities first
  const decoded = decodeHtmlEntities(value.trim())

  // Check if it's just whitespace or nbsp after decoding
  const cleaned = decoded.replace(/\u00A0/g, '').trim() // \u00A0 is the actual non-breaking space character

  return cleaned === '' ? null : decoded
}

/**
 * Extract ASP.NET hidden form fields from HTML using regex
 */
function extractASPNetFormData(html: string): ASPNetFormData {
  return {
    __VIEWSTATE: extractInputValueById(html, "__VIEWSTATE"),
    __VIEWSTATEGENERATOR: extractInputValueById(html, "__VIEWSTATEGENERATOR"),
    __EVENTVALIDATION: extractInputValueById(html, "__EVENTVALIDATION"),
  }
}

/**
 * Find input name by pattern in ID or name attribute
 */
function findInputNameByPattern(html: string, patterns: string[]): string | null {
  for (const pattern of patterns) {
    const lowerPattern = pattern.toLowerCase()

    // Match input elements and capture their id/name
    const inputRegex = /<input[^>]*(?:id|name)=["']([^"']*)[^>]*>/gi
    let match

    while ((match = inputRegex.exec(html)) !== null) {
      const fullMatch = match[0]
      const id = fullMatch.match(/id=["']([^"']+)["']/i)?.[1] || ""
      const name = fullMatch.match(/name=["']([^"']+)["']/i)?.[1] || ""

      if (id.toLowerCase().includes(lowerPattern) || name.toLowerCase().includes(lowerPattern)) {
        return name || id
      }
    }
  }
  return null
}

/**
 * Check if there's a checkbox in the HTML and return its name
 */
function findCheckboxName(html: string): string {
  const match = html.match(/<input[^>]*type=["']checkbox["'][^>]*name=["']([^"']+)["'][^>]*>/i)
  if (match) return match[1]

  const altMatch = html.match(/<input[^>]*name=["']([^"']+)["'][^>]*type=["']checkbox["'][^>]*>/i)
  return altMatch ? altMatch[1] : ""
}

/**
 * Parse European number format (comma as decimal separator)
 */
function parseEuropeanNumber(value: string | undefined): number | null {
  if (!value || value.trim() === "") return null

  // Clean &nbsp; and other empty values first
  const cleaned = cleanEmptyValue(value)
  if (!cleaned) return null

  const normalized = cleaned.replace(",", ".")
  const parsed = parseFloat(normalized)
  return isNaN(parsed) ? null : parsed
}

/**
 * Check if URL is the login page
 */
function isLoginPage(url: string): boolean {
  const lower = url.toLowerCase()
  return lower.includes("default.aspx") || lower.includes("login")
}

/**
 * Extract text content from an element by ID using regex
 */
function extractTextById(html: string, id: string): string | null {
  // Try to find span or label with the ID
  const spanRegex = new RegExp(`<span[^>]*id=["']${id}["'][^>]*>([^<]*)</span>`, 'i')
  const labelRegex = new RegExp(`<label[^>]*id=["']${id}["'][^>]*>([^<]*)</label>`, 'i')

  const match = html.match(spanRegex) || html.match(labelRegex)
  return match ? decodeHtmlEntities(match[1].trim()) : null
}

/**
 * Parse grades table from HTML using regex
 */
function parseGradesFromHTML(html: string): Grade[] | null {
  // Find the grades table
  const tableMatch = html.match(/<table[^>]*id=["']ContentPlaceHolder1_GridView1["'][^>]*>([\s\S]*?)<\/table>/i)
  if (!tableMatch) return null

  const tableHtml = tableMatch[1]

  // Extract all rows
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const rows: string[] = []
  let rowMatch

  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    rows.push(rowMatch[1])
  }

  if (rows.length < 2) return null

  // Parse headers from first row
  const headerRegex = /<th[^>]*>([^<]*)<\/th>/gi
  const headers: string[] = []
  let headerMatch

  while ((headerMatch = headerRegex.exec(rows[0])) !== null) {
    headers.push(headerMatch[1].trim().toLowerCase())
  }

  // Find column indices
  const designationIdx = headers.findIndex(h => h.includes("designation") || h.includes("module"))
  const coefIdx = headers.findIndex(h => h.includes("coef"))
  const ccIdx = headers.findIndex(h => h.includes("cc") || h.includes("note_cc"))
  const tpIdx = headers.findIndex(h => h.includes("tp") || h.includes("note_tp"))
  const examIdx = headers.findIndex(h => h.includes("exam") || h.includes("note_exam"))

  const grades: Grade[] = []

  // Parse data rows (skip header row)
  for (let i = 1; i < rows.length; i++) {
    const cellRegex = /<td[^>]*>([^<]*)<\/td>/gi
    const cells: string[] = []
    let cellMatch

    while ((cellMatch = cellRegex.exec(rows[i])) !== null) {
      cells.push(cellMatch[1].trim())
    }

    if (cells.length === 0) continue

    grades.push({
      designation: designationIdx >= 0 ? cells[designationIdx] ?? "" : cells[0] ?? "",
      coefficient: coefIdx >= 0 ? parseEuropeanNumber(cells[coefIdx]) : null,
      noteCC: ccIdx >= 0 ? parseEuropeanNumber(cells[ccIdx]) : null,
      noteTP: tpIdx >= 0 ? parseEuropeanNumber(cells[tpIdx]) : null,
      noteExam: examIdx >= 0 ? parseEuropeanNumber(cells[examIdx]) : null,
    })
  }

  return grades.length > 0 ? grades : null
}

/**
 * Extract student info from home page HTML
 */
function parseStudentInfoFromHTML(html: string): { name: string | null; className: string | null } {
  let name: string | null = null
  let className: string | null = null

  // Try to find name (Label2)
  name = extractTextById(html, "Label2") || extractTextById(html, "ContentPlaceHolder1_Label2")

  // Try to find class (Label3)
  className = extractTextById(html, "Label3") || extractTextById(html, "ContentPlaceHolder1_Label3")

  return { name, className }
}

/**
 * Parse principal/rattrapage result from HTML (similar to esprit-ts approach)
 * The data is in table #ContentPlaceHolder1_GridView3 with moyenne and decision columns
 */
function parseResultFromHTML(html: string): { moyenneGeneral: string | null; decision: string | null } {
  let moyenneGeneral: string | null = null
  let decision: string | null = null

  // Try to find the result table #ContentPlaceHolder1_GridView3
  const tableMatch = html.match(/<table[^>]*id=["']ContentPlaceHolder1_GridView3["'][^>]*>([\s\S]*?)<\/table>/i)
  if (!tableMatch) {
    console.log("Result table not found, trying fallback extraction")
    // Fallback to label extraction
    moyenneGeneral = cleanEmptyValue(extractTextById(html, "ContentPlaceHolder1_Label1") || extractTextById(html, "Label1"))
    decision = cleanEmptyValue(extractTextById(html, "ContentPlaceHolder1_Label2") || extractTextById(html, "Label2"))
    return { moyenneGeneral, decision }
  }

  const tableHtml = tableMatch[1]

  // Extract headers
  const headerRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi
  const headers: string[] = []
  let headerMatch
  while ((headerMatch = headerRegex.exec(tableHtml)) !== null) {
    headers.push(headerMatch[1].replace(/<[^>]+>/g, '').trim().toLowerCase())
  }

  // Find column indices
  const moyenneIdx = headers.findIndex(h => h.includes("moyenne"))
  const decisionIdx = headers.findIndex(h => h.includes("decision") || h.includes("décision"))

  // Extract first data row
  const rowMatch = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)
  if (rowMatch && rowMatch.length > 1) {
    const dataRow = rowMatch[1]
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
    const cells: string[] = []
    let cellMatch
    while ((cellMatch = cellRegex.exec(dataRow)) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim())
    }

    if (moyenneIdx >= 0 && cells[moyenneIdx]) {
      moyenneGeneral = cleanEmptyValue(cells[moyenneIdx])
    }
    if (decisionIdx >= 0 && cells[decisionIdx]) {
      decision = cleanEmptyValue(cells[decisionIdx])
    }
  }

  console.log("Parsed result:", { moyenneGeneral, decision })
  return { moyenneGeneral, decision }
}

/**
 * Parse language levels from HTML (similar to esprit-ts approach)
 * The data is in a table #ContentPlaceHolder1_GridView2 with columns for francais and anglais
 */
function parseLanguageLevelsFromHTML(html: string): { francais: string | null; anglais: string | null } {
  let francais: string | null = null
  let anglais: string | null = null

  // Check if page contains expected content
  if (!html.includes("NIVEAU LANGUES") && !html.includes("niveau langue")) {
    console.log("Language levels page does not contain expected content")
    return { francais, anglais }
  }

  // Try to find the table #ContentPlaceHolder1_GridView2
  const tableMatch = html.match(/<table[^>]*id=["']ContentPlaceHolder1_GridView2["'][^>]*>([\s\S]*?)<\/table>/i)
  if (!tableMatch) {
    console.log("Language levels table not found, trying fallback extraction")
    // Fallback: try to extract from any table or labels
    francais = cleanEmptyValue(extractTextById(html, "ContentPlaceHolder1_Label1") || extractTextById(html, "Label1"))
    anglais = cleanEmptyValue(extractTextById(html, "ContentPlaceHolder1_Label2") || extractTextById(html, "Label2"))
    return { francais, anglais }
  }

  const tableHtml = tableMatch[1]

  // Extract headers
  const headerRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi
  const headers: string[] = []
  let headerMatch
  while ((headerMatch = headerRegex.exec(tableHtml)) !== null) {
    headers.push(headerMatch[1].replace(/<[^>]+>/g, '').trim().toLowerCase())
  }

  // Find column indices
  const francaisIdx = headers.findIndex(h => h.includes("francais") || h.includes("français"))
  const anglaisIdx = headers.findIndex(h => h.includes("anglais") || h.includes("english"))

  // Extract first data row
  const rowMatch = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)
  if (rowMatch && rowMatch.length > 1) {
    // Skip header row (index 0), get first data row
    const dataRow = rowMatch[1]
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
    const cells: string[] = []
    let cellMatch
    while ((cellMatch = cellRegex.exec(dataRow)) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim())
    }

    if (francaisIdx >= 0 && cells[francaisIdx]) {
      francais = cleanEmptyValue(cells[francaisIdx])
    }
    if (anglaisIdx >= 0 && cells[anglaisIdx]) {
      anglais = cleanEmptyValue(cells[anglaisIdx])
    }
  }

  console.log("Parsed language levels:", { francais, anglais })
  return { francais, anglais }
}

// ============================================================================
// Fetch All Grades Function
// ============================================================================

interface AllGradesData {
  regularGrades: Grade[] | null
  principalResult: { moyenneGeneral: string | null; decision: string | null } | null
  rattrapageGrades: Grade[] | null
  rattrapageResult: { moyenneGeneral: string | null; decision: string | null } | null
  languageLevels: { francais: string | null; anglais: string | null } | null
  lastFetched: string
}

async function fetchAllGrades(): Promise<AllGradesData> {
  const result: AllGradesData = {
    regularGrades: null,
    principalResult: null,
    rattrapageGrades: null,
    rattrapageResult: null,
    languageLevels: null,
    lastFetched: new Date().toISOString()
  }

  // Fetch Regular Grades
  try {
    console.log("Fetching regular grades...")
    const response = await fetch(URLS.REGULAR_GRADES, { credentials: "include" })
    if (!isLoginPage(response.url)) {
      const html = await response.text()
      if (!html.includes("aucune note!")) {
        result.regularGrades = parseGradesFromHTML(html)
      }
    }
  } catch (e) {
    console.warn("Failed to fetch regular grades:", e)
  }

  // Fetch Principal Result
  try {
    console.log("Fetching principal result...")
    const response = await fetch(URLS.PRINCIPAL_RESULT, { credentials: "include" })
    if (!isLoginPage(response.url)) {
      const html = await response.text()
      result.principalResult = parseResultFromHTML(html)
    }
  } catch (e) {
    console.warn("Failed to fetch principal result:", e)
  }

  // Fetch Rattrapage Grades
  try {
    console.log("Fetching rattrapage grades...")
    const response = await fetch(URLS.RATTRAPAGE_GRADES, { credentials: "include" })
    if (!isLoginPage(response.url)) {
      const html = await response.text()
      if (!html.includes("aucune note!")) {
        result.rattrapageGrades = parseGradesFromHTML(html)
      }
    }
  } catch (e) {
    console.warn("Failed to fetch rattrapage grades:", e)
  }

  // Fetch Rattrapage Result
  try {
    console.log("Fetching rattrapage result...")
    const response = await fetch(URLS.RATTRAPAGE_RESULT, { credentials: "include" })
    if (!isLoginPage(response.url)) {
      const html = await response.text()
      result.rattrapageResult = parseResultFromHTML(html)
    }
  } catch (e) {
    console.warn("Failed to fetch rattrapage result:", e)
  }

  // Fetch Language Levels
  try {
    console.log("Fetching language levels...")
    const response = await fetch(URLS.LANGUAGE_LEVEL, { credentials: "include" })
    if (!isLoginPage(response.url)) {
      const html = await response.text()
      result.languageLevels = parseLanguageLevelsFromHTML(html)
    }
  } catch (e) {
    console.warn("Failed to fetch language levels:", e)
  }

  return result
}

// ============================================================================
// Main Login Logic
// ============================================================================

async function handleLogin(credentials: LoginCredentials): Promise<StudentData> {
  console.log("Starting login process for:", credentials.id)

  try {
    // Step 1: Load login page and get initial form data
    console.log("Loading login page...")
    const initialResponse = await fetch(URLS.LOGIN, {
      credentials: "include",
    })

    if (!initialResponse.ok) {
      throw new Error("Failed to load login page")
    }

    let html = await initialResponse.text()
    let formData = extractASPNetFormData(html)

    // Find form field names
    const idFieldName = findInputNameByPattern(html, ["textbox3", "textbox1"]) ?? "ctl00$ContentPlaceHolder1$TextBox3"
    console.log("Found ID field:", idFieldName)

    // Step 2: Check if there's a checkbox (GDPR consent, etc.)
    const checkboxName = findCheckboxName(html)

    if (checkboxName) {
      console.log("Checking consent checkbox...")
      const checkboxFormData = new URLSearchParams({
        ...formData,
        [idFieldName]: credentials.id,
        [checkboxName]: "on",
        __EVENTTARGET: checkboxName,
        __EVENTARGUMENT: "",
      })

      const checkboxResponse = await fetch(URLS.LOGIN, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: checkboxFormData,
        credentials: "include",
      })

      if (checkboxResponse.ok) {
        html = await checkboxResponse.text()
        formData = extractASPNetFormData(html)

        // Check for continue button
        const continueButtonName = findInputNameByPattern(html, ["continuer", "continue"])
        if (continueButtonName) {
          console.log("Clicking continue button...")
          const continueFormData = new URLSearchParams({
            ...formData,
            [idFieldName]: credentials.id,
            [checkboxName]: "on",
            __EVENTTARGET: continueButtonName,
            __EVENTARGUMENT: "",
          })

          const continueResponse = await fetch(URLS.LOGIN, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: continueFormData,
            credentials: "include",
          })

          if (continueResponse.ok) {
            html = await continueResponse.text()
            formData = extractASPNetFormData(html)
          }
        }
      }
    }

    // Step 3: Submit student ID (click "Suivant" button)
    const suivantButtonName = findInputNameByPattern(html, ["button3", "button1", "suivant", "next"]) ?? "ctl00$ContentPlaceHolder1$Button3"
    console.log("Submitting student ID...")

    const suivantFormData = new URLSearchParams({
      ...formData,
      [idFieldName]: credentials.id,
      ...(checkboxName ? { [checkboxName]: "on" } : {}),
      __EVENTTARGET: suivantButtonName,
      __EVENTARGUMENT: "",
    })

    const suivantResponse = await fetch(URLS.LOGIN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: suivantFormData,
      credentials: "include",
    })

    if (!suivantResponse.ok) {
      throw new Error("Failed to submit student ID")
    }

    html = await suivantResponse.text()
    formData = extractASPNetFormData(html)

    // Check if ID was incorrect (still on same page without password field)
    const passwordFieldName = findInputNameByPattern(html, ["textbox7"])
    const idFieldStillPresent = findInputNameByPattern(html, ["textbox3"])

    if (idFieldStillPresent && !passwordFieldName) {
      throw new Error("Identifiant incorrect !")
    }

    // Step 4: Submit password
    console.log("Submitting password...")
    const actualPasswordField = passwordFieldName ?? "ctl00$ContentPlaceHolder1$TextBox7"
    const connexionButtonName = findInputNameByPattern(html, ["buttonetudiant", "button2", "connexion", "connect"]) ?? "ctl00$ContentPlaceHolder1$ButtonEtudiant"

    const passwordFormData = new URLSearchParams({
      ...formData,
      [actualPasswordField]: credentials.password,
      __EVENTTARGET: connexionButtonName,
      __EVENTARGUMENT: "",
    })

    const loginResponse = await fetch(URLS.LOGIN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: passwordFormData,
      credentials: "include",
    })

    if (!loginResponse.ok) {
      throw new Error("Failed to submit password")
    }

    const finalUrl = loginResponse.url
    html = await loginResponse.text()

    // Check if password was incorrect
    const passwordStillPresent = findInputNameByPattern(html, ["textbox7"])
    if (isLoginPage(finalUrl) && passwordStillPresent) {
      throw new Error("Mot de passe incorrect !")
    }

    // Check for successful login
    const successIndicators = [
      "Vous pouvez consulter dans cet espace",
      "Espace Etudiant",
      "Accueil.aspx",
      "Label2",
      "Label3",
    ]

    const hasSuccessIndicator = successIndicators.some(indicator => html.includes(indicator))

    if (!hasSuccessIndicator && isLoginPage(finalUrl)) {
      throw new Error("Login failed - unknown error")
    }

    console.log("Login successful!")

    // Step 5: Fetch student data
    console.log("Fetching student info...")
    const homeResponse = await fetch(URLS.HOME, { credentials: "include" })
    const homeHtml = await homeResponse.text()

    // Check if redirected to login (session expired)
    if (isLoginPage(homeResponse.url)) {
      throw new Error("Session expired - please try again")
    }

    const studentInfo = parseStudentInfoFromHTML(homeHtml)

    // Fetch all grades data
    console.log("Fetching all grades...")
    const allGradesData = await fetchAllGrades()

    const studentData: StudentData = {
      id: credentials.id,
      name: studentInfo.name,
      className: studentInfo.className,
      grades: allGradesData.regularGrades,
      lastFetched: new Date().toISOString(),
    }

    console.log("Data fetched successfully:", studentData)
    console.log("All grades data:", allGradesData)

    // Store in local storage (student data and all grades separately)
    await chrome.storage.local.set({
      studentData,
      allGrades: allGradesData
    })
    console.log("Data saved to chrome.storage.local")

    // Return both studentData and allGrades so web app can store them
    return {
      ...studentData,
      allGrades: allGradesData
    }

  } catch (error) {
    console.error("Login error:", error)
    throw error
  }
}

// ============================================================================
// Message Handlers
// ============================================================================

/**
 * Safe wrapper for sendResponse to handle bfcache port closure
 * When a page is moved to the back/forward cache, the message port is closed
 * and sendResponse will fail. This wrapper catches that error gracefully.
 */
function safeSendResponse(sendResponse: (response: unknown) => void, response: unknown): void {
  try {
    sendResponse(response)
  } catch (error) {
    // Port is closed (page moved to bfcache) - this is expected behavior
    console.log("Message port closed (page likely cached):", error)
  }
}

// Handle messages from the website
chrome.runtime.onMessageExternal.addListener(
  (request, sender, sendResponse) => {
    console.log("Message received from website:", request)

    if (request.action === "LOGIN") {
      handleLogin(request.credentials)
        .then(result => safeSendResponse(sendResponse, { success: true, data: result }))
        .catch(error => safeSendResponse(sendResponse, { success: false, error: error.message }))
      return true // Keep the message channel open for async response
    }

    if (request.action === "GET_GRADES") {
      // Return stored grades data
      chrome.storage.local.get(["allGrades", "studentData"])
        .then(result => {
          if (result.allGrades) {
            safeSendResponse(sendResponse, { success: true, data: result.allGrades })
          } else {
            safeSendResponse(sendResponse, { success: false, error: "No grades data found. Please login first." })
          }
        })
        .catch(error => safeSendResponse(sendResponse, { success: false, error: error.message }))
      return true // Keep the message channel open for async response
    }

    if (request.action === "GET_STUDENT_DATA") {
      // Return stored student data
      chrome.storage.local.get(["studentData"])
        .then(result => {
          if (result.studentData) {
            safeSendResponse(sendResponse, { success: true, data: result.studentData })
          } else {
            safeSendResponse(sendResponse, { success: false, error: "No student data found. Please login first." })
          }
        })
        .catch(error => safeSendResponse(sendResponse, { success: false, error: error.message }))
      return true
    }

    return false
  }
)

chrome.action.onClicked.addListener(() => {
  console.log("Extension clicked")
})

chrome.commands.onCommand.addListener((command) => {
  if (command === "test") {
    console.log("Test command executed")
  }
})

