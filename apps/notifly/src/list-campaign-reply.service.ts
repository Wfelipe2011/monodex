import { PrismaService } from '@core/infra/prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import {
  ListCampaignButtonAction,
  Prisma,
  Tenant,
  TenantListLead,
  TenantListSend,
  WhatsappConversationDirection,
  WhatsappMessageTemplate,
} from '@prisma/client';
import { normalizeListPhone } from '@core/shared/list-campaign-helpers';
import {
  resolveBindingValue,
  SlotBinding,
} from '@core/shared/whatsapp-template-bindings';
import { TemplateSlot } from '@core/shared/whatsapp-template-slots';
import { buildTemplateSendBody } from '@core/shared/whatsapp-template-payload';
import { Message } from './interfaces';
import { PlatformWhatsappService } from './platform-whatsapp.service';
import { WhatsAppSendMessageResponse } from './WhatsAppSendMessageResponse';

type ButtonActionRow = {
  buttonIndex: number;
  label: string;
  action: ListCampaignButtonAction;
};

type ListSendWithRelations = TenantListSend & {
  listLead: TenantListLead;
  campaign: {
    id: number;
    buttonActions: Prisma.JsonValue;
    notifyTemplateId: number | null;
    notifySlotBindings: Prisma.JsonValue;
    notifyTemplate: WhatsappMessageTemplate | null;
    list: { tenant: Tenant };
  };
};

@Injectable()
export class ListCampaignReplyService {
  private readonly logger = new Logger(ListCampaignReplyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly platformWhatsapp: PlatformWhatsappService,
  ) {}

  async handleButtonReply(msg: Message, listSend: TenantListSend): Promise<void> {
    if (msg.type !== 'button' || !msg.button?.text) {
      return;
    }

    const send = await this.prisma.tenantListSend.findUnique({
      where: { id: listSend.id },
      include: {
        listLead: true,
        campaign: {
          include: {
            notifyTemplate: true,
            list: { include: { tenant: true } },
          },
        },
      },
    });

    if (!send) {
      this.logger.warn(
        `[handleButtonReply] TenantListSend ${listSend.id} não encontrado`,
      );
      return;
    }

    const typedSend = send as ListSendWithRelations;
    const buttonText = msg.button.text.trim();
    const actions = this.asButtonActions(typedSend.campaign.buttonActions);
    const matched = actions.find((a) => a.label === buttonText);

    if (!matched) {
      this.logger.log(
        `[handleButtonReply] Botão "${buttonText}" sem ação mapeada (campanha ${typedSend.campaign.id})`,
      );
      return;
    }

    if (matched.action === ListCampaignButtonAction.NOOP) {
      this.logger.log(
        `[handleButtonReply] NOOP para botão "${buttonText}" send=${send.id}`,
      );
      return;
    }

    await this.handleNotify(typedSend, msg);
  }

