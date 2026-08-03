/// <reference types="gapi" />
/// <reference types="gapi.client" />
/// <reference types="gapi.client.calendar" />
/// <reference types="google.accounts" />

import type { EventDetails } from './gemini';

// Google Identity Services (GIS) and Calendar API

const SCOPES = 'https://www.googleapis.com/auth/calendar.events';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

// Environment variables
// Note: In Vite, process.env is usually replaced by import.meta.env, but we stick to the existing pattern if it works.
// However, standard Vite only exposes VITE_* vars. If these are not starting with VITE_, they might be replaced by a plugin.
// Given the previous file used process.env.GOOGLE_CLIENT_ID, we'll try to support both or fallback.
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// Use proxy in development to avoid CORS
const AUTH_BRIDGE_URL = import.meta.env.DEV
    ? '/api/auth'
    : (process.env.AUTH_BRIDGE_URL || import.meta.env.VITE_AUTH_BRIDGE_URL || 'https://auth-bridge-785229654842.europe-west1.run.app');

let codeClient: google.accounts.oauth2.CodeClient;
let tokenResolver: ((value: void | PromiseLike<void>) => void) | null = null;
let tokenRejecter: ((reason?: unknown) => void) | null = null;

export function initGapi() {
    return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => {
            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        discoveryDocs: [DISCOVERY_DOC],
                    });
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        };
        script.onerror = reject;
        document.body.appendChild(script);
    });
}

// Token management
let memoryAccessToken: string | null = null;
let memoryExpiresAt = 0;

function saveTokens(access_token: string, expiry_date?: number, expires_in?: number) {
    let expiresAt = 0;
    if (expiry_date) {
        expiresAt = expiry_date;
    } else if (expires_in) {
        expiresAt = Date.now() + (expires_in * 1000);
    } else {
        // Fallback default 1 hour
        expiresAt = Date.now() + 3600 * 1000;
    }

    memoryAccessToken = access_token;
    memoryExpiresAt = expiresAt;

    console.log('Tokens saved in memory. Expires at', new Date(expiresAt).toLocaleTimeString());
}

async function exchangeCodeForToken(code: string) {
    try {
        console.log('Exchanging code with Bridge:', AUTH_BRIDGE_URL);
        console.log('Using Client ID:', CLIENT_ID); // Verify this matches Cloud Function's CLIENT_ID
        // console.log('Code:', code); // Don't log full code in prod, but helpful for debug

        const response = await fetch(AUTH_BRIDGE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            // Added 'action' field based on "Invalid Action" error
            body: JSON.stringify({ action: 'exchange', code }),
        });

        if (!response.ok) {
            const text = await response.text();
            try {
                const error = JSON.parse(text);
                throw new Error(error.message || 'Failed to exchange code');
            } catch {
                throw new Error(`Server Error: ${text}`);
            }
        }

        const data = await response.json();
        // data should contain: access_token, expires_in, refresh_token, scope, token_type

        gapi.client.setToken({ access_token: data.access_token });
        // Server returns expiry_date (ms)
        saveTokens(data.access_token, data.expiry_date, data.expires_in);

        return data;
    } catch (error) {
        console.error('Error exchanging code for token:', error);
        throw error;
    }
}

async function refreshAccessToken() {
    try {
        console.log('Attempting to refresh access token...');
        const response = await fetch(AUTH_BRIDGE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            // Added 'action' field
            body: JSON.stringify({ action: 'refresh' }),
        });

        if (!response.ok) {
            // If refresh fails (e.g., revoked), clear everything
            if (response.status === 400 || response.status === 401) {
                signOut();
            }
            const text = await response.text();
            try {
                const error = JSON.parse(text);
                throw new Error(error.message || 'Failed to refresh token');
            } catch {
                throw new Error(`Server Error: ${text}`);
            }
        }

        const data = await response.json();
        // data should contain: access_token, expires_in (and maybe validation info)

        gapi.client.setToken({ access_token: data.access_token });
        // Update access token and expiry, keep existing refresh token
        saveTokens(data.access_token, data.expiry_date, data.expires_in);

        return data.access_token;
    } catch (error) {
        console.error('Error refreshing token:', error);
        throw error;
    }
}

