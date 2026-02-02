/**
 * Example Middleware: HTTPBin API
 * 
 * This middleware allows requests to httpbin.org for testing purposes.
 * It demonstrates how to:
 * - Define a URL pattern to match
 * - Check request methods
 * - Modify request headers
 */

module.exports = {
  title: 'HTTPBin Test API',
  description: 'Allows GET, POST, and PATCH requests to httpbin.org for testing. Automatically adds a custom User-Agent header.',
  pattern: 'https://httpbin.org/**',

  /**
   * Handle the request and optionally modify the config.
   * 
   * @param {Object} config - The request configuration
   * @param {string} config.url - The request URL
   * @param {string} config.method - HTTP method (GET, POST, etc.)
   * @param {Object} config.headers - Request headers (can be modified)
   * @param {*} config.body - Request body (can be modified)
   * @param {Object} config.queryParams - Query parameters (can be modified)
   * @returns {boolean | {allowed: boolean, reason?: string}} - Return true/false or object with reason
   */
  handle: async (config) => {
    // Only allow GET, POST, and PATCH methods
    const allowedMethods = ['GET', 'POST', 'PATCH'];
    if (!allowedMethods.includes(config.method)) {
      return { 
        allowed: false, 
        reason: `Method ${config.method} is not allowed. Only GET, POST, and PATCH are permitted.` 
      };
    }

    // Add a custom User-Agent header
    config.headers = {
      ...config.headers,
      'User-Agent': 'SecureFetch/1.0',
    };

    // Example: You could add authentication headers here
    // config.headers['Authorization'] = 'Bearer your-token';

    return true;
  },
};
