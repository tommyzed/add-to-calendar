import { useState, useEffect } from 'react'
import './App.css'
import { initGapi, initGis, authenticate, insertEvent } from './services/calendar';
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

  useEffect(() => {
    Promise.all([initGapi(), initGis()])
      .then(() => {
        setStatus('Ready.');
        // Try silent auth if we believe we are logged in
        if (localStorage.getItem('gcal_authed') === 'true') {
          setStatus('Restoring session...');
          authenticate(true)
            .then(() => {
              setAuthorized(true);
              setStatus('Session restored.');
            })
            .catch((e) => {
              console.log('Silent auth failed', e);
              // Clear flag if silent auth fails
              localStorage.removeItem('gcal_authed');
              setStatus('Please Sign In.');
            });
        }
      })
      .catch(err => setStatus(`Init Error: ${err}`));

    // Check for share target data
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('shared') === 'true') {
      setStatus('Shared content received. Checking...');
      handleSharedContent();
    }
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
      await authenticate(false);
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
        setStatus(`Could not find event: ${details.error}`);
        setProcessing(false);
        return;
      }
      setEventDetails(details);
      setStatus('Event parsed! Confirm to add.');
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

  return (
    <div className="container">
      <h1>Screenshot to Calendar</h1>

      {!authorized ? (
        <div className="card">
          <button onClick={handleAuth}>Sign In with Google</button>
        </div>
      ) : (
        <p className="connected-badge">Connected ✅</p>
      )}

      {/* Status Card Removed */}

      {/* Show Error if any */}
      {status.startsWith('Error') && (
        <div className="card" style={{ borderColor: '#ff6b6b', backgroundColor: 'rgba(255, 107, 107, 0.1)' }}>
          <p style={{ color: '#ff6b6b', fontWeight: 'bold' }}>{status}</p>
        </div>
      )}

      {/* Show Loader if processing */}
      {processing && (
        <div className="card">
          <div className="loader">Processing...</div>
          <p>{status}</p>
        </div>
      )}

      {authorized && !processing && !eventDetails && (
        <div className="card">
          <p style={{ marginBottom: '1.5em', fontSize: '1.1em' }}>Select a screenshot to create an event</p>
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
                <button onClick={() => setEventDetails(null)}>Cancel</button>
                <button onClick={handleConfirm} disabled={processing}>Add to Calendar</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
