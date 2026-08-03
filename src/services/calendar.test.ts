import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';
import { loadToken, signOut } from './calendar';

// Define standard types for gapi mocking
interface MockGapi {
  client: {
    setToken: MockInstance;
  };
}

// Global gapi mock setup
const mockSetToken = vi.fn();
const mockGapi: MockGapi = {
  client: {
    setToken: mockSetToken,
  },
};

vi.stubGlobal('gapi', mockGapi);

// Also mock window.document or other browser APIs if required by script loading
const mockAppendChild = vi.fn();
vi.stubGlobal('document', {
  createElement: vi.fn().mockReturnValue({
    src: '',
    onload: null,
    onerror: null,
  }),
  body: {
    appendChild: mockAppendChild,
  },
});

describe('loadToken', () => {
  let fetchSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Stub global fetch
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  it('should restore a valid token and return true if unexpired access token exists', async () => {
    const unexpiredTime = Date.now() + 100000;
    localStorage.setItem('gcal_access_token', 'valid-token');
    localStorage.setItem('gcal_expires_at', unexpiredTime.toString());

    const result = await loadToken();

    expect(result).toBe(true);
    expect(mockSetToken).toHaveBeenCalledWith({ access_token: 'valid-token' });
  });

  it('should attempt silent refresh and return true if expired access token and refresh token exist, and refresh succeeds', async () => {
    const expiredTime = Date.now() - 100000;
    localStorage.setItem('gcal_access_token', 'expired-token');
    localStorage.setItem('gcal_expires_at', expiredTime.toString());
    localStorage.setItem('gcal_refresh_token', 'refresh-token');

    // Mock fetch to succeed
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new-access-token',
        expires_in: 3600,
        expiry_date: Date.now() + 3600 * 1000,
      }),
    });

    const result = await loadToken();

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(mockSetToken).toHaveBeenCalledWith({ access_token: 'new-access-token' });
    expect(localStorage.getItem('gcal_access_token')).toBe('new-access-token');
  });

  it('should attempt silent refresh and return false if expired access token and refresh token exist, but refresh fails', async () => {
    const expiredTime = Date.now() - 100000;
    localStorage.setItem('gcal_access_token', 'expired-token');
    localStorage.setItem('gcal_expires_at', expiredTime.toString());
    localStorage.setItem('gcal_refresh_token', 'refresh-token');

    // Mock fetch to fail
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Invalid Grant',
    });

    const result = await loadToken();

    expect(result).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // When status is 400, signOut is called which removes all items and clears gapi token
    expect(localStorage.getItem('gcal_access_token')).toBeNull();
    expect(localStorage.getItem('gcal_expires_at')).toBeNull();
    expect(localStorage.getItem('gcal_refresh_token')).toBeNull();
    expect(mockSetToken).toHaveBeenCalledWith(null);
  });

  it('should sign out and return false if stored access token has expired and no refresh token is present', async () => {
    const expiredTime = Date.now() - 100000;
    localStorage.setItem('gcal_access_token', 'expired-token');
    localStorage.setItem('gcal_expires_at', expiredTime.toString());

    const result = await loadToken();

    expect(result).toBe(false);
    expect(localStorage.getItem('gcal_access_token')).toBeNull();
    expect(localStorage.getItem('gcal_expires_at')).toBeNull();
    expect(mockSetToken).toHaveBeenCalledWith(null);
  });

  it('should attempt silent refresh and return true if only refresh token exists (no access token) and refresh succeeds', async () => {
    localStorage.setItem('gcal_refresh_token', 'refresh-token');

    // Mock fetch to succeed
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new-access-token',
        expires_in: 3600,
        expiry_date: Date.now() + 3600 * 1000,
      }),
    });

    const result = await loadToken();

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(mockSetToken).toHaveBeenCalledWith({ access_token: 'new-access-token' });
    expect(localStorage.getItem('gcal_access_token')).toBe('new-access-token');
  });

  it('should attempt silent refresh and return false if only refresh token exists (no access token) and refresh fails', async () => {
    localStorage.setItem('gcal_refresh_token', 'refresh-token');

    // Mock fetch to fail
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Invalid Grant',
    });

    const result = await loadToken();

    expect(result).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('gcal_refresh_token')).toBeNull();
  });

  it('should return false if neither access token nor refresh token exists', async () => {
    const result = await loadToken();
    expect(result).toBe(false);
  });
});

describe('signOut', () => {
  it('should remove all items from storage and set gapi token to null', () => {
    localStorage.setItem('gcal_access_token', 'token');
    localStorage.setItem('gcal_expires_at', '123456');
    localStorage.setItem('gcal_refresh_token', 'refresh');

    signOut();

    expect(localStorage.getItem('gcal_access_token')).toBeNull();
    expect(localStorage.getItem('gcal_expires_at')).toBeNull();
    expect(localStorage.getItem('gcal_refresh_token')).toBeNull();
    expect(mockSetToken).toHaveBeenCalledWith(null);
  });
});
