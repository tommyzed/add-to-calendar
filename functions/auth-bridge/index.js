const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Storage } = require('@google-cloud/storage');
const geoip = require('geoip-lite');

const storage = new Storage();

let sql = null;
function getDb() {
  if (!process.env.DATABASE_URL) return null;
  if (!sql) {
    const { neon } = require('@neondatabase/serverless');
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}

function getClientGeo(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = forwarded ? forwarded.split(',')[0].trim() : (req.socket?.remoteAddress || '');
  const geo = geoip.lookup(rawIp);
  return {
    country: geo?.country || null,
    city: geo?.city || null,
    timezone: req.body?.timezone || geo?.timezone || null,
    locale: req.body?.locale || null,
  };
}

function hashGoogleId(sub) {
  if (!sub) return null;
  return crypto.createHash('sha256').update(sub).digest('hex');
}

function extractSubFromIdToken(idToken) {
  if (!idToken) return null;
  try {
    const parts = idToken.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    return payload.sub || null;
  } catch {
    return null;
  }
}

async function logEvent(userId, eventType, metadata = {}, geo = {}) {
  const db = getDb();
  if (!db) return;
  try {
    const effectiveUserId = userId || 'anonymous';
    const metaJson = JSON.stringify(metadata || {});
    const country = geo.country || null;
    const city = geo.city || null;
    const timezone = geo.timezone || null;
    const locale = geo.locale || null;

    // 1. Append into analytics_events
    await db`
      INSERT INTO analytics_events (user_id, event_type, country, city, metadata)
      VALUES (${effectiveUserId}, ${eventType}, ${country}, ${city}, ${metaJson});
    `;

    // 2. Upsert user if identified
    if (effectiveUserId !== 'anonymous') {
      const isLogin = eventType === 'login' ? 1 : 0;
      const isEventCreated = eventType === 'event_created' ? 1 : 0;

      await db`
        INSERT INTO users (user_id, first_seen_at, last_seen_at, login_count, events_created_count, country, city, timezone, locale)
        VALUES (${effectiveUserId}, NOW(), NOW(), ${isLogin}, ${isEventCreated}, ${country}, ${city}, ${timezone}, ${locale})
        ON CONFLICT (user_id) DO UPDATE SET
          last_seen_at = NOW(),
          login_count = users.login_count + ${isLogin},
          events_created_count = users.events_created_count + ${isEventCreated},
          country = COALESCE(${country}, users.country),
          city = COALESCE(${city}, users.city),
          timezone = COALESCE(${timezone}, users.timezone),
          locale = COALESCE(${locale}, users.locale);
      `;
    }
  } catch (err) {
    console.error('Analytics logEvent error:', err.message);
  }
}

const MARKDOWN_JSON_REGEX = /```json/g;
const MARKDOWN_BLOCK_REGEX = /```/g;

const authBridge = async (req, res) => {
  const allowedOrigins = [
    'https://add-to-calendar.up.railway.app',
    'https://add-to-calendar-dev.up.railway.app',
    'https://add-to-calendar.egodevnull.com',
    'http://localhost:5173' // For local dev
  ];

  // 1. Manually handle CORS (vital for PWAs)
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  }
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).send('');

  const { action, code, refresh_token, image, mimeType, user_hash, event_type, metadata } = req.body || {};

  try {
    // Action 1: Exchange OAuth Code for Tokens & Identify User
    if (action === 'exchange') {
      console.log('TOMOLICK: EXCHANGE');
      const client = new OAuth2Client(
        process.env.CLIENT_ID,
        process.env.CLIENT_SECRET,
        'postmessage'
      );
      const { tokens } = await client.getToken(code);
      const sub = extractSubFromIdToken(tokens.id_token);
      const computedUserHash = hashGoogleId(sub);
      const geo = getClientGeo(req);

      logEvent(computedUserHash, 'login', { method: 'oauth_exchange' }, geo).catch(console.error);

      return res.status(200).json({
        ...tokens,
        user_hash: computedUserHash
      });
    }

    // Action 2: Refresh Expired Access Token
    if (action === 'refresh') {
      console.log('TOMOLICK: REFRESH');
      const client = new OAuth2Client(
        process.env.CLIENT_ID,
        process.env.CLIENT_SECRET,
        'postmessage'
      );
      client.setCredentials({ refresh_token });
      const { credentials } = await client.refreshAccessToken();
      const sub = extractSubFromIdToken(credentials.id_token);
      const computedUserHash = hashGoogleId(sub) || user_hash || null;
      const geo = getClientGeo(req);

      logEvent(computedUserHash, 'refresh', { method: 'token_refresh' }, geo).catch(console.error);

      return res.status(200).json({
        ...credentials,
        user_hash: computedUserHash
      });
    }

    // Action 3: Secure Gemini Screenshot Parsing & Image Storage
    if (action === 'parse') {
      console.log('TOMOLICK: PARSE');
      if (!image) {
        return res.status(400).json({ error: 'Missing image data' });
      }

      const apiKey = process.env.GEMINI_APP_KEY || process.env.GEMINI_API_KEY;
      const modelName = process.env.GEMINI_MODEL || 'gemini-3.7-flash';

      if (!apiKey) {
        console.error('Missing GEMINI_APP_KEY environment variable');
        return res.status(500).json({ error: 'Server configuration error: missing Gemini API key' });
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });

      const currentYear = new Date().getFullYear();
      const prompt = `Extract event details from this image. Assume the event is in the future, using the current year (${currentYear}) or later if no year is specified. Return ONLY a JSON object with: summary, start_datetime (ISO), end_datetime (ISO, or +1hr if not found), location, and description (optional). If the image is not a clear event, set the "error" field to "UNABLE_TO_DETERMINE" but still return the JSON with any partial details or empty strings. Do not include markdown.`;

      const start = Date.now();

      // 1. Kick off Gemini content generation
      const geminiPromise = model.generateContent([
        prompt,
        {
          inlineData: {
            data: image,
            mimeType: mimeType || 'image/png'
          }
        }
      ]);

      // 2. Concurrently upload image to GCS if bucket is configured
      const bucketName = process.env.IMAGE_BUCKET_NAME || process.env.STORAGE_BUCKET;
      const uploadPromise = (async () => {
        if (!bucketName) return null;
        try {
          const buffer = Buffer.from(image, 'base64');
          const effectiveMime = mimeType || 'image/png';
          let ext = 'png';
          if (effectiveMime.includes('jpeg') || effectiveMime.includes('jpg')) ext = 'jpg';
          else if (effectiveMime.includes('webp')) ext = 'webp';
          else if (effectiveMime.includes('gif')) ext = 'gif';

          const randomHex = crypto.randomBytes(6).toString('hex');
          const filename = `events/${Date.now()}-${randomHex}.${ext}`;
          const bucket = storage.bucket(bucketName);
          const file = bucket.file(filename);

          await file.save(buffer, {
            contentType: effectiveMime,
            metadata: {
              cacheControl: 'public, max-age=7776000', // 90 days
            },
          });

          const publicUrl = `https://storage.googleapis.com/${bucketName}/${filename}`;
          console.log('Image successfully uploaded to GCS:', publicUrl);
          return publicUrl;
        } catch (uploadErr) {
          console.error('Failed to upload image to GCS:', uploadErr);
          return null;
        }
      })();

      // Run Gemini parse and GCS upload concurrently
      const [geminiResult, uploadedImageUrl] = await Promise.all([
        geminiPromise,
        uploadPromise
      ]);

      const response = await geminiResult.response;
      const text = response.text();
      const cleanText = text.replace(MARKDOWN_JSON_REGEX, '').replace(MARKDOWN_BLOCK_REGEX, '').trim();

      const durationMs = Date.now() - start;
      console.log('Gemini processing time:', durationMs, 'ms');
      const eventDetails = JSON.parse(cleanText);

      if (uploadedImageUrl) {
        eventDetails.imageUrl = uploadedImageUrl;
      }

      // Log parse event with geo and latency
      const geo = getClientGeo(req);
      logEvent(user_hash, 'parse_image', {
        duration_ms: durationMs,
        has_image_url: !!uploadedImageUrl,
        status: eventDetails.error ? 'unclear_event' : 'success'
      }, geo).catch(console.error);

      return res.status(200).json(eventDetails);
    }

    // Action 4: Client-Side Event Tracking (e.g. event_created, manual_entry)
    if (action === 'track') {
      if (!event_type) {
        return res.status(400).json({ error: 'Missing event_type' });
      }
      const geo = getClientGeo(req);
      await logEvent(user_hash, event_type, metadata || {}, geo);
      return res.status(200).json({ ok: true });
    }

    console.log('TOMOLICK: NO ACTION!');
    return res.status(400).send('Invalid Action');
  } catch (e) {
    console.error('AuthBridge Error:', e);
    return res.status(500).json({ error: e.message || 'Server Error' });
  }
};

exports.authBridge = authBridge;
exports['auth-bridge'] = authBridge;
