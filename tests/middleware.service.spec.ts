import * as fs from "fs";
import * as path from "path";
import { MiddlewareService, RequestConfig } from "../src/middleware.service";

// Mock fs module
jest.mock("fs");

const mockFs = fs as jest.Mocked<typeof fs>;

describe("MiddlewareService", () => {
  let service: MiddlewareService;
  const testMiddlewaresDir = "/test/middlewares";

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset require cache mocking
    jest.resetModules();
  });

  describe("loadMiddlewares", () => {
    it("should warn when middlewares directory does not exist", async () => {
      mockFs.existsSync.mockReturnValue(false);

      service = new MiddlewareService(testMiddlewaresDir);
      await service.loadMiddlewares();

      expect(service.getMiddlewares()).toHaveLength(0);
    });

    it("should warn when config file does not exist", async () => {
      mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
        const pathStr = p.toString();
        return pathStr === testMiddlewaresDir;
      });

      service = new MiddlewareService(testMiddlewaresDir);
      await service.loadMiddlewares();

      expect(service.getMiddlewares()).toHaveLength(0);
    });

    it("should error when config file has invalid JSON", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue("invalid json");

      service = new MiddlewareService(testMiddlewaresDir);
      await service.loadMiddlewares();

      expect(service.getMiddlewares()).toHaveLength(0);
    });

    it("should error when config file does not have middlewares array", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({ middlewares: "not-an-array" }),
      );

      service = new MiddlewareService(testMiddlewaresDir);
      await service.loadMiddlewares();

      expect(service.getMiddlewares()).toHaveLength(0);
    });
  });

  describe("findMatchingMiddleware", () => {
    it("should find middleware matching URL pattern", async () => {
      // Create a service with pre-loaded middlewares for testing
      service = new MiddlewareService(testMiddlewaresDir);

      // Manually inject a middleware for testing
      (service as any).middlewares = [
        {
          title: "Test API",
          description: "Test middleware",
          pattern: "https://api.example.com/**",
          handle: async () => true,
          filePath: "/test/middleware.js",
        },
      ];

      const middleware = service.findMatchingMiddleware(
        "https://api.example.com/users/123",
      );
      expect(middleware).toBeDefined();
      expect(middleware?.title).toBe("Test API");
    });

    it("should return undefined when no middleware matches", async () => {
      service = new MiddlewareService(testMiddlewaresDir);
      (service as any).middlewares = [
        {
          title: "Test API",
          description: "Test middleware",
          pattern: "https://api.example.com/**",
          handle: async () => true,
          filePath: "/test/middleware.js",
        },
      ];

      const middleware = service.findMatchingMiddleware(
        "https://other.example.com/users",
      );
      expect(middleware).toBeUndefined();
    });

    it("should match first middleware when multiple patterns could match", async () => {
      service = new MiddlewareService(testMiddlewaresDir);
      (service as any).middlewares = [
        {
          title: "First API",
          description: "First middleware",
          pattern: "https://api.example.com/**",
          handle: async () => true,
          filePath: "/test/first.js",
        },
        {
          title: "Second API",
          description: "Second middleware",
          pattern: "https://api.example.com/users/**",
          handle: async () => true,
          filePath: "/test/second.js",
        },
      ];

      const middleware = service.findMatchingMiddleware(
        "https://api.example.com/users/123",
      );
      expect(middleware?.title).toBe("First API");
    });
  });

  describe("processRequest", () => {
    const testConfig: RequestConfig = {
      url: "https://api.example.com/users",
      method: "GET",
      headers: {},
      queryParams: {},
    };

    it("should return error when no middlewares are configured", async () => {
      service = new MiddlewareService(testMiddlewaresDir);
      (service as any).middlewares = [];

      const result = await service.processRequest(testConfig);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("No middlewares configured");
    });

    it("should return error when no middleware matches URL", async () => {
      service = new MiddlewareService(testMiddlewaresDir);
      (service as any).middlewares = [
        {
          title: "Other API",
          description: "Other middleware",
          pattern: "https://other.example.com/**",
          handle: async () => true,
          filePath: "/test/other.js",
        },
      ];

      const result = await service.processRequest(testConfig);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("No middleware matches URL");
    });

    it("should allow request when middleware returns true", async () => {
      service = new MiddlewareService(testMiddlewaresDir);
      (service as any).middlewares = [
        {
          title: "Test API",
          description: "Test middleware",
          pattern: "https://api.example.com/**",
          handle: async () => true,
          filePath: "/test/middleware.js",
        },
      ];

      const result = await service.processRequest(testConfig);

      expect(result.allowed).toBe(true);
      expect(result.middleware?.title).toBe("Test API");
    });

    it("should deny request when middleware returns false", async () => {
      service = new MiddlewareService(testMiddlewaresDir);
      (service as any).middlewares = [
        {
          title: "Test API",
          description: "Test middleware",
          pattern: "https://api.example.com/**",
          handle: async () => false,
          filePath: "/test/middleware.js",
        },
      ];

      const result = await service.processRequest(testConfig);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("denied the request");
    });

    it("should handle middleware returning object with allowed: true", async () => {
      service = new MiddlewareService(testMiddlewaresDir);
      (service as any).middlewares = [
        {
          title: "Test API",
          description: "Test middleware",
          pattern: "https://api.example.com/**",
          handle: async () => ({ allowed: true }),
          filePath: "/test/middleware.js",
        },
      ];

      const result = await service.processRequest(testConfig);

      expect(result.allowed).toBe(true);
    });

    it("should handle middleware returning object with allowed: false and reason", async () => {
      service = new MiddlewareService(testMiddlewaresDir);
      (service as any).middlewares = [
        {
          title: "Test API",
          description: "Test middleware",
          pattern: "https://api.example.com/**",
          handle: async () => ({
            allowed: false,
            reason: "Method not allowed",
          }),
          filePath: "/test/middleware.js",
        },
      ];

      const result = await service.processRequest(testConfig);

      expect(result.allowed).toBe(false);
      expect(result.error).toBe("Method not allowed");
    });

    it("should handle middleware throwing an error", async () => {
      service = new MiddlewareService(testMiddlewaresDir);
      (service as any).middlewares = [
        {
          title: "Test API",
          description: "Test middleware",
          pattern: "https://api.example.com/**",
          handle: async () => {
            throw new Error("Middleware error");
          },
          filePath: "/test/middleware.js",
        },
      ];

      const result = await service.processRequest(testConfig);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain("threw an error");
      expect(result.error).toContain("Middleware error");
    });

    it("should allow middleware to modify request config", async () => {
      service = new MiddlewareService(testMiddlewaresDir);
      (service as any).middlewares = [
        {
          title: "Test API",
          description: "Test middleware",
          pattern: "https://api.example.com/**",
          handle: async (config: RequestConfig) => {
            config.headers = {
              ...config.headers,
              "X-Custom-Header": "test-value",
            };
            return true;
          },
          filePath: "/test/middleware.js",
        },
      ];

      const config: RequestConfig = {
        url: "https://api.example.com/users",
        method: "GET",
        headers: {},
      };

      const result = await service.processRequest(config);

      expect(result.allowed).toBe(true);
      expect(config.headers?.["X-Custom-Header"]).toBe("test-value");
    });
  });

  describe("getMiddlewares", () => {
    it("should return empty array when no middlewares loaded", () => {
      service = new MiddlewareService(testMiddlewaresDir);
      expect(service.getMiddlewares()).toEqual([]);
    });

    it("should return loaded middlewares", () => {
      service = new MiddlewareService(testMiddlewaresDir);
      const testMiddlewares = [
        {
          title: "Test API",
          description: "Test middleware",
          pattern: "https://api.example.com/**",
          handle: async () => true,
          filePath: "/test/middleware.js",
        },
      ];
      (service as any).middlewares = testMiddlewares;

      expect(service.getMiddlewares()).toEqual(testMiddlewares);
    });
  });
});
