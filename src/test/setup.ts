import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock matchMedia for MUI components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock caches
const mockCache = {
  match: vi.fn(),
  delete: vi.fn(),
}
const mockCaches = {
  open: vi.fn().mockResolvedValue(mockCache),
}
Object.defineProperty(window, 'caches', {
  writable: true,
  value: mockCaches,
})

// Stub global gapi
const gapiMock = {
  load: vi.fn(),
  client: {
    init: vi.fn().mockResolvedValue(undefined),
    setToken: vi.fn(),
    calendar: {
      events: {
        insert: vi.fn(),
      },
    },
  },
}
Object.defineProperty(globalThis, 'gapi', {
  writable: true,
  value: gapiMock,
})

// Stub global google
const googleMock = {
  accounts: {
    oauth2: {
      initCodeClient: vi.fn().mockReturnValue({
        requestCode: vi.fn(),
      }),
    },
  },
}
Object.defineProperty(globalThis, 'google', {
  writable: true,
  value: googleMock,
})
