import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WhatsappDeliveryStatus } from '@prisma/client';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { extractQuickReplyButtons } from '@core/shared/list-campaign-helpers';
import { UpsertListCampaignDto } from './dto/upsert-list-campaign.dto';
import { PatchListCampaignDto } from './dto/patch-list-campaign.dto';
import {
  assertButtonActionsValid,
  assertNotifySlotBindingsValid,
  assertSendSlotBindingsValid,
  ButtonActionInput,
  hasNotifyButtonAction,
  NotifySlotBindingsInput,
  persistedSlotKeys,
  SendSlotBindingsInput,
  SlotBindingInput,
} from './list-campaign-bindings.validate';

const TEMPLATE_MIN_SELECT = {
  id: true,
  name: true,
  language: true,
  status: true,
} as const;

const CAMPAIGN_SELECT = {
  id: true,
  listId: true,
  name: true,
  enabled: true,
  templateId: true,
  slotBindings: true,
  notifyTemplateId: true,
  notifySlotBindings: true,
  buttonActions: true,
  schedule: true,
  sendsPerRun: true,
  sendIntervalSeconds: true,
  createdAt: true,
  updatedAt: true,
  template: { select: TEMPLATE_MIN_SELECT },
  notifyTemplate: { select: TEMPLATE_MIN_SELECT },
} satisfies Prisma.TenantListCampaignSelect;

const DEFAULT_SEND_LIMIT = 100;

type CampaignFields = {
  enabled: boolean;
  templateId: number;
  notifyTemplateId: number | null;
  slotBindings: SendSlotBindingsInput;
  notifySlotBindings: NotifySlotBindingsInput;
  buttonActions: ButtonActionInput[];
};

