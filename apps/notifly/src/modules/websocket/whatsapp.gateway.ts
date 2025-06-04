import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { forwardRef, Inject, Injectable } from '@nestjs/common';

@WebSocketGateway({
    cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
        credentials: true,
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        transports: ['websocket', 'polling']
    }
})
@Injectable()
export class WhatsappGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    constructor(
        @Inject(forwardRef(() => WhatsappService))
        private readonly whatsappService: WhatsappService
    ) { }

    private userSockets = new Map<number, Socket>();

    async handleConnection(client: Socket) {
        console.log(`Cliente conectado: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        console.log(`Cliente desconectado: ${client.id}`);
        // Limpeza quando o cliente desconectar
        for (const [userId, socket] of this.userSockets.entries()) {
            if (socket.id === client.id) {
                this.userSockets.delete(userId);
                break;
            }
        }
    }

    @SubscribeMessage('subscribeToQrCode')
    async handleSubscribeToQrCode(client: Socket, userId: string) {
        console.log('userId connected: ', userId)
        const userIdNumber = parseInt(userId, 10);

        if (!userIdNumber) {
            client.emit('error', { message: 'Usuário não autenticado' });
            return;
        }

        console.log('Usuário inscrito para QR Code:', userIdNumber);
        this.userSockets.set(userIdNumber, client);

        // Envia o QR code atual se existir
        const currentQrCode = this.whatsappService.getCurrentQrCode(userIdNumber);
        if (currentQrCode) {
            client.emit('qrCode', { qrCode: currentQrCode, status: 'success' });
        }

        // Registra o callback para enviar eventos futuros
        this.whatsappService.getQrCode(userIdNumber, (data) => {
            const userSocket = this.userSockets.get(userIdNumber)
            if (userSocket) {
                userSocket.emit('qrCode', data);
            }
        });
    }

    sendNotification(userId: number, data: any) {
        const userSocket = this.userSockets.get(userId);
        if (userSocket) {
            userSocket.emit('qrCode', data);
        }
    }
}