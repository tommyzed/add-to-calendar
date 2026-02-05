# Screenshot 👉 Calendar

A Progressive Web App (PWA) that uses **Google Gemini AI** to extract event details from screenshots (or any image) and adds them directly to your **Google Calendar**.

Built with **React**, **TypeScript**, and **Vite**, featuring a modern **Glassmorphism UI** and seamless PWA integration.

## 🌐 Demo

[**Try the App Live**](https://add-to-calendar-production.up.railway.app/)

_(NOTE: message me to be allowlisted)_

![CalDemo9-ezgif com-resize (2)](https://github.com/user-attachments/assets/afc71cae-9c1c-4ee2-9d48-b9f03f88b67a)

## ✨ Features

- **AI-Powered Extraction**: Uses Gemini 3 Flash to intelligently parse event titles, dates, times, and locations from images.
- **Seamless Google Calendar Integration**:
  - **Persistent Authentication**: Stays logged in so you don't have to sign in every time.
  - **Direct Insertion**: Adds events directly to your primary calendar.
  - **View Link**: Provides a direct link to view the created event in Google Calendar.
- **Modern User Experience**:
  - **Glassmorphism Design**: Sleek, dark-mode-inspired UI with blur effects and gradients.
  - **Editable Details**: Review and modify the event summary, location, and start/end times before adding.
  - **Custom Date Picker**: Fully styled, modern date/time picker for easy adjustments.
  - **Smart Feedback**: Confetti animations on success, inline error handling, and graceful warnings for unclear images (allowing manual entry).
- **PWA Capabilities**:
  - **Installable**: Can be installed on mobile and desktop.
  - **Share Target**: Receive images directly from the Android System Share Sheet (e.g., share a screenshot from Google Photos directly to this app).

## 🚀 Setup & Installation

### Prerequisites

- Node.js (v18+)
- A Google Cloud Project with the **Google Calendar API** enabled.
- An API Key for **Google Gemini** (Vertex AI or AI Studio).

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd add-to-calendar
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
# Your Google Gemini API Key
VITE_GEMINI_APP_KEY=your_gemini_api_key

# The Gemini Model to use (default: gemini-1.5-flash)
VITE_GEMINI_MODEL=gemini-1.5-flash

# Your Google OAuth 2.0 Client ID (for Calendar access)
VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

> **Note**: For `VITE_GOOGLE_CLIENT_ID`, ensure your Google Cloud Console "Authorized JavaScript origins" includes `http://localhost:5173` (for dev) and your production URL.

### 3. Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## 📱 How to Use

1.  **Sign In**: Click "Sign In with Google" to authorize Calendar access (only needed once).
2.  **Add an Image**:
    *   **Desktop/Mobile Web**: Click "Choose Image" to select a screenshot.
    *   **Android (PWA)**: Open an image in your gallery -> Share -> Select "Screenshot 👉 Calendar".
3.  **Review & Edit**: The AI will populate the event details.
    *   Use the **Date Pickers** to adjust times if needed.
    *   Edit the **Name** or **Location**.
4.  **Add**: Click "Add to Calendar".
5.  **Success**: You'll see a confirmation! Click "View in Calendar" to verify or "Scan Another" to continue.

## 🛠️ Technologies

- **Frontend**: React 19, TypeScript, Vite
- **AI**: Google Gemini API (`@google/generative-ai`)
- **Integration**: Google Identity Services (GIS), Google API Client (GAPI)
- **UI Libraries**: `react-datepicker`, `canvas-confetti`
- **Styling**: Vanilla CSS (Variables, Flexbox, Glassmorphism)

## 📦 Deployment

This app is static and can be deployed to any static host (Vercel, Netlify, Github Pages).

**Important**: For the PWA "Share Target" to work on Android, the app **must be served over HTTPS**.

```bash
npm run build
# Deploy the 'dist' folder
```