@Injectable()
export class ListCampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCampaigns(tenantId: number, listId: number) {
    await this.getListOrThrow(tenantId, listId);
    return this.prisma.tenantListCampaign.findMany({
      where: { listId },
      select: CAMPAIGN_SELECT,
      orderBy: { id: 'asc' },
    });
  }

  async createCampaign(
    tenantId: number,
    listId: number,
    dto: UpsertListCampaignDto,
  ) {
    await this.getListOrThrow(tenantId, listId);
    const fields = this.normalizeCampaignInput(dto);
    await this.assertEnableAllowed(fields);

    return this.prisma.tenantListCampaign.create({
      data: {
        listId,
        name: dto.name.trim(),
        enabled: fields.enabled,
        templateId: fields.templateId,
        slotBindings: fields.slotBindings as unknown as Prisma.InputJsonValue,
        notifyTemplateId: fields.notifyTemplateId,
        notifySlotBindings:
          fields.notifySlotBindings as unknown as Prisma.InputJsonValue,
        buttonActions: fields.buttonActions as unknown as Prisma.InputJsonValue,
        schedule: dto.schedule as Prisma.InputJsonValue,
        sendsPerRun: dto.sendsPerRun ?? 5,
        sendIntervalSeconds: dto.sendIntervalSeconds ?? 5,
      },
      select: CAMPAIGN_SELECT,
    });
  }

  async getCampaign(tenantId: number, listId: number, campaignId: number) {
    return this.getCampaignOrThrow(tenantId, listId, campaignId);
  }

  async replaceCampaign(
    tenantId: number,
    listId: number,
    campaignId: number,
    dto: UpsertListCampaignDto,
  ) {
    await this.getCampaignOrThrow(tenantId, listId, campaignId);
    const fields = this.normalizeCampaignInput(dto);
    await this.assertEnableAllowed(fields);

    return this.prisma.tenantListCampaign.update({
      where: { id: campaignId },
      data: {
        name: dto.name.trim(),
        enabled: fields.enabled,
        templateId: fields.templateId,
        slotBindings: fields.slotBindings as unknown as Prisma.InputJsonValue,
        notifyTemplateId: fields.notifyTemplateId,
        notifySlotBindings:
          fields.notifySlotBindings as unknown as Prisma.InputJsonValue,
        buttonActions: fields.buttonActions as unknown as Prisma.InputJsonValue,
        schedule: dto.schedule as Prisma.InputJsonValue,
        sendsPerRun: dto.sendsPerRun ?? 5,
        sendIntervalSeconds: dto.sendIntervalSeconds ?? 5,
      },
      select: CAMPAIGN_SELECT,
    });
  }

  async patchCampaign(
    tenantId: number,
    listId: number,
    campaignId: number,
    dto: PatchListCampaignDto,
  ) {
    const existing = await this.getCampaignOrThrow(tenantId, listId, campaignId);

    const slotBindings =
      dto.slotBindings !== undefined
        ? assertSendSlotBindingsValid(dto.slotBindings)
        : this.asSendSlotBindings(existing.slotBindings);

    const notifySlotBindings =
      dto.notifySlotBindings !== undefined
        ? assertNotifySlotBindingsValid(dto.notifySlotBindings)
        : this.asNotifySlotBindings(existing.notifySlotBindings);

    const buttonActions =
      dto.buttonActions !== undefined
        ? assertButtonActionsValid(dto.buttonActions)
        : this.asButtonActions(existing.buttonActions);

    const merged: CampaignFields = {
      enabled: dto.enabled ?? existing.enabled,
      templateId: dto.templateId ?? existing.templateId,
      notifyTemplateId:
        dto.notifyTemplateId !== undefined
          ? dto.notifyTemplateId
          : existing.notifyTemplateId,
      slotBindings,
      notifySlotBindings,
      buttonActions,
    };

    await this.assertEnableAllowed(merged);

    return this.prisma.tenantListCampaign.update({
      where: { id: campaignId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.templateId !== undefined ? { templateId: dto.templateId } : {}),
        ...(dto.slotBindings !== undefined
          ? {
              slotBindings:
                slotBindings as unknown as Prisma.InputJsonValue,
            }
          : {}),
        ...(dto.notifyTemplateId !== undefined
          ? { notifyTemplateId: dto.notifyTemplateId }
          : {}),
        ...(dto.notifySlotBindings !== undefined
          ? {
              notifySlotBindings:
                notifySlotBindings as unknown as Prisma.InputJsonValue,
            }
          : {}),
        ...(dto.buttonActions !== undefined
          ? {
              buttonActions:
                buttonActions as unknown as Prisma.InputJsonValue,
            }
          : {}),
        ...(dto.schedule !== undefined
          ? { schedule: dto.schedule as Prisma.InputJsonValue }
          : {}),
        ...(dto.sendsPerRun !== undefined ? { sendsPerRun: dto.sendsPerRun } : {}),
        ...(dto.sendIntervalSeconds !== undefined
          ? { sendIntervalSeconds: dto.sendIntervalSeconds }
          : {}),
      },
      select: CAMPAIGN_SELECT,
    });
  }

  async listSends(
    tenantId: number,
    listId: number,
    query: { status?: string; campaignId?: number },
  ) {
    await this.getListOrThrow(tenantId, listId);

    const where: Prisma.TenantListSendWhereInput = {
      campaign: { listId, list: { tenantId } },
      ...(query.campaignId !== undefined
        ? { campaignId: query.campaignId }
        : {}),
      ...(query.status === 'failed'
        ? { lastStatus: WhatsappDeliveryStatus.failed }
        : {}),
    };

    const sends = await this.prisma.tenantListSend.findMany({
      where,
      select: {
        id: true,
        wamid: true,
        sentAt: true,
        lastStatus: true,
        listLead: { select: { id: true, name: true, phone: true } },
        campaign: { select: { id: true, name: true } },
      },
      orderBy: { sentAt: 'desc' },
      take: DEFAULT_SEND_LIMIT,
    });

    const failedWamids = sends
      .filter((send) => send.lastStatus === WhatsappDeliveryStatus.failed)
      .map((send) => send.wamid);

    const latestErrors = await this.loadLatestFailedErrors(failedWamids);

    return sends.map((send) => ({
      id: send.id,
      wamid: send.wamid,
      sentAt: send.sentAt,
      lastStatus: send.lastStatus,
      listLead: send.listLead,
      campaign: send.campaign,
      ...(send.lastStatus === WhatsappDeliveryStatus.failed
        ? { latestError: latestErrors.get(send.wamid) ?? null }
        : {}),
    }));
  }

  private normalizeCampaignInput(dto: UpsertListCampaignDto): CampaignFields {
    const sendsPerRun = dto.sendsPerRun ?? 5;
    const sendIntervalSeconds = dto.sendIntervalSeconds ?? 5;
    if (sendsPerRun < 1) {
      throw new BadRequestException('sendsPerRun deve ser ≥ 1');
    }
    if (sendIntervalSeconds < 0) {
      throw new BadRequestException('sendIntervalSeconds deve ser ≥ 0');
    }
    if (!dto.name?.trim()) {
      throw new BadRequestException('name é obrigatório');
    }

    return {
      enabled: dto.enabled ?? false,
      templateId: dto.templateId,
      notifyTemplateId: dto.notifyTemplateId ?? null,
      slotBindings: assertSendSlotBindingsValid(dto.slotBindings),
      notifySlotBindings: assertNotifySlotBindingsValid(
        dto.notifySlotBindings ?? { notify: {} },
      ),
      buttonActions: assertButtonActionsValid(dto.buttonActions ?? []),
    };
  }

  private async assertEnableAllowed(fields: CampaignFields) {
    if (!fields.enabled) return;

    const sendTemplate = await this.prisma.whatsappMessageTemplate.findUnique({
      where: { id: fields.templateId },
      select: { id: true, status: true, slots: true, components: true },
    });
    if (!sendTemplate) {
      throw new BadRequestException(
        `Não é possível habilitar campanha: template ${fields.templateId} não encontrado`,
      );
    }

    this.assertApproved('send', sendTemplate.status);
    this.assertSlotCoverage(
      'send',
      'slotBindings',
      persistedSlotKeys(sendTemplate.slots),
      fields.slotBindings.send,
    );
    this.assertButtonLabelsMatchTemplate(
      sendTemplate.components,
      fields.buttonActions,
    );

    if (hasNotifyButtonAction(fields.buttonActions)) {
      if (fields.notifyTemplateId == null) {
        throw new BadRequestException(
          'Não é possível habilitar campanha: notifyTemplateId é obrigatório quando há ação NOTIFY',
        );
      }

      const notifyTemplate =
        await this.prisma.whatsappMessageTemplate.findUnique({
          where: { id: fields.notifyTemplateId },
          select: { id: true, status: true, slots: true },
        });
      if (!notifyTemplate) {
        throw new BadRequestException(
          `Não é possível habilitar campanha: template notify ${fields.notifyTemplateId} não encontrado`,
        );
      }

      this.assertApproved('notify', notifyTemplate.status);
      this.assertSlotCoverage(
        'notify',
        'notifySlotBindings',
        persistedSlotKeys(notifyTemplate.slots),
        fields.notifySlotBindings.notify,
      );
    }
  }

  private assertApproved(role: string, status: string) {
    if (status.trim().toUpperCase() !== 'APPROVED') {
      throw new BadRequestException(
        `Não é possível habilitar campanha: template ${role} deve estar APPROVED (status=${status})`,
      );
    }
  }

  private assertSlotCoverage(
    role: 'send' | 'notify',
    rootField: 'slotBindings' | 'notifySlotBindings',
    requiredKeys: string[],
    bindings: Record<string, SlotBindingInput>,
  ) {
    for (const key of requiredKeys) {
      const binding = bindings[key];
      if (!binding) {
        throw new BadRequestException(
          `Não é possível habilitar campanha: ${rootField}.${role} omite ${key}`,
        );
      }
      if (binding.type === 'literal' || binding.type === 'header_image') {
        if (!(binding.value ?? '').trim()) {
          throw new BadRequestException(
            `Não é possível habilitar campanha: ${rootField}.${role}.${key} exige value`,
          );
        }
      }
    }
  }

  private assertButtonLabelsMatchTemplate(
    components: Prisma.JsonValue,
    buttonActions: ButtonActionInput[],
  ) {
    const quickReplies = extractQuickReplyButtons(components);
    const byIndex = new Map(quickReplies.map((btn) => [btn.index, btn.label]));

    for (const action of buttonActions) {
      const templateLabel = byIndex.get(action.buttonIndex);
      if (templateLabel === undefined) {
        throw new BadRequestException(
          `Não é possível habilitar campanha: buttonIndex ${action.buttonIndex} não existe no template`,
        );
      }
      if (templateLabel !== action.label) {
        throw new BadRequestException(
          `Não é possível habilitar campanha: label "${action.label}" não corresponde ao botão do template ("${templateLabel}")`,
        );
      }
    }
  }

  private async loadLatestFailedErrors(
    wamids: string[],
  ): Promise<Map<string, Prisma.JsonValue | null>> {
    const result = new Map<string, Prisma.JsonValue | null>();
    if (wamids.length === 0) {
      return result;
    }

    const rows = await this.prisma.whatsappSendStatus.findMany({
      where: {
        wamid: { in: wamids },
        status: WhatsappDeliveryStatus.failed,
      },
      select: { wamid: true, errors: true, metaTimestamp: true },
      orderBy: { metaTimestamp: 'desc' },
    });

    for (const row of rows) {
      if (!result.has(row.wamid)) {
        result.set(row.wamid, row.errors);
      }
    }

    return result;
  }

  private async getListOrThrow(tenantId: number, listId: number) {
    const list = await this.prisma.tenantLeadList.findFirst({
      where: { id: listId, tenantId },
      select: { id: true },
    });
    if (!list) {
      throw new NotFoundException(
        `Lead list id=${listId} não encontrada para tenant ${tenantId}`,
      );
    }
    return list;
  }

  private async getCampaignOrThrow(
    tenantId: number,
    listId: number,
    campaignId: number,
  ) {
    await this.getListOrThrow(tenantId, listId);
    const campaign = await this.prisma.tenantListCampaign.findFirst({
      where: { id: campaignId, listId },
      select: CAMPAIGN_SELECT,
    });
    if (!campaign) {
      throw new NotFoundException(
        `Campanha id=${campaignId} não encontrada na lista ${listId}`,
      );
    }
    return campaign;
  }

  private asSendSlotBindings(raw: Prisma.JsonValue): SendSlotBindingsInput {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { send: {} };
    }
    const rec = raw as Record<string, unknown>;
    const send = isRecord(rec.send)
      ? (rec.send as Record<string, SlotBindingInput>)
      : {};
    return { send };
  }

  private asNotifySlotBindings(raw: Prisma.JsonValue): NotifySlotBindingsInput {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { notify: {} };
    }
    const rec = raw as Record<string, unknown>;
    const notify = isRecord(rec.notify)
      ? (rec.notify as Record<string, SlotBindingInput>)
      : {};
    return { notify };
  }

  private asButtonActions(raw: Prisma.JsonValue): ButtonActionInput[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    return assertButtonActionsValid(raw);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
