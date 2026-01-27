# Porting bbpy to a Chrome Extension

This document explains the logic of the bbpy Python/Selenium codebase and provides a detailed guide on how to port it to a Chrome extension.

---

## Table of Contents

1. [Current Architecture Overview](#current-architecture-overview)
2. [How Selenium Works in bbpy](#how-selenium-works-in-bbpy)
3. [Chrome Extension Architecture](#chrome-extension-architecture)
4. [Mimicking Selenium in Chrome Extension](#mimicking-selenium-in-chrome-extension)
5. [API Endpoints Reference](#api-endpoints-reference)
6. [Data Flow Comparison](#data-flow-comparison)
7. [Implementation Guide](#implementation-guide)
8. [Code Examples](#code-examples)
9. [Storage Strategy](#storage-strategy)
10. [Security Considerations](#security-considerations)

---

## Current Architecture Overview

### bbpy Structure

```
bbpy/
├── auth.py       # Authentication & Selenium login
├── client.py     # API client & business logic  
├── exceptions.py # Custom exceptions
└── __init__.py   # Package exports
```

### Core Components

| Component               | Purpose                                            |
| ----------------------- | -------------------------------------------------- |
| `login_with_selenium()` | Automates browser login, captures cookies          |
| `BBClient`              | Main API client - makes HTTP requests with cookies |
| `.id file`              | JSON file storing cookies, user data, courses      |

### Current Flow

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│   Selenium  │───▶│ Fill Login   │───▶│   Capture   │───▶│  requests    │
│   Browser   │    │   Form       │    │   Cookies   │    │  Session     │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
                                                                  │
                                                                  ▼
                                            ┌───────────────────────────────┐
                                            │  Blackboard REST API v1/v2    │
                                            │  /learn/api/public/v1/...     │
                                            └───────────────────────────────┘
```

---

## How Selenium Works in bbpy

### Step-by-Step Login Process

```python
# From auth.py - login_with_selenium()

1. Navigate to login page
   driver.get("https://esprit.blackboard.com/webapps/login/")

2. Handle cookie consent (if present)
   cookie_button = driver.find_element(By.ID, "agree_button")
   cookie_button.click()

3. Find login form elements
   username_field = driver.find_element(By.ID, "user_id")
   password_field = driver.find_element(By.ID, "password")

4. Fill credentials
   username_field.send_keys(username)
   password_field.send_keys(password)

5. Submit form
   login_button = driver.find_element(By.ID, "entry-login")
   login_button.click()

6. Wait for redirect (login complete)
   time.sleep(5)

7. Extract cookies
   cookies = driver.get_cookies()
   # Returns: [{"name": "BbRouter", "value": "...", "domain": "...", ...}, ...]

8. Transfer to requests Session
   session = requests.Session()
   for cookie in cookies:
       session.cookies.set(cookie['name'], cookie['value'])
```

### Key Cookies Captured

| Cookie Name             | Purpose                              |
| ----------------------- | ------------------------------------ |
| `BbRouter`              | Main session cookie (authentication) |
| `JSESSIONID`            | Java session ID                      |
| `web_client_cache_guid` | Client cache identifier              |
| `AWSALBCORS`            | AWS load balancer                    |

---

## Chrome Extension Architecture

### Why Extensions Are Better for This Use Case

| Aspect              | Selenium                    | Chrome Extension                           |
| ------------------- | --------------------------- | ------------------------------------------ |
| **Cookie Access**   | Needs browser automation    | Native access via `chrome.cookies` API     |
| **Authentication**  | Automated form filling      | User logs in naturally, extension captures |
| **Background Work** | Requires running Python     | Service worker runs in background          |
| **Distribution**    | Local Python + ChromeDriver | Single .crx file or Chrome Web Store       |
| **User Experience** | Opens separate browser      | Integrated into user's browser             |

### Extension Components

```
extension/
├── manifest.json          # Extension configuration
├── background.js          # Service worker (main logic)
├── content.js             # Content script (DOM access)
├── popup/
│   ├── popup.html         # Extension popup UI
│   ├── popup.js           # Popup logic
│   └── popup.css          # Popup styles
├── lib/
│   └── bbapi.js           # Blackboard API client
└── storage/
    └── storage.js         # chrome.storage wrapper
```

---

## Mimicking Selenium in Chrome Extension

### Selenium → Extension Mapping

| Selenium Action         | Extension Equivalent       | API Used          |
| ----------------------- | -------------------------- | ----------------- |
| `driver.get(url)`       | User navigates naturally   | N/A               |
| `driver.find_element()` | `document.querySelector()` | Content Script    |
| `element.send_keys()`   | Set `input.value`          | Content Script    |
| `element.click()`       | `element.click()`          | Content Script    |
| `driver.get_cookies()`  | `chrome.cookies.getAll()`  | Background Script |
| `requests.Session()`    | `fetch()` with credentials | Background Script |

### Cookie Capture Strategy

```javascript
// Background script (service worker)

// Option 1: Get all cookies for domain
async function getCookies(domain) {
    return new Promise((resolve) => {
        chrome.cookies.getAll({ domain: domain }, (cookies) => {
            resolve(cookies);
        });
    });
}

// Option 2: Listen for login completion
chrome.webNavigation.onCompleted.addListener(
    async (details) => {
        if (details.url.includes("esprit.blackboard.com") && 
            !details.url.includes("/webapps/login/")) {
            // User has logged in, capture cookies
            const cookies = await getCookies("esprit.blackboard.com");
            await saveSession(cookies);
        }
    },
    { url: [{ hostContains: "esprit.blackboard.com" }] }
);
```

### Making API Requests

```javascript
// In extension, use fetch() instead of requests.Session()

class BBClient {
    constructor(domain = "https://esprit.blackboard.com") {
        this.domain = domain;
        this.apiUrl = `${domain}/learn/api/public/v1`;
    }

    async get(endpoint, params = {}) {
        const url = new URL(`${this.apiUrl}${endpoint}`);
        Object.keys(params).forEach(key => 
            url.searchParams.append(key, params[key])
        );

        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include', // Important! Includes cookies
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        return response.json();
    }
}
```

---

## API Endpoints Reference

### Authentication Endpoints

| Endpoint                        | Method | Description                        |
| ------------------------------- | ------ | ---------------------------------- |
| `/learn/api/public/v1/users/me` | GET    | Validate session, get current user |

### User & Course Endpoints

| Endpoint                                        | Method | Description                   |
| ----------------------------------------------- | ------ | ----------------------------- |
| `/learn/api/public/v1/users/{userId}/courses`   | GET    | Get user's course memberships |
| `/learn/api/public/v1/courses/{courseId}`       | GET    | Get course details            |
| `/learn/api/public/v1/courses/{courseId}/users` | GET    | Get course members            |

### Gradebook Endpoints (v2)

| Endpoint                                                                              | Method | Description            |
| ------------------------------------------------------------------------------------- | ------ | ---------------------- |
| `/learn/api/public/v2/courses/{courseId}/gradebook/columns`                           | GET    | Get assignment columns |
| `/learn/api/public/v1/courses/{courseId}/gradebook/columns/{columnId}/users/{userId}` | GET    | Get user's grade       |
| `/learn/api/public/v1/courses/{courseId}/contents/{contentId}`                        | GET    | Get content details    |

### Attendance Endpoints

| Endpoint                                                                      | Method | Description         |
| ----------------------------------------------------------------------------- | ------ | ------------------- |
| `/learn/api/public/v1/courses/{courseId}/meetings`                            | GET    | Get course meetings |
| `/learn/api/public/v1/courses/{courseId}/meetings/{meetingId}/users/{userId}` | GET    | Get user attendance |

### Pagination

All list endpoints support pagination:
- `?offset=0` - Starting offset
- `?limit=100` - Results per page
- Response includes `paging.nextPage` with next URL

---

## Data Flow Comparison

### Python (Current)

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Selenium   │─────▶│   Cookies   │─────▶│  requests   │
│  (Python)   │      │  (dict)     │      │  .Session() │
└─────────────┘      └─────────────┘      └─────────────┘
                                                 │
                     ┌───────────────────────────┘
                     ▼
              ┌─────────────┐      ┌─────────────┐
              │   .id file  │◀────▶│  BBClient   │
              │   (JSON)    │      │  (Python)   │
              └─────────────┘      └─────────────┘
```

### Chrome Extension (Target)

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   User      │─────▶│  Browser    │─────▶│  Extension  │
│   Login     │      │  Cookies    │      │  Captures   │
└─────────────┘      └─────────────┘      └─────────────┘
                                                 │
                     ┌───────────────────────────┘
                     ▼
              ┌─────────────┐      ┌─────────────┐
              │   chrome    │◀────▶│  BBClient   │
              │   .storage  │      │  (JS)       │
              └─────────────┘      └─────────────┘
                                          │
                                          ▼
                                   ┌─────────────┐
                                   │   fetch()   │
                                   │  (w/creds)  │
                                   └─────────────┘
```

---

## Implementation Guide

### 1. manifest.json

```json
{
  "manifest_version": 3,
  "name": "Blackboard Helper",
  "version": "1.0.0",
  "description": "ESPRIT Blackboard API helper extension",
  
  "permissions": [
    "cookies",
    "storage",
    "webNavigation"
  ],
  
  "host_permissions": [
    "https://esprit.blackboard.com/*",
    "https://*.blackboard.com/*"
  ],
  
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  
  "content_scripts": [
    {
      "matches": ["https://esprit.blackboard.com/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

### 2. background.js (Service Worker)

```javascript
// Service worker - main extension logic

const BB_DOMAIN = "esprit.blackboard.com";
const API_BASE = "https://esprit.blackboard.com/learn/api/public";

// ============================================
// Cookie Management (replaces Selenium cookies)
// ============================================

async function getAllCookies() {
    return new Promise((resolve) => {
        chrome.cookies.getAll({ domain: BB_DOMAIN }, resolve);
    });
}

async function isAuthenticated() {
    const cookies = await getAllCookies();
    // Check for essential cookies
    const hasBbRouter = cookies.some(c => c.name === "BbRouter");
    const hasSession = cookies.some(c => c.name === "JSESSIONID");
    return hasBbRouter && hasSession;
}

// ============================================
// API Client (replaces requests.Session)
// ============================================

class BBClient {
    constructor() {
        this.apiV1 = `${API_BASE}/v1`;
        this.apiV2 = `${API_BASE}/v2`;
        this.userId = null;
    }

    async request(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
                ...options.headers
            }
        });

        if (response.status === 401) {
            throw new Error('AUTH_EXPIRED');
        }

        if (!response.ok) {
            throw new Error(`API_ERROR_${response.status}`);
        }

        return response.json();
    }

    async get(endpoint, params = {}, version = 'v1') {
        const base = version === 'v2' ? this.apiV2 : this.apiV1;
        const url = new URL(`${base}${endpoint}`);
        Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
        return this.request(url.toString());
    }

    async getPaginated(endpoint, params = {}, version = 'v1') {
        let allResults = [];
        let currentParams = { ...params };

        while (true) {
            const data = await this.get(endpoint, currentParams, version);
            allResults = allResults.concat(data.results || []);

            const nextPage = data.paging?.nextPage;
            if (!nextPage) break;

            // Extract offset from nextPage URL
            const offsetMatch = nextPage.match(/offset=(\d+)/);
            if (offsetMatch) {
                currentParams.offset = offsetMatch[1];
            } else {
                break;
            }
        }

        return allResults;
    }

    // ========================================
    // API Methods (ported from client.py)
    // ========================================

    async validateAuth() {
        const user = await this.get('/users/me');
        this.userId = user.id;
        return user;
    }

    async getCurrentUser() {
        return this.get('/users/me');
    }

    async getEnrolledCourses() {
        if (!this.userId) {
            await this.validateAuth();
        }

        const memberships = await this.getPaginated(`/users/${this.userId}/courses`);
        const enrolledCourses = [];

        for (const membership of memberships) {
            const courseId = membership.courseId;
            if (!courseId) continue;

            try {
                const course = await this.get(`/courses/${courseId}`);
                if (course.externalAccessUrl) {
                    course.membership = membership;
                    enrolledCourses.push(course);
                }
            } catch (e) {
                console.warn(`Could not fetch course ${courseId}:`, e);
            }
        }

        return enrolledCourses;
    }

    async getCourseInstructors(courseId) {
        const members = await this.getPaginated(`/courses/${courseId}/users`);
        const instructorRoles = ['Instructor', 'TeachingAssistant', 'Grader', 'CourseBuilder'];
        
        return members
            .filter(m => instructorRoles.includes(m.courseRoleId))
            .map(m => ({
                userId: m.userId,
                role: m.courseRoleId,
                name: m.name
            }));
    }

    async getCourseAssignments(courseId) {
        const columns = await this.getPaginated(
            `/courses/${courseId}/gradebook/columns`,
            {},
            'v2'
        );

        const assignments = [];

        for (const column of columns) {
            const grading = column.grading || {};
            if (grading.type === 'Calculated') continue;

            // Get user's grade
            let score = null;
            let status = 'NotSubmitted';

            try {
                const grade = await this.get(
                    `/courses/${courseId}/gradebook/columns/${column.id}/users/${this.userId}`
                );
                score = grade.score;
                status = grade.status || (score !== null ? 'Graded' : 'NotSubmitted');
            } catch (e) {
                // No grade record
            }

            assignments.push({
                id: column.id,
                name: column.name,
                courseId: courseId,
                due: grading.due,
                scorePossible: column.score?.possible,
                score: score,
                status: status,
                isPastDue: grading.due ? new Date() > new Date(grading.due) : false
            });
        }

        return assignments;
    }

    async getAttendance(courseId) {
        try {
            const meetings = await this.getPaginated(`/courses/${courseId}/meetings`);
            const attendance = [];

            for (const meeting of meetings) {
                try {
                    const record = await this.get(
                        `/courses/${courseId}/meetings/${meeting.id}/users/${this.userId}`
                    );
                    attendance.push({
                        meeting: meeting,
                        status: record.status
                    });
                } catch (e) {
                    attendance.push({
                        meeting: meeting,
                        status: 'unknown'
                    });
                }
            }

            return attendance;
        } catch (e) {
            return [];
        }
    }
}

// ============================================
// Session Storage (replaces .id file)
// ============================================

async function saveSession(data) {
    await chrome.storage.local.set({ 
        bbSession: {
            ...data,
            savedAt: new Date().toISOString()
        }
    });
}

async function loadSession() {
    const result = await chrome.storage.local.get('bbSession');
    return result.bbSession || null;
}

async function clearSession() {
    await chrome.storage.local.remove('bbSession');
}

// ============================================
// Event Listeners
// ============================================

// Detect when user completes login
chrome.webNavigation.onCompleted.addListener(
    async (details) => {
        const url = new URL(details.url);
        
        // Check if user just logged in (not on login page anymore)
        if (url.hostname === BB_DOMAIN && 
            !url.pathname.includes('/webapps/login/')) {
            
            const client = new BBClient();
            
            try {
                const user = await client.validateAuth();
                const courses = await client.getEnrolledCourses();
                
                // Build instructor lookup
                const instructors = {};
                for (const course of courses) {
                    instructors[course.id] = await client.getCourseInstructors(course.id);
                }
                
                // Save session data (like .id file)
                await saveSession({
                    user: {
                        id: user.id,
                        name: `${user.name?.given || ''} ${user.name?.family || ''}`.trim(),
                        username: user.userName,
                        email: user.contact?.email
                    },
                    courses: courses.map(c => ({
                        id: c.id,
                        courseId: c.courseId,
                        name: c.name,
                        url: c.externalAccessUrl,
                        instructors: instructors[c.id] || []
                    }))
                });
                
                console.log('Session saved successfully!');
            } catch (e) {
                console.warn('Could not save session:', e);
            }
        }
    },
    { url: [{ hostContains: BB_DOMAIN }] }
);

// Message handler for popup/content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
        const client = new BBClient();
        
        switch (request.action) {
            case 'getSession':
                sendResponse(await loadSession());
                break;
                
            case 'isAuthenticated':
                sendResponse(await isAuthenticated());
                break;
                
            case 'getCurrentUser':
                try {
                    const user = await client.getCurrentUser();
                    sendResponse({ success: true, data: user });
                } catch (e) {
                    sendResponse({ success: false, error: e.message });
                }
                break;
                
            case 'getCourses':
                try {
                    const courses = await client.getEnrolledCourses();
                    sendResponse({ success: true, data: courses });
                } catch (e) {
                    sendResponse({ success: false, error: e.message });
                }
                break;
                
            case 'getAssignments':
                try {
                    const session = await loadSession();
                    if (!session?.courses) {
                        throw new Error('No session data');
                    }
                    
                    const allAssignments = [];
                    for (const course of session.courses) {
                        const assignments = await client.getCourseAssignments(course.id);
                        assignments.forEach(a => a.courseName = course.name);
                        allAssignments.push(...assignments);
                    }
                    sendResponse({ success: true, data: allAssignments });
                } catch (e) {
                    sendResponse({ success: false, error: e.message });
                }
                break;
                
            case 'getAttendance':
                try {
                    const session = await loadSession();
                    if (!session?.courses) {
                        throw new Error('No session data');
                    }
                    
                    const allAttendance = [];
                    for (const course of session.courses) {
                        const attendance = await client.getAttendance(course.id);
                        attendance.forEach(a => a.courseName = course.name);
                        allAttendance.push(...attendance);
                    }
                    sendResponse({ success: true, data: allAttendance });
                } catch (e) {
                    sendResponse({ success: false, error: e.message });
                }
                break;
                
            case 'isNerd':
                try {
                    const session = await loadSession();
                    if (!session?.courses) {
                        throw new Error('No session data');
                    }
                    
                    let totalAssignments = 0;
                    let onTime = 0;
                    
                    for (const course of session.courses) {
                        const assignments = await client.getCourseAssignments(course.id);
                        for (const a of assignments) {
                            totalAssignments++;
                            if (a.status !== 'NotSubmitted' && !a.isPastDue) {
                                onTime++;
                            }
                        }
                    }
                    
                    const onTimeRate = totalAssignments > 0 ? onTime / totalAssignments : 0;
                    const isNerd = onTimeRate > 0.45;
                    
                    sendResponse({ success: true, data: { isNerd, onTimeRate } });
                } catch (e) {
                    sendResponse({ success: false, error: e.message });
                }
                break;
                
            case 'clearSession':
                await clearSession();
                sendResponse({ success: true });
                break;
                
            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
    })();
    
    return true; // Keep message channel open for async response
});
```

### 3. popup/popup.html

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Blackboard Helper</title>
    <link rel="stylesheet" href="popup.css">
</head>
<body>
    <div class="container">
        <h1>📚 Blackboard Helper</h1>
        
        <div id="auth-status" class="status">
            <span id="status-icon">⏳</span>
            <span id="status-text">Checking authentication...</span>
        </div>
        
        <div id="user-info" class="hidden">
            <div class="info-row">
                <span class="label">👤 User:</span>
                <span id="user-name">-</span>
            </div>
            <div class="info-row">
                <span class="label">📧 Email:</span>
                <span id="user-email">-</span>
            </div>
            <div class="info-row">
                <span class="label">📖 Courses:</span>
                <span id="course-count">-</span>
            </div>
        </div>
        
        <div id="actions" class="hidden">
            <button id="btn-refresh">🔄 Refresh Data</button>
            <button id="btn-assignments">📝 View Assignments</button>
            <button id="btn-nerd-check">🤓 Am I a Nerd?</button>
        </div>
        
        <div id="login-prompt" class="hidden">
            <p>Please log in to Blackboard first:</p>
            <a href="https://esprit.blackboard.com" target="_blank" class="login-link">
                🔐 Open Blackboard Login
            </a>
        </div>
        
        <div id="result" class="hidden"></div>
    </div>
    
    <script src="popup.js"></script>
</body>
</html>
```

### 4. popup/popup.js

```javascript
// Popup script

document.addEventListener('DOMContentLoaded', async () => {
    const statusIcon = document.getElementById('status-icon');
    const statusText = document.getElementById('status-text');
    const userInfo = document.getElementById('user-info');
    const actions = document.getElementById('actions');
    const loginPrompt = document.getElementById('login-prompt');
    const result = document.getElementById('result');

    // Check authentication
    const isAuth = await sendMessage({ action: 'isAuthenticated' });
    
    if (isAuth) {
        statusIcon.textContent = '✅';
        statusText.textContent = 'Authenticated';
        
        // Load session data
        const session = await sendMessage({ action: 'getSession' });
        
        if (session?.user) {
            document.getElementById('user-name').textContent = session.user.name;
            document.getElementById('user-email').textContent = session.user.email || 'N/A';
            document.getElementById('course-count').textContent = session.courses?.length || 0;
            userInfo.classList.remove('hidden');
        }
        
        actions.classList.remove('hidden');
    } else {
        statusIcon.textContent = '❌';
        statusText.textContent = 'Not authenticated';
        loginPrompt.classList.remove('hidden');
    }

    // Button handlers
    document.getElementById('btn-refresh')?.addEventListener('click', async () => {
        result.innerHTML = '<p>🔄 Refreshing...</p>';
        result.classList.remove('hidden');
        
        const response = await sendMessage({ action: 'getCurrentUser' });
        if (response.success) {
            result.innerHTML = '<p>✅ Data refreshed!</p>';
            location.reload();
        } else {
            result.innerHTML = `<p>❌ Error: ${response.error}</p>`;
        }
    });

    document.getElementById('btn-assignments')?.addEventListener('click', async () => {
        result.innerHTML = '<p>📝 Loading assignments...</p>';
        result.classList.remove('hidden');
        
        const response = await sendMessage({ action: 'getAssignments' });
        if (response.success) {
            const assignments = response.data;
            let html = `<h3>📝 Assignments (${assignments.length})</h3><ul>`;
            
            for (const a of assignments.slice(0, 10)) {
                const statusEmoji = a.status === 'Graded' ? '✅' : 
                                   a.status === 'Submitted' ? '📤' : '❌';
                html += `<li>${statusEmoji} ${a.name} - ${a.courseName || 'Unknown'}</li>`;
            }
            
            if (assignments.length > 10) {
                html += `<li>... and ${assignments.length - 10} more</li>`;
            }
            
            html += '</ul>';
            result.innerHTML = html;
        } else {
            result.innerHTML = `<p>❌ Error: ${response.error}</p>`;
        }
    });

    document.getElementById('btn-nerd-check')?.addEventListener('click', async () => {
        result.innerHTML = '<p>🤓 Calculating...</p>';
        result.classList.remove('hidden');
        
        const response = await sendMessage({ action: 'isNerd' });
        if (response.success) {
            const { isNerd, onTimeRate } = response.data;
            const percentage = (onTimeRate * 100).toFixed(1);
            
            if (isNerd) {
                result.innerHTML = `<h3>🤓 You're a NERD!</h3><p>On-time rate: ${percentage}%</p>`;
            } else {
                result.innerHTML = `<h3>😎 Not a nerd (yet)</h3><p>On-time rate: ${percentage}%</p>`;
            }
        } else {
            result.innerHTML = `<p>❌ Error: ${response.error}</p>`;
        }
    });
});

function sendMessage(message) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, resolve);
    });
}
```

### 5. popup/popup.css

```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    width: 320px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #1a1a2e;
    color: #eee;
}

.container {
    padding: 16px;
}

h1 {
    font-size: 18px;
    margin-bottom: 16px;
    text-align: center;
}

.status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: #16213e;
    border-radius: 8px;
    margin-bottom: 16px;
}

#status-icon {
    font-size: 20px;
}

.info-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #333;
}

.label {
    color: #888;
}

#user-info {
    margin-bottom: 16px;
}

#actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

button {
    padding: 12px;
    border: none;
    border-radius: 8px;
    background: #0f3460;
    color: white;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.2s;
}

button:hover {
    background: #e94560;
}

.login-link {
    display: block;
    padding: 12px;
    background: #e94560;
    color: white;
    text-decoration: none;
    text-align: center;
    border-radius: 8px;
}

#login-prompt p {
    margin-bottom: 12px;
    color: #888;
}

#result {
    margin-top: 16px;
    padding: 12px;
    background: #16213e;
    border-radius: 8px;
    max-height: 200px;
    overflow-y: auto;
}

#result h3 {
    margin-bottom: 8px;
}

#result ul {
    padding-left: 20px;
}

#result li {
    margin: 4px 0;
    font-size: 12px;
}

