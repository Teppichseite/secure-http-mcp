import { Injectable } from '@nestjs/common';
import { Tool, Context } from '@rekog/mcp-nest';
import { z } from 'zod';
import { MiddlewareService, RequestConfig } from './middleware.service';

@Injectable()
export class SecureHttpTool {
  constructor(private readonly middlewareService: MiddlewareService) {}

  @Tool({
    name: 'execute-http',
    description:
      'Execute an HTTP request. The request must pass through a configured middleware that matches the URL pattern. Middlewares can modify the request config (headers, etc.) before execution.',
    parameters: z.object({
      url: z.string().url().describe('The full URL to call (e.g. https://api.example.com/users/123)'),
      method: z
        .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
        .describe('HTTP method'),
      headers: z
        .record(z.string(), z.string())
        .optional()
        .describe('HTTP headers to include (e.g. {"Authorization": "Bearer token", "Content-Type": "application/json"})'),
      body: z.any().optional().describe('Request body (will be JSON stringified if object)'),
      queryParams: z
        .record(z.string(), z.string())
        .optional()
        .describe('Query parameters to append to the URL'),
    }),
  })
  async executeHttp(
    { url, method, headers, body, queryParams }: {
      url: string;
      method: string;
      headers?: Record<string, string>;
      body?: unknown;
      queryParams?: Record<string, string>;
    },
    context: Context,
  ) {
    await context.reportProgress({ progress: 0, total: 100 });

    // Build the request config that will be passed to the middleware
    const config: RequestConfig = {
      url,
      method,
      headers: headers ? { ...headers } : {},
      body,
      queryParams: queryParams ? { ...queryParams } : {},
    };

    await context.reportProgress({ progress: 10, total: 100 });

    // Process the request through middleware
    const middlewareResult = await this.middlewareService.processRequest(config);

    if (!middlewareResult.allowed) {
      return {
        error: middlewareResult.error,
        allowed: false,
        matchedMiddleware: middlewareResult.middleware
          ? {
              title: middlewareResult.middleware.title,
              description: middlewareResult.middleware.description,
              pattern: middlewareResult.middleware.pattern,
            }
          : null,
      };
    }

    await context.reportProgress({ progress: 30, total: 100 });

    try {
      // Build URL with query params (using potentially modified config)
      const requestUrl = new URL(config.url);
      if (config.queryParams) {
        Object.entries(config.queryParams).forEach(([key, value]) => {
          requestUrl.searchParams.append(key, value);
        });
      }

      // Prepare request options
      const requestHeaders: Record<string, string> = { ...config.headers };

      let requestBody: string | undefined;
      if (config.body !== undefined && method !== 'GET' && method !== 'HEAD') {
        if (typeof config.body === 'object') {
          requestBody = JSON.stringify(config.body);
          if (!requestHeaders['Content-Type'] && !requestHeaders['content-type']) {
            requestHeaders['Content-Type'] = 'application/json';
          }
        } else {
          requestBody = String(config.body);
        }
      }

      await context.reportProgress({ progress: 50, total: 100 });

      const response = await fetch(requestUrl.toString(), {
        method: config.method,
        headers: requestHeaders,
        body: requestBody,
      });

      await context.reportProgress({ progress: 80, total: 100 });

      // Parse response
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const contentType = response.headers.get('content-type') || '';
      let responseBody: unknown;

      if (contentType.includes('application/json')) {
        try {
          responseBody = await response.json();
        } catch {
          responseBody = await response.text();
        }
      } else {
        responseBody = await response.text();
      }

      await context.reportProgress({ progress: 100, total: 100 });

      return {
        allowed: true,
        matchedMiddleware: {
          title: middlewareResult.middleware.title,
          description: middlewareResult.middleware.description,
          pattern: middlewareResult.middleware.pattern,
        },
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: responseBody,
        },
      };
    } catch (err) {
      return {
        error: `Request failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        allowed: true,
        matchedMiddleware: {
          title: middlewareResult.middleware.title,
          description: middlewareResult.middleware.description,
          pattern: middlewareResult.middleware.pattern,
        },
      };
    }
  }

  @Tool({
    name: 'list-middlewares',
    description: 'List all configured middlewares with their URL patterns and descriptions.',
    parameters: z.object({}),
  })
  async listMiddlewares() {
    const middlewares = this.middlewareService.getMiddlewares();

    if (middlewares.length === 0) {
      return {
        message: 'No middlewares configured. Create .js files in the middlewares directory.',
        middlewares: [],
      };
    }

    return {
      message: `Found ${middlewares.length} middleware(s)`,
      middlewares: middlewares.map((m) => ({
        title: m.title,
        description: m.description,
        pattern: m.pattern,
      })),
    };
  }

  @Tool({
    name: 'reload-middlewares',
    description: 'Reload all middleware files from the middlewares directory. Use this after adding or modifying middleware files.',
    parameters: z.object({}),
  })
  async reloadMiddlewares() {
    await this.middlewareService.loadMiddlewares();
    const middlewares = this.middlewareService.getMiddlewares();

    return {
      message: `Reloaded ${middlewares.length} middleware(s)`,
      middlewares: middlewares.map((m) => ({
        title: m.title,
        description: m.description,
        pattern: m.pattern,
      })),
    };
  }
}

