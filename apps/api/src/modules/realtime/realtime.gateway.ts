import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import type { AccessTokenPayload } from '../../common/guards/jwt-auth.guard';

/**
 * Authenticated Socket.IO gateway on namespace /rt.
 * Clients connect with { auth: { token: '<access-token>' } }.
 * Sockets join `role:{ROLE}` and `user:{id}` rooms; all emission goes through RealtimeService.
 */
@WebSocketGateway({ namespace: 'rt', cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection {
  private logger = new Logger('RealtimeGateway');

  @WebSocketServer()
  server!: Server;

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const token = (client.handshake.auth?.token as string) || '';
      const payload = this.jwt.verify<AccessTokenPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      if (payload.type !== 'access') throw new Error('wrong token type');
      client.data.userId = payload.sub;
      client.data.role = payload.role;
      void client.join(`role:${payload.role}`);
      void client.join(`user:${payload.sub}`);
      this.logger.debug(`Socket connected: ${payload.username} (${payload.role})`);
    } catch {
      this.logger.debug('Socket rejected: invalid token');
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }
}
