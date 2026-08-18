import { RequestUser } from '@core/contracts/request-user';
import { UserToken } from '@core/contracts/user-token';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Roles } from '@prisma/client';

@Injectable()
export class TenantScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestUser>();
    const user = request.user as UserToken | undefined;
    if (!user) {
      return true;
    }
    if (user.roles?.includes(Roles.SUPER_ADMIN)) {
      return true;
    }
    const tenantId = Number.parseInt(String(request.params?.tenantId), 10);
    if (tenantId === user.tenantId) {
      return true;
    }
    throw new ForbiddenException('Acesso não permitido');
  }
}
