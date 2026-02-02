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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var MiddlewareService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MiddlewareService = exports.MIDDLEWARES_DIR = void 0;
const common_1 = require("@nestjs/common");
const fs = require("fs");
const path = require("path");
const picomatch = require("picomatch");
exports.MIDDLEWARES_DIR = "MIDDLEWARES_DIR";
let MiddlewareService = MiddlewareService_1 = class MiddlewareService {
    constructor(middlewaresDir) {
        this.logger = new common_1.Logger(MiddlewareService_1.name);
        this.middlewares = [];
        this.middlewaresDir = path.resolve(middlewaresDir);
        this.configFile = path.join(this.middlewaresDir, "sf-config.json");
    }
    async onModuleInit() {
        await this.loadMiddlewares();
    }
    async loadMiddlewares() {
        this.middlewares = [];
        if (!fs.existsSync(this.middlewaresDir)) {
            this.logger.warn(`Config directory not found: ${this.middlewaresDir}`);
            return;
        }
        if (!fs.existsSync(this.configFile)) {
            this.logger.warn(`Config file not found: ${this.configFile}`);
            this.logger.warn('Create a sf-config.json file with a "middlewares" array listing middleware files in order.');
            return;
        }
        let config;
        try {
            const configContent = fs.readFileSync(this.configFile, "utf-8");
            config = JSON.parse(configContent);
            if (!Array.isArray(config.middlewares)) {
                this.logger.error('sf-config.json must contain a "middlewares" array');
                return;
            }
        }
        catch (error) {
            this.logger.error(`Failed to parse sf-config.json: ${error.message}`);
            return;
        }
        for (const file of config.middlewares) {
            const filePath = path.join(this.middlewaresDir, file);
            if (!fs.existsSync(filePath)) {
                this.logger.warn(`Middleware file not found: ${file}`);
                continue;
            }
            try {
                delete require.cache[require.resolve(filePath)];
                const middlewareModule = require(filePath);
                if (!this.isValidMiddleware(middlewareModule)) {
                    this.logger.warn(`Invalid middleware file: ${file} - missing required fields`);
                    continue;
                }
                this.middlewares.push({
                    title: middlewareModule.title,
                    description: middlewareModule.description,
                    pattern: middlewareModule.pattern,
                    handle: middlewareModule.handle,
                    filePath,
                });
                this.logger.log(`Loaded middleware: ${middlewareModule.title} (${middlewareModule.pattern})`);
            }
            catch (error) {
                this.logger.error(`Failed to load middleware ${file}: ${error.message}`);
            }
        }
        this.logger.log(`Loaded ${this.middlewares.length} middleware(s)`);
    }
    isValidMiddleware(module) {
        if (typeof module !== "object" || module === null)
            return false;
        const m = module;
        return (typeof m.title === "string" &&
            typeof m.description === "string" &&
            typeof m.pattern === "string" &&
            typeof m.handle === "function");
    }
    findMatchingMiddleware(url) {
        for (const middleware of this.middlewares) {
            const matcher = picomatch(middleware.pattern);
            if (matcher(url)) {
                return middleware;
            }
        }
        return undefined;
    }
    async processRequest(config) {
        if (this.middlewares.length === 0) {
            return {
                allowed: false,
                error: "No middlewares configured. Create middleware files in the middlewares directory.",
            };
        }
        const middleware = this.findMatchingMiddleware(config.url);
        if (!middleware) {
            return {
                allowed: false,
                error: `No middleware matches URL: ${config.url}`,
            };
        }
        try {
            const result = await middleware.handle(config);
            if (typeof result === "boolean") {
                return {
                    allowed: result,
                    middleware,
                    error: !result
                        ? `Middleware "${middleware.title}" denied the request`
                        : undefined,
                };
            }
            return {
                allowed: result.allowed,
                middleware,
                error: !result.allowed
                    ? result.reason ||
                        `Middleware "${middleware.title}" denied the request`
                    : undefined,
            };
        }
        catch (error) {
            this.logger.error(`Middleware "${middleware.title}" threw an error: ${error.message}`);
            return {
                allowed: false,
                middleware,
                error: `Middleware "${middleware.title}" threw an error: ${error.message}`,
            };
        }
    }
    getMiddlewares() {
        return this.middlewares;
    }
};
exports.MiddlewareService = MiddlewareService;
exports.MiddlewareService = MiddlewareService = MiddlewareService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(exports.MIDDLEWARES_DIR)),
    __metadata("design:paramtypes", [String])
], MiddlewareService);
