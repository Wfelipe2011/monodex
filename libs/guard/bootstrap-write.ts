import { ForbiddenException } from '@nestjs/common';
import { Roles } from '@prisma/client';
import { canSuperAdminWriteAdminFields } from '../shared/bootstrap-window';

export function assertSuperAdminTenantWrite(args: {
  roles: Roles[];
  resourceCreatedAt: Date | null;
  isPlatformField: boolean;
}): void {
  if (!args.roles?.includes(Roles.SUPER_ADMIN)) {
    return;
  }
  if (args.isPlatformField) {
    return;
  }
  const allowed = canSuperAdminWriteAdminFields({
    exists: args.resourceCreatedAt != null,
    createdAt: args.resourceCreatedAt,
  });
  if (!allowed) {
    throw new ForbiddenException('Acesso não permitido');
  }
}
