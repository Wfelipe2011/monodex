import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { getRouteTypeFromMetadata } from './helpers';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const { PUBLIC } = getRouteTypeFromMetadata(
      this.reflector,
      context,
    );
    const header = context.switchToHttp().getRequest().headers;

    if (PUBLIC) {
      return true;
    }

    return super.canActivate(context);
  }
}
