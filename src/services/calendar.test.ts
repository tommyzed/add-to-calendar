import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { insertEvent } from './calendar';

// Mock gapi
vi.stubGlobal('gapi', {
  client: {
    calendar: {
      events: {
        insert: vi.fn().mockResolvedValue({ result: { id: 'event_id_123' } }),
      },
    },
    setToken: vi.fn(),
  },
});

describe('calendar service', () => {
  beforeEach(() => {
    localStorage.setItem('gcal_access_token', 'valid-token');
    localStorage.setItem('gcal_expires_at', String(Date.now() + 100000));
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('insertEvent', () => {
    it('throws error when summary is invalid or missing', async () => {
      const eventDataMissingSummary = {
        start_datetime: new Date().toISOString(),
      };
      await expect(insertEvent(eventDataMissingSummary as any)).rejects.toThrow('Invalid or missing event summary');

      const eventDataEmptySummary = {
        summary: '   ',
        start_datetime: new Date().toISOString(),
      };
      await expect(insertEvent(eventDataEmptySummary as any)).rejects.toThrow('Invalid or missing event summary');

      const eventDataNumberSummary = {
        summary: 123,
        start_datetime: new Date().toISOString(),
      };
      await expect(insertEvent(eventDataNumberSummary as any)).rejects.toThrow('Invalid or missing event summary');
    });

    it('throws error when start_datetime is invalid or missing', async () => {
      const eventDataMissingDate = {
        summary: 'Test Event',
      };
      await expect(insertEvent(eventDataMissingDate as any)).rejects.toThrow('Invalid or missing start_datetime');

      const eventDataInvalidDate = {
        summary: 'Test Event',
        start_datetime: 'invalid-date',
      };
      await expect(insertEvent(eventDataInvalidDate as any)).rejects.toThrow('Invalid or missing start_datetime');
    });

    it('throws error when end_datetime is invalid', async () => {
      const eventData = {
        summary: 'Test Event',
        start_datetime: new Date().toISOString(),
        end_datetime: 'invalid-date',
      };

      await expect(insertEvent(eventData as any)).rejects.toThrow('Invalid end_datetime');
    });

    it('successfully inserts an event with valid data', async () => {
      const eventData = {
        summary: 'Valid Event',
        start_datetime: new Date().toISOString(),
      };

      const result = await insertEvent(eventData as any);
      expect(result).toEqual({ id: 'event_id_123' });
    });
  });
});
