import {
  Body,
  Controller,
  Delete,
  HttpCode,
  NotFoundException,
  Put,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RequestUser } from '@core/contracts/request-user';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { DeletePushSubscriptionDto } from './dto/delete-push-subscription.dto';
import { UpsertPushSubscriptionDto } from './dto/upsert-push-subscription.dto';

@ApiTags('Admin — Push')
@ApiBearerAuth()
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('admin/push-subscriptions')
export class PushSubscriptionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Put()
  @HttpCode(204)
  @ApiOperation({ summary: 'Registrar ou atualizar PushSubscription do usuário autenticado' })
  @ApiNoContentResponse({ description: 'Subscription registrada ou atualizada' })
  @ApiUnauthorizedResponse({ description: 'JWT ausente ou inválido' })
  async upsert(
    @Body() dto: UpsertPushSubscriptionDto,
    @Req() req: RequestUser,
  ): Promise<void> {
    const userAgent = this.resolveUserAgent(req);

    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId: req.user.userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent,
      },
      update: {
        userId: req.user.userId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent,
      },
    });
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: 'Remover PushSubscription do usuário autenticado' })
  @ApiNoContentResponse({ description: 'Subscription removida' })
  @ApiNotFoundResponse({ description: 'Subscription não encontrada para este usuário' })
  @ApiUnauthorizedResponse({ description: 'JWT ausente ou inválido' })
  async remove(
    @Body() dto: DeletePushSubscriptionDto,
    @Req() req: RequestUser,
  ): Promise<void> {
    const result = await this.prisma.pushSubscription.deleteMany({
      where: {
        endpoint: dto.endpoint,
        userId: req.user.userId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Push subscription não encontrada');
    }
  }

  private resolveUserAgent(req: RequestUser): string | undefined {
    const userAgent = req.headers['user-agent'];
    if (Array.isArray(userAgent)) {
      return userAgent[0];
    }
    return userAgent;
  }
}
