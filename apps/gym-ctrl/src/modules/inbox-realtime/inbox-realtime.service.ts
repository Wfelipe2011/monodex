import { Injectable, Logger } from '@nestjs/common';
import { WebSocket } from 'ws';
import { InboxInboundEventDto } from './inbox-inbound-event.interface';

type RoomClient = { id: string; socket: WebSocket };

@Injectable()
export class InboxRealtimeService {
  private readonly logger = new Logger(InboxRealtimeService.name);
  private readonly roomClients = new Map<string, Set<RoomClient>>();
  private readonly clientRooms = new Map<string, { socket: WebSocket; rooms: string[] }>();

  registerClient(clientId: string, socket: WebSocket, rooms: string[]): void {
    const uniqueRooms = [...new Set(rooms)];
    this.clientRooms.set(clientId, { socket, rooms: uniqueRooms });

    for (const room of uniqueRooms) {
      let clients = this.roomClients.get(room);
      if (!clients) {
        clients = new Set();
        this.roomClients.set(room, clients);
      }
      clients.add({ id: clientId, socket });
    }

    this.logger.debug(`Client ${clientId} registered in rooms: ${uniqueRooms.join(', ')}`);
  }

  unregisterClient(clientId: string): void {
    const entry = this.clientRooms.get(clientId);
    if (!entry) {
      return;
    }

    for (const room of entry.rooms) {
      const clients = this.roomClients.get(room);
      if (!clients) {
        continue;
      }
      for (const client of clients) {
        if (client.id === clientId) {
          clients.delete(client);
        }
      }
      if (clients.size === 0) {
        this.roomClients.delete(room);
      }
    }

    this.clientRooms.delete(clientId);
    this.logger.debug(`Client ${clientId} unregistered`);
  }

  unregisterBySocket(socket: WebSocket): void {
    for (const [clientId, entry] of this.clientRooms) {
      if (entry.socket === socket) {
        this.unregisterClient(clientId);
        return;
      }
    }
  }

  broadcastToRooms(rooms: string[], payload: object): void {
    const uniqueRooms = [...new Set(rooms)];
    const sentTo = new Set<string>();
    const data = JSON.stringify(payload);

    for (const room of uniqueRooms) {
      const clients = this.roomClients.get(room);
      if (!clients) {
        continue;
      }

      for (const { id, socket } of clients) {
        if (sentTo.has(id)) {
          continue;
        }
        if (socket.readyState !== WebSocket.OPEN) {
          continue;
        }
        try {
          socket.send(data);
          sentTo.add(id);
        } catch (error) {
          this.logger.warn(`Failed to send to client ${id} in room ${room}: ${error}`);
        }
      }
    }
  }

  publishInbound(dto: InboxInboundEventDto): void {
    const payload: InboxInboundEventDto = {
      type: 'message.inbound',
      tenantId: dto.tenantId,
      listId: dto.listId,
      leadId: dto.leadId,
      message: dto.message,
    };
    this.broadcastToRooms([`tenant:${dto.tenantId}`, 'super-admin'], payload);
  }
}
