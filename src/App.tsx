import { useState, useEffect } from 'react'
import './App.css'
import { initGapi, initGis, authenticate, insertEvent, loadToken, signOut } from './services/calendar';
import { parseImage } from './services/gemini';
import confetti from 'canvas-confetti';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs from 'dayjs';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const muiTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#3b82f6' },
    background: { paper: 'rgba(30, 30, 47, 0.95)' }
  },
  typography: { fontFamily: 'inherit' },
  components: {
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          color: 'white',
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '12px',
          fontFamily: 'inherit',
          '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
          '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.3)' },
          '&.Mui-focused fieldset': { borderColor: '#3b82f6', borderWidth: '1px' },
        },
        input: {
          padding: '12px 14px',
        }
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { color: 'rgba(255, 255, 255, 0.7)' } }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
        }
      }
    }
  }
});

function App() {
  const [authorized, setAuthorized] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [eventDetails, setEventDetails] = useState<any>(null);
  const [createdEventLink, setCreatedEventLink] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    // Start by assuming we are restoring if the flag exists
    const hasAuthFlag = localStorage.getItem('gcal_authed') === 'true';
    setIsRestoring(hasAuthFlag); // If no flag, we are not restoring, effectively.

    Promise.all([initGapi(), initGis()])
      .then(() => {
        // Check for share target data first to set correct initial status if needed
        const urlParams = new URLSearchParams(window.location.search);
        const isSharing = urlParams.get('shared') === 'true';

        if (isSharing) {
          setStatus('Shared content received. Processing...');
          handleSharedContent();
        } else {
          setStatus('Ready.');
        }

        // Check for valid stored token first
        loadToken().then((isValid) => {
          if (isValid) {
            setAuthorized(true);
            // Only update status if NOT sharing, to avoid overwriting "Analyzing..."
            if (!isSharing) {
              setStatus('Session restored from storage.');
            }
            setIsRestoring(false);
          } else {
            // Token invalid or missing.
            // IF we were previously authorized, try to silently refresh.
            const wasAuthed = localStorage.getItem('gcal_authed') === 'true';
            if (wasAuthed) {
              if (!isSharing) setStatus('Refreshing session...');
              // Attempt restore which might have failed above due to race, or just try auth
              // Actually, loadToken() already attempts refresh if refresh token exists.
              // If it returned false, it means refresh failed or no tokens.

              // If we want to force re-auth flow or just show login button:
              setAuthorized(false);
              setIsRestoring(false);
            } else {
              // No previous session, ready for fresh login
              setIsRestoring(false);
            }
          }
        });
      })
      .catch(err => {
        setStatus(`Init Error: ${err}`);
        setIsRestoring(false);
      });
  }, []);

  const handleSharedContent = async () => {
    try {
      if ('caches' in window) {
        const cache = await caches.open('share-target');
        const response = await cache.match('shared-file');
        if (response) {
          const blob = await response.blob();
          const file = new File([blob], "shared_image.png", { type: blob.type });
          processFile(file);

          // Clean up cache to prevent reprocessing on reload
          await cache.delete('shared-file');

          // Clean up URL to prevent triggering again
          const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
          window.history.replaceState({ path: newUrl }, '', newUrl);
        } else {
          setStatus('No shared file found in cache.');
        }
      }
    } catch (e) {
      console.error(e);
      setStatus('Error retrieving shared file.');
    }
  };

  const handleAuth = async () => {
    try {
      await authenticate();
      setAuthorized(true);
      localStorage.setItem('gcal_authed', 'true');
      setStatus('Authorized!');
    } catch (e) {
      setStatus(`Auth Failed: ${JSON.stringify(e)}`);
    }
  };

  const processFile = async (file: File) => {
    setProcessing(true);
    setStatus('Analyzing image with Gemini...');
    setCreatedEventLink(null); // Reset link
    try {
      const details = await parseImage(file);
      console.log('Parsed:', details);

      if (details.error && details.error !== 'none') {
        if (details.error === 'UNABLE_TO_DETERMINE') {
          // Warn user but allow manual entry
          setStatus('🧙 The AI elves are confused. Please review. 🧙');
          // Ensure we have at least empty structure
          setEventDetails({
            summary: details.summary || '',
            location: details.location || '',
            start_datetime: details.start_datetime || new Date().toISOString(),
            end_datetime: details.end_datetime || new Date(Date.now() + 3600000).toISOString(),
            description: details.description || ''
          });
        } else {
          // Hard error
          setStatus(`Could not find event: ${details.error}`);
          setProcessing(false);
          return;
        }
      } else {
        setEventDetails(details);
        setStatus('Event parsed! Confirm to add.');
      }
    } catch (e: any) {
      setStatus(`Error parsing: ${e.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirm = async () => {
    if (!eventDetails) return;
    setProcessing(true);
    setStatus('Adding to Calendar...');
    try {
      const result = await insertEvent(eventDetails);
      setStatus('Event Added Successfully!');
      if (result.htmlLink) {
        setCreatedEventLink(result.htmlLink);
      }
      confetti();
      // Keep details on screen as requested
    } catch (e: any) {
      console.error(e);
      const msg = e.result?.error?.message || e.message || JSON.stringify(e);
      setStatus(`Error adding event: ${msg}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setEventDetails(null);
    setCreatedEventLink(null);
    setStatus('Ready for next.');
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  }

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    signOut();
    setAuthorized(false);
    setEventDetails(null);
    setCreatedEventLink(null);
    setShowLogoutConfirm(false);
    setStatus('');
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  const handleCancel = () => {
    setEventDetails(null);
    setStatus('Ready for next.');
  };

  const handleManualEntry = () => {
    const now = new Date();
    // Default to the next full hour
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    const offsetDateStart = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));

    const end = new Date(now.getTime() + 3600000);
    const offsetDateEnd = new Date(end.getTime() - (end.getTimezoneOffset() * 60000));

    setEventDetails({
      summary: '',
      location: '',
      start_datetime: offsetDateStart.toISOString().slice(0, 19),
      end_datetime: offsetDateEnd.toISOString().slice(0, 19),
      description: ''
    });
    setStatus('');
    setCreatedEventLink(null);
  };

  return (
    <ThemeProvider theme={muiTheme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <div className="container">
          <div className="banner">
            <h1 className="title">
              <span className="screenshot">Screenshot 👉 Calendar</span>
            </h1>
            <p className="tagline">Turn screenshots into scheduled events instantly!</p>
          </div>

          <div className="header-actions">
            <a href="https://ko-fi.com/egodevnull" target="_blank" rel="noopener noreferrer" className="coffee-link">
              Buy me a ☕️
            </a>
            {authorized && (
              <button className="connected-badge logout-btn" onClick={handleLogoutClick} title="Click to Sign Out">
                Connected ✅
              </button>
            )}
          </div>

          {!authorized && !processing ? (
            <div className="card">
              {isRestoring ? (
                <div className="processing-container">
                  <div className="loader" style={{ width: '24px', height: '24px', borderWidth: '3px' }}></div>
                  <p style={{ margin: 0, fontSize: '0.9em' }}>Restoring Session...</p>
                </div>
              ) : (
                <button onClick={handleAuth}>Sign In with Google</button>
              )}
            </div>
          ) : null}

          {/* Show Error if any */}
          {status.startsWith('Error') && (
            <div className="card" style={{ borderColor: '#ff6b6b', backgroundColor: 'rgba(255, 107, 107, 0.1)' }}>
              <p style={{ color: '#ff6b6b', fontWeight: 'bold' }}>{status}</p>
            </div>
          )}

          {/* Show Warning if any */}
          {(status.startsWith('Warning') || status.startsWith('🧙')) && (
            <div className="card warning-card" style={{ borderColor: '#fca5a5', backgroundColor: 'rgba(255, 166, 0, 0.15)' }}>
              <p style={{ color: '#fbbf24', fontWeight: 'bold' }}>{status}</p>
            </div>
          )}


          {/* Show Loader if processing */}
          {processing && (
            <div className="card processing-container">
              <div className="loader"></div>
              <p>{isRestoring ? 'Restoring Session & Analyzing...' : status}</p>
            </div>
          )}

          {authorized && !processing && !eventDetails && (
            <div className="card">
              <p style={{ marginBottom: '1.5em', fontSize: '1.1em' }}>Select a screenshot to create an event in Google Calendar.</p>
              <label className="file-upload-label">
                <input type="file" accept="image/*" onChange={onFileSelect} style={{ display: 'none' }} />
                <span className="upload-btn">Choose Image</span>
              </label>
              <div style={{ marginTop: '1.2rem' }}>
                <button className="manual-entry-link" onClick={handleManualEntry}>
                  Or enter manually ✍️
                </button>
              </div>
            </div>
          )}

          {eventDetails && (
            <div className="card event-preview">
              <h2>{createdEventLink ? 'Event Created!' : (eventDetails.summary === '' && eventDetails.location === '' ? 'Manual Entry' : 'Confirm Event')}</h2>

              <div className="input-group">
                <label>Event Name</label>
                <input
                  type="text"
                  value={eventDetails.summary}
                  onChange={(e) => setEventDetails({ ...eventDetails, summary: e.target.value })}
                  disabled={!!createdEventLink}
                />
              </div>

              <div className="row-group" style={{ alignItems: 'flex-start' }}>
                <div className="input-group mui-date-picker-wrapper">
                  <label style={{ marginBottom: '8px' }}>Start</label>
                  <DateTimePicker
                    value={eventDetails.start_datetime ? dayjs(eventDetails.start_datetime) : null}
                    onChange={(newValue) => {
                      if (newValue) {
                        setEventDetails({
                          ...eventDetails,
                          start_datetime: newValue.format('YYYY-MM-DDTHH:mm:ss'),
                          end_datetime: newValue.add(1, 'hour').format('YYYY-MM-DDTHH:mm:ss')
                        });
                      }
                    }}
                    disabled={!!createdEventLink}
                    slotProps={{ textField: { fullWidth: true, variant: 'outlined' } }}
                  />
                </div>

                <div className="input-group mui-date-picker-wrapper">
                  <label style={{ marginBottom: '8px' }}>End</label>
                  <DateTimePicker
                    value={eventDetails.end_datetime ? dayjs(eventDetails.end_datetime) : null}
                    onChange={(newValue) => {
                      if (newValue) {
                        setEventDetails({ ...eventDetails, end_datetime: newValue.format('YYYY-MM-DDTHH:mm:ss') });
                      }
                    }}
                    disabled={!!createdEventLink}
                    slotProps={{ textField: { fullWidth: true, variant: 'outlined' } }}
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Location</label>
                <input
                  type="text"
                  value={eventDetails.location || ''}
                  onChange={(e) => setEventDetails({ ...eventDetails, location: e.target.value })}
                  disabled={!!createdEventLink}
                  placeholder="Add location"
                />
              </div>

              <div className="actions">
                {createdEventLink ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                    <a href={createdEventLink} target="_blank" rel="noreferrer" style={{ width: '100%' }}>
                      <button className="view-event-btn" style={{ width: '100%' }}>View in Calendar</button>
                    </a>
                    <button onClick={handleReset}>Scan Another</button>
                  </div>
                ) : (
                  <>
                    <button onClick={handleCancel}>Cancel</button>
                    <button onClick={handleConfirm} disabled={processing}>Add to Calendar</button>
                  </>
                )}
              </div>
            </div>
          )}

          {showLogoutConfirm && (
            <div className="modal-overlay">
              <div className="card modal-card">
                <h3>Sign Out?</h3>
                <p>Are you sure you want to disconnect your Google Calendar?</p>
                <div className="actions">
                  <button onClick={cancelLogout}>Cancel</button>
                  <button onClick={confirmLogout} style={{ background: 'linear-gradient(90deg, #ff6b6b 0%, #ff8e8e 100%)', color: 'white' }}>Sign Out</button>
                </div>
              </div>
            </div>
          )}

          <footer className="footer" style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', opacity: 0.7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <a href="https://www.linkedin.com/in/tomolick/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', display: 'flex', alignItems: 'center' }} aria-label="LinkedIn">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
              <a href="https://www.egodevnull.com" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', display: 'flex', alignItems: 'center' }} aria-label="Ego /dev/null">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
                  <defs>
                    <mask id="eo-mask">
                      <rect width="24" height="24" fill="white" />
                      <g stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
                        <path d="M9 6H4v12h5" />
                        <path d="M4 12h4" />
                        <circle cx="16" cy="12" r="5" />
                        <line x1="11.5" y1="16.5" x2="20.5" y2="7.5" />
                      </g>
                    </mask>
                  </defs>
                  <rect width="24" height="24" rx="4" fill="white" mask="url(#eo-mask)" />
                </svg>
              </a>
            </div>
            <span style={{ fontStyle: 'italic', fontSize: '0.8rem' }}>v1.2 - Copyright © 2026 Ego/dev/null</span>
          </footer>
        </div>
      </LocalizationProvider>
    </ThemeProvider>
  )
}

export default App
