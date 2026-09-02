const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Storage } = require('@google-cloud/storage');

const storage = new Storage();

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

  const { action, code, refresh_token, image, mimeType } = req.body || {};

  try {
    // Action 1: Exchange OAuth Code for Tokens
    if (action === 'exchange') {
      console.log('TOMOLICK: EXCHANGE');
      const client = new OAuth2Client(
        process.env.CLIENT_ID,
        process.env.CLIENT_SECRET,
        'postmessage'
      );
      const { tokens } = await client.getToken(code);
      return res.status(200).json(tokens);
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
      return res.status(200).json(credentials);
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

      console.log('Gemini processing time:', Date.now() - start, 'ms');
      const eventDetails = JSON.parse(cleanText);

      if (uploadedImageUrl) {
        eventDetails.imageUrl = uploadedImageUrl;
      }

      return res.status(200).json(eventDetails);
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
