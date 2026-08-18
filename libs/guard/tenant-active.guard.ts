import { PrismaService } from '@core/infra/prisma/prisma.service';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class TenantActiveGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = String(request.method ?? '').toUpperCase();
    if (READ_METHODS.has(method)) {
      return true;
    }

    const tenantId = Number.parseInt(String(request.params?.tenantId), 10);
    if (!Number.isFinite(tenantId)) {
      return true;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { active: true },
    });
    if (tenant && tenant.active === false) {
      throw new ForbiddenException('Acesso não permitido');
    }
    return true;
  }
}
