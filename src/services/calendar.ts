/// <reference types="gapi" />
/// <reference types="gapi.client" />
/// <reference types="gapi.client.calendar" />
/// <reference types="google.accounts" />

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
let tokenRejecter: ((reason?: any) => void) | null = null;

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
function saveTokens(access_token: string, expiry_date?: number, expires_in?: number, refresh_token?: string) {
    let expiresAt = 0;
    if (expiry_date) {
        expiresAt = expiry_date;
    } else if (expires_in) {
        expiresAt = Date.now() + (expires_in * 1000);
    } else {
        // Fallback default 1 hour
        expiresAt = Date.now() + 3600 * 1000;
    }

    localStorage.setItem('gcal_access_token', access_token);
    localStorage.setItem('gcal_expires_at', expiresAt.toString());

    if (refresh_token) {
        localStorage.setItem('gcal_refresh_token', refresh_token);
    }
    console.log('Tokens saved. Expires at', new Date(expiresAt).toLocaleTimeString());
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
            // Added 'action' field based on "Invalid Action" error
            body: JSON.stringify({ action: 'exchange', code }),
        });

        if (!response.ok) {
            const text = await response.text();
            try {
                const error = JSON.parse(text);
                throw new Error(error.message || 'Failed to exchange code');
            } catch (e) {
                throw new Error(`Server Error: ${text}`);
            }
        }

        const data = await response.json();
        // data should contain: access_token, expires_in, refresh_token, scope, token_type

        gapi.client.setToken({ access_token: data.access_token });
        // Server returns expiry_date (ms)
        saveTokens(data.access_token, data.expiry_date, data.expires_in, data.refresh_token);

        return data;
    } catch (error) {
        console.error('Error exchanging code for token:', error);
        throw error;
    }
}

async function refreshAccessToken() {
    const refresh_token = localStorage.getItem('gcal_refresh_token');
    if (!refresh_token) {
        throw new Error('No refresh token available');
    }

    try {
        console.log('Attempting to refresh access token...');
        const response = await fetch(AUTH_BRIDGE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // Added 'action' field
            body: JSON.stringify({ action: 'refresh', refresh_token }),
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
            } catch (e) {
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
    const token = localStorage.getItem('gcal_access_token');
    const expiresAt = localStorage.getItem('gcal_expires_at');
    const refreshToken = localStorage.getItem('gcal_refresh_token');

    if (token && expiresAt) {
        if (Date.now() < Number(expiresAt)) {
            // Token is valid, restore it
            gapi.client.setToken({ access_token: token });
            console.log('Restored valid token from storage');
            return true;
        } else if (refreshToken) {
            // Token expired but we have refresh token
            console.log('Token expired, attempting refresh...');
            try {
                await refreshAccessToken();
                return true;
            } catch (e) {
                console.warn('Silent refresh failed', e);
                return false;
            }
        } else {
            console.log('Stored token expired and no refresh token');
            signOut();
        }
    } else if (refreshToken) {
        // No access token but have refresh token (unlikely but possible)
        try {
            await refreshAccessToken();
            return true;
        } catch (e) {
            return false;
        }
    }
    return false;
}

export function signOut() {
    localStorage.removeItem('gcal_access_token');
    localStorage.removeItem('gcal_expires_at');
    localStorage.removeItem('gcal_refresh_token');
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

export async function insertEvent(eventData: any) {
    try {
        // Double check token validity before request
        const isAuth = await loadToken();
        if (!isAuth) {
            throw new Error("Not authenticated");
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
    } catch (err: any) {
        console.error("Error inserting event", err);
        // If 401, maybe token expired during use? Try one retry if we wanted to be robust
        if (err.result && err.result.error && err.result.error.code === 401) {
            // Could trigger refresh here and retry, but simpler to rely on loadToken checks for now
        }
        throw err;
    }
}
