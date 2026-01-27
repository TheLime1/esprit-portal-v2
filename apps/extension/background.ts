/**
 * Esprit Portal Extension - Background Service Worker
 * 
 * This implements the Esprit portal login flow using browser-native APIs.
 * Based on the endpoints from @lime1/esprit-ts but adapted for browser extensions.
 * 
 * Multi-Layer Caching Strategy:
 * 1. localStorage (content script) - instant display
 * 2. Supabase (cloud) - cross-device sync
 * 3. Portal fetch - fresh data from old portal
 * 
 * Cache Duration: 4 hours before refresh
 * Fetch Trigger: Only when user visits esprit-tn.com website
 * 
 * NOTE: Service workers don't have access to DOMParser, so we use regex for HTML parsing.
 * 
 * BLACKBOARD INTEGRATION:
 * - Automatically captures cookies when user logs into Blackboard
 * - Syncs session data to the web app for homework/course tracking
 */

import {
  getStudentDataFromSupabase,
  upsertStudentDataToSupabase,
  upsertBlackboardData,
  getBlackboardDataFromSupabase,
  isDataStale,
  isNewerTimestamp,
  CACHE_DURATION_HOURS,
  type GradesData,
  type Credit,
  type BBCourseRow,
  type BBAssignmentRow,
  type BBAttendanceRow,
  type BBAttendanceStats,
} from "./supabase-client"

// ============================================================================
// Sync State - Prevent race conditions
// ============================================================================
let espritSyncInProgress = false

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

// Blackboard Integration Constants
const BB_DOMAIN = "esprit.blackboard.com"
const BB_API_V1 = `https://${BB_DOMAIN}/learn/api/public/v1`
const BB_API_V2 = `https://${BB_DOMAIN}/learn/api/public/v2`
const WEB_APP_URL = process.env.PLASMO_PUBLIC_WEB_APP_URL || "http://localhost:3000"

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

