import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import App from './App'
import { initGapi, initGis, authenticate, insertEvent, loadToken, signOut } from './services/calendar'
import { parseImage } from './services/gemini'

// Mock the calendar service
vi.mock('./services/calendar', () => ({
  initGapi: vi.fn(),
  initGis: vi.fn(),
  authenticate: vi.fn(),
  insertEvent: vi.fn(),
  loadToken: vi.fn(),
  signOut: vi.fn(),
}))

// Mock the gemini service
vi.mock('./services/gemini', () => ({
  parseImage: vi.fn(),
}))

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}))

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(initGapi).mockResolvedValue(undefined)
    vi.mocked(initGis).mockResolvedValue(undefined)
    vi.mocked(loadToken).mockResolvedValue(false)
  })

  it('renders Sign In screen initially when not authorized', async () => {
    render(<App />)

    const signInButton = await screen.findByRole('button', { name: /Sign In with Google/i })
    expect(signInButton).toBeInTheDocument()
    expect(screen.getByText('Screenshot 👉 Calendar')).toBeInTheDocument()
  })

  it('restores session when valid token exists', async () => {
    localStorage.setItem('gcal_authed', 'true')
    vi.mocked(loadToken).mockResolvedValue(true)

    render(<App />)

    const chooseImageButton = await screen.findByText(/Choose Image/i)
    expect(chooseImageButton).toBeInTheDocument()
    expect(screen.getByText(/Connected/i)).toBeInTheDocument()
  })

  it('triggers authentication flow on Sign In click', async () => {
    vi.mocked(authenticate).mockResolvedValue(undefined)

    render(<App />)

    const signInButton = await screen.findByRole('button', { name: /Sign In with Google/i })
    fireEvent.click(signInButton)

    await waitFor(() => {
      expect(authenticate).toHaveBeenCalled()
    })
  })

  it('allows manual entry of events when authorized', async () => {
    vi.mocked(loadToken).mockResolvedValue(true)

    render(<App />)

    const manualEntryButton = await screen.findByRole('button', { name: /Or enter manually/i })
    fireEvent.click(manualEntryButton)

    const summaryLabel = await screen.findByText('Event Name')
    const summaryInput = summaryLabel.nextElementSibling as HTMLInputElement
    expect(summaryInput).toBeInTheDocument()

    fireEvent.change(summaryInput, { target: { value: 'Team Lunch' } })
    expect(summaryInput).toHaveValue('Team Lunch')

    const locationInput = screen.getByPlaceholderText('Add location') as HTMLInputElement
    fireEvent.change(locationInput, { target: { value: 'Pizzeria' } })
    expect(locationInput).toHaveValue('Pizzeria')
  })

  it('resets form when clicking cancel', async () => {
    vi.mocked(loadToken).mockResolvedValue(true)

    render(<App />)

    const manualEntryButton = await screen.findByRole('button', { name: /Or enter manually/i })
    fireEvent.click(manualEntryButton)

    const cancelButton = await screen.findByRole('button', { name: /Cancel/i })
    fireEvent.click(cancelButton)

    expect(screen.getByText(/Choose Image/i)).toBeInTheDocument()
  })

  it('successfully adds event and shows confirmation with view link', async () => {
    vi.mocked(loadToken).mockResolvedValue(true)
    vi.mocked(insertEvent).mockResolvedValue({ htmlLink: 'https://calendar.google.com/event' })

    render(<App />)

    const manualEntryButton = await screen.findByRole('button', { name: /Or enter manually/i })
    fireEvent.click(manualEntryButton)

    const summaryLabel = await screen.findByText('Event Name')
    const summaryInput = summaryLabel.nextElementSibling as HTMLInputElement
    fireEvent.change(summaryInput, { target: { value: 'Project Sync' } })

    const addButton = screen.getByRole('button', { name: /Add to Calendar/i })
    fireEvent.click(addButton)

    const viewButton = await screen.findByRole('button', { name: /View in Calendar/i })
    expect(viewButton).toBeInTheDocument()

    const scanAnotherButton = screen.getByRole('button', { name: /Scan Another/i })
    fireEvent.click(scanAnotherButton)

    expect(screen.getByText(/Choose Image/i)).toBeInTheDocument()
  })

  it('displays error message if calendar event insertion fails', async () => {
    vi.mocked(loadToken).mockResolvedValue(true)
    vi.mocked(insertEvent).mockRejectedValue(new Error('Network Error'))

    render(<App />)

    const manualEntryButton = await screen.findByRole('button', { name: /Or enter manually/i })
    fireEvent.click(manualEntryButton)

    const summaryLabel = await screen.findByText('Event Name')
    const summaryInput = summaryLabel.nextElementSibling as HTMLInputElement
    fireEvent.change(summaryInput, { target: { value: 'Project Sync' } })

    const addButton = screen.getByRole('button', { name: /Add to Calendar/i })
    fireEvent.click(addButton)

    const errorMessage = await screen.findByText(/Error adding event: Network Error/i)
    expect(errorMessage).toBeInTheDocument()
  })

  it('triggers logout flow and cancels logout', async () => {
    vi.mocked(loadToken).mockResolvedValue(true)

    render(<App />)

    const connectedBadge = await screen.findByRole('button', { name: /Connected/i })
    fireEvent.click(connectedBadge)

    expect(screen.getByText(/Sign Out\?/i)).toBeInTheDocument()

    const cancelLogoutButton = screen.getByRole('button', { name: /Cancel/i })
    fireEvent.click(cancelLogoutButton)

    expect(screen.queryByText(/Sign Out\?/i)).not.toBeInTheDocument()
  })

  it('triggers logout flow and confirms logout', async () => {
    vi.mocked(loadToken).mockResolvedValue(true)

    render(<App />)

    const connectedBadge = await screen.findByRole('button', { name: /Connected/i })
    fireEvent.click(connectedBadge)

    const signoutButtons = screen.getAllByRole('button')
    const signoutBtn = signoutButtons.find(btn => btn.textContent === 'Sign Out')
    expect(signoutBtn).toBeDefined()
    fireEvent.click(signoutBtn!)

    expect(signOut).toHaveBeenCalled()
    const signInButton = await screen.findByRole('button', { name: /Sign In with Google/i })
    expect(signInButton).toBeInTheDocument()
  })

  it('processes shared target content when loaded with shared parameter', async () => {
    const mockFileBlob = new Blob(['dummy content'], { type: 'image/png' })
    const mockResponse = {
      blob: vi.fn().mockResolvedValue(mockFileBlob),
    }
    const mockCache = {
      match: vi.fn().mockResolvedValue(mockResponse),
      delete: vi.fn().mockResolvedValue(true),
    }
    const mockCaches = {
      open: vi.fn().mockResolvedValue(mockCache),
    }
    Object.defineProperty(window, 'caches', {
      writable: true,
      value: mockCaches,
    })

    const originalLocation = window.location
    const customLocation = {
      ...originalLocation,
      search: '?shared=true',
    }
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: customLocation,
    })

    vi.mocked(loadToken).mockResolvedValue(true)
    vi.mocked(parseImage).mockResolvedValue({
      summary: 'Shared Event',
      location: 'Shared Location',
      start_datetime: '2026-01-01T12:00:00',
      end_datetime: '2026-01-01T13:00:00',
      description: 'Shared Description',
    })

    render(<App />)

    const summaryLabel = await screen.findByText('Event Name')
    const summaryInput = summaryLabel.nextElementSibling as HTMLInputElement
    expect(summaryInput).toHaveValue('Shared Event')

    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: originalLocation,
    })
  })
})