.hidden {
    display: none;
}
```

### 6. content.js (Optional - for DOM manipulation)

```javascript
// Content script - runs on Blackboard pages
// Useful for auto-detection of login state or page manipulation

(function() {
    // Detect login success
    if (window.location.pathname.includes('/webapps/login/')) {
        // On login page - could auto-fill if needed
        console.log('BB Helper: On login page');
    } else {
        // Logged in - notify background script
        chrome.runtime.sendMessage({ 
            action: 'loginDetected',
            url: window.location.href 
        });
    }

    // Optional: Add UI enhancements
    const addHelperBadge = () => {
        const badge = document.createElement('div');
        badge.id = 'bb-helper-badge';
        badge.innerHTML = '📚 BB Helper Active';
        badge.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            background: #0f3460;
            color: white;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 12px;
            z-index: 9999;
            opacity: 0.8;
        `;
        document.body.appendChild(badge);
        
        setTimeout(() => badge.remove(), 3000);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addHelperBadge);
    } else {
        addHelperBadge();
    }
})();
```

---

## Storage Strategy

### Python (.id file) → Chrome Storage

| Python          | Chrome Extension             | Notes                         |
| --------------- | ---------------------------- | ----------------------------- |
| `.id` JSON file | `chrome.storage.local`       | Persistent, survives restarts |
| `json.load()`   | `chrome.storage.local.get()` | Async API                     |
| `json.dump()`   | `chrome.storage.local.set()` | Async API                     |
| Cookies in file | Browser manages              | No need to store cookies      |

### Storage Structure

```javascript
// chrome.storage.local structure
{
    "bbSession": {
        "savedAt": "2024-01-15T10:30:00.000Z",
        "user": {
            "id": "_12345_1",
            "name": "John Doe",
            "username": "221ABC1234",
            "email": "john@esprit.tn"
        },
        "courses": [
            {
                "id": "_67890_1",
                "courseId": "ESE.TC-21__4SAE11",
                "name": "Course Name",
                "url": "https://esprit.blackboard.com/...",
                "instructors": [
                    { "name": "Prof. Smith", "role": "Instructor" }
                ]
            }
        ],
        "isNerd": true,
        "onTimeRate": 0.67,
        "isAttending": true,
        "attendancePercentage": 85.5
    }
}
```

---

## Security Considerations

### 1. No Credentials Stored

Unlike the Python version, the Chrome extension **never needs to store credentials**:

```python
# Python version stores credentials (risky)
"credentials": {
    "username": "...",
    "password": "..."
}
```

```javascript
// Extension - browser handles authentication
// Cookies are managed by Chrome, not by extension
```

### 2. Permissions

Request only necessary permissions in `manifest.json`:

```json
{
    "permissions": [
        "cookies",      // Required for auth checking
        "storage",      // For session cache
        "webNavigation" // For login detection
    ],
    "host_permissions": [
        "https://esprit.blackboard.com/*"  // Only your domain
    ]
}
```

### 3. Content Security

- Use `fetch()` with `credentials: 'include'` for same-origin requests
- Never expose sensitive data in console logs in production
- Validate all API responses before processing

---

## Key Differences Summary

| Aspect                 | Python/Selenium         | Chrome Extension           |
| ---------------------- | ----------------------- | -------------------------- |
| **Login**              | Automated form filling  | User logs in naturally     |
| **Cookie Access**      | Captured via Selenium   | `chrome.cookies` API       |
| **HTTP Requests**      | `requests.Session()`    | `fetch()` with credentials |
| **Data Storage**       | `.id` JSON file         | `chrome.storage.local`     |
| **Background Tasks**   | Requires Python running | Service Worker             |
| **Credential Storage** | Stored in .id file      | Not needed!                |
| **Distribution**       | Python + ChromeDriver   | .crx file or Web Store     |
| **Auto-refresh**       | Selenium re-login       | User logs in again         |

---

## Next Steps

1. **Create Extension Directory Structure**
   ```
   mkdir blackboard-extension
   cd blackboard-extension
   # Create files as shown above
   ```

2. **Load in Chrome**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select extension folder

3. **Test**
   - Navigate to Blackboard
   - Log in normally
   - Click extension icon to see data

4. **Optional Enhancements**
   - Add notifications for new assignments
   - Badge icon with assignment count
   - Export data to JSON
   - Attendance tracking alerts
