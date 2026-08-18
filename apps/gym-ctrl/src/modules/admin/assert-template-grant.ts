import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '@core/infra/prisma/prisma.service';

export async function assertTemplateGranted(
  prisma: PrismaService,
  tenantId: number,
  templateId: number | null | undefined,
): Promise<void> {
  if (templateId == null) {
    return;
  }
  const grant = await prisma.tenantTemplateGrant.findUnique({
    where: { tenantId_templateId: { tenantId, templateId } },
    select: { tenantId: true },
  });
  if (!grant) {
    throw new BadRequestException(
      `Template ${templateId} não está concedido ao tenant ${tenantId}`,
    );
  }
}
