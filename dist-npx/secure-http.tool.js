"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SecureHttpTool_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecureHttpTool = void 0;
const common_1 = require("@nestjs/common");
const mcp_nest_1 = require("@rekog/mcp-nest");
const zod_1 = require("zod");
const middleware_service_1 = require("./middleware.service");
let SecureHttpTool = SecureHttpTool_1 = class SecureHttpTool {
    constructor(middlewareService) {
        this.middlewareService = middlewareService;
        this.logger = new common_1.Logger(SecureHttpTool_1.name);
    }
    async executeHttp({ url, method, headers, body, queryParams, }, context) {
        await context.reportProgress({ progress: 0, total: 100 });
        this.logger.log(`Incoming request: ${method} ${url}`);
        const config = {
            url,
            method,
            headers: headers ? { ...headers } : {},
            body,
            queryParams: queryParams ? { ...queryParams } : {},
        };
        await context.reportProgress({ progress: 10, total: 100 });
        const middlewareResult = await this.middlewareService.processRequest(config);
        if (!middlewareResult.allowed) {
            if (middlewareResult.middleware) {
                this.logger.warn(`Request denied by middleware "${middlewareResult.middleware.title}": ${method} ${url}`);
            }
            else {
                this.logger.warn(`Request denied (no matching middleware): ${method} ${url}`);
            }
            this.logger.debug(`Denial reason: ${middlewareResult.error}`);
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
        this.logger.log(`Request allowed by middleware "${middlewareResult.middleware.title}"`);
        await context.reportProgress({ progress: 30, total: 100 });
        try {
            const requestUrl = new URL(config.url);
            if (config.queryParams) {
                Object.entries(config.queryParams).forEach(([key, value]) => {
                    requestUrl.searchParams.append(key, value);
                });
            }
            const requestHeaders = { ...config.headers };
            let requestBody;
            if (config.body !== undefined && method !== "GET" && method !== "HEAD") {
                if (typeof config.body === "object") {
                    requestBody = JSON.stringify(config.body);
                    if (!requestHeaders["Content-Type"] &&
                        !requestHeaders["content-type"]) {
                        requestHeaders["Content-Type"] = "application/json";
                    }
                }
                else {
                    requestBody = String(config.body);
                }
            }
            await context.reportProgress({ progress: 50, total: 100 });
            this.logger.log(`Executing: ${config.method} ${requestUrl.toString()}`);
            const response = await fetch(requestUrl.toString(), {
                method: config.method,
                headers: requestHeaders,
                body: requestBody,
            });
            await context.reportProgress({ progress: 80, total: 100 });
            this.logger.log(`Response: ${response.status} ${response.statusText}`);
            const responseHeaders = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });
            const contentType = response.headers.get("content-type") || "";
            let responseBody;
            if (contentType.includes("application/json")) {
                try {
                    responseBody = await response.json();
                }
                catch {
                    responseBody = await response.text();
                }
            }
            else {
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
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Unknown error";
            this.logger.error(`Request failed: ${errorMsg}`);
            return {
                error: `Request failed: ${errorMsg}`,
                allowed: true,
                matchedMiddleware: {
                    title: middlewareResult.middleware.title,
                    description: middlewareResult.middleware.description,
                    pattern: middlewareResult.middleware.pattern,
                },
            };
        }
    }
    async listMiddlewares() {
        const middlewares = this.middlewareService.getMiddlewares();
        if (middlewares.length === 0) {
            return {
                message: "No middlewares configured. Create .js files in the middlewares directory.",
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
};
exports.SecureHttpTool = SecureHttpTool;
__decorate([
    (0, mcp_nest_1.Tool)({
        name: "execute-http",
        description: "Execute an HTTP request. The request must pass through a configured middleware that matches the URL pattern. Middlewares can modify the request config (headers, etc.) before execution.",
        parameters: zod_1.z.object({
            url: zod_1.z
                .string()
                .url()
                .describe("The full URL to call (e.g. https://api.example.com/users/123)"),
            method: zod_1.z
                .enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])
                .describe("HTTP method"),
            headers: zod_1.z
                .record(zod_1.z.string(), zod_1.z.string())
                .optional()
                .describe('HTTP headers to include (e.g. {"Authorization": "Bearer token", "Content-Type": "application/json"})'),
            body: zod_1.z
                .any()
                .optional()
                .describe("Request body (will be JSON stringified if object)"),
            queryParams: zod_1.z
                .record(zod_1.z.string(), zod_1.z.string())
                .optional()
                .describe("Query parameters to append to the URL"),
        }),
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SecureHttpTool.prototype, "executeHttp", null);
__decorate([
    (0, mcp_nest_1.Tool)({
        name: "list-middlewares",
        description: "List all configured middlewares with their URL patterns and descriptions.",
        parameters: zod_1.z.object({}),
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SecureHttpTool.prototype, "listMiddlewares", null);
__decorate([
    (0, mcp_nest_1.Tool)({
        name: "reload-middlewares",
        description: "Reload all middleware files from the middlewares directory. Use this after adding or modifying middleware files.",
        parameters: zod_1.z.object({}),
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SecureHttpTool.prototype, "reloadMiddlewares", null);
exports.SecureHttpTool = SecureHttpTool = SecureHttpTool_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [middleware_service_1.MiddlewareService])
], SecureHttpTool);
