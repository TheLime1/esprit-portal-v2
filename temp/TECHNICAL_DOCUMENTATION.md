# ESPRIT Empty Room Finder - Complete Technical Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Data Structure (schedules.json)](#data-structure-schedulesjson)
4. [Core Algorithms](#core-algorithms)
5. [API Endpoints](#api-endpoints)
6. [Time Parsing System](#time-parsing-system)
7. [Room Occupancy Detection](#room-occupancy-detection)
8. [Class Location Finder](#class-location-finder)
9. [Special Course Types](#special-course-types)
10. [Building/Bloc Normalization](#buildingbloc-normalization)
11. [Class Code Matching Algorithm](#class-code-matching-algorithm)
12. [Integration Guide](#integration-guide)
13. [Code Reference](#code-reference)

---

## Overview

This system parses university timetable data (ESPRIT - École Supérieure Privée d'Ingénierie et de Technologies) to:

1. **Find empty/available rooms** at a specific day and time
2. **Locate where a class is currently having their session**
3. **Show full schedules for any class group**

The system is built with **Next.js API Routes** and reads schedule data from a JSON file.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT REQUEST                            │
│         (day, time, building, classCode parameters)              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API ROUTE HANDLERS                          │
│  ┌─────────────────┐ ┌─────────────────┐ ┌───────────────────┐  │
│  │  /api/empty     │ │ /api/rooms/free │ │ /api/classes/     │  │
│  │  (basic empty)  │ │ (advanced free) │ │ [classCode]/      │  │
│  │                 │ │                 │ │ location          │  │
│  └────────┬────────┘ └────────┬────────┘ └─────────┬─────────┘  │
└───────────┼───────────────────┼────────────────────┼────────────┘
            │                   │                    │
            ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CORE PARSING FUNCTIONS                       │
│  ┌─────────────────┐ ┌─────────────────┐ ┌───────────────────┐  │
│  │ parseTimeStr()  │ │eventRangeToMin()│ │findMatchingClass()│  │
│  └─────────────────┘ └─────────────────┘ └───────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA SOURCE                                 │
│                   schedules.json                                 │
│          (19,841 lines of timetable data)                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Structure (schedules.json)

### Root Structure

The JSON file is a dictionary where each key is a **class group identifier** (e.g., "2EM1", "4ERP-BI3", "4MécaT1").

```json
{
  "CLASS_GROUP_ID": {
    "days": {
      "DAY_NAME": [
        {
          "time": "START_TIME-END_TIME",
          "course": "COURSE_NAME",
          "room": "ROOM_ID"
        }
      ]
    },
    "metadata": {
      "year": "2024-2025",
      "semester": "S2",
      "period": "..."
    }
  }
}
```

### Complete Example

```json
{
  "2EM1": {
    "days": {
      "Lundi": [
        {
          "time": "09H:00-12H:15",
          "course": "MACHINES THERMIQUES M. BOUGHZOU Ibtissem |",
          "room": "En Ligne"
        },
        {
          "time": "13H:30-16H:45",
          "course": "MÉTALLURGIE M. ELLOUZE Ameni |",
          "room": "En Ligne"
        }
      ],
      "Mardi": [
        {
          "time": "09H:00-12H:15",
          "course": "MATHÉMATIQUES DE BASE 4 M. OUALI Yosra |",
          "room": "H410"
        },
        {
          "time": "13H:30-16H:45",
          "course": "ELECTROTECHNIQUE M. GANNOUN Maroua |",
          "room": "H410"
        }
      ],
      "Mercredi": [
        {
          "time": "09H:00-12H:15",
          "course": "INSTALLATIONS ÉLECTRIQUES M. LAABIDI Houda |",
          "room": "H410"
        },
        {
          "time": "13H:30-16H:45",
          "course": "FREE",
          "room": "H410"
        }
      ]
    },
    "metadata": {
      "year": "2024-2025",
      "semester": "S2",
      "period": "Du 03/11/2025 Au 14/02/2026"
    }
  }
}
```

### Field Descriptions

| Field            | Type   | Description                                                                              |
| ---------------- | ------ | ---------------------------------------------------------------------------------------- |
| `CLASS_GROUP_ID` | string | Unique identifier for a class group (e.g., "2EM1", "4ERP-BI3")                           |
| `days`           | object | Dictionary mapping day names to arrays of time slots                                     |
| `DAY_NAME`       | string | French day name: "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche" |
| `time`           | string | Time range in format "HHH:MM-HHH:MM" (e.g., "09H:00-12H:15")                             |
| `course`         | string | Course name with professor. Can be special values: "FREE", "FREEWARNING", "NOT-FREE"     |
| `room`           | string | Room identifier (e.g., "H410", "B104") or "En Ligne" for online classes                  |
| `metadata`       | object | Optional metadata about the schedule period                                              |

### Room ID Format

Room IDs follow the pattern: `[BUILDING_LETTER][FLOOR][ROOM_NUMBER]`

Examples:
- `H410` = Building H, Floor 4, Room 10
- `B104` = Building B, Floor 1, Room 04
- `I201` = Building I, Floor 2, Room 01

### Special Room Values

| Value             | Meaning                                |
| ----------------- | -------------------------------------- |
| `"En Ligne"`      | Online class - no physical room needed |
| Empty string `""` | Unknown/unassigned room                |

---

## Core Algorithms

### Algorithm 1: Find All Empty Rooms

```
INPUT: day (string), time (string in HH:MM format)
OUTPUT: { empty: string[], occupied: string[], days: string[], rooms: string[] }

PROCEDURE FindEmptyRooms(day, time):
    1. LOAD schedules.json
    
    2. COLLECT all unique rooms:
       FOR each classGroup IN schedules:
           FOR each day IN classGroup.days:
               FOR each event IN day.events:
                   IF event.room IS NOT "En Ligne" AND event.room IS NOT empty:
                       ADD event.room TO roomSet
    
    3. CONVERT query time to minutes:
       queryMinutes = parseTimeStr(time)
    
    4. FIND occupied rooms:
       FOR each classGroup IN schedules:
           events = classGroup.days[selectedDay]
           FOR each event IN events:
               IF event.course IS "FREE": SKIP  // Room is available
               IF event.room IS "En Ligne": SKIP  // Online class
               
               (start, end) = eventRangeToMinutes(event.time)
               IF queryMinutes >= start AND queryMinutes < end:
                   ADD event.room TO occupiedSet
    
    5. COMPUTE empty rooms:
       empty = roomSet - occupiedSet
    
    6. RETURN { empty, occupied, days, rooms }
```

### Algorithm 2: Find Empty Rooms with Building Filter and Warnings

```
INPUT: day, time, building (optional)
OUTPUT: { empty: string[], warning: string[], occupied: string[] }

PROCEDURE FindFreeRooms(day, time, building):
    1. LOAD schedules.json
    
    2. COLLECT all unique rooms (same as Algorithm 1)
    
    3. CONVERT query time to minutes
    
    4. CATEGORIZE rooms:
       FOR each classGroup IN schedules:
           events = classGroup.days[selectedDay]
           FOR each event IN events:
               (start, end) = eventRangeToMinutes(event.time)
               IF queryMinutes NOT IN [start, end): SKIP
               
               SWITCH event.course.toUpperCase():
                   CASE "FREE":
                       // Room is definitely free, do nothing
                       BREAK
                   CASE "FREEWARNING":
                       ADD event.room TO freeWarningSet
                       BREAK
                   CASE "NOT-FREE":
                       ADD event.room TO occupiedSet
                       BREAK
                   DEFAULT:
                       IF event.room != "En Ligne":
                           ADD event.room TO occupiedSet
    
    5. COMPUTE categories:
       empty = roomSet - occupiedSet - freeWarningSet
       warning = freeWarningSet
    
    6. APPLY building filter (if provided):
       IF building == "I" OR "J" OR "K":
           FILTER rooms starting with I, J, or K
       ELSE:
           FILTER rooms starting with building letter
    
    7. RETURN { empty, warning, occupied }
```

### Algorithm 3: Find Class Location

```
INPUT: classCode, day (optional), time (optional)
OUTPUT: { status, room, session, fullSchedule, nextSession }

PROCEDURE FindClassLocation(classCode, day, time):
    1. LOAD schedules.json
    
    2. FIND matching class using flexible matching:
       matchedClass = findMatchingClassName(classCode, schedules)
       IF matchedClass IS NULL:
           RETURN { status: "no_schedule" }
    
    3. DETERMINE target day and time:
       IF day AND time provided:
           USE provided values
       ELSE:
           USE current Tunisia time (Africa/Tunis timezone)
    
    4. FIND current session:
       FOR each dayKey IN classSchedule.days:
           IF dayKey.startsWith(targetDay):
               FOR each session IN dayKey.sessions:
                   IF session.course == "FREE": SKIP
                   (start, end) = eventRangeToMinutes(session.time)
                   IF currentMinutes >= start AND currentMinutes < end:
                       RETURN {
                           status: "in_session",
                           room: session.room,
                           session: { start, end, course },
                           fullSchedule
                       }
    
    5. IF not in session, FIND next session:
       // Check if currently in lunch break (FREE period)
       // Look for next session after lunch or after current time
       
       FOR each session IN remaining sessions:
           IF session.course NOT IN ["FREE", "NOT-FREE"]:
               IF session.start >= currentMinutes:
                   nextSession = session
                   BREAK
    
    6. RETURN { status: "not_in_session", nextSession, fullSchedule }
```

---

## API Endpoints

### 1. GET /api/empty

**Purpose**: Basic empty room finder

**Query Parameters**:
| Parameter | Type   | Required | Description                                                      |
| --------- | ------ | -------- | ---------------------------------------------------------------- |
| `day`     | string | No       | French day name (e.g., "Lundi"). Defaults to first available day |
| `time`    | string | No       | Time in HH:MM format (e.g., "09:30")                             |

**Response**:
```json
{
  "days": ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"],
  "rooms": ["A101", "A102", "B101", "..."],
  "occupied": ["A101", "B203"],
  "empty": ["A102", "B101", "C301", "..."]
}
```

### 2. GET /api/rooms/free

**Purpose**: Advanced empty room finder with building filter and warning system

**Query Parameters**:
| Parameter  | Type   | Required | Description                                                           |
| ---------- | ------ | -------- | --------------------------------------------------------------------- |
| `day`      | string | No       | French day name                                                       |
| `time`     | string | No       | Time in HH:MM format                                                  |
| `building` | string | No       | Building letter filter (e.g., "H", "B", "I"). Use "all" for no filter |

**Response**:
```json
{
  "days": ["Lundi", "Mardi", "..."],
  "rooms": ["A101", "A102", "..."],
  "occupied": ["A101", "B203"],
  "empty": ["A102", "B101", "C301"],
  "warning": ["D405"]  // Rooms that might have soutenance
}
```

### 3. GET /api/classes/[classCode]/location

**Purpose**: Find where a specific class is currently located

**URL Parameters**:
| Parameter   | Type   | Description                                         |
| ----------- | ------ | --------------------------------------------------- |
| `classCode` | string | Class identifier (e.g., "4ERP-BI3", "4bi3", "2EM1") |

**Query Parameters**:
| Parameter | Type   | Required | Description                                               |
| --------- | ------ | -------- | --------------------------------------------------------- |
| `day`     | string | No       | Specific day to check                                     |
| `time`    | string | No       | Specific time to check (format: "HH:MM" or "HH:MM-HH:MM") |

**Response (In Session)**:
```json
{
  "classCode": "4ERP-BI3",
  "status": "in_session",
  "room": {
    "roomId": "H410",
    "name": "H410",
    "building": "H"
  },
  "session": {
    "start": "2026-01-25T09:00:00.000Z",
    "end": "2026-01-25T12:15:00.000Z",
    "course": "DATABASE SYSTEMS M. SMITH John |"
  },
  "fullSchedule": {
    "Lundi": [...],
    "Mardi": [...]
  }
}
```

**Response (Not In Session)**:
```json
{
  "classCode": "4ERP-BI3",
  "status": "not_in_session",
  "nextSession": {
    "day": "Mardi",
    "start": "09H:00",
    "end": "12H:15",
    "room": "H410",
    "course": "WEB DEVELOPMENT M. DOE Jane |"
  },
  "fullSchedule": {...}
}
```

**Response (No Schedule Found)**:
```json
{
  "classCode": "INVALID123",
  "status": "no_schedule"
}
```

---

## Time Parsing System

### parseTimeStr(s: string): number | null

Converts a time string to total minutes since midnight.

**Supported Formats**:
- `"09H:00"` → 540 minutes
- `"09:00"` → 540 minutes  
- `"9H:00"` → 540 minutes
- `"13H:30"` → 810 minutes
- `"16H:45"` → 1005 minutes

**Implementation**:

```typescript
function parseTimeStr(s: string): number | null {
  if (!s) return null;
  
  // Normalize: Convert "09H:00" or "09H00" to "09:00"
  const normalized = s.replace(/(\d{1,2})H:?(\d{2})/i, "$1:$2").trim();
  
  // Extract hours and minutes using regex
  const regex = /(\d{1,2}):(\d{2})/;
  const m = regex.exec(normalized);
  
  if (!m) return null;
  
  // Convert to total minutes: hours * 60 + minutes
  return Number.parseInt(m[1], 10) * 60 + Number.parseInt(m[2], 10);
}
```

**Examples**:
| Input       | Normalized | Output (minutes) |
| ----------- | ---------- | ---------------- |
| `"09H:00"`  | `"09:00"`  | 540              |
| `"13H:30"`  | `"13:30"`  | 810              |
| `"16H:45"`  | `"16:45"`  | 1005             |
| `"8H:15"`   | `"8:15"`   | 495              |
| `""`        | -          | null             |
| `"invalid"` | -          | null             |

### eventRangeToMinutes(range: string): { start: number | null, end: number | null }

Parses a time range string into start and end minutes.

**Supported Formats**:
- `"09H:00-12H:15"` → { start: 540, end: 735 }
- `"09:00 - 12:15"` → { start: 540, end: 735 }
- `"09H:00 12H:15"` (space-separated) → { start: 540, end: 735 }

**Implementation**:

```typescript
function eventRangeToMinutes(range: string) {
  if (!range) return { start: null, end: null };
  
  // Primary: Split by dash
  const parts = range.split("-").map((p) => p.trim());
  if (parts.length === 2) {
    return { 
      start: parseTimeStr(parts[0]), 
      end: parseTimeStr(parts[1]) 
    };
  }
  
  // Fallback: Find time-like tokens separated by spaces
  const toks = range.split(/\s+/).filter((t) => /\dH|:\d{2}/.test(t));
  if (toks.length >= 2) {
    return { 
      start: parseTimeStr(toks[0]), 
      end: parseTimeStr(toks[1]) 
    };
  }
  
  return { start: null, end: null };
}
```

---

## Room Occupancy Detection

### Time Slot Checking Logic

When determining if a room is occupied at a given time, the system uses **half-open interval** logic:

```typescript
// Check if query time falls within this time slot
// Use < end instead of <= end to avoid counting room as occupied at exact end time
if (qMinutes >= start && qMinutes < end) {
  occupied.add(room);
}
```

**Why `< end` instead of `<= end`?**

Consider two back-to-back sessions:
- Session 1: 09:00-12:15
- Session 2: 12:15-15:30

At exactly 12:15:
- With `<= end`: Room would be marked occupied by BOTH sessions (wrong!)
- With `< end`: Room is only occupied by Session 2 (correct!)

### Visual Timeline

```
09:00        12:15        15:30
  │───────────│───────────│
  │  Session1 │  Session2 │
  │ [start,end)│ [start,end)│
  
Query at 12:15:
- Session 1: 12:15 >= 540 AND 12:15 < 735? → 735 < 735? → FALSE
- Session 2: 12:15 >= 735 AND 12:15 < 930? → TRUE → Room occupied by Session 2
```

---

## Class Location Finder

### Timezone Handling

The system operates in **Tunisia timezone (Africa/Tunis = UTC+1)**:

```typescript
// Get current time in Tunisia timezone
const now = new Date();
const tunisiaTime = new Date(
  now.toLocaleString("en-US", { timeZone: "Africa/Tunis" })
);
let currentMinutes = tunisiaTime.getHours() * 60 + tunisiaTime.getMinutes();
```

### Day Mapping

French to JavaScript day index mapping:

```typescript
const daysOfWeek = [
  "Dimanche",  // 0 - Sunday
  "Lundi",     // 1 - Monday
  "Mardi",     // 2 - Tuesday
  "Mercredi",  // 3 - Wednesday
  "Jeudi",     // 4 - Thursday
  "Vendredi",  // 5 - Friday
  "Samedi"     // 6 - Saturday
];

const targetDayName = daysOfWeek[tunisiaTime.getDay()];
```

### Lunch Break Detection

The system detects if the query time falls within a "FREE" period (typically lunch break):

```typescript
// Detect if we're in a lunch break
let isLunchBreak = false;
let lunchBreakEnd = 810; // Default 13:30

for (const [dayKey, sessions] of Object.entries(classSchedule.days)) {
  if (dayKey.startsWith(targetDayName)) {
    for (const session of sessions) {
      if (session.course.toUpperCase() === "FREE") {
        const { start, end } = eventRangeToMinutes(session.time);
        if (currentMinutes >= start && currentMinutes < end) {
          isLunchBreak = true;
          lunchBreakEnd = end;
          break;
        }
      }
    }
  }
}

// When searching for next session, start from end of lunch
const searchFromMinutes = isLunchBreak ? lunchBreakEnd : currentMinutes;
```

---

## Special Course Types

The schedule data contains special course values that affect room availability:

### 1. FREE

**Meaning**: The class has no session at this time. The room they were assigned is free.

**Behavior**: 
- Room is NOT marked as occupied
- Used to indicate a break/free period in the schedule
- Skipped when looking for current or next sessions

```json
{
  "time": "13H:30-16H:45",
  "course": "FREE",
  "room": "H410"
}
```

### 2. FREEWARNING

**Meaning**: The room is technically free, but there might be a "soutenance" (thesis defense) or exam happening.

**Behavior**:
- Room is added to `freeWarning` set, NOT `occupied`
- Room is excluded from the main `empty` list
- Room is included in the `warning` list in the response
- UI can show these rooms with a warning indicator

```json
{
  "time": "09H:00-12H:15",
  "course": "FREEWARNING",
  "room": "D405"
}
```

### 3. NOT-FREE

**Meaning**: Another class is using this room (room sharing scenario).

**Behavior**:
- Room is marked as occupied
- Used when a room is borrowed by another class not in the original schedule

```json
{
  "time": "09H:00-12H:15",
  "course": "NOT-FREE",
  "room": "A101"
}
```

### 4. En Ligne (Online)

**Meaning**: The class is conducted online, no physical room needed.

**Behavior**:
- Room is NOT added to the occupied set
- The room value "En Ligne" is filtered out when building the room list
- Effectively means the class doesn't occupy any physical space

```json
{
  "time": "09H:00-12H:15",
  "course": "MACHINES THERMIQUES M. BOUGHZOU Ibtissem |",
  "room": "En Ligne"
}
```

### Processing Flow Chart

```
┌────────────────────────────────────────┐
│         For each event at time T       │
└───────────────────┬────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ Is course == "FREE"?  │
        └───────────┬───────────┘
                    │
         YES ───────┴─────── NO
          │                   │
          ▼                   ▼
    ┌───────────┐   ┌───────────────────────┐
    │   SKIP    │   │ Is course ==          │
    │(room free)│   │ "FREEWARNING"?        │
    └───────────┘   └───────────┬───────────┘
                                │
                     YES ───────┴─────── NO
                      │                   │
                      ▼                   ▼
              ┌────────────┐   ┌───────────────────────┐
              │Add to      │   │ Is course ==          │
              │freeWarning │   │ "NOT-FREE"?           │
              └────────────┘   └───────────┬───────────┘
                                           │
                                YES ───────┴─────── NO
                                 │                   │
                                 ▼                   ▼
                         ┌────────────┐   ┌───────────────────────┐
                         │Add to      │   │ Is room ==            │
                         │occupied    │   │ "En Ligne"?           │
                         └────────────┘   └───────────┬───────────┘
                                                      │
                                           YES ───────┴─────── NO
                                            │                   │
                                            ▼                   ▼
                                      ┌───────────┐     ┌────────────┐
                                      │   SKIP    │     │Add to      │
                                      │(online)   │     │occupied    │
                                      └───────────┘     └────────────┘
```

---

## Building/Bloc Normalization

### The IJK Building Group

Buildings I, J, and K are treated as a single group "IJK" because they are physically connected or considered together.

```typescript
function normalizeBloc(bloc: string): string {
  const upper = bloc.toUpperCase();
  if (upper === 'I' || upper === 'J' || upper === 'K') {
    return 'IJK';
  }
  return upper;
}
```

### Building Filter Logic

```typescript
if (buildingParam && buildingParam !== "all") {
  const normalizedParam = normalizeBloc(buildingParam);
  
  if (normalizedParam === 'IJK') {
    // Filter for rooms starting with I, J, or K
    empty = empty.filter((r) => 
      r.startsWith('I') || r.startsWith('J') || r.startsWith('K')
    );
  } else {
    // Filter for rooms starting with the specific building letter
    empty = empty.filter((r) => r.startsWith(buildingParam));
  }
}
```

### Building Examples

| Filter Value | Matches                                         |
| ------------ | ----------------------------------------------- |
| `"H"`        | H101, H410, H301...                             |
| `"B"`        | B101, B204, B305...                             |
| `"I"`        | I101, I202, J101, J305, K101, K204... (all IJK) |
| `"J"`        | Same as "I" (normalized to IJK)                 |
| `"K"`        | Same as "I" (normalized to IJK)                 |
| `"all"`      | All rooms                                       |

---

## Class Code Matching Algorithm

### The Problem

Users might search for classes using different formats:
- Official: `"4ERP-BI3"`
- Shorthand: `"4bi3"`, `"4erp3"`, `"4erpbi3"`
- With accents: `"4MécaT1"` vs `"4mecat1"`

### Solution: Flexible Matching

The `findMatchingClassName` function implements a multi-stage matching algorithm:

### Stage 1: Direct Match (with accent removal)

```typescript
function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Direct match first
const upperSearch = removeAccents(searchCode.toUpperCase());
const directMatch = Object.keys(schedules).find(
  key => removeAccents(key.toUpperCase()) === upperSearch
);
if (directMatch) return directMatch;
```

### Stage 2: Exact Normalized Match

Remove all non-alphanumeric characters and compare:

```typescript
const normalizedSearch = upperSearch.replaceAll(/[^A-Z0-9]/g, '');

for (const className of Object.keys(schedules)) {
  const normalizedClass = removeAccents(className.toUpperCase())
    .replaceAll(/[^A-Z0-9]/g, '');
  
  if (normalizedClass === normalizedSearch) {
    return className;  // "4ERPBI3" matches "4ERP-BI3"
  }
}
```

### Stage 3: Flexible Partial Match

For cases like `"4bi3"` → `"4ERP-BI3"`:

```typescript
// Extract trailing number (must match exactly)
const searchTrailingNum = normalizedSearch.match(/\d+$/)?.[0];  // "3"
const classTrailingNum = normalizedClass.match(/\d+$/)?.[0];    // "3"

if (classTrailingNum !== searchTrailingNum) continue;

// Extract leading number (must match exactly)
const searchLeading = normalizedSearch.match(/^(\d+)/)?.[0];  // "4"
const classLeading = normalizedClass.match(/^(\d+)/)?.[0];    // "4"

if (searchLeading !== classLeading) continue;

// Get middle letters
const searchMiddle = "BI";   // from "4BI3"
const classMiddle = "ERPBI"; // from "4ERPBI3"

// Check if search is a substring of class
if (classMiddle.includes(searchMiddle)) {
  return className;  // Match! "BI" is in "ERPBI"
}
```

### Matching Examples

| Search Input | Actual Class | Match Type                  |
| ------------ | ------------ | --------------------------- |
| `"4ERP-BI3"` | `"4ERP-BI3"` | Direct                      |
| `"4erp-bi3"` | `"4ERP-BI3"` | Direct (case-insensitive)   |
| `"4ERPBI3"`  | `"4ERP-BI3"` | Exact normalized            |
| `"4bi3"`     | `"4ERP-BI3"` | Flexible partial            |
| `"4erp3"`    | `"4ERP-BI3"` | Flexible partial            |
| `"4MécaT1"`  | `"4MécaT1"`  | Direct                      |
| `"4mecat1"`  | `"4MécaT1"`  | Direct (accent-insensitive) |
| `"4MECAT1"`  | `"4MécaT1"`  | Exact normalized            |

### Validation Rules

1. **Must contain at least one digit**: Prevents matching generic words
2. **Leading number must match**: `"4bi3"` won't match `"3BI4"`
3. **Trailing number must match exactly**: `"4bi3"` won't match `"4BI1"` or `"4BI31"`

---

## Integration Guide

### Step 1: Set Up the Data File

Create a `schedules.json` file in your `data/` directory with the correct structure:

```json
{
  "CLASS_ID": {
    "days": {
      "Lundi": [
        { "time": "09H:00-12H:15", "course": "...", "room": "..." }
      ]
    }
  }
}
```

### Step 2: Copy Core Functions

These functions are reusable across all endpoints:

```typescript
// Copy these to a shared utils file
function parseTimeStr(s: string): number | null { ... }
function eventRangeToMinutes(range: string) { ... }
function normalizeBloc(bloc: string): string { ... }
function removeAccents(str: string): string { ... }
function findMatchingClassName(searchCode: string, schedules: ScheduleData): string | null { ... }
```

### Step 3: Adapt for Your Framework

**Next.js (App Router)**:
```typescript
// app/api/rooms/route.ts
export async function GET(req: NextRequest) {
  const schedules = await loadSchedules();
  // ... your logic
  return NextResponse.json(result);
}
```

**Express.js**:
```javascript
// routes/rooms.js
app.get('/api/rooms', async (req, res) => {
  const schedules = await loadSchedules();
  // ... your logic
  res.json(result);
});
```

**Plain Node.js**:
```javascript
const http = require('http');
const fs = require('fs');

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/rooms')) {
    const schedules = JSON.parse(fs.readFileSync('data/schedules.json'));
    // ... your logic
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }
});
```

### Step 4: Environment Considerations

**Timezone**: Update the timezone for your location:

```typescript
// Tunisia
const localTime = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Tunis" }));

// France
const localTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));

// US Eastern
const localTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
```

**Day Names**: Update for your language:

```typescript
// French (current)
const weekdayOrder = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

// English
const weekdayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Arabic
const weekdayOrder = ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"];
```

---

## Code Reference

### File: empty-route.ts (Basic Empty Room Finder)

**Location**: `/app/api/empty/route.ts`

**Purpose**: Simple endpoint to find empty rooms at a given day/time.

**Key Features**:
- Collects all physical rooms from schedule
- Filters out "En Ligne" (online) rooms
- Marks rooms as occupied if they have a non-FREE class at the query time
- Returns occupied and empty room lists

### File: rooms-free-route.ts (Advanced Free Room Finder)

**Location**: `/app/api/rooms/free/route.ts`

**Purpose**: Advanced endpoint with building filter and warning system.

**Key Features**:
- Everything from basic version, plus:
- FREEWARNING handling (rooms with potential soutenance)
- NOT-FREE handling (rooms used by other classes)
- Building/bloc filtering (with IJK grouping)
- Separate warning array in response

### File: classes/[classCode]/location/route.ts (Class Locator)

**Location**: `/app/api/classes/[classCode]/location/route.ts`

**Purpose**: Find where a specific class is located at a given time.

**Key Features**:
- Flexible class code matching (handles typos, abbreviations, accents)
- Tunisia timezone support
- Current session detection
- Next session finder
- Lunch break detection
- Full schedule in response

### File: schedules.json (Data Source)

**Location**: `/data/schedules.json`

**Purpose**: The master timetable data for all classes.

**Key Characteristics**:
- ~19,841 lines of JSON
- Contains all class groups with their weekly schedules
- Uses French day names
- Time format: "HHH:MM-HHH:MM"
- Special course values: FREE, FREEWARNING, NOT-FREE
- Room format: BuildingFloorRoom (e.g., H410)

---

## Appendix: TypeScript Interfaces

```typescript
interface TimeSlot {
  time: string;      // "09H:00-12H:15"
  course: string;    // "DATABASE M. SMITH |" or "FREE"
  room: string;      // "H410" or "En Ligne"
}

interface ClassSchedule {
  days: {
    [day: string]: TimeSlot[];  // "Lundi" => [TimeSlot, ...]
  };
  metadata?: {
    year: string;
    semester: string;
    period: string;
  };
}

interface ScheduleData {
  [className: string]: ClassSchedule;  // "4ERP-BI3" => ClassSchedule
}

interface EmptyRoomResponse {
  days: string[];
  rooms: string[];
  occupied: string[];
  empty: string[];
}

interface FreeRoomResponse extends EmptyRoomResponse {
  warning: string[];
}

interface ClassLocationResponse {
  classCode: string;
  status: "in_session" | "not_in_session" | "no_schedule";
  room?: {
    roomId: string;
    name: string;
    building: string;
    coords?: { lat: number; lng: number };
  };
  session?: {
    start: string;  // ISO date string
    end: string;
    course: string;
  };
  nextSession?: {
    day: string;
    start: string;
    end: string;
    room: string;
    course: string;
  };
  fullSchedule?: {
    [day: string]: TimeSlot[];
  };
}
```

---

## Appendix: Error Handling

All endpoints wrap their logic in try-catch:

```typescript
try {
  // ... main logic
  return NextResponse.json(result);
} catch (err: unknown) {
  return NextResponse.json(
    { error: err instanceof Error ? err.message : String(err) },
    { status: 500 }
  );
}
```

Common error scenarios:
1. **File not found**: schedules.json doesn't exist
2. **Invalid JSON**: schedules.json is malformed
3. **Missing data**: Expected class/day doesn't exist

---

## Appendix: Performance Considerations

1. **File Reading**: The schedule file is read on each request. Consider caching:
   ```typescript
   let cachedSchedules: ScheduleData | null = null;
   let cacheTime = 0;
   const CACHE_TTL = 60000; // 1 minute
   
   async function getSchedules() {
     if (cachedSchedules && Date.now() - cacheTime < CACHE_TTL) {
       return cachedSchedules;
     }
     cachedSchedules = JSON.parse(await fs.promises.readFile(dataPath, 'utf-8'));
     cacheTime = Date.now();
     return cachedSchedules;
   }
   ```

2. **Room Set Building**: The room set is rebuilt on each request. Consider pre-computing:
   ```typescript
   const precomputedRooms = new Set([...]);  // Built at startup
   ```

3. **Time Parsing**: Same time strings are parsed multiple times. Consider memoization.

---

*Documentation generated for ESPRIT Empty Room Finder*
*Version: 1.0*
*Last Updated: January 2026*
