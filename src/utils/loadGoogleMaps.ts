/**
 * Dynamically loads Google Maps JavaScript API
 * Uses VITE_GOOGLE_MAPS_API_KEY from environment variables
 */

declare global {
  interface Window {
    google: any;
    initGoogleMaps?: () => void;
  }
}

let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  // Return existing promise if already loading
  if (loadPromise) {
    return loadPromise;
  }

  // Check if already loaded
  if (typeof window !== 'undefined' && window.google && window.google.maps) {
    return Promise.resolve();
  }

  // Get API key from environment
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.warn('⚠️ VITE_GOOGLE_MAPS_API_KEY not set. Google Maps will not be available.');
    return Promise.reject(new Error('Google Maps API key not configured'));
  }

  // Create promise to load script
  loadPromise = new Promise<void>((resolve, reject) => {
    // Check if script already exists
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      // Script exists, wait for it to load
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Google Maps failed to load'));
      }, 10000);
      return;
    }

    // Create script element
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      // Wait a bit for Google Maps to initialize
      const checkInterval = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        if (window.google && window.google.maps) {
          resolve();
        } else {
          reject(new Error('Google Maps API loaded but not initialized'));
        }
      }, 10000);
    };

    script.onerror = () => {
      loadPromise = null; // Reset promise on error
      reject(new Error('Failed to load Google Maps script'));
    };

    // Append to head
    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * Check if Google Maps is already loaded
 */
export function isGoogleMapsLoaded(): boolean {
  return typeof window !== 'undefined' && 
         !!window.google && 
         !!window.google.maps;
}

