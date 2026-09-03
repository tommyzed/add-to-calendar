# Add to Calendar

A Progressive Web App (PWA) that uses **Google Gemini AI** to extract event details from screenshots (or any image) and adds them directly to your **Google Calendar**.

Built with **React 19**, **TypeScript**, and **Vite**, featuring a modern **Glassmorphism UI**, a secure **Cloud Run Backend Bridge**, and seamless PWA integration.

## 🌐 Publicly Available! (v2.1)

* [**Try it NOW!**](https://add-to-calendar.egodevnull.com/) 

## ✨ Features

- **AI-Powered Extraction**: Uses Google Gemini to intelligently parse event titles, dates, times, and locations from images.
- **Secure Backend Proxy Architecture**:
  - Gemini API calls are securely routed through a Cloud Run backend (`auth-bridge`).
  - Secret keys (`GEMINI_APP_KEY`, `CLIENT_SECRET`, etc.) remain strictly server-side in Google Secret Manager and are **never** exposed to client-side browser bundles.
- **Cloud Image Storage & Attendee Sharing (v2.0)**:
  - **Zero-Latency Concurrent Uploads**: Uploads source images to Google Cloud Storage (GCS) in parallel with Gemini AI analysis.
  - **Attendee-Accessible Hyperlinks**: Adds a clean HTML hyperlink (`📸 View Event Image`) to the calendar event description so all attendees can view the original screenshot.
  - **Automated 90-Day TTL**: GCS bucket lifecycle rules automatically purge old images, keeping maintenance and storage costs near zero.
  - **Branded Event Footer**: Includes an interactive link to Add to Calendar in event descriptions.
- **Interactive Source Thumbnail & In-App Lightbox (v2.1)**:
  - **Header Thumbnail Badge**: Embedded 40×40px clickable screenshot preview right next to the "Confirm Event" title.
  - **In-App Lightbox Modal**: Tap the thumbnail to view the full-resolution screenshot in a sleek glassmorphic modal to cross-check dates and times without losing your place.
  - **Direct External Tab**: Includes a one-click "Open ↗" action to view the image in a separate browser tab.
  - **Streamlined Vertical Layout**: Eliminated compounding margins between Start and End date fields and compacted spacing for a zero/minimal-scroll confirmation screen on mobile and desktop.
- **Anonymous Analytics & Coarse Geo-Location (v2.1)**:
  - **Neon Postgres Serverless Integration**: Non-blocking analytics logging using `@neondatabase/serverless` over HTTPS.
  - **100% Privacy-Preserving Identity**: Google Account IDs (`sub` claim from OAuth `id_token`) are deterministically hashed with SHA-256 (`user_hash`), enabling consistent user retention metrics without storing emails or names.
  - **Zero-Latency In-Memory Geo-Location**: Uses `geoip-lite` to resolve client IP (`x-forwarded-for`) to country and city in microseconds, supplemented by browser timezone and locale.
  - **Comprehensive Activity Tracking**: Tracks `login`, `refresh`, `parse_image` (with parsing latency and status), `event_created` (with image attachment flag), `manual_entry`, and `logout` (with reason: `user_action`, `token_expired`, `token_revoked`).
  - **Zero User Overhead**: All database queries are fire-and-forget background promises that never delay user responses.
- **Seamless Google Calendar Integration**:
  - **Persistent Authentication**: Stays logged in with secure OAuth 2.0 token refresh.
  - **Direct Insertion**: Adds events directly to your primary calendar.
  - **View Link**: Provides a direct link to view the created event in Google Calendar.
- **Modern User Experience**:
  - **Warm Sunset Palette**: Golden amber, warm orange, and terracotta design tailored for calendar scheduling.
  - **Glassmorphism Design**: Sleek UI with frosted blur effects, responsive typography, and high contrast.
  - **Editable Details**: Review and modify the event summary, location, and start/end times before adding.
  - **Manual Entry**: Bypass image uploading entirely and create events manually.
  - **Custom Date Picker**: Fully styled, responsive `@mui/x-date-pickers` for intuitive time adjustments.
  - **Smart Feedback**: Confetti animations on success, high-contrast error cards, and warnings for unclear images.
- **PWA Capabilities**:
  - **Installable**: Can be installed on mobile (iOS/Android) and desktop.
  - **Share Target**: Receive images directly from the Android System Share Sheet (e.g., share a screenshot from Google Photos directly to this app).

## 🏗️ Architecture

```text
add-to-calendar/
├── src/                      # Frontend PWA (React 19, Vite, MUI)
│   ├── App.tsx               # Main UI, responsive layout & image lightbox modal
│   └── services/
│       ├── calendar.ts       # Google Calendar API, OAuth & client event tracking
│       └── gemini.ts         # Image parsing client (passes context to auth-bridge)
├── functions/
│   └── auth-bridge/          # Cloud Run Backend Service (Node.js 22)
│       ├── index.js          # OAuth, Gemini AI, GCS uploader, GeoIP & Neon logging
│       └── package.json      # Dependencies (@neondatabase/serverless, geoip-lite, etc.)
└── .github/
    └── workflows/
        └── deploy-auth-bridge.yml # Automated CI/CD for Cloud Run backend (Node 24 actions)
```

## 🚀 Setup & Installation

### Prerequisites

- Node.js (v18+)
- A Google Cloud Project with the **Google Calendar API** enabled.
- A **Google Gemini API Key** (from Google AI Studio or Vertex AI).

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd add-to-calendar
npm install
```

### 2. Environment Configuration

#### Frontend Configuration (`.env`)
Create a `.env` file in the root directory:

```env
# Your Google OAuth 2.0 Client ID (for Calendar access)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

# (Optional) Backend Bridge URL (defaults to production Cloud Run URL)
AUTH_BRIDGE_URL=your_google_cloud_function_url
```

> **Note**: For `GOOGLE_CLIENT_ID`, ensure your Google Cloud Console "Authorized JavaScript origins" includes `http://localhost:5173` (for dev) and your production URL.

#### Backend Secrets (`functions/auth-bridge`)
The backend service uses Google Secret Manager for sensitive keys:
- `GEMINI_APP_KEY`: Your Google Gemini API Key.
- `CLIENT_ID`: Your Google OAuth 2.0 Client ID.
- `CLIENT_SECRET`: Your Google OAuth 2.0 Client Secret.
- `GEMINI_MODEL`: Your Google Gemini Model (e.g., 'gemini-3.7-flash').
- `IMAGE_BUCKET_NAME`: Your Google Cloud Storage bucket name (e.g., 'add-to-calendar-images').
- `DATABASE_URL`: Your Neon Postgres serverless connection string (`postgresql://...`).

### 3. Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## 📱 How to Use

1. **Sign In**: Click "Sign In with Google" to authorize Calendar access (only needed once).
2. **Add an Image or Enter Manually**:
   - **Desktop/Mobile Web**: Click "Choose Image" to select a screenshot, or click "Or enter manually ✍️".
   - **Android (PWA)**: Open an image in your gallery &rarr; Share &rarr; Select "Add to Calendar".
3. **Review & Edit**: The AI populates the event details.
   - Use the **Date Pickers** to adjust dates and times.
   - Edit the **Name** or **Location**.
4. **Add**: Click "Add to Calendar".
5. **Success**: Confetti triggers! Click "View in Calendar" to inspect or "Scan Another" to continue.

## 🛠️ Technologies

- **Frontend**: React 19, TypeScript, Vite
- **Backend / Proxy**: Google Cloud Run (Node.js 22 LTS, Functions Framework)
- **Database**: Neon Postgres Serverless (`@neondatabase/serverless`)
- **Geo-Location**: `geoip-lite` (in-memory IP lookup) + client context (browser timezone, locale)
- **AI**: Google Gemini API via server-side `@google/generative-ai`
- **Storage**: Google Cloud Storage (`@google-cloud/storage`) with 90-day automated TTL lifecycle
- **Integration**: Google Identity Services (GIS), Google API Client (GAPI), Google Auth Library
- **UI Libraries**: `@mui/x-date-pickers`, `@mui/material`, `dayjs`, `canvas-confetti`
- **Styling**: Vanilla CSS (Variables, Flexbox, Glassmorphism)
- **CI/CD**: GitHub Actions (`gcloud run deploy` with Node 24 actions and path filtering)

## 📦 Deployment

### Frontend PWA
The frontend builds to static files and can be deployed to any static host (Railway, Vercel, Netlify, Cloudflare Pages):

```bash
npm run build
# Deploy the 'dist' folder
```

**Important**: For the PWA "Share Target" to work on Android, the app **must be served over HTTPS**.

### Backend Cloud Run (`auth-bridge`)
The backend automatically deploys via GitHub Actions when changes are pushed to `functions/auth-bridge/**`:

```bash
# Manual deployment command:
gcloud run deploy auth-bridge \
  --region=europe-west1 \
  --source=./functions/auth-bridge \
  --allow-unauthenticated \
  --set-secrets="GEMINI_APP_KEY=GEMINI_APP_KEY:latest,CLIENT_ID=CLIENT_ID:latest,CLIENT_SECRET=CLIENT_SECRET:latest,GEMINI_MODEL=GEMINI_MODEL:latest,IMAGE_BUCKET_NAME=IMAGE_BUCKET_NAME:latest,DATABASE_URL=DATABASE_URL:latest"
```

## 📊 Analytics & Insights (v2.1)

All analytics are stored in **Neon Postgres** with complete user privacy (Google IDs are hashed with SHA-256 and coarse location is resolved in-memory).

### Sample SQL Queries for Neon SQL Editor

```sql
-- 1. Active users, location, and lifetime events created
SELECT 
    user_id, 
    country, 
    city, 
    timezone, 
    login_count, 
    events_created_count, 
    last_seen_at 
FROM users 
ORDER BY last_seen_at DESC;

-- 2. Daily breakdown by event type
SELECT 
    DATE(created_at) AS date,
    event_type, 
    COUNT(*) AS total_events
FROM analytics_events 
GROUP BY date, event_type 
ORDER BY date DESC, total_events DESC;

-- 3. Top countries using the app
SELECT 
    country, 
    COUNT(DISTINCT user_id) AS total_users,
    COUNT(*) AS total_events
FROM analytics_events 
WHERE country IS NOT NULL 
GROUP BY country 
ORDER BY total_events DESC;

-- 4. Gemini AI image parsing performance & status
SELECT 
    AVG((metadata->>'duration_ms')::numeric) AS avg_duration_ms,
    COUNT(*) AS total_parses,
    COUNT(*) FILTER (WHERE metadata->>'status' = 'success') AS success_count
FROM analytics_events 
WHERE event_type = 'parse_image';
```
