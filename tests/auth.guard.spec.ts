import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { BearerAuthGuard } from "../src/auth.guard";

describe("BearerAuthGuard", () => {
  let guard: BearerAuthGuard;
  const originalEnv = process.env;

  beforeEach(() => {
    guard = new BearerAuthGuard();
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const createMockContext = (authHeader?: string): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers:
            authHeader !== undefined ? { authorization: authHeader } : {},
        }),
      }),
    } as ExecutionContext;
  };

  describe("when SHM_AUTH_TOKEN is not configured", () => {
    beforeEach(() => {
      delete process.env.SHM_AUTH_TOKEN;
    });

    it("should allow all requests without authorization header", () => {
      const context = createMockContext();
      expect(guard.canActivate(context)).toBe(true);
    });

    it("should allow all requests with any authorization header", () => {
      const context = createMockContext("Bearer any-token");
      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe("when SHM_AUTH_TOKEN is configured", () => {
    const validToken = "my-secret-token";

    beforeEach(() => {
      process.env.SHM_AUTH_TOKEN = validToken;
    });

    it("should throw UnauthorizedException when authorization header is missing", () => {
      const context = createMockContext();
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow(
        "Authorization header is required",
      );
    });

    it("should throw UnauthorizedException when authorization type is not Bearer", () => {
      const context = createMockContext("Basic some-token");
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow(
        "Invalid authorization format",
      );
    });

    it("should throw UnauthorizedException when token is missing after Bearer", () => {
      const context = createMockContext("Bearer ");
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow(
        "Invalid authorization format",
      );
    });

    it("should throw UnauthorizedException when token is invalid", () => {
      const context = createMockContext("Bearer wrong-token");
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow("Invalid token");
    });

    it("should allow request when token is valid", () => {
      const context = createMockContext(`Bearer ${validToken}`);
      expect(guard.canActivate(context)).toBe(true);
    });

    it("should be case-sensitive for Bearer type", () => {
      const context = createMockContext(`bearer ${validToken}`);
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow(
        "Invalid authorization format",
      );
    });
  });

  describe("edge cases", () => {
    beforeEach(() => {
      process.env.SHM_AUTH_TOKEN = "test-token";
    });

    it("should handle authorization header with extra spaces", () => {
      const context = createMockContext("Bearer  test-token");
      // First part after split is 'Bearer', second is empty string
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it("should handle empty string token in env", () => {
      process.env.SHM_AUTH_TOKEN = "";
      const context = createMockContext();
      // Empty string is falsy, so should allow all
      expect(guard.canActivate(context)).toBe(true);
    });
  });
});