export async function loadToken(): Promise<boolean> {
    const token = memoryAccessToken;
    const expiresAt = memoryExpiresAt;

    if (token && expiresAt) {
        if (Date.now() < expiresAt) {
            // Token is valid, restore it
            gapi.client.setToken({ access_token: token });
            console.log('Restored valid token from memory');
            return true;
        } else {
            // Token expired, attempt refresh
            console.log('In-memory token expired, attempting refresh...');
            try {
                await refreshAccessToken();
                return true;
            } catch {
                console.warn('Silent refresh failed');
                return false;
            }
        }
    } else {
        // No token in memory (e.g. fresh page load).
        // Attempt silent refresh via cookie-based flow.
        console.log('No token in memory, attempting silent refresh...');
        try {
            await refreshAccessToken();
            return true;
        } catch {
            console.warn('Silent refresh on init failed');
            return false;
        }
    }
}

export function signOut() {
    memoryAccessToken = null;
    memoryExpiresAt = 0;
    localStorage.removeItem('gcal_authed');
    // Clear GAPI token
    gapi.client.setToken(null);
    console.log('User signed out, tokens cleared.');
}

export function initGis() {
    return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.onload = () => {
            codeClient = google.accounts.oauth2.initCodeClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                ux_mode: 'popup',
                callback: (resp: google.accounts.oauth2.CodeResponse) => {
                    if (resp.error) {
                        if (tokenRejecter) tokenRejecter(resp);
                        return;
                    }

                    // Exchange code for code
                    exchangeCodeForToken(resp.code)
                        .then(() => {
                            if (tokenResolver) tokenResolver();
                        })
                        .catch((err) => {
                            if (tokenRejecter) tokenRejecter(err);
                        });
                },
            });
            resolve();
        };
        script.onerror = reject;
        document.body.appendChild(script);
    });
}

export async function authenticate() {
    return new Promise<void>((resolve, reject) => {
        if (!codeClient) return reject('GIS not initialized');
        tokenResolver = resolve;
        tokenRejecter = reject;

        try {
            // Request auth code (offline access for refresh token)
            // Note: select_account allows user to switch accounts if needed
            codeClient.requestCode();
        } catch (e) {
            reject(e);
        }
    });
}

export async function insertEvent(eventData: EventDetails) {
    try {
        // Double check token validity before request
        const isAuth = await loadToken();
        if (!isAuth) {
            throw new Error("Not authenticated");
        }

        if (!eventData || typeof eventData !== 'object') {
            throw new Error("Invalid event data: must be an object");
        }

        if (!eventData.summary || typeof eventData.summary !== 'string' || eventData.summary.trim() === '') {
            throw new Error("Invalid or missing event summary");
        }

        if (!eventData.start_datetime || isNaN(Date.parse(eventData.start_datetime))) {
            throw new Error("Invalid or missing start_datetime");
        }

        if (eventData.end_datetime && isNaN(Date.parse(eventData.end_datetime))) {
            throw new Error("Invalid end_datetime");
        }

        const event = {
            summary: eventData.summary,
            location: eventData.location,
            description: (eventData.description ? eventData.description + "\n\n" : "") + "💫✨ Imported by Screenshot 👉 Calendar.",
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
    } catch (err: unknown) {
        console.error("Error inserting event", err);
        // If 401, maybe token expired during use? Try one retry if we wanted to be robust
        if (err && typeof err === 'object' && 'result' in err) {
            const res = (err as Record<string, unknown>).result;
            if (res && typeof res === 'object' && 'error' in res) {
                const apiError = (res as Record<string, unknown>).error;
                if (apiError && typeof apiError === 'object' && 'code' in apiError && (apiError as Record<string, unknown>).code === 401) {
                    // Could trigger refresh here and retry, but simpler to rely on loadToken checks for now
                }
            }
        }
        throw err;
    }
}
