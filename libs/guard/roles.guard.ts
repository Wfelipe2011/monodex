import { ROLES_KEY } from '@core/decorators/roles.decorator';
import { Role } from '@core/enums/role.enum';
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    const isAccess = requiredRoles.some(role => user.roles?.includes(role));
    if (!isAccess) throw new ForbiddenException('Acesso não permitido');
    return isAccess;
  }
}
