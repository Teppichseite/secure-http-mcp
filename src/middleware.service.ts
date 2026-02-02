import { Injectable, OnModuleInit, Logger, Inject } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import * as picomatch from "picomatch";

export const MIDDLEWARES_DIR = "MIDDLEWARES_DIR";

export interface RequestConfig {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
  queryParams?: Record<string, string>;
}

export interface MiddlewareHandleResult {
  allowed: boolean;
  reason?: string;
}

export type MiddlewareHandleReturn =
  | boolean
  | MiddlewareHandleResult
  | Promise<boolean | MiddlewareHandleResult>;

export interface Middleware {
  title: string;
  description: string;
  pattern: string;
  handle: (config: RequestConfig) => MiddlewareHandleReturn;
  filePath: string;
}

export interface MiddlewareResult {
  allowed: boolean;
  middleware?: Middleware;
  error?: string;
}

interface MiddlewaresConfig {
  middlewares: string[];
}

@Injectable()
export class MiddlewareService implements OnModuleInit {
  private readonly logger = new Logger(MiddlewareService.name);
  private middlewares: Middleware[] = [];
  private readonly middlewaresDir: string;
  private readonly configFile: string;

  constructor(@Inject(MIDDLEWARES_DIR) middlewaresDir: string) {
    // Resolve to absolute path
    this.middlewaresDir = path.resolve(middlewaresDir);
    this.configFile = path.join(this.middlewaresDir, "shm-config.json");
  }

  async onModuleInit() {
    await this.loadMiddlewares();
  }

  async loadMiddlewares(): Promise<void> {
    this.middlewares = [];

    if (!fs.existsSync(this.middlewaresDir)) {
      this.logger.warn(`Config directory not found: ${this.middlewaresDir}`);
      return;
    }

    if (!fs.existsSync(this.configFile)) {
      this.logger.warn(`Config file not found: ${this.configFile}`);
      this.logger.warn(
        'Create a shm-config.json file with a "middlewares" array listing middleware files in order.',
      );
      return;
    }

    // Load config file
    let config: MiddlewaresConfig;
    try {
      const configContent = fs.readFileSync(this.configFile, "utf-8");
      config = JSON.parse(configContent);

      if (!Array.isArray(config.middlewares)) {
        this.logger.error('shm-config.json must contain a "middlewares" array');
        return;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to parse shm-config.json: ${errorMessage}`);
      return;
    }

    // Load middlewares in the order specified in config
    for (const file of config.middlewares) {
      const filePath = path.join(this.middlewaresDir, file);

      if (!fs.existsSync(filePath)) {
        this.logger.warn(`Middleware file not found: ${file}`);
        continue;
      }

      try {
        // Clear require cache to allow hot reloading
        delete require.cache[require.resolve(filePath)];

        const middlewareModule = require(filePath);

        if (!this.isValidMiddleware(middlewareModule)) {
          this.logger.warn(
            `Invalid middleware file: ${file} - missing required fields`,
          );
          continue;
        }

        this.middlewares.push({
          title: middlewareModule.title,
          description: middlewareModule.description,
          pattern: middlewareModule.pattern,
          handle: middlewareModule.handle,
          filePath,
        });

        this.logger.log(
          `Loaded middleware: ${middlewareModule.title} (${middlewareModule.pattern})`,
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to load middleware ${file}: ${errorMessage}`);
      }
    }

    this.logger.log(`Loaded ${this.middlewares.length} middleware(s)`);
  }

  private isValidMiddleware(
    module: unknown,
  ): module is Omit<Middleware, "filePath"> {
    if (typeof module !== "object" || module === null) return false;
    const m = module as Record<string, unknown>;
    return (
      typeof m.title === "string" &&
      typeof m.description === "string" &&
      typeof m.pattern === "string" &&
      typeof m.handle === "function"
    );
  }

  findMatchingMiddleware(url: string): Middleware | undefined {
    for (const middleware of this.middlewares) {
      const matcher = picomatch(middleware.pattern);
      if (matcher(url)) {
        return middleware;
      }
    }
    return undefined;
  }

  async processRequest(config: RequestConfig): Promise<MiddlewareResult> {
    if (this.middlewares.length === 0) {
      return {
        allowed: false,
        error:
          "No middlewares configured. Create middleware files in the middlewares directory.",
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

      // Handle different return types
      if (typeof result === "boolean") {
        return {
          allowed: result,
          middleware,
          error: !result
            ? `Middleware "${middleware.title}" denied the request`
            : undefined,
        };
      }

      // Result is an object with allowed and optional reason
      return {
        allowed: result.allowed,
        middleware,
        error: !result.allowed
          ? result.reason ||
            `Middleware "${middleware.title}" denied the request`
          : undefined,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Middleware "${middleware.title}" threw an error: ${errorMessage}`,
      );
      return {
        allowed: false,
        middleware,
        error: `Middleware "${middleware.title}" threw an error: ${errorMessage}`,
      };
    }
  }

  getMiddlewares(): Middleware[] {
    return this.middlewares;
  }
}
