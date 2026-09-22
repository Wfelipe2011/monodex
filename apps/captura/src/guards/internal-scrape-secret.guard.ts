import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class InternalScrapeSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
    }>();
    const secret = request.headers['x-internal-secret'];
    const expected = process.env.CAPTURA_INTERNAL_SCRAPE_SECRET;

    if (!secret || !expected || secret !== expected) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
