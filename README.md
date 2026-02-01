# Secure HTTP MCP

> ⚠️ **Note:** This project is still in development.

A secure HTTP mcp executor for autonomoues agents. Have full control which requests are allowed to be performed and which data they contain.

## Why Use This?

- **Whitelist once** - Allow all tools from this MCP in your agent to be executed by default
- **Control on server** - Middlewares define exactly which URLs and methods are permitted
- **Add authentication** - Middlewares can inject API keys, tokens, and headers automatically

## Installation

```bash
npm install
npm run build
```

## Usage

```bash
SF_CONFIG=/path/to/config SF_PORT=3000 node dist/main
```

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `SF_CONFIG` | **required** | Path to config directory containing middlewares |
| `SF_PORT` | `3000` | Server port |

### Register the MCP

E.g. in Cursor:
```python
{
  "mcpServers": {
    "secure-http-mcp": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```


## Configuration

### Config Directory Structure

```
config/
├── sf-config.json            # Config file listing middlewares in order
├── my-api-middleware.js      # Middleware files
└── another-middleware.js
```

### sf-config.json

This file defines which middlewares to load and in what order. The first matching middleware defiend by the middleware's pattern is used.

```json
{
  "middlewares": [
    "my-api-middleware.js",
    "another-middleware.js"
  ]
}
```

## Creating Middlewares

Each middleware is a JavaScript file that exports:

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Human-readable name |
| `description` | string | What this middleware allows |
| `pattern` | string | Glob pattern to match URLs |
| `handle` | function | Middleware function |

### Example Middleware

```javascript
// middlewares/github-api.js
module.exports = {
  title: 'GitHub API',
  description: 'Allows read-only access to GitHub API',
  pattern: 'https://api.github.com/**',

  /**
   * Handle the request and optionally modify it.
   * @param {Object} config - Request configuration (mutable)
   * @param {string} config.url - Request URL
   * @param {string} config.method - HTTP method
   * @param {Object} config.headers - Request headers
   * @param {*} config.body - Request body
   * @param {Object} config.queryParams - Query parameters
   * @returns {boolean | {allowed: boolean, reason?: string}} - true/false or object with reason
   */
  handle: async (config) => {
    // Only allow GET requests - with custom denial reason
    if (config.method !== 'GET') {
      return { allowed: false, reason: 'Only GET requests are allowed for GitHub API' };
    }

    // Add required headers
    config.headers = {
      ...config.headers,
      'User-Agent': 'SecureFetch/1.0',
      'Accept': 'application/vnd.github.v3+json',
    };

    return true;
  },
};
```

### URL Pattern Examples

Patterns use glob syntax via [picomatch](https://github.com/micromatch/picomatch):

| Pattern | Matches |
|---------|---------|
| `https://api.github.com/**` | Any GitHub API endpoint |
| `https://example.com/api/v1/*` | Single path segment after v1 |
| `https://*.example.com/**` | Any subdomain of example.com |
| `https://api.example.com/users/{id}` | Literal `{id}` in path |

## MCP Tools

| Tool | Description |
|------|-------------|
| `execute-http` | Execute an HTTP request (must pass through middleware) |
| `list-middlewares` | List all configured middlewares |
| `reload-middlewares` | Reload middlewares without restarting the server |

## License

MIT



