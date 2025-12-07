// API Proxy - Uses environment variable for backend URL
// Get backend URL from environment variable (VITE_API_URL), remove /api suffix if present
const getBackendBaseUrl = () => {
  const apiUrl = process.env.VITE_API_URL || '';
  if (apiUrl) {
    // Remove /api suffix if present
    return apiUrl.replace(/\/api\/?$/, '');
  }
  // Fallback to empty string - will cause error which is better than wrong URL
  console.warn('[api-proxy] VITE_API_URL not set, using fallback');
  return '';
};

const BACKEND_BASE_URL = getBackendBaseUrl();

exports.handler = async (event) => {
  console.log('[api-proxy] Called:', event.httpMethod, event.queryStringParameters?.path);

  // CORS headers - support credentials for cookie-based auth
  const requestOrigin = event.headers.origin || event.headers.Origin || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': requestOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true', // Required for cookies
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  // Get path from query parameter
  const { path } = event.queryStringParameters || {};

  if (!path) {
    return {
      statusCode: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Missing path parameter' }),
    };
  }

  // AUTH ENDPOINTS - Pass through to backend, return proper 401 for unauthenticated
  // No special handling - let backend handle authentication properly

  try {
    // Clean path - remove leading slash if present, remove /api prefix if present
    let cleanPath = path;
    if (cleanPath.startsWith('/api/')) {
      cleanPath = cleanPath.substring(5);
    } else if (cleanPath.startsWith('/api')) {
      cleanPath = cleanPath.substring(4);
    } else if (cleanPath.startsWith('/')) {
      cleanPath = cleanPath.substring(1);
    }

    // Construct backend URL
    const backendURL = `${BACKEND_BASE_URL}/api/${cleanPath}`;

    console.log('[api-proxy] Proxying to:', backendURL);

    // Prepare request options
    const options = {
      method: event.httpMethod,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Forward Authorization header if present
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (authHeader) {
      options.headers['Authorization'] = authHeader;
    }

    // CRITICAL: Forward cookies from client request to backend
    const cookieHeader = event.headers.cookie || event.headers.Cookie;
    if (cookieHeader) {
      options.headers['Cookie'] = cookieHeader;
    }

    // Add body for non-GET requests
    if (event.body && event.httpMethod !== 'GET') {
      options.body = event.body;
    }

    // Make request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(backendURL, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Get response data
      const contentType = response.headers.get('content-type') || '';
      let data;

      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // CRITICAL: Forward Set-Cookie headers from backend response to client
      const setCookieHeader = response.headers.get('set-cookie');
      const responseHeaders = {
        ...corsHeaders,
        'Content-Type': contentType || 'application/json',
      };

      // Forward Set-Cookie header if present (for authentication cookies)
      if (setCookieHeader) {
        responseHeaders['Set-Cookie'] = setCookieHeader;
      }

      // Return successful response
      return {
        statusCode: response.status,
        headers: responseHeaders,
        body: typeof data === 'string' ? data : JSON.stringify(data),
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        console.error('[api-proxy] Request timeout');
        // Return 200 to prevent frontend crashes
        return {
          statusCode: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            success: false,
            error: 'Request timeout',
            message: 'Service is taking longer than expected. Please try again.',
          }),
        };
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('[api-proxy] Error:', error);
    console.error('[api-proxy] Path:', path);

    // RETURN 200 TO PREVENT FRONTEND CRASHES
    // Always return 200 with error in body instead of 502
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: 'Service temporarily unavailable',
        message: 'Please try again in a few moments',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
};
