import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";

@Injectable()
export class BearerAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const token = process.env.SHM_AUTH_TOKEN;

    // If no token is configured, allow all requests
    if (!token) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;

    if (!authHeader) {
      throw new UnauthorizedException("Authorization header is required");
    }

    const [type, providedToken] = authHeader.split(" ");

    if (type !== "Bearer" || !providedToken) {
      throw new UnauthorizedException(
        "Invalid authorization format. Use: Bearer <token>",
      );
    }

    if (providedToken !== token) {
      throw new UnauthorizedException("Invalid token");
    }

    return true;
  }
}
