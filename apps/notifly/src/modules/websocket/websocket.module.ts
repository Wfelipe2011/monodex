import { forwardRef, Module } from '@nestjs/common';
import { WhatsappGateway } from './whatsapp.gateway';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
    imports: [forwardRef(() => WhatsappModule)],
    providers: [WhatsappGateway],
    exports: [WhatsappGateway]
})
export class WebsocketModule { }