import { Controller, Get, Param, BadRequestException, Res } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import { PrismaService } from '@core/infra/prisma/prisma.service';

@Controller('sites')
export class WhatsappController {
    constructor(private readonly prisma: PrismaService) {}

    @Get('welcome/:uuid')
    async getWelcomePage(@Param('uuid') uuid: string, @Res() res: Response) {
        const sanitizedUuid = uuid.replace('{{1}}', '');
        console.log('[WhatsappController] getWelcomePage called with uuid:', sanitizedUuid);

        const tenant = await this.prisma.tenant.findUnique({
            where: { uuid: sanitizedUuid },
        });

        if (!tenant?.phone) {
            return res.sendFile(join(process.cwd(), 'public', 'index.html'));
        }

        const cleanedPhoneNumber = tenant.phone.replace(/\D/g, '');

        if (!cleanedPhoneNumber || !/^[0-9]+$/.test(cleanedPhoneNumber)) {
            throw new BadRequestException('Número de telefone inválido. Por favor, forneça apenas dígitos.');
        }

        const whatsappUrl = `https://wa.me/+${cleanedPhoneNumber}?text=Olá, gostaria de saber mais sobre os serviços!`;
        return res.redirect(whatsappUrl);
    }
}
