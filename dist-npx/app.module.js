"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AppModule_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const mcp_nest_1 = require("@rekog/mcp-nest");
const middleware_service_1 = require("./middleware.service");
const secure_http_tool_1 = require("./secure-http.tool");
const auth_guard_1 = require("./auth.guard");
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
let AppModule = AppModule_1 = class AppModule {
    static forRoot(options) {
        return {
            module: AppModule_1,
            imports: [
                mcp_nest_1.McpModule.forRoot({
                    name: "secure-http-mcp",
                    version: "1.0.0",
                    instructions: MCP_INSTRUCTIONS,
                    guards: [auth_guard_1.BearerAuthGuard],
                    transport: [mcp_nest_1.McpTransportType.STREAMABLE_HTTP],
                    streamableHttp: {
                        enableJsonResponse: true,
                        sessionIdGenerator: undefined,
                        statelessMode: true,
                    },
                }),
            ],
            providers: [
                {
                    provide: middleware_service_1.MIDDLEWARES_DIR,
                    useValue: options.configDir,
                },
                middleware_service_1.MiddlewareService,
                secure_http_tool_1.SecureHttpTool,
            ],
        };
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = AppModule_1 = __decorate([
    (0, common_1.Module)({})
], AppModule);
