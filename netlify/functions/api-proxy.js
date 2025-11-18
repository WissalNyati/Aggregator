// Backend API URL - can be overridden with environment variable
const BACKEND_API_URL = process.env.VITE_API_URL || process.env.BACKEND_API_URL || 'https://physician-search-api-production.up.railway.app';

// Use CommonJS exports for Netlify functions compatibility
exports.handler = async (event) => {
  // Only allow POST, GET, PUT, DELETE methods
  if (!['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'].includes(event.httpMethod)) {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
      body: '',
    };
  }

  try {
    // Extract the path from the query string
    // The function will be called as: /.netlify/functions/api-proxy?path=/api/auth/signin
    const path = event.queryStringParameters?.path || '/api';
    
    // Ensure path starts with /api
    const apiPath = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;
    
    // Construct the full backend URL
    const backendUrl = `${BACKEND_API_URL}${apiPath}`;
    
    console.log(`[api-proxy] ${event.httpMethod} ${apiPath} -> ${backendUrl}`);
    
    // Get headers from the request
    const headers = {
      'Content-Type': 'application/json',
    };

    // Forward Authorization header if present (check both lowercase and capitalized)
    const authHeader = event.headers.authorization || event.headers.Authorization || event.headers['authorization'] || event.headers['Authorization'];
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    // Prepare fetch options
    const fetchOptions = {
      method: event.httpMethod,
      headers,
    };

    // Add body for POST, PUT requests
    if (event.body && ['POST', 'PUT'].includes(event.httpMethod)) {
      fetchOptions.body = event.body;
    }

    // Make request to backend API
    const response = await fetch(backendUrl, fetchOptions);
    const data = await response.text();
    
    // Try to parse as JSON, fallback to text
    let body;
    try {
      body = JSON.parse(data);
    } catch {
      body = data;
    }

    return {
      statusCode: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    };
  } catch (error) {
    console.error('[api-proxy] Error:', error);
    console.error('[api-proxy] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Proxy error',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : String(error)) : undefined,
      }),
    };
  }
};

