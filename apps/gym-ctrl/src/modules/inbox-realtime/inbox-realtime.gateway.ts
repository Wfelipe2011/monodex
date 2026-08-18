import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import * as jwt from 'jsonwebtoken';
import { Roles } from '@prisma/client';
import { IncomingMessage } from 'http';
import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { UserToken } from '@core/contracts/user-token';
import { InboxRealtimeService } from './inbox-realtime.service';

const WS_PATH = process.env['WS_INBOX_PATH'] ?? 'ws/inbox';

@WebSocketGateway({ path: WS_PATH })
export class InboxRealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(InboxRealtimeGateway.name);
  private readonly socketClientIds = new WeakMap<WebSocket, string>();

  constructor(private readonly inboxRealtimeService: InboxRealtimeService) {}

  handleConnection(client: WebSocket, request: IncomingMessage): void {
    const token = extractTokenFromUrl(request.url);
    if (!token) {
      client.close(4401, 'Unauthorized');
      return;
    }

    let payload: UserToken;
    try {
      payload = jwt.verify(token, process.env['JWT_SECRET']) as UserToken;
    } catch {
      client.close(4401, 'Unauthorized');
      return;
    }

    const rooms = [`tenant:${payload.tenantId}`];
    if (payload.roles?.includes(Roles.SUPER_ADMIN)) {
      rooms.push('super-admin');
    }

    const clientId = uuidv4();
    this.socketClientIds.set(client, clientId);
    this.inboxRealtimeService.registerClient(clientId, client, rooms);

    client.send(JSON.stringify({ type: 'connected', rooms }));
    this.logger.log(`WS client ${clientId} connected (tenant ${payload.tenantId}, rooms: ${rooms.join(', ')})`);
  }

  handleDisconnect(client: WebSocket): void {
    const clientId = this.socketClientIds.get(client);
    if (clientId) {
      this.inboxRealtimeService.unregisterClient(clientId);
      this.logger.log(`WS client ${clientId} disconnected`);
      return;
    }
    this.inboxRealtimeService.unregisterBySocket(client);
  }
}

function extractTokenFromUrl(url: string | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url, 'http://localhost');
    return parsed.searchParams.get('token');
  } catch {
    return null;
  }
}
