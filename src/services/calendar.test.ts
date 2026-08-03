import { describe, it, expect, beforeEach, vi } from 'vitest';
import { insertEvent } from './calendar';
import type { EventDetails } from './gemini';

// We need to define gapi in the global scope so our file can load and refer to it.
const mockSetToken = vi.fn();
const mockInsert = vi.fn();

global.gapi = {
    load: vi.fn(),
    client: {
        init: vi.fn(),
        setToken: mockSetToken,
        calendar: {
            events: {
                insert: mockInsert,
            },
        },
    },
} as any;

// Stub import.meta.env properties as needed for Vite environment in Vitest
if (!import.meta.env) {
    (import.meta as any).env = {
        DEV: true,
        VITE_AUTH_BRIDGE_URL: 'https://auth-bridge-785229654842.europe-west1.run.app',
    };
}

// In-memory mock for localStorage since we're running without jsdom by default or we need to specify environment
class LocalStorageMock {
    private store: Record<string, string> = {};

    clear() {
        this.store = {};
    }

    getItem(key: string) {
        return this.store[key] || null;
    }

    setItem(key: string, value: string) {
        this.store[key] = String(value);
    }

    removeItem(key: string) {
        delete this.store[key];
    }
}

global.localStorage = new LocalStorageMock() as any;

describe('insertEvent tests', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
        mockInsert.mockReset();
        mockSetToken.mockReset();
    });

    it('throws "Not authenticated" if token is missing or expired and no refresh token exists', async () => {
        // No token in localStorage
        await expect(insertEvent({
            summary: 'Test event',
            start_datetime: '2026-08-03T10:00:00Z',
        })).rejects.toThrow('Not authenticated');
    });

    it('throws "Invalid event data: must be an object" if eventData is falsy or not an object', async () => {
        // Set up active authenticated token
        localStorage.setItem('gcal_access_token', 'valid-token');
        localStorage.setItem('gcal_expires_at', String(Date.now() + 100000));

        // @ts-ignore
        await expect(insertEvent(null)).rejects.toThrow('Invalid event data: must be an object');
        // @ts-ignore
        await expect(insertEvent('not-an-object')).rejects.toThrow('Invalid event data: must be an object');
    });

    it('throws "Invalid or missing event summary" if summary is missing, empty, or not a string', async () => {
        // Set up active authenticated token
        localStorage.setItem('gcal_access_token', 'valid-token');
        localStorage.setItem('gcal_expires_at', String(Date.now() + 100000));

        await expect(insertEvent({
            summary: '',
            start_datetime: '2026-08-03T10:00:00Z',
        })).rejects.toThrow('Invalid or missing event summary');

        await expect(insertEvent({
            // @ts-ignore
            summary: null,
            start_datetime: '2026-08-03T10:00:00Z',
        })).rejects.toThrow('Invalid or missing event summary');
    });

    it('throws "Invalid or missing start_datetime" if start_datetime is missing or invalid', async () => {
        // Set up active authenticated token
        localStorage.setItem('gcal_access_token', 'valid-token');
        localStorage.setItem('gcal_expires_at', String(Date.now() + 100000));

        await expect(insertEvent({
            summary: 'Test event',
            start_datetime: 'not-a-valid-date',
        })).rejects.toThrow('Invalid or missing start_datetime');

        await expect(insertEvent({
            summary: 'Test event',
            // @ts-ignore
            start_datetime: null,
        })).rejects.toThrow('Invalid or missing start_datetime');
    });

    it('throws "Invalid end_datetime" if end_datetime is provided but invalid', async () => {
        // Set up active authenticated token
        localStorage.setItem('gcal_access_token', 'valid-token');
        localStorage.setItem('gcal_expires_at', String(Date.now() + 100000));

        await expect(insertEvent({
            summary: 'Test event',
            start_datetime: '2026-08-03T10:00:00Z',
            end_datetime: 'not-a-valid-date',
        })).rejects.toThrow('Invalid end_datetime');
    });

    it('successfully calls calendar insert and returns response result', async () => {
        // Set up active authenticated token
        localStorage.setItem('gcal_access_token', 'valid-token');
        localStorage.setItem('gcal_expires_at', String(Date.now() + 100000));

        const mockResponseResult = { id: 'event-123', status: 'confirmed' };
        mockInsert.mockResolvedValue({
            result: mockResponseResult,
        });

        const eventData: EventDetails = {
            summary: 'My Awesome Event',
            start_datetime: '2026-08-03T10:00:00Z',
            end_datetime: '2026-08-03T11:00:00Z',
            location: 'Coffee Shop',
            description: 'Discuss project roadmap',
        };

        const result = await insertEvent(eventData);

        expect(mockInsert).toHaveBeenCalledWith({
            calendarId: 'primary',
            resource: {
                summary: 'My Awesome Event',
                location: 'Coffee Shop',
                description: 'Discuss project roadmap\n\n💫✨ Imported by Screenshot 👉 Calendar.',
                start: {
                    dateTime: '2026-08-03T10:00:00Z',
                    timeZone: expect.any(String),
                },
                end: {
                    dateTime: '2026-08-03T11:00:00Z',
                    timeZone: expect.any(String),
                },
            },
        });

        expect(result).toEqual(mockResponseResult);
    });

    it('successfully calls calendar insert when optional fields (description, end_datetime, location) are omitted', async () => {
        // Set up active authenticated token
        localStorage.setItem('gcal_access_token', 'valid-token');
        localStorage.setItem('gcal_expires_at', String(Date.now() + 100000));

        const mockResponseResult = { id: 'event-456', status: 'confirmed' };
        mockInsert.mockResolvedValue({
            result: mockResponseResult,
        });

        const eventData: EventDetails = {
            summary: 'Simple Event',
            start_datetime: '2026-08-03T10:00:00Z',
        };

        const result = await insertEvent(eventData);

        expect(mockInsert).toHaveBeenCalledWith({
            calendarId: 'primary',
            resource: {
                summary: 'Simple Event',
                location: undefined,
                description: '💫✨ Imported by Screenshot 👉 Calendar.',
                start: {
                    dateTime: '2026-08-03T10:00:00Z',
                    timeZone: expect.any(String),
                },
                end: {
                    dateTime: undefined,
                    timeZone: expect.any(String),
                },
            },
        });

        expect(result).toEqual(mockResponseResult);
    });
});
