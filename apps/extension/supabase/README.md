# Supabase Setup for Esprit Portal Extension

This document explains how to set up the Supabase backend for the multi-layer caching system.

## Overview

The extension uses a 3-tier caching system:

1. **localStorage** (chrome.storage.local) - Instant display, checked first
2. **Supabase** (cloud) - Cross-device sync, checked if localStorage empty
3. **Portal fetch** - Fresh data from old ESPRIT portal, only when cache is stale

### Cache Duration
- Data is refreshed every **4 hours**
- Stale data is shown immediately while fetching fresh data in background
- Fetching only happens when user visits `esprit-tn.com`

## Security Model

Since the Supabase anon key is exposed in the extension code, we use **Row Level Security (RLS)** to ensure each student can only access their own data:

- Each student has one row in the `students` table
- Authentication is done via `student_id` + `password` (stored in plaintext)
- RLS policies check these credentials on every operation

## Setup Steps

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon key from Project Settings → API

### 2. Run the Migration

1. Go to SQL Editor in your Supabase dashboard
2. Copy the contents of `supabase/migrations/001_create_students_table.sql`
3. Run the SQL to create:
   - `students` table with RLS enabled
   - RLS policies for SELECT, INSERT, UPDATE, DELETE
   - RPC functions: `authenticate_and_get_data`, `upsert_student_data`, `check_data_freshness`

### 3. Configure the Extension

Update `supabase-client.ts` with your Supabase credentials:

```typescript
const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co"
const SUPABASE_ANON_KEY = "your-anon-key-here"
```

### 4. Test the Setup

1. Build the extension: `pnpm run build`
2. Load it in Chrome: chrome://extensions → Load unpacked → select `build/chrome-mv3-dev`
3. Login on `esprit-tn.com`
4. Check Supabase dashboard → Table Editor → students table

## Database Schema

### `students` Table

| Column         | Type        | Description                   |
| -------------- | ----------- | ----------------------------- |
| `student_id`   | TEXT (PK)   | Student ID (e.g., "21123456") |
| `password`     | TEXT        | Plain text password           |
| `name`         | TEXT        | Student's full name           |
| `class_name`   | TEXT        | Class (e.g., "4GL1")          |
| `grades_data`  | JSONB       | All grades data               |
| `credits_data` | JSONB       | Credits/makeup modules        |
| `created_at`   | TIMESTAMPTZ | First login time              |
| `updated_at`   | TIMESTAMPTZ | Last data refresh             |

### RPC Functions

#### `authenticate_and_get_data(p_student_id, p_password)`
Returns student data only if credentials match. Used to fetch cached data from Supabase.

#### `upsert_student_data(...)`
Inserts or updates student data. Called after portal fetch to sync to cloud.

#### `check_data_freshness(p_student_id, p_password)`
Returns whether data needs refresh (older than 4 hours).

## Data Flow

```
User visits esprit-tn.com
         │
         ▼
┌─────────────────────────────────────┐
│ 1. Check chrome.storage.local       │
│    (localStorage equivalent)        │
└─────────────────────────────────────┘
         │
         │ Empty?
         ▼
┌─────────────────────────────────────┐
│ 2. Check Supabase (cloud cache)     │
│    via authenticate_and_get_data()  │
└─────────────────────────────────────┘
         │
         │ Empty or stale (>4hrs)?
         ▼
┌─────────────────────────────────────┐
│ 3. Fetch from old ESPRIT portal     │
│    (requires user login)            │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 4. Save to both:                    │
│    - chrome.storage.local           │
│    - Supabase (via upsert)          │
└─────────────────────────────────────┘
```

## Rate Limiting Considerations

- Extension only fetches when user visits the website
- Background refresh is triggered when cache is >4 hours old
- Supabase free tier: 500MB database, 2GB bandwidth/month
- Each student row is ~10-50KB, so 10,000 students = ~500MB max

## Troubleshooting

### Data not syncing to Supabase
1. Check browser console for errors
2. Verify Supabase URL and anon key are correct
3. Check RLS policies are in place

### Authentication failing
1. Ensure `student_id` and `password` match exactly
2. Check if row exists in `students` table
3. Verify RLS policies are enabled

### Cache not refreshing
1. Clear extension storage: chrome://extensions → Your extension → Storage
2. Check `updated_at` timestamp in Supabase
3. Verify `CACHE_DURATION_HOURS` is set correctly (default: 4)