interface Credit {
  /** Raw data from each column - keys depend on table headers */
  [key: string]: string
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

/**
 * Parse credits from HTML (based on esprit-ts approach)
 * Credits are in table #ContentPlaceHolder1_GridView1 with dynamic columns
 */
function parseCreditsFromHTML(html: string): Credit[] | null {
  // Try to find the main credits table
  let tableMatch = html.match(/<table[^>]*id=["']ContentPlaceHolder1_GridView1["'][^>]*>([\s\S]*?)<\/table>/i)

  // Fallback: search for table with Année or enseignement headers
  if (!tableMatch) {
    const tables = html.match(/<table[^>]*>([\s\S]*?)<\/table>/gi) || []
    for (const tableHtml of tables) {
      if (tableHtml.includes("Année") || tableHtml.includes("enseignement") || tableHtml.includes("Crédits")) {
        tableMatch = [tableHtml, tableHtml]
        break
      }
    }
  }

  if (!tableMatch) {
    console.log("Credits table not found")
    return null
  }

  const tableHtml = tableMatch[1] || tableMatch[0]

  // Extract headers
  const headerRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi
  const headers: string[] = []
  let headerMatch
  while ((headerMatch = headerRegex.exec(tableHtml)) !== null) {
    // Decode HTML entities in headers (e.g., &#233; -> é)
    const headerText = decodeHtmlEntities(headerMatch[1].replace(/<[^>]+>/g, "").trim())
    headers.push(headerText)
  }

  if (headers.length === 0) {
    console.log("No headers found in credits table")
    return null
  }

  console.log("Credits table headers:", headers)

  // Extract data rows
  const credits: Credit[] = []
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch
  let isFirstRow = true

  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    // Skip header row
    if (isFirstRow) {
      isFirstRow = false
      continue
    }

    const rowHtml = rowMatch[1]
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
    const cells: string[] = []
    let cellMatch

    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      // Decode HTML entities in cell values
      const cellText = decodeHtmlEntities(cellMatch[1].replace(/<[^>]+>/g, "").trim())
      cells.push(cellText)
    }

    if (cells.length > 0) {
      const credit: Credit = {}
      headers.forEach((header, index) => {
        credit[header] = cells[index] ?? ""
      })
      credits.push(credit)
    }
  }

  console.log("Parsed credits:", credits)
  return credits.length > 0 ? credits : null
}

/**
 * Fetch credits from the portal
 */
async function fetchCredits(): Promise<Credit[] | null> {
  try {
    console.log("Fetching credits...")
    const response = await fetch(URLS.CREDITS, { credentials: "include" })

    if (isLoginPage(response.url)) {
      console.log("Session expired - redirected to login")
      return null
    }

    const html = await response.text()
    return parseCreditsFromHTML(html)
  } catch (e) {
    console.error("Failed to fetch credits:", e)
    return null
  }
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

    // Fetch credits data
    console.log("Fetching credits...")
    const creditsData = await fetchCredits()
    console.log("Credits fetched:", creditsData)

    const studentData: StudentData = {
      id: credentials.id,
      name: studentInfo.name,
      className: studentInfo.className,
      grades: allGradesData.regularGrades,
      lastFetched: new Date().toISOString(),
    }

    console.log("Data fetched successfully:", studentData)
    console.log("All grades data:", allGradesData)

    // Store in local storage (student data, all grades, and credits separately)
    const cacheTimestamp = new Date().toISOString()
    await chrome.storage.local.set({
      studentData,
      allGrades: allGradesData,
      credits: creditsData,
      cacheTimestamp, // Explicit timestamp for staleness checks
    })
    console.log(`Data saved to chrome.storage.local at ${cacheTimestamp} (including credits)`)

    // Return studentData, allGrades, and credits so web app can store them
    return {
      ...studentData,
      allGrades: allGradesData,
      credits: creditsData
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

/**
 * Get cached credentials from storage
 */
async function getCachedCredentials(): Promise<{ id: string; password: string } | null> {
  const result = await chrome.storage.local.get(["cachedCredentials"])
  return result.cachedCredentials || null
}

/**
 * Save credentials to storage for cache refresh
 */
async function saveCachedCredentials(id: string, password: string): Promise<void> {
  await chrome.storage.local.set({ cachedCredentials: { id, password } })
}

/**
 * Multi-layer cache lookup with Supabase comparison
 * Flow:
 * 1. Return local data instantly (if exists)
 * 2. Check Supabase in parallel → if newer AND fresh, replace local
 * 3. If no local, use Supabase
 * 4. If all stale or missing, trigger portal fetch
 */
async function getDataWithCaching(studentId: string, password: string): Promise<{
  data: StudentData & { allGrades?: AllGradesData; credits?: Credit[] } | null
  source: "cache" | "supabase" | "portal"
  needsRefresh: boolean
  supabaseWasNewer?: boolean
}> {
  // Step 1: Check chrome.storage.local (extension's localStorage equivalent)
  const localResult = await chrome.storage.local.get(["studentData", "allGrades", "credits", "cacheTimestamp"])
  
  const hasLocalCache = localResult.studentData?.id === studentId
  const localTimestamp = localResult.cacheTimestamp || localResult.studentData?.lastFetched
  
  if (hasLocalCache) {
    const localIsStale = isDataStale(localTimestamp)
    console.log(`📦 Local cache found. Stale: ${localIsStale}, Last fetched: ${localTimestamp}`)
    
    // Step 2: Also check Supabase to see if it has newer data
    console.log("☁️ Checking Supabase for newer data...")
    const supabaseData = await getStudentDataFromSupabase(studentId, password)
    
    if (supabaseData && isNewerTimestamp(localTimestamp, supabaseData.updated_at)) {
      const supabaseIsStale = isDataStale(supabaseData.updated_at)
      
      if (!supabaseIsStale) {
        // Supabase has NEWER and FRESH data - replace local cache
        console.log(`☁️ Supabase has newer fresh data (${supabaseData.updated_at}), replacing local cache`)
        
        const studentData: StudentData = {
          id: supabaseData.student_id,
          name: supabaseData.name,
          className: supabaseData.class_name,
          grades: supabaseData.grades_data?.regularGrades || null,
          lastFetched: supabaseData.updated_at,
        }
        
        // Replace local cache with Supabase data
        await chrome.storage.local.set({
          studentData,
          allGrades: supabaseData.grades_data,
          credits: supabaseData.credits_data,
          cacheTimestamp: supabaseData.updated_at,
        })
        
        return {
          data: {
            ...studentData,
            allGrades: supabaseData.grades_data as AllGradesData,
            credits: supabaseData.credits_data as Credit[],
          },
          source: "supabase",
          needsRefresh: false,
          supabaseWasNewer: true,
        }
      } else {
        // Supabase has newer but STALE data - use local, will need refresh
        console.log(`☁️ Supabase has newer but stale data, keeping local, needs refresh`)
      }
    } else {
      console.log(`📦 Local cache is up-to-date or newer than Supabase`)
    }
    
    // Return local data (either Supabase wasn't newer, or both are stale)
    return {
      data: {
        ...localResult.studentData,
        allGrades: localResult.allGrades,
        credits: localResult.credits,
      },
      source: "cache",
      needsRefresh: localIsStale,
    }
  }
  
  console.log("📦 No local cache, checking Supabase...")
  
  // Step 3: No local cache - check Supabase
  const supabaseData = await getStudentDataFromSupabase(studentId, password)
  
  if (supabaseData) {
    const isStale = isDataStale(supabaseData.updated_at)
    
    console.log(`☁️ Supabase data found. Stale: ${isStale}, Updated at: ${supabaseData.updated_at}`)
    
    // Convert Supabase format to local format
    const studentData: StudentData = {
      id: supabaseData.student_id,
      name: supabaseData.name,
      className: supabaseData.class_name,
      grades: supabaseData.grades_data?.regularGrades || null,
      lastFetched: supabaseData.updated_at,
    }
    
    // Save to local cache
    await chrome.storage.local.set({
      studentData,
      allGrades: supabaseData.grades_data,
      credits: supabaseData.credits_data,
      cacheTimestamp: supabaseData.updated_at,
    })
    
    return {
      data: {
        ...studentData,
        allGrades: supabaseData.grades_data as AllGradesData,
        credits: supabaseData.credits_data as Credit[],
      },
      source: "supabase",
      needsRefresh: isStale,
    }
  }
  
  console.log("📦 No Supabase data found, will need portal fetch")
  
  // Step 4: No cached data anywhere, needs fresh fetch
  return {
    data: null,
    source: "portal",
    needsRefresh: true,
  }
}

/**
 * Sync data to Supabase after portal fetch
 */
async function syncToSupabase(
  studentId: string,
  password: string,
  name: string | null,
  className: string | null,
  allGrades: AllGradesData | null,
  credits: Credit[] | null
): Promise<void> {
  console.log("🔄 Syncing pending Blackboard data to Supabase...", { studentId, name, className })
  try {
    const success = await upsertStudentDataToSupabase(
      studentId,
      password,
      name,
      className,
      allGrades as GradesData,
      credits
    )
    if (success) {
      console.log("✅ Data synced to Supabase successfully")
    } else {
      console.error("❌ Supabase sync returned false - check RPC function logs")
    }
  } catch (e) {
    console.error("❌ Failed to sync to Supabase:", e)
  }
}

// Handle messages from the website
chrome.runtime.onMessageExternal.addListener(
  (request, sender, sendResponse) => {
    console.log("Message received from website:", request)

    if (request.action === "LOGIN") {
      (async () => {
        try {
          // Prevent concurrent login operations
          if (espritSyncInProgress) {
            console.log("⏳ Login already in progress, waiting...")
            safeSendResponse(sendResponse, { success: false, error: "Login already in progress" })
            return
          }
          espritSyncInProgress = true
          
          const { id, password } = request.credentials
          
          // Step 1: Save credentials for future refreshes
          await saveCachedCredentials(id, password)
          
          // Step 2: Check caches first (fastest route)
          console.log("🔍 Checking caches before login...")
          const cached = await getDataWithCaching(id, password)
          
          if (cached.data && !cached.needsRefresh) {
            // Fresh data found in cache - no need to fetch from portal
            console.log(`✅ Fresh data found in ${cached.source}, skipping portal fetch`)
            
            // Sync any pending Blackboard data
            syncPendingBlackboardData(id)
            
            espritSyncInProgress = false
            safeSendResponse(sendResponse, { 
              success: true, 
              data: cached.data,
              source: cached.source,
              cached: true,
            })
            return
          }
          
          // Step 3: Cache is stale or missing - fetch from portal
          console.log(`🌐 ${cached.data ? "Cache is stale" : "No cache"}, fetching from portal...`)
          const result = await handleLogin(request.credentials)
          
          // Step 4: Sync to Supabase in background
          syncToSupabase(
            id,
            password,
            result.name,
            result.className,
            result.allGrades,
            result.credits
          )
          
          // Sync any pending Blackboard data
          syncPendingBlackboardData(id)
          
          espritSyncInProgress = false
          safeSendResponse(sendResponse, { success: true, data: result, source: "portal" })
        } catch (error) {
          espritSyncInProgress = false
          safeSendResponse(sendResponse, { success: false, error: error.message })
        }
      })()
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

    if (request.action === "GET_CREDITS") {
      // Fetch credits from portal
      fetchCredits()
        .then(credits => {
          if (credits) {
            // Store in chrome.storage for future use
            chrome.storage.local.set({ credits })
            safeSendResponse(sendResponse, { success: true, data: credits })
          } else {
            safeSendResponse(sendResponse, { success: false, error: "No credits data found. Make sure you're logged in." })
          }
        })
        .catch(error => safeSendResponse(sendResponse, { success: false, error: error.message }))
      return true
    }

    // New action: Check cache and optionally refresh
    if (request.action === "CHECK_CACHE") {
      const { studentId, password } = request
      
      getDataWithCaching(studentId, password)
        .then(async (result) => {
          if (result.needsRefresh && result.source !== "portal") {
            // Return cached data immediately, but flag that refresh is needed
            safeSendResponse(sendResponse, {
              success: true,
              data: result.data,
              source: result.source,
              needsRefresh: true,
            })
          } else if (result.source === "portal") {
            // No cached data, respond with empty and needsRefresh flag
            safeSendResponse(sendResponse, {
              success: false,
              data: null,
              source: "portal",
              needsRefresh: true,
              error: "No cached data. Login required.",
            })
          } else {
            // Fresh cached data
            safeSendResponse(sendResponse, {
              success: true,
              data: result.data,
              source: result.source,
              needsRefresh: false,
            })
          }
        })
        .catch(error => safeSendResponse(sendResponse, { success: false, error: error.message }))
      return true
    }

    // New action: Background refresh (called by content script when cache is stale)
    if (request.action === "BACKGROUND_REFRESH") {
      (async () => {
        try {
          // Prevent concurrent refresh operations
          if (espritSyncInProgress) {
            console.log("⏳ Refresh already in progress, skipping...")
            safeSendResponse(sendResponse, { success: false, error: "Refresh already in progress", skipped: true })
            return
          }
          espritSyncInProgress = true
          
          const credentials = await getCachedCredentials()
          if (!credentials) {
            espritSyncInProgress = false
            safeSendResponse(sendResponse, { success: false, error: "No cached credentials. Login required." })
            return
          }
          
          // Step 1: Check caches with Supabase comparison
          console.log("🔍 Checking caches before refresh...")
          const cached = await getDataWithCaching(credentials.id, credentials.password)
          
          if (cached.data && !cached.needsRefresh) {
            // Fresh data found (possibly updated from Supabase)
            console.log(`✅ Fresh data found in ${cached.source}${cached.supabaseWasNewer ? " (updated from Supabase)" : ""}, skipping portal fetch`)
            espritSyncInProgress = false
            safeSendResponse(sendResponse, {
              success: true,
              data: cached.data,
              source: cached.source,
              skipped: !cached.supabaseWasNewer,
              updatedFromSupabase: cached.supabaseWasNewer || false,
            })
            return
          }
          
          // Step 2: Data is stale - fetch from portal
          const cacheTimestamp = cached.data?.lastFetched
          console.log(`🔄 Data is stale (last fetched: ${cacheTimestamp}), fetching from portal...`)
          
          const result = await handleLogin(credentials)
          
          // Step 3: Sync to Supabase
          await syncToSupabase(
            credentials.id,
            credentials.password,
            result.name,
            result.className,
            result.allGrades,
            result.credits
          )
          
          espritSyncInProgress = false
          safeSendResponse(sendResponse, { success: true, data: result, source: "portal" })
        } catch (error) {
          espritSyncInProgress = false
          safeSendResponse(sendResponse, { success: false, error: error.message })
        }
      })()
      return true
    }

    // New action: Get cache status (for debugging/UI)
    if (request.action === "GET_CACHE_STATUS") {
      chrome.storage.local.get(["studentData", "allGrades", "credits", "cacheTimestamp", "cachedCredentials"])
        .then(async (result) => {
          const cacheTimestamp = result.cacheTimestamp || result.studentData?.lastFetched
          const isStale = isDataStale(cacheTimestamp)
          const hasCredentials = !!result.cachedCredentials
          
          safeSendResponse(sendResponse, {
            success: true,
            data: {
              hasLocalCache: !!result.studentData,
              cacheTimestamp,
              isStale,
              hasCredentials,
              cacheDurationHours: CACHE_DURATION_HOURS,
            },
          })
        })
        .catch(error => safeSendResponse(sendResponse, { success: false, error: error.message }))
      return true
    }

    // ========================================================================
    // Blackboard handlers (accessible from web app)
    // ========================================================================
    
    if (request.action === "GET_BB_STATUS") {
      (async () => {
        // First check if we have cached data
        const stored = await chrome.storage.local.get(["bbSession"])
        
        if (stored.bbSession?.user) {
          // Return full data so web app can cache it properly
          safeSendResponse(sendResponse, {
            connected: true,
            user: stored.bbSession.user,
            courses: stored.bbSession.courses || [],
            assignments: stored.bbSession.assignments || [],
            attendance: stored.bbSession.attendance || [],
            courseCount: stored.bbSession.courses?.length || 0,
            assignmentCount: stored.bbSession.assignments?.length || 0,
            attendanceStats: stored.bbSession.attendanceStats || null,
            lastSync: stored.bbSession.savedAt,
          })
          return
        }
        
        // No cached data, check live Blackboard session
        const isAuth = await isBlackboardAuthenticated()
        if (!isAuth) {
          safeSendResponse(sendResponse, { connected: false })
          return
        }

        const user = await getBlackboardUser()
        if (!user) {
          safeSendResponse(sendResponse, { connected: false })
          return
        }

        safeSendResponse(sendResponse, {
          connected: true,
          user: {
            id: user.id,
            name: `${user.name?.given || ""} ${user.name?.family || ""}`.trim(),
            username: user.userName,
            email: user.contact?.email,
          },
          courses: [],
          assignments: [],
          attendance: [],
          courseCount: 0,
          assignmentCount: 0,
          attendanceStats: null,
          lastSync: null,
        })
      })()
      return true
    }

    if (request.action === "SYNC_BB_NOW") {
      handleBlackboardLogin()
        .then(() => safeSendResponse(sendResponse, { success: true }))
        .catch((error) => safeSendResponse(sendResponse, { success: false, error: error.message }))
      return true
    }

    if (request.action === "GET_BB_COURSES") {
      (async () => {
        const stored = await chrome.storage.local.get(["bbSession"])
        safeSendResponse(sendResponse, {
          success: true,
          courses: stored.bbSession?.courses || [],
          lastSync: stored.bbSession?.savedAt,
        })
      })()
      return true
    }

    if (request.action === "GET_BB_ASSIGNMENTS") {
      (async () => {
        const stored = await chrome.storage.local.get(["bbSession"])
        const assignments = stored.bbSession?.assignments || []
        
        // Calculate nearest deadline
        const now = new Date()
        const pendingWithDue = assignments.filter(
          (a: BBAssignmentRow) => a.status !== "Graded" && a.due && new Date(a.due) > now
        )
        pendingWithDue.sort((a: BBAssignmentRow, b: BBAssignmentRow) => 
          new Date(a.due!).getTime() - new Date(b.due!).getTime()
        )
        
        const nearestDeadline = pendingWithDue[0] || null
        let deadlineAlert = null

        if (nearestDeadline?.due) {
          const dueDate = new Date(nearestDeadline.due)
          const diffMs = dueDate.getTime() - now.getTime()
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
          const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
          
          let timeLeft = ""
          if (diffDays > 0) {
            timeLeft = `${diffDays} day${diffDays > 1 ? "s" : ""} ${diffHours}h`
          } else if (diffHours > 0) {
            timeLeft = `${diffHours} hour${diffHours > 1 ? "s" : ""}`
          } else {
            timeLeft = "Less than 1 hour"
          }

          deadlineAlert = {
            assignment: nearestDeadline.name,
            course: nearestDeadline.courseName,
            timeLeft,
            dueDate: nearestDeadline.due,
          }
        }

        safeSendResponse(sendResponse, {
          success: true,
          assignments,
          deadlineAlert,
          total: assignments.length,
          pending: assignments.filter((a: BBAssignmentRow) => a.status !== "Graded").length,
        })
      })()
      return true
    }

    if (request.action === "GET_BB_FULL_DATA") {
      (async () => {
        const stored = await chrome.storage.local.get(["bbSession"])
        if (!stored.bbSession) {
          safeSendResponse(sendResponse, { success: false, error: "No Blackboard data cached" })
          return
        }
        safeSendResponse(sendResponse, {
          success: true,
          data: stored.bbSession,
        })
      })()
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

// ============================================================================
// BLACKBOARD INTEGRATION
// ============================================================================

interface BBCookie {
  name: string
  value: string
  domain: string
  path: string
  expirationDate?: number
}

interface BBUser {
  id: string
  userName: string
  name?: {
    given: string
    family: string
  }
  contact?: {
    email: string
  }
}

interface BBCourse {
  id: string
  courseId: string
  name: string
  externalAccessUrl?: string
}

/**
 * Get all cookies for the Blackboard domain
 */
async function getBlackboardCookies(): Promise<BBCookie[]> {
  return new Promise((resolve) => {
    chrome.cookies.getAll({ domain: BB_DOMAIN }, (cookies) => {
      resolve(
        cookies.map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          expirationDate: c.expirationDate,
        }))
      )
    })
  })
}

/**
 * Check if user is authenticated with Blackboard
 */
async function isBlackboardAuthenticated(): Promise<boolean> {
  const cookies = await getBlackboardCookies()
  const hasBbRouter = cookies.some((c) => c.name === "BbRouter")
  const hasSession = cookies.some((c) => c.name === "JSESSIONID")
  return hasBbRouter && hasSession
}

/**
 * Make authenticated request to Blackboard API
 */
async function bbFetch(endpoint: string, version: "v1" | "v2" = "v1"): Promise<Response> {
  const baseUrl = version === "v2" ? BB_API_V2 : BB_API_V1
  const url = `${baseUrl}${endpoint}`

  // Get cookies and build Cookie header manually (service workers need this)
  const cookies = await getBlackboardCookies()
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join("; ")

  return fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Cookie: cookieHeader,
    },
  })
}

/**
 * Get paginated results from Blackboard API
 */
async function bbGetPaginated<T>(endpoint: string, version: "v1" | "v2" = "v1"): Promise<T[]> {
  const allResults: T[] = []
  let currentOffset = 0
  const limit = 100

  while (true) {
    const separator = endpoint.includes("?") ? "&" : "?"
    const paginatedEndpoint = `${endpoint}${separator}offset=${currentOffset}&limit=${limit}`

    const response = await bbFetch(paginatedEndpoint, version)

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("AUTH_EXPIRED")
      }
      throw new Error(`API_ERROR_${response.status}`)
    }

