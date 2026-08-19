import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvitePurpose, Prisma, Roles } from '@prisma/client';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import {
  DEFAULT_INVITE_TTL_HOURS,
  generateInviteToken,
  hashInviteToken,
  inviteExpiresAt,
} from '@core/shared/invite-token';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { AcceptInviteDto, PreviewInviteResponseDto } from './dto/accept-invite.dto';
import {
  InviteListItemDto,
  InviteStatus,
  IssuedInviteResponseDto,
} from './dto/invite-response.dto';

const BCRYPT_ROUNDS = 10;
const PUBLIC_RATE_MAX = 20;
const PUBLIC_RATE_WINDOW_MS = 15 * 60 * 1000;
const INVITE_NOT_FOUND = 'Convite não encontrado';

const inviteLiveSelect = {
  id: true,
  tenantId: true,
  purpose: true,
  expiresAt: true,
  consumedAt: true,
  revokedAt: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
  tenant: { select: { id: true, name: true, active: true } },
} satisfies Prisma.InviteSelect;

type InviteLiveRow = Prisma.InviteGetPayload<{
  select: typeof inviteLiveSelect;
}>;

const acceptUserSelect = {
  id: true,
  name: true,
  username: true,
  email: true,
  roles: true,
  uuid: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const invitePublicSelect = {
  id: true,
  tenantId: true,
  purpose: true,
  expiresAt: true,
  consumedAt: true,
  revokedAt: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.InviteSelect;

type InvitePublicRow = Prisma.InviteGetPayload<{
  select: typeof invitePublicSelect;
}>;

export function deriveInviteStatus(
  invite: {
    consumedAt: Date | null;
    revokedAt: Date | null;
    expiresAt: Date;
  },
  now = new Date(),
): InviteStatus {
  if (invite.consumedAt) return 'CONSUMED';
  if (invite.revokedAt) return 'REVOKED';
  if (invite.expiresAt.getTime() <= now.getTime()) return 'EXPIRED';
  return 'PENDING';
}

@Injectable()
export class InvitesService {
  private readonly hitsByIp = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {}

  async preview(
    rawToken: string,
    ip: string,
  ): Promise<PreviewInviteResponseDto> {
    this.assertPublicRateLimit(ip);
    const invite = await this.resolveLiveInvite(rawToken);
    return {
      purpose: invite.purpose,
      tenantName: invite.tenant.name,
      tenantId: invite.tenantId,
      expiresAt: invite.expiresAt,
    };
  }

  async accept(rawToken: string, dto: AcceptInviteDto, ip: string) {
    this.assertPublicRateLimit(ip);
    const invite = await this.resolveLiveInvite(rawToken);
    if (!invite.tenant.active) {
      throw new ForbiddenException('Acesso não permitido');
    }

    if (invite.purpose === InvitePurpose.FIRST_ADMIN) {
      const existingCount = await this.prisma.user.count({
        where: { tenantId: invite.tenantId },
      });
      if (existingCount > 0) {
        await this.prisma.invite.update({
          where: { id: invite.id },
          data: { revokedAt: new Date() },
        });
        throw new ConflictException('Tenant já possui usuários');
      }
    }

    const roles =
      invite.purpose === InvitePurpose.FIRST_ADMIN
        ? [Roles.ADMIN]
        : [Roles.USER];
    const hashed = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    let user: Prisma.UserGetPayload<{ select: typeof acceptUserSelect }>;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name: dto.name,
            username: dto.username,
            email: dto.email.toLowerCase(),
            password: hashed,
            roles,
            tenantId: invite.tenantId,
          },
          select: acceptUserSelect,
        });
        await tx.invite.update({
          where: { id: invite.id },
          data: { consumedAt: new Date() },
        });
        return created;
      });
    } catch (error) {
      this.rethrowUnique(error);
    }

    return this.authService.issueJwt(user);
  }

  async issueFirstAdmin(
    tenantId: number,
    createdByUserId: number,
  ): Promise<IssuedInviteResponseDto> {
    await this.ensureTenant(tenantId);
    const existingCount = await this.prisma.user.count({ where: { tenantId } });
    if (existingCount > 0) {
      throw new ConflictException('Tenant já possui usuários');
    }

    const raw = generateInviteToken();
    const now = new Date();
    const expiresAt = inviteExpiresAt(now, this.ttlHours());

    const invite = await this.prisma.$transaction(async (tx) => {
      await tx.invite.updateMany({
        where: {
          tenantId,
          purpose: InvitePurpose.FIRST_ADMIN,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      });
      return tx.invite.create({
        data: {
          tenantId,
          purpose: InvitePurpose.FIRST_ADMIN,
          tokenHash: hashInviteToken(raw),
          expiresAt,
          createdByUserId,
        },
        select: invitePublicSelect,
      });
    });

    return this.toIssued(invite, raw);
  }

  async issueTenantUser(
    tenantId: number,
    createdByUserId: number,
    roles: Roles[],
  ): Promise<IssuedInviteResponseDto> {
    this.rejectSuperAdminWrite(roles);
    await this.ensureTenant(tenantId);

    const raw = generateInviteToken();
    const now = new Date();
    const expiresAt = inviteExpiresAt(now, this.ttlHours());

    const invite = await this.prisma.invite.create({
      data: {
        tenantId,
        purpose: InvitePurpose.TENANT_USER,
        tokenHash: hashInviteToken(raw),
        expiresAt,
        createdByUserId,
      },
      select: invitePublicSelect,
    });

    return this.toIssued(invite, raw);
  }

  async listByTenant(
    tenantId: number,
    purpose: InvitePurpose,
  ): Promise<InviteListItemDto[]> {
    await this.ensureTenant(tenantId);
    const rows = await this.prisma.invite.findMany({
      where: { tenantId, purpose },
      select: invitePublicSelect,
      orderBy: { id: 'desc' },
    });
    const now = new Date();
    return rows.map((row) => this.toListItem(row, now));
  }

  async revoke(
    tenantId: number,
    inviteId: number,
    purpose: InvitePurpose,
    roles?: Roles[],
  ): Promise<InviteListItemDto> {
    if (purpose === InvitePurpose.TENANT_USER) {
      this.rejectSuperAdminWrite(roles);
    }
    await this.ensureTenant(tenantId);

    const invite = await this.prisma.invite.findFirst({
      where: { id: inviteId, tenantId, purpose },
      select: invitePublicSelect,
    });
    if (!invite) {
      throw new NotFoundException(`Convite ${inviteId} não encontrado`);
    }
    if (deriveInviteStatus(invite) !== 'PENDING') {
      throw new ConflictException('Convite não está pendente');
    }

    const revokedAt = new Date();
    const updated = await this.prisma.invite.update({
      where: { id: inviteId },
      data: { revokedAt },
      select: invitePublicSelect,
    });
    return this.toListItem(updated, revokedAt);
  }

  private rejectSuperAdminWrite(roles?: Roles[]) {
    if (roles?.includes(Roles.SUPER_ADMIN)) {
      throw new ForbiddenException('Acesso não permitido');
    }
  }

  private ttlHours(): number {
    const raw = this.config.get<number | string>('INVITE_TTL_HOURS');
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    return DEFAULT_INVITE_TTL_HOURS;
  }

  private publicUrl(rawToken: string): string {
    const base = String(this.config.get<string>('INVITE_PUBLIC_BASE_URL') ?? '')
      .trim()
      .replace(/\/+$/, '');
    return base ? `${base}/convite/${rawToken}` : `/convite/${rawToken}`;
  }

  private toIssued(
    invite: InvitePublicRow,
    rawToken: string,
  ): IssuedInviteResponseDto {
    return {
      id: invite.id,
      purpose: invite.purpose,
      token: rawToken,
      url: this.publicUrl(rawToken),
      expiresAt: invite.expiresAt,
    };
  }

  private toListItem(
    invite: InvitePublicRow,
    now = new Date(),
  ): InviteListItemDto {
    return {
      id: invite.id,
      tenantId: invite.tenantId,
      purpose: invite.purpose,
      status: deriveInviteStatus(invite, now),
      expiresAt: invite.expiresAt,
      consumedAt: invite.consumedAt,
      revokedAt: invite.revokedAt,
      createdByUserId: invite.createdByUserId,
      createdAt: invite.createdAt,
      updatedAt: invite.updatedAt,
    };
  }

  private async ensureTenant(tenantId: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} não encontrado`);
    }
  }

  private async resolveLiveInvite(rawToken: string): Promise<InviteLiveRow> {
    const tokenHash = hashInviteToken(String(rawToken ?? '').trim());
    const invite = await this.prisma.invite.findUnique({
      where: { tokenHash },
      select: inviteLiveSelect,
    });
    if (!invite || deriveInviteStatus(invite) !== 'PENDING') {
      throw new NotFoundException(INVITE_NOT_FOUND);
    }
    return invite;
  }

  private assertPublicRateLimit(ip: string) {
    const now = Date.now();
    const windowStart = now - PUBLIC_RATE_WINDOW_MS;
    const recent = (this.hitsByIp.get(ip) ?? []).filter((ts) => ts > windowStart);
    if (recent.length >= PUBLIC_RATE_MAX) {
      this.hitsByIp.set(ip, recent);
      throw new HttpException(
        'Muitas tentativas. Tente novamente mais tarde.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.hitsByIp.set(ip, recent);
  }

  private rethrowUnique(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta.target as string[]).join(', ')
        : String(error.meta?.target ?? 'email/username');
      throw new ConflictException(`Valor único já em uso (${target})`);
    }
    throw error;
  }
}
