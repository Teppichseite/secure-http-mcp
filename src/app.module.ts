import { DynamicModule, Module } from "@nestjs/common";
import { McpModule, McpTransportType } from "@rekog/mcp-nest";
import { MiddlewareService, MIDDLEWARES_DIR } from "./middleware.service";
import { SecureHttpTool } from "./secure-http.tool";
import { BearerAuthGuard } from "./auth.guard";

export interface SecureFetchModuleOptions {
  configDir: string;
}

const MCP_INSTRUCTIONS = `
A secure HTTP request executor. You can safely whitelist all tools from this MCP - security is enforced by configurable JavaScript middlewares on the server side.

## Security Model
- All tools can be whitelisted in your MCP client - the server handles authorization
- Middlewares define which URLs are allowed and can modify requests (add auth headers, etc.)
- No requests are allowed by default - only explicitly configured URL patterns work
- If no middleware matches a URL, the request is DENIED

## Tools Available
1. \`execute-http\` - Execute an HTTP request (validated by middleware)
2. \`list-middlewares\` - View allowed URL patterns and their descriptions
3. \`reload-middlewares\` - Hot-reload middleware configuration

## Workflow
1. Use \`list-middlewares\` to see what APIs/URLs are permitted
2. Use \`execute-http\` to make requests - the middleware handles authorization
3. If denied, the URL pattern is not configured in the server's middleware
`.trim();

@Module({})
export class AppModule {
  static forRoot(options: SecureFetchModuleOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [
        McpModule.forRoot({
          name: "secure-http-mcp",
          version: "1.0.0",
          instructions: MCP_INSTRUCTIONS,
          guards: [BearerAuthGuard],
          transport: [McpTransportType.STREAMABLE_HTTP],
          streamableHttp: {
            enableJsonResponse: true,
            sessionIdGenerator: undefined,
            statelessMode: true,
          },
        }),
      ],
      providers: [
        {
          provide: MIDDLEWARES_DIR,
          useValue: options.configDir,
        },
        MiddlewareService,
        SecureHttpTool,
      ],
    };
  }
}
