import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { toTemplatePreviewDto } from '@core/shared/whatsapp-template-preview';
import { CreateTemplateGrantDto } from './dto/create-template-grant.dto';

@Injectable()
export class TemplateGrantsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: number) {
    await this.assertTenant(tenantId);
    const grants = await this.prisma.tenantTemplateGrant.findMany({
      where: { tenantId },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            language: true,
            status: true,
          },
        },
      },
      orderBy: { templateId: 'asc' },
    });
    return grants.map((grant) => ({
      tenantId: grant.tenantId,
      templateId: grant.templateId,
      createdAt: grant.createdAt,
      template: grant.template,
    }));
  }

  async upsert(tenantId: number, dto: CreateTemplateGrantDto) {
    await this.assertTenant(tenantId);
    const template = await this.prisma.whatsappMessageTemplate.findUnique({
      where: { id: dto.templateId },
      select: { id: true },
    });
    if (!template) {
      throw new NotFoundException(
        `WhatsappMessageTemplate id=${dto.templateId} não encontrado`,
      );
    }

    const grant = await this.prisma.tenantTemplateGrant.upsert({
      where: {
        tenantId_templateId: {
          tenantId,
          templateId: dto.templateId,
        },
      },
      create: { tenantId, templateId: dto.templateId },
      update: {},
      include: {
        template: {
          select: {
            id: true,
            name: true,
            language: true,
            status: true,
          },
        },
      },
    });

    return {
      tenantId: grant.tenantId,
      templateId: grant.templateId,
      createdAt: grant.createdAt,
      template: grant.template,
    };
  }

  async remove(tenantId: number, templateId: number) {
    await this.assertTenant(tenantId);
    const grant = await this.prisma.tenantTemplateGrant.findUnique({
      where: {
        tenantId_templateId: { tenantId, templateId },
      },
    });
    if (!grant) {
      throw new NotFoundException(
        `Grant tenant=${tenantId} template=${templateId} não encontrado`,
      );
    }
    await this.prisma.tenantTemplateGrant.delete({
      where: { id: grant.id },
    });
    return grant;
  }

  async listGrantedTemplates(tenantId: number) {
    await this.assertTenant(tenantId);
    const grants = await this.prisma.tenantTemplateGrant.findMany({
      where: { tenantId },
      include: { template: true },
      orderBy: { templateId: 'asc' },
    });
    return grants.map((grant) => toTemplatePreviewDto(grant.template));
  }

  async getGrantedTemplate(tenantId: number, templateId: number) {
    await this.assertTenant(tenantId);
    const grant = await this.prisma.tenantTemplateGrant.findUnique({
      where: {
        tenantId_templateId: { tenantId, templateId },
      },
      include: { template: true },
    });
    if (!grant) {
      throw new NotFoundException(
        `Template id=${templateId} não encontrado para o tenant ${tenantId}`,
      );
    }
    return toTemplatePreviewDto(grant.template);
  }

  private async assertTenant(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
    }
  }
}
