import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAnalytics, logEvent, isSupported, type Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'add-to-calendar-486609'}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'add-to-calendar-486609',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'add-to-calendar-486609'}.firebasestorage.app`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let app: FirebaseApp | null = null;
let analyticsInstance: Analytics | null = null;
let initPromise: Promise<Analytics | null> | null = null;

export async function initAnalytics(): Promise<Analytics | null> {
  if (typeof window === 'undefined') return null;
  if (analyticsInstance) return analyticsInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Only initialize if an API key or Measurement ID is configured
    if (!firebaseConfig.apiKey && !firebaseConfig.measurementId) {
      console.info('Firebase Analytics: No VITE_FIREBASE_API_KEY or VITE_FIREBASE_MEASUREMENT_ID found. Tracking disabled.');
      return null;
    }

    try {
      const supported = await isSupported();
      if (!supported) {
        console.info('Firebase Analytics: Environment not supported.');
        return null;
      }

      if (!getApps().length) {
        app = initializeApp(firebaseConfig);
      } else {
        app = getApps()[0];
      }

      analyticsInstance = getAnalytics(app);
      console.info('Firebase Analytics (GA4) initialized successfully.');
      return analyticsInstance;
    } catch (err) {
      console.warn('Firebase Analytics initialization error:', err);
      return null;
    }
  })();

  return initPromise;
}

/**
 * Safely track an event in Firebase Analytics (GA4).
 * If Firebase is not yet configured or fails, this fails silently without interrupting the user.
 */
export function trackAnalyticsEvent(eventName: string, params?: Record<string, any>): void {
  try {
    if (analyticsInstance) {
      logEvent(analyticsInstance, eventName, params);
      return;
    }

    // If not initialized yet, try to wait for initialization
    initAnalytics().then((instance) => {
      if (instance) {
        logEvent(instance, eventName, params);
      }
    }).catch(() => {
      // Ignore background analytics errors
    });
  } catch (err) {
    console.warn(`Analytics logEvent error for "${eventName}":`, err);
  }
}
