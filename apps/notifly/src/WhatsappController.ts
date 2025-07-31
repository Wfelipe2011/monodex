import { Controller, Get, Param, Redirect, BadRequestException, Res } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';

const tenats = {
    '50dd2a8e-9b5a-4396-b78a-7cb2f2a677dc': 5515981057803,
    '1096d06b-bac3-4d99-9a37-10b557a89328': 5515981785706
}

@Controller('sites')
export class WhatsappController {


    @Get('welcome/:uuid')
    getWelcomePage(@Param('uuid') uuid: string, @Res() res: Response) {
        console.log('[WhatsappController] getWelcomePage called with phoneNumber:', uuid.replace('{{1}}', ''));
        // [WhatsappController] getWelcomePage called with phoneNumber: {{1}}1096d06b-bac3-4d99-9a37-10b557a89328
        // replace {{1}}
        if (tenats[uuid.replace('{{1}}', '')]) {
            // Remove any non-digit characters from the phone number
            const cleanedPhoneNumber = tenats[uuid.replace('{{1}}', '')];

            // Basic validation: check if the cleaned number is not empty and contains only digits
            if (!cleanedPhoneNumber || !/^[0-9]+$/.test(cleanedPhoneNumber)) {
                throw new BadRequestException('Número de telefone inválido. Por favor, forneça apenas dígitos.');
            }

            const whatsappUrl = `https://wa.me/+${cleanedPhoneNumber}?text=Olá, gostaria de saber mais sobre os serviços!`;
            // Perform the redirect manually since @Redirect() decorator doesn't work with conditional logic easily
            return res.redirect(whatsappUrl);
        } else {
            // If no phoneNumber is provided, serve the welcome page
            return res.sendFile(join(process.cwd(), 'public', 'index.html'));
        }
    }

    // @Get(':phoneNumber')
    // @Redirect()
    // redirectToWhatsapp(@Param('phoneNumber') phoneNumber: string) {
    //     // Remove any non-digit characters from the phone number
    //     const cleanedPhoneNumber = phoneNumber.replace(/\D/g, '');

    //     // Basic validation: check if the cleaned number is not empty and contains only digits
    //     if (!cleanedPhoneNumber || !/^[0-9]+$/.test(cleanedPhoneNumber)) {
    //         throw new BadRequestException('Número de telefone inválido. Por favor, forneça apenas dígitos.');
    //     }

    //     const whatsappUrl = `https://wa.me/+${cleanedPhoneNumber}`;
    //     return { url: whatsappUrl };
    // }
}