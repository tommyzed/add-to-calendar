# Add to Calendar

A Progressive Web App (PWA) that uses **Google Gemini AI** to extract event details from screenshots (or any image) and adds them directly to your **Google Calendar**.

Built with **React 19**, **TypeScript**, and **Vite**, featuring a modern **Glassmorphism UI**, a secure **Cloud Run Backend Bridge**, and seamless PWA integration.

## 🌐 Demo

[**Try the App Live**](https://add-to-calendar.egodevnull.com/)

_(NOTE: message me to be allowlisted)_

![CalDemo9-ezgif com-resize (2)](https://github.com/user-attachments/assets/afc71cae-9c1c-4ee2-9d48-b9f03f88b67a)

## ✨ Features

- **AI-Powered Extraction**: Uses Google Gemini to intelligently parse event titles, dates, times, and locations from images.
- **Secure Backend Proxy Architecture**:
  - Gemini API calls are securely routed through a Cloud Run backend (`auth-bridge`).
  - Secret keys (`GEMINI_APP_KEY`, `CLIENT_SECRET`, etc.) remain strictly server-side in Google Secret Manager and are **never** exposed to client-side browser bundles.
- **Cloud Image Storage & Attendee Sharing (v2.0)**:
  - **Zero-Latency Concurrent Uploads**: Uploads source images to Google Cloud Storage (GCS) in parallel with Gemini AI analysis.
  - **Attendee-Accessible Hyperlinks**: Adds a clean HTML hyperlink (`📸 View Event Image`) to the calendar event description so all attendees can view the original screenshot.
  - **Automated 90-Day TTL**: GCS bucket lifecycle rules automatically purge old images, keeping maintenance and storage costs near zero.
  - **In-App Source Preview**: Inspect the uploaded screenshot via a convenient preview pill in the review card before adding to Calendar.
  - **Branded Event Footer**: Includes an interactive link to Add to Calendar in event descriptions.
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
│   ├── App.tsx               # Main application component & layout
│   └── services/
│       ├── calendar.ts       # Google Calendar API & OAuth client
│       └── gemini.ts         # Image processing client (calls auth-bridge)
├── functions/
│   └── auth-bridge/          # Cloud Run Backend Service (Node.js 22)
│       ├── index.js          # OAuth token exchange/refresh, Gemini parser & GCS uploader
│       └── package.json      # Backend dependencies (@google-cloud/storage, @google/generative-ai)
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
  --set-secrets="GEMINI_APP_KEY=GEMINI_APP_KEY:latest,CLIENT_ID=CLIENT_ID:latest,CLIENT_SECRET=CLIENT_SECRET:latest,GEMINI_MODEL=GEMINI_MODEL:latest,IMAGE_BUCKET_NAME=IMAGE_BUCKET_NAME:latest"
```
