import * as jwt from 'jsonwebtoken';
import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from '@prisma/client';
import { UserToken } from '../contracts/user-token';
import { IS_PUBLIC_KEY } from '@core/decorators/public.decorator';
import { API_KEY_ALLOWLIST_KEY } from '@core/decorators/api-key-allowlist.decorator';
import { RequestUser } from '@core/contracts/request-user';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { hashApiKey } from '@core/shared/api-key';

@Injectable()
export class AuthGuard implements CanActivate {
  logger = new Logger(AuthGuard.name);

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<RequestUser>();
    if (isPublic) {
      this.logger.log(`Rota pública - ${request.url} - ${request.method}`);
      return true;
    }

    const rawApiKey = this.extractApiKeyFromHeader(request);
    const hasAuthorization = this.hasAuthorizationHeader(request);

    if (rawApiKey && hasAuthorization) {
      throw new BadRequestException(
        'Informe Authorization Bearer ou X-API-KEY, não ambos',
      );
    }

    if (rawApiKey) {
      await this.authenticateWithApiKey(request, context, rawApiKey);
      return true;
    }

    const token = this.extractTokenFromHeader(request);
    this.logger.log(`Rota privada - ${request.url} - ${request.method} - ${token}`);
    const payload = this.validateToken(token);
    request['user'] = payload;
    return true;
  }

  private async authenticateWithApiKey(
    request: RequestUser,
    context: ExecutionContext,
    rawApiKey: string,
  ): Promise<void> {
    const keyHash = hashApiKey(rawApiKey);
    const apiKey = await this.prisma.tenantApiKey.findUnique({
      where: { keyHash },
      include: { tenant: { select: { id: true, apiAccessEnabled: true } } },
    });

    if (
      !apiKey ||
      apiKey.revokedAt != null ||
      !apiKey.tenant ||
      !apiKey.tenant.apiAccessEnabled
    ) {
      throw new UnauthorizedException('Não autorizado');
    }

    const allowlisted = this.reflector.getAllAndOverride<boolean>(
      API_KEY_ALLOWLIST_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!allowlisted) {
      throw new UnauthorizedException('Não autorizado');
    }

    const user = new UserToken(0, 0, '', apiKey.tenantId, [Roles.ADMIN]);
    user.authKind = 'api_key';
    user.apiKeyId = apiKey.id;
    request.user = user;

    void this.prisma.tenantApiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((error: Error) => {
        this.logger.warn(
          `Falha ao atualizar lastUsedAt da API key ${apiKey.id}: ${error.message}`,
        );
      });
  }

  private extractApiKeyFromHeader(request: RequestUser): string | undefined {
    const header = request?.headers?.['x-api-key'];
    if (header == null || header === '') {
      return undefined;
    }
    const value = Array.isArray(header) ? header[0] : header;
    return value?.trim() || undefined;
  }

  private hasAuthorizationHeader(request: any): boolean {
    if (request?.headers?.authorization) {
      return true;
    }
    if (request?.handshake?.auth?.token) {
      return true;
    }
    return false;
  }

  private extractTokenFromHeader(request: any): string {
    let token = '';
    if (request?.headers?.authorization) {
      token = request?.headers?.authorization;
    } else if (request?.handshake?.auth?.token) {
      token = request?.handshake?.auth?.token;
    }
    if (!token) {
      throw new UnauthorizedException('Token não encontrado');
    }
    return token.replace('Bearer ', '');
  }

  validateToken(token: string) {
    try {
      const payload = jwt.verify(token, process.env['JWT_SECRET']);
      return payload as UserToken;
    } catch (error) {
      this.logger.error(`Token inválido: ${error['message']} - Token: ${token}`);
      throw new UnauthorizedException(`Token inválido: ${error['message']}`);
    }
  }
}
