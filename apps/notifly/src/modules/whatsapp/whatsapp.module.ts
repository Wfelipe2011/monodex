import { forwardRef, Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
    imports: [forwardRef(() => WebsocketModule)],
    controllers: [WhatsappController],
    providers: [WhatsappService],
    exports: [WhatsappService]
})
export class WhatsappModule { }