    const data = await response.json()
    const results = data.results || []
    allResults.push(...results)

    if (!data.paging?.nextPage || results.length < limit) {
      break
    }

    currentOffset += limit
  }

  return allResults
}

/**
 * Validate Blackboard session and get current user
 */
async function getBlackboardUser(): Promise<BBUser | null> {
  try {
    const response = await bbFetch("/users/me")
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

/**
 * Get enrolled courses from Blackboard
 */
async function getBlackboardCourses(userId: string): Promise<BBCourse[]> {
  const memberships = await bbGetPaginated<{ courseId: string }>(`/users/${userId}/courses`)
  const courses: BBCourse[] = []

  for (const membership of memberships) {
    if (!membership.courseId) continue

    try {
      const response = await bbFetch(`/courses/${membership.courseId}`)
      if (response.ok) {
        const course = await response.json()
        if (course.externalAccessUrl) {
          courses.push(course)
        }
      }
    } catch (e) {
      console.warn(`Could not fetch course ${membership.courseId}:`, e)
    }
  }

  return courses
}

// ============================================================================
// Blackboard Assignments (Homework)
// ============================================================================

interface BBAssignment {
  id: string
  contentId: string | null
  name: string
  courseId: string
  courseName: string | null
  due: string | null
  scorePossible: number | null
  score: number | null
  status: string
  submitted: boolean
  graded: boolean
  isPastDue: boolean
  acceptsLate: boolean
  gradingType: string
}

/**
 * Get assignments for a specific course
 * Based on Python client's get_course_assignments()
 */
async function getBlackboardCourseAssignments(
  courseId: string,
  userId: string,
  courseName: string | null = null
): Promise<BBAssignment[]> {
  const assignments: BBAssignment[] = []

  try {
    // Get gradebook columns from v2 API
    const columns = await bbGetPaginated<{
      id: string
      name: string
      contentId?: string
      grading?: { type?: string; due?: string }
      score?: { possible?: number }
    }>(`/courses/${courseId}/gradebook/columns`, "v2")

    for (const column of columns) {
      const columnId = column.id
      const grading = column.grading || {}
      const gradingType = grading.type || "Manual"

      // Skip calculated columns (like Total, Weighted Total)
      if (gradingType === "Calculated") continue

      const due = grading.due || null
      let isPastDue = false
      if (due) {
        try {
          const dueDate = new Date(due)
          isPastDue = new Date() > dueDate
        } catch {
          // Invalid date
        }
      }

      // Get user's grade for this column
      let score: number | null = null
      let status: string = "NotSubmitted"
      let graded = false
      let submitted = false

      try {
        const gradeResponse = await bbFetch(
          `/courses/${courseId}/gradebook/columns/${columnId}/users/${userId}`
        )
        if (gradeResponse.ok) {
          const grade = await gradeResponse.json()
          const gradeStatus = grade.status
          score = grade.score ?? null

          if (gradeStatus === "Graded") {
            status = "Graded"
            graded = true
            submitted = true
          } else if (gradeStatus === "NeedsGrading") {
            status = "Submitted"
            submitted = true
          } else if (gradeStatus) {
            status = gradeStatus
            submitted = true
          } else if (score !== null) {
            status = "Graded"
            graded = true
            submitted = true
          }
        }
      } catch {
        // No grade record - not submitted
      }

      // Check if late submissions are allowed
      let acceptsLate = true
      const contentId = column.contentId || null
      if (contentId) {
        try {
          const contentResponse = await bbFetch(
            `/courses/${courseId}/contents/${contentId}`
          )
          if (contentResponse.ok) {
            const content = await contentResponse.json()
            const handler = content.contentHandler || {}
            acceptsLate = !handler.isLateAttemptCreationDisallowed
          }
        } catch {
          // Default to accepting late
        }
      }

      assignments.push({
        id: columnId,
        contentId,
        name: column.name || "Unknown",
        courseId,
        courseName,
        due,
        scorePossible: column.score?.possible ?? null,
        score,
        status,
        submitted,
        graded,
        isPastDue,
        acceptsLate,
        gradingType,
      })
    }
  } catch (e) {
    console.warn(`Could not fetch assignments for course ${courseId}:`, e)
  }

  return assignments
}

/**
 * Get all assignments from all courses
 */
async function getBlackboardAllAssignments(
  userId: string,
  courses: BBCourse[]
): Promise<BBAssignment[]> {
  const allAssignments: BBAssignment[] = []

  for (const course of courses) {
    const courseAssignments = await getBlackboardCourseAssignments(
      course.id,
      userId,
      course.name
    )
    allAssignments.push(...courseAssignments)
  }

  return allAssignments
}

// ============================================================================
// Blackboard Attendance
// ============================================================================

interface BBAttendanceRecord {
  meetingId: string
  meetingName: string | null
  status: string
  courseId: string
  courseName: string | null
}

/**
 * Get attendance records for a specific course
 */
async function getBlackboardCourseAttendance(
  courseId: string,
  userId: string,
  courseName: string | null = null
): Promise<BBAttendanceRecord[]> {
  const records: BBAttendanceRecord[] = []

  try {
    // Get course meetings
    const meetings = await bbGetPaginated<{
      id: string
      name?: string
    }>(`/courses/${courseId}/meetings`)

    for (const meeting of meetings) {
      try {
        const attendanceResponse = await bbFetch(
          `/courses/${courseId}/meetings/${meeting.id}/users/${userId}`
        )
        if (attendanceResponse.ok) {
          const attendance = await attendanceResponse.json()
          records.push({
            meetingId: meeting.id,
            meetingName: meeting.name || null,
            status: attendance.status || "unknown",
            courseId,
            courseName,
          })
        } else {
          records.push({
            meetingId: meeting.id,
            meetingName: meeting.name || null,
            status: "unknown",
            courseId,
            courseName,
          })
        }
      } catch {
        records.push({
          meetingId: meeting.id,
          meetingName: meeting.name || null,
          status: "unknown",
          courseId,
          courseName,
        })
      }
    }
  } catch (e) {
    console.warn(`Could not fetch attendance for course ${courseId}:`, e)
  }

  return records
}

/**
 * Get all attendance from all courses
 */
async function getBlackboardAllAttendance(
  userId: string,
  courses: BBCourse[]
): Promise<BBAttendanceRecord[]> {
  const allAttendance: BBAttendanceRecord[] = []

  for (const course of courses) {
    const courseAttendance = await getBlackboardCourseAttendance(
      course.id,
      userId,
      course.name
    )
    allAttendance.push(...courseAttendance)
  }

  return allAttendance
}

/**
 * Calculate attendance percentage
 */
function calculateAttendancePercentage(records: BBAttendanceRecord[]): {
  present: number
  absent: number
  total: number
  percentage: number
} {
  const total = records.length
  let present = 0
  let absent = 0

  for (const record of records) {
    const status = record.status.toLowerCase()
    if (["present", "late", "excused"].includes(status)) {
      present++
    } else if (status === "absent") {
      absent++
    }
  }

  const percentage = total > 0 ? Math.round((present / total) * 100) : 0

  return { present, absent, total, percentage }
}

// ============================================================================
// Blackboard Data Cache (Local Storage Layer)
// ============================================================================

interface BBLocalCache {
  user: {
    id: string
    name: string
    username: string
    email?: string
  }
  courses: BBCourseRow[]
  assignments: BBAssignmentRow[]
  attendance: BBAttendanceRow[]
  attendanceStats: BBAttendanceStats
  savedAt: string
}

/**
 * Get Blackboard data with multi-layer caching + Supabase comparison
 * Flow:
 * 1. Return local data instantly (if exists)
 * 2. Check Supabase → if newer AND fresh, replace local
 * 3. If no local, use Supabase
 * 4. If all stale or missing, trigger fresh fetch
 */
async function getBlackboardDataWithCaching(studentId: string): Promise<{
  data: BBLocalCache | null
  source: "cache" | "supabase" | "none"
  needsRefresh: boolean
  supabaseWasNewer?: boolean
}> {
  // Step 1: Check chrome.storage.local
  const localResult = await chrome.storage.local.get(["bbSession"])
  
  const hasLocalCache = localResult.bbSession?.user
  const localTimestamp = localResult.bbSession?.savedAt
  
  if (hasLocalCache) {
    const localIsStale = isDataStale(localTimestamp)
    console.log(`📦 BB Local cache found. Stale: ${localIsStale}, Last synced: ${localTimestamp}`)
    
    // Step 2: Also check Supabase to see if it has newer data
    console.log("☁️ Checking Supabase for newer BB data...")
    const supabaseData = await getBlackboardDataFromSupabase(studentId)
    
    if (supabaseData && isNewerTimestamp(localTimestamp, supabaseData.lastSync)) {
      const supabaseIsStale = isDataStale(supabaseData.lastSync)
      
      if (!supabaseIsStale) {
        // Supabase has NEWER and FRESH data - replace local cache
        console.log(`☁️ Supabase has newer fresh BB data (${supabaseData.lastSync}), replacing local cache`)
        
        const localData: BBLocalCache = {
          user: {
            id: supabaseData.bbUserId,
            name: supabaseData.bbUsername,
            username: supabaseData.bbUsername,
          },
          courses: supabaseData.courses,
          assignments: supabaseData.assignments,
          attendance: supabaseData.attendance,
          attendanceStats: supabaseData.attendanceStats,
          savedAt: supabaseData.lastSync,
        }
        
        // Replace local cache with Supabase data
        await chrome.storage.local.set({ bbSession: localData })
        
        return {
          data: localData,
          source: "supabase",
          needsRefresh: false,
          supabaseWasNewer: true,
        }
      } else {
        console.log(`☁️ Supabase has newer but stale BB data, keeping local, needs refresh`)
      }
    } else {
      console.log(`📦 BB Local cache is up-to-date or newer than Supabase`)
    }
    
    // Return local data
    return {
      data: localResult.bbSession as BBLocalCache,
      source: "cache",
      needsRefresh: localIsStale,
    }
  }
  
  console.log("📦 No BB local cache, checking Supabase...")
  
  // Step 3: No local cache - check Supabase
  const supabaseData = await getBlackboardDataFromSupabase(studentId)
  
  if (supabaseData) {
    const isStale = isDataStale(supabaseData.lastSync)
    
    console.log(`☁️ BB Supabase data found. Stale: ${isStale}, Last sync: ${supabaseData.lastSync}`)
    
    // Convert to local format and cache locally
    const localData: BBLocalCache = {
      user: {
        id: supabaseData.bbUserId,
        name: supabaseData.bbUsername,
        username: supabaseData.bbUsername,
      },
      courses: supabaseData.courses,
      assignments: supabaseData.assignments,
      attendance: supabaseData.attendance,
      attendanceStats: supabaseData.attendanceStats,
      savedAt: supabaseData.lastSync,
    }
    
    // Save to local cache
    await chrome.storage.local.set({ bbSession: localData })
    
    return {
      data: localData,
      source: "supabase",
      needsRefresh: isStale,
    }
  }
  
  console.log("📦 No BB data in Supabase, needs fresh fetch")
  
  return {
    data: null,
    source: "none",
    needsRefresh: true,
  }
}

/**
 * Save Blackboard data to local cache
 */
async function saveBBToLocalCache(data: BBLocalCache): Promise<void> {
  await chrome.storage.local.set({ bbSession: data })
  console.log("💾 BB data saved to local cache")
}

/**
 * Sync pending Blackboard data to Supabase
 * Called after Esprit Portal login to sync any BB data that was captured before login
 */
async function syncPendingBlackboardData(studentId: string): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(["bbSession"])
    
    if (!stored.bbSession || !stored.bbSession.user) {
      console.log("📦 No pending Blackboard data to sync")
      return
    }
    
    const bbSession = stored.bbSession as BBLocalCache
    
    console.log("🔄 Syncing pending Blackboard data to Supabase...")
    
    const success = await upsertBlackboardData(
      studentId,
      bbSession.user.id,
      bbSession.user.username,
      bbSession.courses,
      bbSession.assignments,
      bbSession.attendance,
      bbSession.attendanceStats
    )
    
    if (success) {
      console.log("✅ Pending Blackboard data synced to Supabase")
    } else {
      console.warn("⚠️ Failed to sync pending Blackboard data")
    }
  } catch (error) {
    console.warn("❌ Error syncing pending Blackboard data:", error)
  }
}

