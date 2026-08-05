import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/infra/prisma/prisma.service';

@Injectable()
export class OpsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const [totalTenants, activeTenants, outreachEnabledTenants, totalLeads] =
      await Promise.all([
        this.prisma.tenant.count(),
        this.prisma.tenant.count({ where: { active: true } }),
        this.prisma.tenantOutreachConfig.count({ where: { enabled: true } }),
        this.prisma.lead.count({ where: { deletedAt: null } }),
      ]);

    return {
      totalTenants,
      activeTenants,
      outreachEnabledTenants,
      totalLeads,
    };
  }

  async leadsStats(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
    }

    const [contacted, replied, quoted, closed, deleted] = await Promise.all([
      this.prisma.tenantLead.count({ where: { tenantId, contacted: true } }),
      this.prisma.tenantLead.count({ where: { tenantId, replied: true } }),
      this.prisma.tenantLead.count({ where: { tenantId, quoted: true } }),
      this.prisma.tenantLead.count({ where: { tenantId, closed: true } }),
      this.prisma.tenantLead.count({ where: { tenantId, deleted: true } }),
    ]);

    return { contacted, replied, quoted, closed, deleted };
  }

  async leadsCount() {
    const count = await this.prisma.lead.count({
      where: { deletedAt: null },
    });
    return { count };
  }
}
