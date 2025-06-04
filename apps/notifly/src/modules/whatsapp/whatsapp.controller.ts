import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Res, Sse } from '@nestjs/common';
import { Response } from 'express'
import { WhatsappService } from './whatsapp.service';
import { CurrentPassport } from '../../decorators/passports/passports.decorator';
import { NewWebhook, webhookSchema, NewMessage } from './types';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) { }

  @Post('send-message')
  async sendMessage(
    @CurrentPassport() jwtPayload: IJwtPayload,
    @Body() body: NewMessage
  ) {
    if (!body?.message || !body?.phoneNumber) {
      throw new BadRequestException('message or phoneNumber is required')
    }
    const userWasWithWhatsappLinked = this.whatsappService.userWasVinculedUser(jwtPayload.userId)
    if (!userWasWithWhatsappLinked) {
      throw new BadRequestException('User not linked with whatsapp')
    }
    await this.whatsappService.initializeForUser(jwtPayload.userId)
    return this.whatsappService.sendMessage(jwtPayload.userId, body.phoneNumber, body.message)
  }

  @Post('session/init')
  sessionInit(@CurrentPassport() jwtPayload: IJwtPayload) {
    return this.whatsappService.initializeForUser(jwtPayload.userId)
  }

  @Post('session/logout')
  sessionLogout(@CurrentPassport() jwtPayload: IJwtPayload) {
    return this.whatsappService.logoutUser(jwtPayload.userId)
  }

  @Get('contacts')
  contacts(@CurrentPassport() jwtPayload: IJwtPayload) {
    return this.whatsappService.getContacts(jwtPayload.userId)
  }

  @Post('webhook')
  async webhook(@Body() body: NewWebhook, @CurrentPassport() jwtPayload: IJwtPayload, @Res() res: Response) {
    const { success, error } = webhookSchema.safeParse(body)
    if (!success) {
      res.status(400).json({
        message: 'Invalid body',
        error: error?.message
      })
      return
    }
    const newWebhook = await this.whatsappService.setWebhook(body, jwtPayload.userId)
    return res.send(newWebhook).status(201)
  }
  @Get('webhook')
  getWebhook(@CurrentPassport() jwtPayload: IJwtPayload) {
    return this.whatsappService.listWebhooks(jwtPayload.userId)
  }
  @Get('webhook/:id')
  getWebhookById(@Param('id') id: number, @CurrentPassport() jwtPayload: IJwtPayload) {
    return this.whatsappService.getWebhook(id, jwtPayload.userId)
  }
  @Put('webhook/:id')
  updateWebhook(@Param('id') id: number, @Body() body: NewWebhook, @CurrentPassport() jwtPayload: IJwtPayload, @Res() res: Response) {
    const { success, error } = webhookSchema.safeParse(body)
    if (!success) {
      res.status(400).json({
        message: 'Invalid body',
        error: error?.message
      })
      return
    }
    const webhookUpdated = this.whatsappService.updateWebhook(id, jwtPayload.userId, body)
    return res.send(webhookUpdated).status(200)
  }
  @Delete('webhook/:id')
  deleteWebhook(@Param('id') id: number, @CurrentPassport() jwtPayload: IJwtPayload) {
    return this.whatsappService.deleteWebhook(id, jwtPayload.userId)
  }
}
