import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WhatsappDeliveryStatus } from '@prisma/client';
import { PrismaService } from '@core/infra/prisma/prisma.service';

const DEFAULT_SEND_LIMIT = 100;

@Injectable()
export class OutreachSendsService {
  constructor(private readonly prisma: PrismaService) {}

  async listSends(tenantId: number, query: { status?: string }) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
    }

    const where: Prisma.TenantLeadWhereInput = {
      tenantId,
      messageId: { not: null },
      ...(query.status === 'failed'
        ? { lastStatus: WhatsappDeliveryStatus.failed }
        : {}),
    };

    const rows = await this.prisma.tenantLead.findMany({
      where,
      select: {
        id: true,
        messageId: true,
        createdAt: true,
        lastStatus: true,
        templateName: true,
        lead: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: DEFAULT_SEND_LIMIT,
    });

    const failedWamids = rows
      .filter(
        (row) =>
          row.lastStatus === WhatsappDeliveryStatus.failed && row.messageId,
      )
      .map((row) => row.messageId as string);

    const latestErrors = await this.loadLatestFailedErrors(failedWamids);

    return rows.map((row) => ({
      id: row.id,
      wamid: row.messageId,
      sentAt: row.createdAt,
      lastStatus: row.lastStatus,
      templateName: row.templateName,
      lead: row.lead,
      ...(row.lastStatus === WhatsappDeliveryStatus.failed
        ? { latestError: latestErrors.get(row.messageId as string) ?? null }
        : {}),
    }));
  }

  private async loadLatestFailedErrors(
    wamids: string[],
  ): Promise<Map<string, Prisma.JsonValue | null>> {
    const result = new Map<string, Prisma.JsonValue | null>();
    if (wamids.length === 0) {
      return result;
    }

    const statusRows = await this.prisma.whatsappSendStatus.findMany({
      where: {
        wamid: { in: wamids },
        status: WhatsappDeliveryStatus.failed,
      },
      select: { wamid: true, errors: true, metaTimestamp: true },
      orderBy: { metaTimestamp: 'desc' },
    });

    for (const row of statusRows) {
      if (!result.has(row.wamid)) {
        result.set(row.wamid, row.errors);
      }
    }

    return result;
  }
}
