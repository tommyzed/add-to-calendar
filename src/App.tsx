import { useState, useEffect } from 'react'
import './App.css'
import { initGapi, initGis, authenticate, insertEvent, loadToken, signOut } from './services/calendar';
import { parseImage } from './services/gemini';
import confetti from 'canvas-confetti';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

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
        setStatus('Ready.');

        // Check for valid stored token first
        // Check for valid stored token first
        loadToken().then((isValid) => {
          if (isValid) {
            setAuthorized(true);
            setStatus('Session restored from storage.');
            setIsRestoring(false);
          } else {
            // Token invalid or missing.
            // IF we were previously authorized, try to silently refresh.
            const wasAuthed = localStorage.getItem('gcal_authed') === 'true';
            if (wasAuthed) {
              setStatus('Refreshing session...');
              // Attempt restore which might have failed above due to race, or just try auth
              // Actually, loadToken() already attempts refresh if refresh token exists.
              // If it returned false, it means refresh failed or no tokens.

              // If we want to force re-auth flow or just show login button:
              setAuthorized(false);
              setIsRestoring(false);
              // We don't auto-call authenticate() anymore as it opens popup
            } else {
              // No previous session, ready for fresh login
              setIsRestoring(false);
            }
          }
        });

        // Check for share target data AFTER init is done to avoid status race conditions
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('shared') === 'true') {
          // This will overwrite "Session restored" immediately if present, which is desired.
          setStatus('Shared content received. Checking...');
          handleSharedContent();
        }
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

  return (
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

      {!authorized ? (
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
          <p>{status}</p>
        </div>
      )}

      {authorized && !processing && !eventDetails && (
        <div className="card">
          <p style={{ marginBottom: '1.5em', fontSize: '1.1em' }}>Select a screenshot to create an event in Google Calendar.</p>
          <label className="file-upload-label">
            <input type="file" accept="image/*" onChange={onFileSelect} style={{ display: 'none' }} />
            <span className="upload-btn">Choose Image</span>
          </label>
        </div>
      )}

      {eventDetails && (
        <div className="card event-preview">
          <h2>{createdEventLink ? 'Event Created!' : 'Confirm Event'}</h2>

          <div className="input-group">
            <label>Event Name</label>
            <input
              type="text"
              value={eventDetails.summary}
              onChange={(e) => setEventDetails({ ...eventDetails, summary: e.target.value })}
              disabled={!!createdEventLink}
            />
          </div>

          <div className="row-group">
            <div className="input-group">
              <label>Start</label>
              <DatePicker
                selected={eventDetails.start_datetime ? new Date(eventDetails.start_datetime) : null}
                onChange={(date: Date | null) => {
                  if (date) {
                    // Format to local ISO string (YYYY-MM-DDTHH:mm:ss) to keep local time consistent
                    const offsetDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
                    const localISO = offsetDate.toISOString().slice(0, 19);
                    setEventDetails({ ...eventDetails, start_datetime: localISO });
                  }
                }}
                showTimeSelect
                dateFormat="MMM d, yyyy h:mm aa"
                disabled={!!createdEventLink}
                className="custom-datepicker"
                wrapperClassName="datepicker-wrapper"
              />
            </div>

            <div className="input-group">
              <label>End</label>
              <DatePicker
                selected={eventDetails.end_datetime ? new Date(eventDetails.end_datetime) : null}
                onChange={(date: Date | null) => {
                  if (date) {
                    const offsetDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
                    const localISO = offsetDate.toISOString().slice(0, 19);
                    setEventDetails({ ...eventDetails, end_datetime: localISO });
                  }
                }}
                showTimeSelect
                dateFormat="MMM d, yyyy h:mm aa"
                disabled={!!createdEventLink}
                className="custom-datepicker"
                wrapperClassName="datepicker-wrapper"
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
          <a href="https://www.instagram.com/thisendlessreverie/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', display: 'flex', alignItems: 'center' }} aria-label="Instagram">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.069-4.85.069-3.204 0-3.584-.012-4.849-.069-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
          </a>
        </div>
        <span style={{ fontStyle: 'italic', fontSize: '0.8rem' }}>v1.1 - Copyright © 2026 Ego /dev/null</span>
      </footer>
    </div>
  )
}

export default App
