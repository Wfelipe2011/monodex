import { UserToken } from '@core/contracts/user-token';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  logger = new Logger(AuthService.name);
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService
  ) { }

  async login(email: string, password: string) {
    this.logger.log(`login ${email}`);
    if (!email || !password) throw new BadRequestException('Faltando dados');
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });
    this.logger.log(`Verificando usuário ${user?.email}`);
    
    if (!user) throw new UnauthorizedException('Não autorizado');
    this.logger.log(`Verificando senha ${user?.email}`);
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) throw new UnauthorizedException('Não autorizado');
    this.logger.log(`Gerando token ${user?.email}`);

    return this.issueJwt(user);
  }

  issueJwt(user: {
    id: number;
    name: string;
    roles: UserToken['roles'];
    tenantId: number;
  }) {
    const userToken: UserToken = {
      id: user.id,
      userName: user.name,
      roles: user.roles,
      tenantId: user.tenantId,
      userId: user.id,
    };
    const token = jwt.sign(userToken, this.configService.get('JWT_SECRET'), {
      expiresIn: '1d',
    });
    return { token };
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Não autorizado');

    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) throw new UnauthorizedException('Não autorizado');

    const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });
    return { ok: true };
  }
}