  private async handleNotify(send: ListSendWithRelations, msg: Message) {
    const campaign = send.campaign;
    const tenant = campaign.list.tenant;
    const notifyTemplate = campaign.notifyTemplate;

    if (!campaign.notifyTemplateId || !notifyTemplate) {
      this.logger.warn(
        `[handleNotify] Campanha ${campaign.id} sem notifyTemplateId; pulando`,
      );
      return;
    }

    if (notifyTemplate.status.toUpperCase() !== 'APPROVED') {
      this.logger.warn(
        `[handleNotify] notifyTemplate ${notifyTemplate.id} status≠APPROVED; pulando`,
      );
      return;
    }

    if (!tenant.phone) {
      this.logger.warn(
        `[handleNotify] Tenant ${tenant.id} sem phone; pulando notify`,
      );
      return;
    }

    const slots = this.asSlots(notifyTemplate.slots);
    const bindings = this.roleBindings(campaign.notifySlotBindings, 'notify');
    const values = this.resolveRoleValues(slots, bindings, {
      recipient: send.listLead,
      tenant,
    });

    if (!values) {
      this.logger.warn(
        `[handleNotify] bindings notify inválidos campanha ${campaign.id}`,
      );
      return;
    }

    const { messagesUrl, token } =
      await this.platformWhatsapp.resolveCredentials(tenant.id);
    const sendBody = buildTemplateSendBody({
      name: notifyTemplate.name,
      language: notifyTemplate.language,
      slots,
      values,
    });
    const to = normalizeListPhone(tenant.phone);

    const res = await this.httpService.axiosRef.post<WhatsAppSendMessageResponse>(
      messagesUrl,
      {
        ...sendBody,
        recipient_type: 'individual',
        to,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const wamid = res.data.messages[0].id;

    await this.prisma.whatsappConversationMessage.create({
      data: {
        wamid,
        direction: WhatsappConversationDirection.OUT,
        type: 'template',
        body: notifyTemplate.name,
        raw: {
          ...sendBody,
          to,
          replyToButton: msg.button?.text ?? null,
        } as unknown as Prisma.InputJsonValue,
        phone: to,
        tenantId: tenant.id,
        listLeadId: send.listLeadId,
        listSendId: send.id,
      },
    });

    this.logger.log(
      `[handleNotify] Notify enviado ao tenant ${tenant.id} wamid=${wamid} (reply send=${send.id})`,
    );
  }

  private asButtonActions(value: Prisma.JsonValue): ButtonActionRow[] {
    if (!Array.isArray(value)) {
      return [];
    }
    const out: ButtonActionRow[] = [];
    for (const item of value) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        continue;
      }
      const rec = item as Record<string, unknown>;
      if (
        typeof rec.label !== 'string' ||
        typeof rec.action !== 'string'
      ) {
        continue;
      }
      out.push({
        buttonIndex: Number(rec.buttonIndex ?? 0),
        label: rec.label.trim(),
        action: rec.action as ListCampaignButtonAction,
      });
    }
    return out;
  }

  private asSlots(value: Prisma.JsonValue): TemplateSlot[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value as TemplateSlot[];
  }

  private roleBindings(
    slotBindings: Prisma.JsonValue,
    role: 'send' | 'notify',
  ): Record<string, SlotBinding> {
    if (
      !slotBindings ||
      typeof slotBindings !== 'object' ||
      Array.isArray(slotBindings)
    ) {
      return {};
    }
    const roleObj = (slotBindings as Record<string, unknown>)[role];
    if (!roleObj || typeof roleObj !== 'object' || Array.isArray(roleObj)) {
      return {};
    }
    const out: Record<string, SlotBinding> = {};
    for (const [key, raw] of Object.entries(roleObj as Record<string, unknown>)) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        continue;
      }
      const rec = raw as Record<string, unknown>;
      if (typeof rec.type !== 'string') {
        continue;
      }
      out[key] = {
        type: rec.type,
        value:
          typeof rec.value === 'string'
            ? rec.value
            : rec.value == null
              ? null
              : String(rec.value),
      };
    }
    return out;
  }

  private resolveRoleValues(
    slots: TemplateSlot[],
    bindings: Record<string, SlotBinding>,
    ctx: { recipient: TenantListLead; tenant: Tenant },
  ): Record<string, string> | null {
    const now = new Date();
    const resolveCtx = {
      recipient: {
        name: ctx.recipient.name,
        phone: ctx.recipient.phone,
        category: ctx.recipient.category,
        website: ctx.recipient.website,
        reviews: ctx.recipient.reviews,
      },
      tenant: { phone: ctx.tenant.phone },
      now,
    };
    const values: Record<string, string> = {};
    for (const slot of slots) {
      const binding = bindings[slot.key];
      if (!binding) {
        this.logger.warn(
          `[resolveRoleValues] binding ausente para slot ${slot.key}`,
        );
        return null;
      }
      const value = resolveBindingValue(binding, resolveCtx);
      if (
        (binding.type === 'literal' || binding.type === 'header_image') &&
        !value
      ) {
        return null;
      }
      values[slot.key] = value;
    }
    return values;
  }
}
