import { SecureHttpTool } from "../src/secure-http.tool";
import {
  MiddlewareService,
  MiddlewareResult,
  RequestConfig,
} from "../src/middleware.service";

// Mock the MiddlewareService
const mockMiddlewareService = {
  processRequest: jest.fn(),
  getMiddlewares: jest.fn(),
  loadMiddlewares: jest.fn(),
};

// Mock context for MCP tools
const mockContext = {
  reportProgress: jest.fn().mockResolvedValue(undefined),
};

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("SecureHttpTool", () => {
  let tool: SecureHttpTool;

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new SecureHttpTool(
      mockMiddlewareService as unknown as MiddlewareService,
    );
  });

  describe("executeHttp", () => {
    const testMiddleware = {
      title: "Test API",
      description: "Test middleware",
      pattern: "https://api.example.com/**",
      handle: async () => true,
      filePath: "/test/middleware.js",
    };

    describe("when middleware denies request", () => {
      it("should return error when no middleware matches", async () => {
        mockMiddlewareService.processRequest.mockResolvedValue({
          allowed: false,
          error: "No middleware matches URL: https://api.example.com/users",
        } as MiddlewareResult);

        const result = await tool.executeHttp(
          {
            url: "https://api.example.com/users",
            method: "GET",
          },
          mockContext as any,
        );

        expect(result.allowed).toBe(false);
        expect(result.error).toContain("No middleware matches");
        expect(result.matchedMiddleware).toBeNull();
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it("should return error when middleware denies with reason", async () => {
        mockMiddlewareService.processRequest.mockResolvedValue({
          allowed: false,
          middleware: testMiddleware,
          error: "Method DELETE is not allowed",
        } as MiddlewareResult);

        const result = await tool.executeHttp(
          {
            url: "https://api.example.com/users/1",
            method: "DELETE",
          },
          mockContext as any,
        );

        expect(result.allowed).toBe(false);
        expect(result.error).toBe("Method DELETE is not allowed");
        expect(result.matchedMiddleware).toEqual({
          title: testMiddleware.title,
          description: testMiddleware.description,
          pattern: testMiddleware.pattern,
        });
      });
    });

    describe("when middleware allows request", () => {
      beforeEach(() => {
        mockMiddlewareService.processRequest.mockResolvedValue({
          allowed: true,
          middleware: testMiddleware,
        } as MiddlewareResult);
      });

      it("should execute GET request successfully", async () => {
        mockFetch.mockResolvedValue({
          status: 200,
          statusText: "OK",
          headers: new Map([["content-type", "application/json"]]),
          json: jest.fn().mockResolvedValue({ id: 1, name: "Test" }),
        });

        const result = await tool.executeHttp(
          {
            url: "https://api.example.com/users/1",
            method: "GET",
          },
          mockContext as any,
        );

        expect(result.allowed).toBe(true);
        expect(result.response?.status).toBe(200);
        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.example.com/users/1",
          expect.objectContaining({
            method: "GET",
            body: undefined,
          }),
        );
      });

      it("should execute POST request with JSON body", async () => {
        mockFetch.mockResolvedValue({
          status: 201,
          statusText: "Created",
          headers: new Map([["content-type", "application/json"]]),
          json: jest.fn().mockResolvedValue({ id: 2, name: "New User" }),
        });

        const result = await tool.executeHttp(
          {
            url: "https://api.example.com/users",
            method: "POST",
            body: { name: "New User" },
          },
          mockContext as any,
        );

        expect(result.allowed).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.example.com/users",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ name: "New User" }),
            headers: expect.objectContaining({
              "Content-Type": "application/json",
            }),
          }),
        );
      });

      it("should append query parameters to URL", async () => {
        mockFetch.mockResolvedValue({
          status: 200,
          statusText: "OK",
          headers: new Map([["content-type", "application/json"]]),
          json: jest.fn().mockResolvedValue([]),
        });

        await tool.executeHttp(
          {
            url: "https://api.example.com/users",
            method: "GET",
            queryParams: { page: "1", limit: "10" },
          },
          mockContext as any,
        );

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("page=1"),
          expect.anything(),
        );
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("limit=10"),
          expect.anything(),
        );
      });

      it("should pass custom headers", async () => {
        mockFetch.mockResolvedValue({
          status: 200,
          statusText: "OK",
          headers: new Map([["content-type", "text/plain"]]),
          text: jest.fn().mockResolvedValue("OK"),
        });

        await tool.executeHttp(
          {
            url: "https://api.example.com/users",
            method: "GET",
            headers: { "X-Custom-Header": "custom-value" },
          },
          mockContext as any,
        );

        expect(mockFetch).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            headers: expect.objectContaining({
              "X-Custom-Header": "custom-value",
            }),
          }),
        );
      });

      it("should handle text response when content-type is not JSON", async () => {
        mockFetch.mockResolvedValue({
          status: 200,
          statusText: "OK",
          headers: new Map([["content-type", "text/html"]]),
          text: jest.fn().mockResolvedValue("<html>Hello</html>"),
        });

        const result = await tool.executeHttp(
          {
            url: "https://api.example.com/page",
            method: "GET",
          },
          mockContext as any,
        );

        expect(result.response?.body).toBe("<html>Hello</html>");
      });

      it("should handle fetch error", async () => {
        mockFetch.mockRejectedValue(new Error("Network error"));

        const result = await tool.executeHttp(
          {
            url: "https://api.example.com/users",
            method: "GET",
          },
          mockContext as any,
        );

        expect(result.error).toContain("Request failed: Network error");
        expect(result.allowed).toBe(true); // Was allowed by middleware, but failed
      });

      it("should not send body for GET requests", async () => {
        mockFetch.mockResolvedValue({
          status: 200,
          statusText: "OK",
          headers: new Map([["content-type", "application/json"]]),
          json: jest.fn().mockResolvedValue({}),
        });

        await tool.executeHttp(
          {
            url: "https://api.example.com/users",
            method: "GET",
            body: { ignored: "body" },
          },
          mockContext as any,
        );

        expect(mockFetch).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            body: undefined,
          }),
        );
      });

      it("should not send body for HEAD requests", async () => {
        mockFetch.mockResolvedValue({
          status: 200,
          statusText: "OK",
          headers: new Map([["content-type", "application/json"]]),
          json: jest.fn().mockResolvedValue({}),
        });

        await tool.executeHttp(
          {
            url: "https://api.example.com/users",
            method: "HEAD",
            body: { ignored: "body" },
          },
          mockContext as any,
        );

        expect(mockFetch).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            body: undefined,
          }),
        );
      });

      it("should handle string body", async () => {
        mockFetch.mockResolvedValue({
          status: 200,
          statusText: "OK",
          headers: new Map([["content-type", "text/plain"]]),
          text: jest.fn().mockResolvedValue("OK"),
        });

        await tool.executeHttp(
          {
            url: "https://api.example.com/users",
            method: "POST",
            body: "raw string body",
          },
          mockContext as any,
        );

        expect(mockFetch).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            body: "raw string body",
          }),
        );
      });

      it("should report progress during execution", async () => {
        mockFetch.mockResolvedValue({
          status: 200,
          statusText: "OK",
          headers: new Map([["content-type", "application/json"]]),
          json: jest.fn().mockResolvedValue({}),
        });

        await tool.executeHttp(
          {
            url: "https://api.example.com/users",
            method: "GET",
          },
          mockContext as any,
        );

        expect(mockContext.reportProgress).toHaveBeenCalled();
      });
    });
  });

  describe("listMiddlewares", () => {
    it("should return message when no middlewares configured", async () => {
      mockMiddlewareService.getMiddlewares.mockReturnValue([]);

      const result = await tool.listMiddlewares();

      expect(result.message).toContain("No middlewares configured");
      expect(result.middlewares).toEqual([]);
    });

    it("should return list of middlewares", async () => {
      const middlewares = [
        {
          title: "API 1",
          description: "First API",
          pattern: "https://api1.example.com/**",
          handle: async () => true,
          filePath: "/test/api1.js",
        },
        {
          title: "API 2",
          description: "Second API",
          pattern: "https://api2.example.com/**",
          handle: async () => true,
          filePath: "/test/api2.js",
        },
      ];
      mockMiddlewareService.getMiddlewares.mockReturnValue(middlewares);

      const result = await tool.listMiddlewares();

      expect(result.message).toContain("Found 2 middleware(s)");
      expect(result.middlewares).toHaveLength(2);
      expect(result.middlewares[0]).toEqual({
        title: "API 1",
        description: "First API",
        pattern: "https://api1.example.com/**",
      });
      // filePath and handle should not be exposed
      expect(result.middlewares[0]).not.toHaveProperty("filePath");
      expect(result.middlewares[0]).not.toHaveProperty("handle");
    });
  });

  describe("reloadMiddlewares", () => {
    it("should reload middlewares and return updated list", async () => {
      const middlewares = [
        {
          title: "Reloaded API",
          description: "Reloaded middleware",
          pattern: "https://reloaded.example.com/**",
          handle: async () => true,
          filePath: "/test/reloaded.js",
        },
      ];
      mockMiddlewareService.loadMiddlewares.mockResolvedValue(undefined);
      mockMiddlewareService.getMiddlewares.mockReturnValue(middlewares);

      const result = await tool.reloadMiddlewares();

      expect(mockMiddlewareService.loadMiddlewares).toHaveBeenCalled();
      expect(result.message).toContain("Reloaded 1 middleware(s)");
      expect(result.middlewares).toHaveLength(1);
    });
  });
});
