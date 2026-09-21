import { describe, it, expect, beforeEach } from 'vitest';
import { refreshAccessToken } from './calendar';

describe('Calendar Service Tests', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('refreshAccessToken throws error if no refresh token is available in localStorage', async () => {
    // Ensure the token is explicitly removed
    localStorage.removeItem('gcal_refresh_token');

    // Assert that calling refreshAccessToken throws the correct error
    await expect(refreshAccessToken()).rejects.toThrow('No refresh token available');
  });
});