// ============================================================================
// Blackboard Sync State - Prevent spam
// ============================================================================
let lastBBSyncTime = 0
let bbSyncInProgress = false
const BB_SYNC_COOLDOWN_MS = 30000 // 30 seconds between syncs

/**
 * Sync Blackboard session to web app
 */
async function syncBlackboardToWebApp(
  user: BBUser,
  courses: BBCourse[],
  cookies: BBCookie[]
): Promise<void> {
  // Get stored Esprit student ID to link accounts
  const stored = await chrome.storage.local.get(["cachedCredentials"])
  const studentId = stored.cachedCredentials?.id

  console.log("📊 Fetching assignments and attendance...")
  
  // Fetch assignments (homework) for all courses
  const assignments = await getBlackboardAllAssignments(user.id, courses)
  console.log(`📝 Found ${assignments.length} assignments`)
  
  // Fetch attendance for all courses
  const attendance = await getBlackboardAllAttendance(user.id, courses)
  const attendanceStats = calculateAttendancePercentage(attendance)
  console.log(`📅 Found ${attendance.length} attendance records (${attendanceStats.percentage}% present)`)

  const coursesData: BBCourseRow[] = courses.map((c) => ({
    id: c.id,
    courseId: c.courseId,
    name: c.name,
    url: c.externalAccessUrl || null,
  }))

  // Convert assignments to proper type
  const assignmentsData: BBAssignmentRow[] = assignments

  // Convert attendance to proper type
  const attendanceData: BBAttendanceRow[] = attendance

  const payload = {
    user: {
      id: user.id,
      name: `${user.name?.given || ""} ${user.name?.family || ""}`.trim(),
      username: user.userName,
      email: user.contact?.email,
    },
    courses: coursesData,
    assignments: assignmentsData,
    attendance: attendanceData,
    attendanceStats: attendanceStats,
    bbCookies: cookies,
    studentId: studentId,
  }

  // Sync to Supabase (all data: courses, assignments, attendance)
  if (studentId) {
    try {
      const success = await upsertBlackboardData(
        studentId,
        user.id,
        user.userName,
        coursesData,
        assignmentsData,
        attendanceData,
        attendanceStats as BBAttendanceStats
      )
      if (success) {
        console.log("✅ Blackboard data synced to Supabase")
      } else {
        console.warn("⚠️ Supabase sync returned false - check RPC function")
      }
    } catch (error) {
      console.warn("❌ Could not sync to Supabase:", error)
    }
  } else {
    console.warn("⚠️ No Esprit studentId cached - Blackboard data saved locally only. Login to Esprit Portal to sync to Supabase.")
  }

  // Sync to web app (for current session) - only send summary, not full data
  // Full data is in Supabase, cookie just tracks connection status
  try {
    const response = await fetch(`${WEB_APP_URL}/api/blackboard/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      credentials: "include",
    })

    if (response.ok) {
      console.log("✅ Blackboard session synced to web app")
      
      const savedAt = new Date().toISOString()
      
      // Store in local cache for multi-layer caching system
      await saveBBToLocalCache({
        user: payload.user,
        courses: payload.courses,
        assignments: payload.assignments,
        attendance: payload.attendance,
        attendanceStats: payload.attendanceStats as BBAttendanceStats,
        savedAt,
      })
      
      // Also store in bbSession for quick access
      await chrome.storage.local.set({
        bbSession: {
          user: payload.user,
          courses: payload.courses,
          assignments: payload.assignments,
          attendance: payload.attendance,
          attendanceStats: payload.attendanceStats,
          savedAt,
        },
      })
    } else {
      console.warn("Failed to sync Blackboard session:", await response.text())
    }
  } catch (error) {
    console.warn("Could not sync Blackboard session:", error)
  }
}

/**
 * Handle Blackboard login detection
 * Called when user navigates to Blackboard (not on login page)
 * Implements multi-layer caching: localStorage → Supabase → Fresh fetch
 */
async function handleBlackboardLogin(): Promise<void> {
  // Check cooldown - don't sync more than once every 30 seconds
  const now = Date.now()
  if (now - lastBBSyncTime < BB_SYNC_COOLDOWN_MS) {
    console.log("⏳ Blackboard sync on cooldown, skipping...")
    return
  }
  
  // Prevent concurrent syncs
  if (bbSyncInProgress) {
    console.log("⏳ Blackboard sync already in progress, skipping...")
    return
  }
  
  bbSyncInProgress = true
  console.log("🔍 Checking Blackboard authentication...")

  try {
    const isAuth = await isBlackboardAuthenticated()
    if (!isAuth) {
      console.log("❌ Not authenticated with Blackboard")
      return
    }

    console.log("✅ Blackboard cookies found, validating session...")

    const user = await getBlackboardUser()
    if (!user) {
      console.log("❌ Could not validate Blackboard user")
      return
    }

    console.log(`👤 Blackboard user: ${user.name?.given} ${user.name?.family}`)

    // Get stored Esprit student ID
    const stored = await chrome.storage.local.get(["cachedCredentials"])
    const studentId = stored.cachedCredentials?.id
    
    // Check cache first
    if (studentId) {
      const cached = await getBlackboardDataWithCaching(studentId)
      
      if (cached.data && !cached.needsRefresh) {
        console.log(`📦 Using cached BB data from ${cached.source}, no refresh needed`)
        // Update last sync time to prevent unnecessary calls
        lastBBSyncTime = Date.now()
        return
      }
      
      if (cached.data && cached.needsRefresh) {
        console.log(`📦 Cache found from ${cached.source} but stale, will refresh...`)
      }
    }

    // Fetch fresh data from Blackboard API
    console.log("🔄 Fetching fresh Blackboard data...")
    
    const cookies = await getBlackboardCookies()
    const courses = await getBlackboardCourses(user.id)

    console.log(`📚 Found ${courses.length} courses`)

    // Sync to web app and Supabase
    await syncBlackboardToWebApp(user, courses, cookies)
    
    // Update last sync time on success
    lastBBSyncTime = Date.now()
    console.log("✅ Blackboard sync complete, next allowed in 30 seconds")
  } finally {
    bbSyncInProgress = false
  }
}

// Debounce timer for Blackboard login detection
let bbLoginDebounceTimer: ReturnType<typeof setTimeout> | null = null

function debouncedHandleBlackboardLogin(): void {
  // Clear any pending timer
  if (bbLoginDebounceTimer) {
    clearTimeout(bbLoginDebounceTimer)
  }
  // Set new timer - only fire after 2 seconds of no new triggers
  bbLoginDebounceTimer = setTimeout(() => {
    bbLoginDebounceTimer = null
    handleBlackboardLogin()
  }, 2000)
}

// Listen for navigation to Blackboard
chrome.webNavigation.onCompleted.addListener(
  async (details) => {
    const url = new URL(details.url)

    // Check if user navigated to Blackboard (not login page)
    if (
      url.hostname === BB_DOMAIN &&
      !url.pathname.includes("/webapps/login/")
    ) {
      // Debounced call to prevent spam
      debouncedHandleBlackboardLogin()
    }
  },
  { url: [{ hostContains: BB_DOMAIN }] }
)

// Also check on cookie changes for Blackboard
chrome.cookies.onChanged.addListener((changeInfo) => {
  if (
    changeInfo.cookie.domain.includes(BB_DOMAIN) &&
    changeInfo.cookie.name === "BbRouter" &&
    !changeInfo.removed
  ) {
    console.log("🍪 Blackboard session cookie detected")
    // Debounced call to prevent spam
    debouncedHandleBlackboardLogin()
  }
})

// Message handler for Blackboard actions
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "GET_BB_STATUS") {
    (async () => {
      // First check if we have cached data - return that even if BB session expired
      const stored = await chrome.storage.local.get(["bbSession"])
      
      if (stored.bbSession?.user) {
        // We have cached data, return it
        sendResponse({
          connected: true,
          user: stored.bbSession.user,
          courseCount: stored.bbSession.courses?.length || 0,
          assignmentCount: stored.bbSession.assignments?.length || 0,
          attendanceStats: stored.bbSession.attendanceStats || null,
          lastSync: stored.bbSession.savedAt,
        })
        return
      }
      
      // No cached data, check live Blackboard session
      const isAuth = await isBlackboardAuthenticated()
      if (!isAuth) {
        sendResponse({ connected: false })
        return
      }

      const user = await getBlackboardUser()
      if (!user) {
        sendResponse({ connected: false })
        return
      }

      sendResponse({
        connected: true,
        user: {
          id: user.id,
          name: `${user.name?.given || ""} ${user.name?.family || ""}`.trim(),
          username: user.userName,
          email: user.contact?.email,
        },
        courseCount: 0,
        assignmentCount: 0,
        attendanceStats: null,
        lastSync: null,
      })
    })()
    return true
  }

  if (request.action === "SYNC_BB_NOW") {
    handleBlackboardLogin()
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true
  }

  if (request.action === "GET_BB_COURSES") {
    (async () => {
      const stored = await chrome.storage.local.get(["bbSession"])
      sendResponse({
        success: true,
        courses: stored.bbSession?.courses || [],
        lastSync: stored.bbSession?.savedAt,
      })
    })()
    return true
  }

  if (request.action === "GET_BB_ASSIGNMENTS") {
    (async () => {
      const stored = await chrome.storage.local.get(["bbSession"])
      const assignments = stored.bbSession?.assignments || []
      
      // Calculate nearest deadline
      const now = new Date()
      const pendingWithDue = assignments.filter(
        (a: BBAssignmentRow) => a.status !== "Graded" && a.due && new Date(a.due) > now
      )
      pendingWithDue.sort((a: BBAssignmentRow, b: BBAssignmentRow) => 
        new Date(a.due!).getTime() - new Date(b.due!).getTime()
      )
      
      const nearestDeadline = pendingWithDue[0] || null
      let deadlineAlert = null

      if (nearestDeadline?.due) {
        const dueDate = new Date(nearestDeadline.due)
        const diffMs = dueDate.getTime() - now.getTime()
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        
        let timeLeft = ""
        if (diffDays > 0) {
          timeLeft = `${diffDays} day${diffDays > 1 ? "s" : ""} ${diffHours}h`
        } else if (diffHours > 0) {
          timeLeft = `${diffHours} hour${diffHours > 1 ? "s" : ""}`
        } else {
          timeLeft = "Less than 1 hour"
        }

        deadlineAlert = {
          assignment: nearestDeadline.name,
          course: nearestDeadline.courseName,
          timeLeft,
          dueDate: nearestDeadline.due,
        }
      }

      sendResponse({
        success: true,
        assignments,
        deadlineAlert,
        total: assignments.length,
        pending: assignments.filter((a: BBAssignmentRow) => a.status !== "Graded").length,
      })
    })()
    return true
  }

  if (request.action === "GET_BB_FULL_DATA") {
    (async () => {
      const stored = await chrome.storage.local.get(["bbSession"])
      if (!stored.bbSession) {
        sendResponse({ success: false, error: "No Blackboard data cached" })
        return
      }
      sendResponse({
        success: true,
        data: stored.bbSession,
      })
    })()
    return true
  }

  return false
})