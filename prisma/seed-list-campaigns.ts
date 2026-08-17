/**
 * Idempotent seed: demo TenantLeadList + leads + disabled TenantListCampaign.
 *
 * Prerequisite: run seed-outreach first (or have APPROVED templates in catalog).
 *
 * Tenant resolution:
 * - Uses TENANT_ID env when set
 * - Otherwise defaults to id 8 (same as seed-outreach)
 *
 * Usage: npx ts-node prisma/seed-list-campaigns.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

const DEFAULT_OPERATIONAL_TENANT_ID = 8;
const LIST_NAME = 'Demo List (seed)';
const CAMPAIGN_NAME = 'Demo Campaign (seed)';

const OUTREACH_TEMPLATE_NAME = 'test_gladson';
const NOTIFY_TEMPLATE_NAME = 'lembrete_entrar_contato_interessado';

const DEMO_LEADS = [
  {
    name: 'Lead Demo 1',
    phone: '5511911111111',
    category: 'Construtoras',
    reviews: 10,
  },
  {
    name: 'Lead Demo 2',
    phone: '5511922222222',
    category: 'Construtoras',
    reviews: 5,
  },
];

const SCHEDULE = { '2': [18], '4': [13] };

const prisma = new PrismaClient();

async function resolveOperationalTenantId(): Promise<number> {
  const fromEnv = process.env.TENANT_ID;
  if (fromEnv) {
    const parsed = Number(fromEnv);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(
        `TENANT_ID inválido: "${fromEnv}". Informe um inteiro positivo.`,
      );
    }
    const tenant = await prisma.tenant.findUnique({ where: { id: parsed } });
    if (!tenant) {
      throw new Error(
        `Tenant id=${parsed} (TENANT_ID) não encontrado. Cadastre o tenant ou ajuste TENANT_ID.`,
      );
    }
    return tenant.id;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: DEFAULT_OPERATIONAL_TENANT_ID },
  });
  if (!tenant) {
    throw new Error(
      `Tenant operacional padrão id=${DEFAULT_OPERATIONAL_TENANT_ID} não existe. ` +
        `Passe TENANT_ID=<id> (ex.: TENANT_ID=4 npx ts-node prisma/seed-list-campaigns.ts).`,
    );
  }
  return tenant.id;
}

async function findTemplateByName(name: string) {
  const template = await prisma.whatsappMessageTemplate.findFirst({
    where: { name, status: 'APPROVED' },
    orderBy: { id: 'asc' },
  });
  if (!template) {
    throw new Error(
      `Template APPROVED "${name}" não encontrado. Execute seed-outreach ou sync do catálogo primeiro.`,
    );
  }
  return template;
}

function defaultSendSlotBindings(headerImageUrl?: string) {
  const send: Record<string, { type: string; value?: string }> = {
    'body.1': {
      type: 'literal',
      value: 'Gladson Teixeira (contador em Pindamonhagaba)',
    },
    'header.image': {
      type: 'header_image',
      value: headerImageUrl ?? '',
    },
  };
  return { send };
}

function defaultNotifySlotBindings() {
  return {
    notify: {
      'body.customer_name': { type: 'recipient.name' },
      'body.customer_phone': { type: 'recipient.phone' },
      'body.customer_lead': { type: 'literal', value: 'customer_lead' },
    },
  };
}

async function upsertDemoList(tenantId: number) {
  const existing = await prisma.tenantLeadList.findFirst({
    where: { tenantId, name: LIST_NAME },
  });
  if (existing) {
    console.log(
      `[seed-list-campaigns] TenantLeadList exists id=${existing.id} name="${LIST_NAME}"`,
    );
    return existing;
  }

  const created = await prisma.tenantLeadList.create({
    data: {
      tenantId,
      name: LIST_NAME,
      costPerSend: 1.5,
    },
  });
  console.log(`[seed-list-campaigns] TenantLeadList created id=${created.id}`);
  return created;
}

async function ensureDemoLeads(listId: number) {
  let created = 0;
  for (const lead of DEMO_LEADS) {
    const existing = await prisma.tenantListLead.findUnique({
      where: { listId_phone: { listId, phone: lead.phone } },
    });
    if (existing) {
      console.log(
        `[seed-list-campaigns] TenantListLead exists id=${existing.id} phone=${lead.phone}`,
      );
      continue;
    }
    await prisma.tenantListLead.create({
      data: { listId, ...lead },
    });
    created += 1;
    console.log(
      `[seed-list-campaigns] TenantListLead created phone=${lead.phone}`,
    );
  }
  return created;
}

async function upsertDemoCampaign(
  listId: number,
  sendTemplateId: number,
  notifyTemplateId: number,
) {
  const existing = await prisma.tenantListCampaign.findFirst({
    where: { listId, name: CAMPAIGN_NAME },
  });

  const headerImageUrl = process.env.WHATSAPP_OUTREACH_HEADER_IMAGE_URL?.trim();
  const slotBindings = defaultSendSlotBindings(headerImageUrl);
  const notifySlotBindings = defaultNotifySlotBindings();

  if (existing) {
    console.log(
      `[seed-list-campaigns] TenantListCampaign exists id=${existing.id} enabled=${existing.enabled}`,
    );
    return existing;
  }

  const created = await prisma.tenantListCampaign.create({
    data: {
      listId,
      name: CAMPAIGN_NAME,
      enabled: false,
      templateId: sendTemplateId,
      slotBindings: slotBindings as Prisma.InputJsonValue,
      notifyTemplateId,
      notifySlotBindings: notifySlotBindings as Prisma.InputJsonValue,
      buttonActions: [] as Prisma.InputJsonValue,
      schedule: SCHEDULE as Prisma.InputJsonValue,
      sendsPerRun: 5,
      sendIntervalSeconds: 5,
    },
  });
  console.log(
    `[seed-list-campaigns] TenantListCampaign created id=${created.id} (disabled)`,
  );
  return created;
}

async function main() {
  const tenantId = await resolveOperationalTenantId();
  const sendTemplate = await findTemplateByName(OUTREACH_TEMPLATE_NAME);
  const notifyTemplate = await findTemplateByName(NOTIFY_TEMPLATE_NAME);

  const list = await upsertDemoList(tenantId);
  const leadsCreated = await ensureDemoLeads(list.id);
  const campaign = await upsertDemoCampaign(
    list.id,
    sendTemplate.id,
    notifyTemplate.id,
  );

  console.log('[seed-list-campaigns] Done.', {
    tenantId,
    listId: list.id,
    leadsCreated,
    campaignId: campaign.id,
    sendTemplateId: sendTemplate.id,
    notifyTemplateId: notifyTemplate.id,
  });
}

main()
  .catch((err) => {
    console.error('[seed-list-campaigns] Failed:', err.message ?? err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
