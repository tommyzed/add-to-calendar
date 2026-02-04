/// <reference types="gapi" />
/// <reference types="gapi.client" />
/// <reference types="gapi.client.calendar" />
/// <reference types="google.accounts" />

// Google Identity Services (GIS) and Calendar API

const SCOPES = 'https://www.googleapis.com/auth/calendar.events';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

// We need a Google Client ID. Usually this is also an env var, but for this bootstrap we might need to ask user or hardcode a placeholder.
// The user said "use values in .env", but only shared GEMINI ones.
// I'll assume REACT_APP_GOOGLE_CLIENT_ID or VITE_GOOGLE_CLIENT_ID will be added later.
// For now, I'll put a placeholder string and ask user to fill it.

// WAIT, user didn't give Google Client ID variable name.
// I will check if I can use a generic one or if I should add it to env.d.ts and use process.env.GOOGLE_CLIENT_ID

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID_HERE';

let tokenClient: google.accounts.oauth2.TokenClient;
let gapiInited = false;
let gisInited = false;
let tokenResolver: ((value: void | PromiseLike<void>) => void) | null = null;
let tokenRejecter: ((reason?: any) => void) | null = null;

export function initGapi() {
    return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => {
            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        // apiKey: API_KEY, // Optional for Calendar if using OAuth token
                        discoveryDocs: [DISCOVERY_DOC],
                    });
                    gapiInited = true;
                    if (gisInited) resolve();
                } catch (e) {
                    reject(e);
                }
            });
        };
        script.onerror = reject;
        document.body.appendChild(script);
    });
}

export function initGis() {
    return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.onload = () => {
            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: (resp: google.accounts.oauth2.TokenResponse) => {
                    if (resp.error !== undefined) {
                        if (tokenRejecter) tokenRejecter(resp);
                    } else {
                        if (tokenResolver) tokenResolver();
                    }
                },
            });
            gisInited = true;
            if (gapiInited) resolve();
        };
        script.onerror = reject;
        document.body.appendChild(script);
    });
}

export async function authenticate(silent = false) {
    return new Promise<void>((resolve, reject) => {
        if (!tokenClient) return reject('GIS not initialized');
        tokenResolver = resolve;
        tokenRejecter = reject;

        // Request access token
        // Use 'none' for silent auth to avoid popup if already signed in
        tokenClient.requestAccessToken({ prompt: silent ? 'none' : '' });
    });
}

export async function insertEvent(eventData: any) {
    // Ensure auth
    // Note: gapi.client.calendar.events.insert
    try {
        const event = {
            summary: eventData.summary,
            location: eventData.location,
            description: eventData.description || 'Added via Screenshot to Calendar PWA',
            start: {
                dateTime: eventData.start_datetime,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            end: {
                dateTime: eventData.end_datetime,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
        };

        const request = gapi.client.calendar.events.insert({
            'calendarId': 'primary',
            'resource': event,
        });

        const response = await request;
        return response.result;
    } catch (err) {
        console.error("Error inserting event", err);
        throw err;
    }
}
