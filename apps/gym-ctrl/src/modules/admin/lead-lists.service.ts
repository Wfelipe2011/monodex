import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Roles } from '@prisma/client';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { assertSuperAdminTenantWrite } from '@core/guard/bootstrap-write';
import {
  normalizeCategoryKey,
  normalizeListPhone,
} from '@core/shared/list-campaign-helpers';
import { CreateLeadListDto } from './dto/create-lead-list.dto';
import { PatchLeadListDto } from './dto/patch-lead-list.dto';
import { CreateListLeadDto } from './dto/create-list-lead.dto';
import { PatchListLeadDto } from './dto/patch-list-lead.dto';
import { rejectForbiddenBodyKeys } from './reject-forbidden-body-keys';

const listSelect = {
  id: true,
  tenantId: true,
  name: true,
  costPerSend: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TenantLeadListSelect;

const leadSelect = {
  id: true,
  listId: true,
  name: true,
  phone: true,
  website: true,
  category: true,
  reviews: true,
  sendLockCampaignId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TenantListLeadSelect;

const CSV_HEADERS = ['name', 'phone', 'website', 'category', 'reviews'] as const;

type CsvRow = {
  name: string;
  phone: string;
  website?: string;
  category?: string;
  reviews?: number;
};

type LeadInput = {
  name: string;
  phone: string;
  website?: string | null;
  category?: string | null;
  reviews?: number | null;
};

@Injectable()
export class LeadListsService {
  constructor(private readonly prisma: PrismaService) {}

  async listLists(tenantId: number) {
    await this.assertTenantExists(tenantId);
    return this.prisma.tenantLeadList.findMany({
      where: { tenantId },
      select: listSelect,
      orderBy: { id: 'asc' },
    });
  }

  async createList(
    tenantId: number,
    dto: CreateLeadListDto,
    roles: Roles[],
    rawBody: unknown,
  ) {
    rejectForbiddenBodyKeys(rawBody, ['costPerSend']);
    await this.assertTenantExists(tenantId);
    const existingCount = await this.prisma.tenantLeadList.count({
      where: { tenantId },
    });
    if (roles?.includes(Roles.SUPER_ADMIN) && existingCount > 0) {
      throw new ForbiddenException('Acesso não permitido');
    }
    assertSuperAdminTenantWrite({
      roles,
      resourceCreatedAt: null,
      isPlatformField: false,
    });
    return this.prisma.tenantLeadList.create({
      data: {
        tenantId,
        name: dto.name,
        costPerSend: 0,
      },
      select: listSelect,
    });
  }

  async getList(tenantId: number, listId: number) {
    return this.getListOrThrow(tenantId, listId);
  }

  async patchList(
    tenantId: number,
    listId: number,
    dto: PatchLeadListDto,
    roles: Roles[],
    rawBody: unknown,
  ) {
    rejectForbiddenBodyKeys(rawBody, ['costPerSend']);
    const list = await this.getListOrThrow(tenantId, listId);
    assertSuperAdminTenantWrite({
      roles,
      resourceCreatedAt: list.createdAt,
      isPlatformField: false,
    });
    return this.prisma.tenantLeadList.update({
      where: { id: listId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
      },
      select: listSelect,
    });
  }

  async patchListCost(tenantId: number, listId: number, costPerSend: number) {
    await this.getListOrThrow(tenantId, listId);
    return this.prisma.tenantLeadList.update({
      where: { id: listId },
      data: { costPerSend },
      select: listSelect,
    });
  }

  async listLeads(tenantId: number, listId: number) {
    await this.getListOrThrow(tenantId, listId);
    return this.prisma.tenantListLead.findMany({
      where: { listId },
      select: leadSelect,
      orderBy: { id: 'asc' },
    });
  }

  async createLead(
    tenantId: number,
    listId: number,
    dto: CreateListLeadDto,
    roles: Roles[],
  ) {
    const list = await this.getListOrThrow(tenantId, listId);
    this.assertListWrite(roles, list.createdAt);
    const data = this.normalizeLeadInput(dto);
    await this.assertPhoneNotDuplicate(listId, data.phone);
    return this.prisma.tenantListLead.create({
      data: { listId, ...data },
      select: leadSelect,
    });
  }

  async bulkCreateLeads(
    tenantId: number,
    listId: number,
    leads: CreateListLeadDto[],
    roles: Roles[],
  ) {
    const list = await this.getListOrThrow(tenantId, listId);
    this.assertListWrite(roles, list.createdAt);
    const normalized = leads.map((lead) => this.normalizeLeadInput(lead));
    this.assertNoDuplicatePhonesInBatch(normalized);
    return this.createLeadsInTransaction(listId, normalized);
  }

  async getLead(tenantId: number, listId: number, leadId: number) {
    return this.getLeadOrThrow(tenantId, listId, leadId);
  }

  async patchLead(
    tenantId: number,
    listId: number,
    leadId: number,
    dto: PatchListLeadDto,
    roles: Roles[],
  ) {
    const list = await this.getListOrThrow(tenantId, listId);
    this.assertListWrite(roles, list.createdAt);
    const existing = await this.getLeadOrThrow(tenantId, listId, leadId);

    let phone = existing.phone;
    if (dto.phone !== undefined) {
      phone = this.normalizePhoneOrThrow(dto.phone);
      if (phone !== existing.phone) {
        await this.assertPhoneNotDuplicate(listId, phone, leadId);
      }
    }

    return this.prisma.tenantListLead.update({
      where: { id: leadId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.phone !== undefined ? { phone } : {}),
        ...(dto.website !== undefined ? { website: dto.website || null } : {}),
        ...(dto.category !== undefined ? { category: dto.category || null } : {}),
        ...(dto.reviews !== undefined ? { reviews: dto.reviews } : {}),
      },
      select: leadSelect,
    });
  }

  async deleteLead(
    tenantId: number,
    listId: number,
    leadId: number,
    roles: Roles[],
  ) {
    const list = await this.getListOrThrow(tenantId, listId);
    this.assertListWrite(roles, list.createdAt);
    const existing = await this.getLeadOrThrow(tenantId, listId, leadId);
    await this.prisma.tenantListLead.delete({ where: { id: leadId } });
    return existing;
  }

  getImportTemplateCsv(): string {
    return [
      CSV_HEADERS.join(','),
      'Construtora Exemplo,(11) 98765-4321,https://exemplo.com.br,Construtoras,42',
      'Empresa Demo,11999887766,,Serviços,0',
    ].join('\n');
  }

  async importCsv(
    tenantId: number,
    listId: number,
    buffer: Buffer,
    roles: Roles[],
  ) {
    const list = await this.getListOrThrow(tenantId, listId);
    this.assertListWrite(roles, list.createdAt);
    const rows = this.parseCsv(buffer);
    const normalized = rows.map((row) => this.normalizeLeadInput(row));
    this.assertNoDuplicatePhonesInBatch(normalized);
    return this.createLeadsInTransaction(listId, normalized);
  }

  async categorySuggestions(tenantId: number): Promise<string[]> {
    await this.assertTenantExists(tenantId);

    const [tenantLeadCategories, listLeadCategories] = await Promise.all([
      this.prisma.tenantLead.findMany({
        where: { tenantId },
        select: { lead: { select: { category: true } } },
      }),
      this.prisma.tenantListLead.findMany({
        where: { list: { tenantId } },
        select: { category: true },
      }),
    ]);

    const seen = new Set<string>();
    const result: string[] = [];

    for (const value of [
      ...tenantLeadCategories.map((row) => row.lead.category),
      ...listLeadCategories.map((row) => row.category),
    ]) {
      if (!value?.trim()) {
        continue;
      }
      const key = normalizeCategoryKey(value);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push(value.trim());
    }

    return result.sort((a, b) =>
      a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
    );
  }

  private assertListWrite(roles: Roles[], createdAt: Date) {
    assertSuperAdminTenantWrite({
      roles,
      resourceCreatedAt: createdAt,
      isPlatformField: false,
    });
  }

  private async assertTenantExists(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
    }
  }

  private async getListOrThrow(tenantId: number, listId: number) {
    const list = await this.prisma.tenantLeadList.findFirst({
      where: { id: listId, tenantId },
      select: listSelect,
    });
    if (!list) {
      throw new NotFoundException(
        `Lead list id=${listId} não encontrada para tenant ${tenantId}`,
      );
    }
    return list;
  }

  private async getLeadOrThrow(
    tenantId: number,
    listId: number,
    leadId: number,
  ) {
    await this.getListOrThrow(tenantId, listId);
    const lead = await this.prisma.tenantListLead.findFirst({
      where: { id: leadId, listId },
      select: leadSelect,
    });
    if (!lead) {
      throw new NotFoundException(
        `Lead id=${leadId} não encontrado na lista ${listId}`,
      );
    }
    return lead;
  }

  private normalizePhoneOrThrow(raw: string): string {
    const phone = normalizeListPhone(raw);
    if (!phone) {
      throw new BadRequestException('phone inválido ou vazio após normalização');
    }
    return phone;
  }

  private normalizeLeadInput(input: LeadInput | CreateListLeadDto): LeadInput {
    const phone = this.normalizePhoneOrThrow(input.phone);
    if (!input.name?.trim()) {
      throw new BadRequestException('name é obrigatório');
    }
    if (
      input.reviews !== undefined &&
      input.reviews !== null &&
      (!Number.isInteger(input.reviews) || input.reviews < 0)
    ) {
      throw new BadRequestException('reviews deve ser inteiro ≥ 0');
    }
    return {
      name: input.name.trim(),
      phone,
      website: input.website?.trim() || null,
      category: input.category?.trim() || null,
      reviews: input.reviews ?? null,
    };
  }

  private async assertPhoneNotDuplicate(
    listId: number,
    phone: string,
    excludeLeadId?: number,
  ) {
    const existing = await this.prisma.tenantListLead.findFirst({
      where: {
        listId,
        phone,
        ...(excludeLeadId !== undefined ? { NOT: { id: excludeLeadId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        `Telefone ${phone} já existe nesta lista (lead id=${existing.id})`,
      );
    }
  }

  private assertNoDuplicatePhonesInBatch(leads: LeadInput[]) {
    const seen = new Set<string>();
    for (const lead of leads) {
      if (seen.has(lead.phone)) {
        throw new BadRequestException(
          `Telefone duplicado no lote: ${lead.phone}`,
        );
      }
      seen.add(lead.phone);
    }
  }

  private async createLeadsInTransaction(listId: number, leads: LeadInput[]) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.tenantListLead.findMany({
        where: {
          listId,
          phone: { in: leads.map((lead) => lead.phone) },
        },
        select: { phone: true },
      });
      if (existing.length > 0) {
        throw new BadRequestException(
          `Telefone(s) já existem na lista: ${existing.map((row) => row.phone).join(', ')}`,
        );
      }

      if (leads.length === 0) {
        return { created: 0 };
      }

      const result = await tx.tenantListLead.createMany({
        data: leads.map((lead) => ({ listId, ...lead })),
      });

      return { created: result.count };
    });
  }

  private parseCsv(buffer: Buffer): CsvRow[] {
    const text = buffer.toString('utf-8').replace(/^\uFEFF/, '');
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      throw new BadRequestException('CSV vazio');
    }

    const headerCells = this.parseCsvLine(lines[0]);
    const headerIndex = this.buildHeaderIndex(headerCells);

    const rows: CsvRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = this.parseCsvLine(lines[i]);
      const name = this.cellValue(cells, headerIndex, 'name');
      const phone = this.cellValue(cells, headerIndex, 'phone');
      if (!name) {
        throw new BadRequestException(`Linha ${i + 1}: name é obrigatório`);
      }
      if (!phone) {
        throw new BadRequestException(`Linha ${i + 1}: phone é obrigatório`);
      }

      const reviewsRaw = this.cellValue(cells, headerIndex, 'reviews');
      let reviews: number | undefined;
      if (reviewsRaw) {
        const parsed = Number.parseInt(reviewsRaw, 10);
        if (!Number.isInteger(parsed) || parsed < 0) {
          throw new BadRequestException(
            `Linha ${i + 1}: reviews deve ser inteiro ≥ 0`,
          );
        }
        reviews = parsed;
      }

      rows.push({
        name,
        phone,
        website: this.cellValue(cells, headerIndex, 'website') || undefined,
        category: this.cellValue(cells, headerIndex, 'category') || undefined,
        reviews,
      });
    }

    return rows;
  }

  private buildHeaderIndex(headerCells: string[]): Map<string, number> {
    const index = new Map<string, number>();
    headerCells.forEach((cell, i) => {
      const key = cell.trim().toLowerCase();
      if (key) {
        index.set(key, i);
      }
    });

    for (const required of ['name', 'phone']) {
      if (!index.has(required)) {
        throw new BadRequestException(
          `CSV deve conter coluna "${required}" no cabeçalho`,
        );
      }
    }

    return index;
  }

  private cellValue(
    cells: string[],
    headerIndex: Map<string, number>,
    column: (typeof CSV_HEADERS)[number],
  ): string {
    const idx = headerIndex.get(column);
    if (idx === undefined) {
      return '';
    }
    return (cells[idx] ?? '').trim();
  }

  private parseCsvLine(line: string): string[] {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (char === ',' && !inQuotes) {
        cells.push(current);
        current = '';
        continue;
      }
      current += char;
    }

    cells.push(current);
    return cells;
  }
}
