import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const secret = request.headers['x-internal-secret'];
    const expected = this.configService.get<string>('INTERNAL_WS_NOTIFY_SECRET');

    if (!secret || secret !== expected) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
