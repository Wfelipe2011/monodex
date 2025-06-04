import { forwardRef, Inject, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { EventEmitter } from 'events';
import { Boom } from '@hapi/boom';
import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  Browsers,
  BaileysEventMap,
  Contact,
  Chat,
  proto,

} from '@whiskeysockets/baileys';
// @ts-ignore
import { makeInMemoryStore } from '@whiskeysockets/baileys';
import * as fs from 'fs';
import { NewWebhook } from './types';
import { HashService } from '../../hash.service';
import { PrismaService } from '@core/infra/prisma/prisma.service';
import { WhatsappGateway } from '../websocket/whatsapp.gateway';

type UserSocket = ReturnType<typeof makeWASocket>;
type QRCodeData = { raw: string; imageUrl: string; createdAt: Date };

@Injectable()
export class WhatsappService implements OnModuleInit {
  private userStores: Map<number, ReturnType<typeof makeInMemoryStore>> = new Map();
  private userSockets: Map<number, UserSocket> = new Map();
  private userListeners: Map<number, (keyof BaileysEventMap)[]> = new Map();
  private qrCodes: Map<number, QRCodeData> = new Map();
  private qrCallbacks = new Map<number, (data: any) => void>();
  private eventEmitters: Map<number, EventEmitter> = new Map();
  private reconnecting: Map<number, { userId: number }> = new Map();
  private connectionStatus: Map<number, { userId: number; status: 'connected' | 'disconnected' }> = new Map();
  private contacts: Map<number, Contact[]> = new Map();
  private chats: Map<number, Chat[]> = new Map();
  private messages: Map<number, proto.IWebMessageInfo[]> = new Map();

  constructor(
    @Inject(forwardRef(() => WhatsappGateway))
    private readonly whatsappGateway: WhatsappGateway,
    private readonly postgresService: PrismaService
  ) {
  }

  async onModuleInit() {
    const users = await this.postgresService.user.findMany()
    users.forEach(async (user) => {
      const hasAuthFolder = this.hasAuthFolder(user.id);
      if (!hasAuthFolder) {
        return
      }
      this.initializeForUser(user.id);
    });
  }

  public userWasVinculedUser(userId: number): boolean {
    const hasSocket = this.userSockets.has(userId)
    if (!hasSocket) {
      return false
    }
    const hasAuthFolder = this.hasAuthFolder(userId)
    if (!hasAuthFolder) {
      return false
    }
    const hasAuthFiles = this.hasFilesInAuthFolder(userId)
    if (!hasAuthFiles) {
      return false
    }
    return true
  }

  public async initializeForUser(userId: number): Promise<ReturnType<typeof makeWASocket> | any> {
    if (this.userWasVinculedUser(userId)) {
      if (this.eventEmitters.has(userId)) {
        const emitter = this.eventEmitters.get(userId);
        emitter?.emit('qr', { status: 'connected', qrCode: '' });
      }
      const socket = this.userSockets.get(userId);
      this.whatsappGateway.sendNotification(userId, { status: 'connected', qrCode: '' })
      return socket;
    }
    if (this.connectionStatus.has(userId)) {
      const connectionStatus = this.connectionStatus.get(userId)
      if (connectionStatus?.status === 'connected' && this.userWasVinculedUser(userId)) {
        const socket = this.userSockets.get(userId);
        return socket
      }
    }

    this.checkAuthFolder(userId);
    const { state, saveCreds } = await useMultiFileAuthState(this.getAuthFolder(userId));
    const emitter = new EventEmitter();
    this.eventEmitters.set(userId, emitter);

    try {
      const store = makeInMemoryStore({})
      const socket = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: Browsers.macOS('Chrome'),
        markOnlineOnConnect: false,
        connectTimeoutMs: 45_000,
        keepAliveIntervalMs: 10_000,
        getMessage: async () => undefined,
        linkPreviewImageThumbnailWidth: 0,
        transactionOpts: {
          maxCommitRetries: 1,
          delayBetweenTriesMs: 3000
        },
        fireInitQueries: false,
        syncFullHistory: false,
      });
      try {
        store.bind(socket.ev);
      } catch (error) {
        console.log('error on store bid', error)
      }
      this.userStores.set(userId, store)

      // socket.ev.on('chats.upsert', () => {
      //   const chats = store.chats.all()
      //   console.log("🚀 ~ WhatsappService ~ socket.ev.on ~ chats:", JSON.stringify(chats, null, 2))
      // })
      // socket.ev.on('contacts.upsert', () => {
      //   const contacts = store.contacts
      //   console.log("🚀 ~ WhatsappService ~ socket.ev.on ~ contacts:", JSON.stringify(contacts, null, 2))
      // })
      // socket.ev.on('labels.association', (association) => {
      //   // console.log('labels.association: ', JSON.stringify(association, null, 2))
      //   const labels = store.labels.findAll()
      //   console.log("🚀 ~ WhatsappService ~ socket.ev.on ~ labels:", JSON.stringify(labels, null, 2))

      //   const labelAssociations = store.labelAssociations.all()
      //   console.log("🚀 ~ WhatsappService ~ socket.ev.on ~ labelAssociations:", labelAssociations);
      //   return association
      // })


      socket.ev.on('connection.update', (update) => this.handleConnectionUpdate(userId, update));
      socket.ev.on('creds.update', saveCreds);
      socket.ev.on('messaging-history.set', ({ contacts, ...rest }) => {
        if (contacts?.length) {
          this.savesContacts(userId, contacts)
        }
        return {
          contacts,
          ...rest
        }
      })
      socket.ev.on('messages.upsert', (info) => {
        const { messages, type, requestId } = info
        for (const messageRaw of messages) {
          this.getMessage(userId, messageRaw)
        }
      })
      socket.ev.on('contacts.update', (contacts) => {
        if (contacts?.length) {
          this.savesContacts(userId, contacts as Contact[])
        }
        return {
          contacts
        }
      })

      this.userSockets.set(userId, socket);
      this.userListeners.set(userId, [
        'connection.update',
        'creds.update',
        'messages.upsert',
        'contacts.update',
        'labels.association',
        'chats.upsert',
      ]);
      await new Promise((resolve, rejected) => {
        let timeout
        socket.ev.on('connection.update', (update) => {
          clearTimeout(timeout)
          timeout = setTimeout(() => {
            rejected('Request rejected because has timeout')
          }, 30_000)
          if (update.connection === 'open') {
            console.log('conectou-se ao socket')
            clearTimeout(timeout)
            resolve(true)
          }
        })
      })

      return socket;
    } catch (error) {
      console.log("🚀 ~ initializeForUser ~ error:", error)
      const socket = this.userSockets.get(userId);
      this.scheduleReconnect(userId, socket)
      return socket
    }
  }

  private async savesContacts(userId: number, contacts: Contact[]) {
    const contactsAlreadySaved = this.contacts.get(userId) || [];
    const newContacts = contacts.filter((contact) => {
      return !contactsAlreadySaved.some((savedContact) => savedContact.id === contact.id);
    });
    this.contacts.set(userId, [...contactsAlreadySaved, ...newContacts]);

    const toSave = contacts.map(c => {
      return new Promise(async (resolve) => {
        const alreadyExists = await this.postgresService.contacts.findFirst({
          where: {
            contactInformation: c.id,
            userId
          }
        })
        if (!alreadyExists && c.id) {
          await this.postgresService.contacts.create({
            data: {
              notifyName: c.notify,
              name: c.name,
              type: c.id?.includes('@g.us') ? 'GROUP' : 'INDIVIDUAL',
              contactInformation: c.id,
              userId,
            }
          })
        }
        resolve(true)
      })
    })

    await Promise.all(toSave)
  }

  private async getMessage(userId: number, messageRaw: proto.IWebMessageInfo) {
    const webhooks = await this.listWebhooks(userId)
    if (!webhooks?.length) return
    const { message, key: { remoteJid, fromMe } } = messageRaw
    const phoneNumber = remoteJid?.split('@')[0]
    const textMessage = message?.conversation || message?.extendedTextMessage?.text;
    if (!textMessage || !phoneNumber || fromMe) return

    for (const webhook of webhooks) {
      const { filter: filterRaw, target, secret } = webhook
      const filter = !!filterRaw ? JSON.parse(filterRaw as any) : {}
      const hasFilter = 'contacts' in filter ? filter.contacts.includes(phoneNumber) : true
      if (hasFilter) {
        await fetch(target, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-secret': secret
          },
          body: JSON.stringify({
            phoneNumber,
            textMessage,
          })
        })
      }
    }

    // const socket = this.userSockets.get(userId);
    //     if (!socket) return
    //     console.log('aqui')
    //     const store = this.userStores.get(userId)
    //     if (store) {
    //       const labels = store.labelAssociations.all()
    //       console.log("🚀 ~ WhatsappService ~ getMessage ~ labels:", labels)
    //     }
    //     await socket.addLabel(remoteJid, {
    //       id: '123',
    //       name: 'Auto Atendimento',
    //     })
    //     socket.chatModify({
    //       addChatLabel: {
    //         labelId: '123',
    //       },
  }

  private getAuthFolder(userId: number) {
    // return path.join(__dirname, '..', '..', 'auth', `user_${userId}`);
    return `${__dirname}/../../../auth/user_${userId}`
  }

  private hasAuthFolder(userId: number) {
    const authFolder = this.getAuthFolder(userId)
    return fs.existsSync(authFolder);
  }

  private hasFilesInAuthFolder(userId: number) {
    const authFolder = this.getAuthFolder(userId)
    const files = fs.readdirSync(authFolder);
    return files.length > 0;
  }

  private checkAuthFolder(userId: number) {
    if (!this.hasAuthFolder(userId)) {
      const authFolder = this.getAuthFolder(userId)
      fs.mkdirSync(authFolder, { recursive: true });
    }
  }

  private async handleConnectionUpdate(userId: number, update: BaileysEventMap['connection.update']) {
    const { connection, qr, lastDisconnect } = update;
    const emitter = this.eventEmitters.get(userId);

    if (connection === 'open') {
      this.whatsappGateway.sendNotification(userId, { status: 'connected', qrCode: '' })
      this.qrCodes.delete(userId);
      emitter?.emit('qr', { status: 'connected', qrCode: '' });
      this.connectionStatus.set(userId, { userId, status: 'connected' });
    }

    if (qr && this.connectionStatus.get(userId)?.status !== 'connected') {
      const imageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;
      this.qrCodes.set(userId, { raw: qr, imageUrl, createdAt: new Date() });
      emitter?.emit('qr', { status: 'pending', qrCode: imageUrl });
      this.updateQrCode(userId, imageUrl)
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        setTimeout(() => {
          this.userSockets.delete(userId);
          this.initializeForUser(userId)
        }, 5_000);
      } else {
        this.logoutUser(userId);
      }
    }
  }

  public async logoutUser(userId: number) {
    const socket = this.userSockets.get(userId);
    if (socket) socket.end(undefined)

    this.userStores.delete(userId);
    this.userSockets.delete(userId);
    this.qrCodes.delete(userId);
    this.eventEmitters.delete(userId);
    this.reconnecting.delete(userId);
    this.connectionStatus.delete(userId);
    this.contacts.delete(userId);
    this.chats.delete(userId);

    const authFolder = this.getAuthFolder(userId);
    if (fs.existsSync(authFolder)) fs.rmSync(authFolder, { recursive: true });
  }

  private scheduleReconnect(userId: number, socket: UserSocket | undefined = undefined) {
    const isReconnectingForThisUser = this.reconnecting.has(userId);
    if (isReconnectingForThisUser) return;

    this.reconnecting.set(userId, { userId });
    console.log('Agendando reconexão em 5 segundos...');

    setTimeout(async () => {
      try {
        if (socket) {
          const listeners = this.userListeners.get(userId);
          if (listeners?.length) {
            for (const listener of listeners) {
              socket.ev.removeAllListeners(listener);
              socket.ev.off(listener, (e) => {
                console.log('desligando: ', e)
              })
            }
          }
          socket.end(undefined);
        }
        this.reconnecting.delete(userId);
        await this.initializeForUser(userId);
      } catch (error) {
        console.error('Erro na reconexão:', error);
        this.scheduleReconnect(userId, socket);
      }
    }, 5_000);
  }

  public async sendMessage(userId: number, phoneNumber: string, message: string, retryCount: number = 0): Promise<{ success: boolean; message: string }> {
    const socket = await this.initializeForUser(userId);

    try {
      const destinationIsToGroup = phoneNumber.includes('@g.us');
      if (destinationIsToGroup) {
        await socket.sendMessage(phoneNumber, { text: message });
      } else {
        const formattedNumber = phoneNumber.includes('@')
          ? `${phoneNumber}`
          : `${phoneNumber.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
        await socket.sendMessage(formattedNumber, { text: message });
      }
      return { success: true, message: 'Message sent successfully' };
    } catch (error) {
      console.error('Send message error:', error);
      if (retryCount < 3) {
        const baseDelay = 10_000;
        const delay = baseDelay * (2 ** retryCount)
        console.log('Retrying message send... ', delay);
        await this.sleep(delay);
        return this.sendMessage(userId, phoneNumber, message, retryCount + 1);
      }
      return { success: false, message: 'Failed to send message' };
    }
  }

  private async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }


  public async getQrCode(userId: number, callBack: (data: any) => void) {
    // if (this.qrCallbacks.has(userId)) {
    //   const qr = this.qrCodes.get(userId)!;
    //   if (Date.now() - qr.createdAt.getTime() <= 15_000) return qr.imageUrl;
    //   this.qrCallbacks.delete(userId);
    // }
    this.qrCallbacks.set(userId, callBack);

    if (this.qrCodes.has(userId)) {
      const qr = this.qrCodes.get(userId)!;
      if (Date.now() - qr.createdAt.getTime() <= 15_000) return qr.imageUrl;
      this.qrCodes.delete(userId);
    }

    await this.initializeForUser(userId);
    return new Promise<string>((resolve) => {
      const emitter = this.eventEmitters.get(userId);
      const timeout = setTimeout(() => resolve(''), 30_000);
      emitter?.once('qr', (data) => {
        clearTimeout(timeout);
        callBack(data);
        resolve(data.qrCode);
      });
    });
  }

  // public getCurrentQrCode(userId: number) {
  //   if (this.qrCodes.has(userId)) {
  //     const qr = this.qrCodes.get(userId)!;
  //     return qr.imageUrl;
  //   }
  //   return null;
  // }
  getCurrentQrCode(userId: number): string | undefined {
    return this.qrCodes.get(userId)?.imageUrl;
  }

  updateQrCode(userId: number, qrCode: string) {
    const callback = this.qrCallbacks.get(userId);
    if (callback) {
      callback({ qrCode, status: 'updated' });
    }
  }

  public async getContacts(userId: number) {
    const contacts = await this.postgresService.contacts.findMany({
      where: {
        userId
      }
    })
    return contacts
  }

  public async setWebhook(body: NewWebhook, userId: number) {
    const nowTimestamp = new Date().getTime();
    const secret = await this.hashWebhookSecret(`${nowTimestamp}${userId}`);

    const user = await this.postgresService.user.findFirst({
      where: {
        id: userId
      }
    })

    return this.postgresService.webhooks.create({
      data: {
        name: body.name,
        target: body.target,
        secret,
        user: { connect: { id: userId } },
        tenant: { connect: { id: user.tenantId } },
        trigger: body.trigger || 'CONVERSATION_MESSAGE',
        ...('filter' in body && { filter: JSON.stringify(body.filter) }),
      }
    })
  }
  private hashWebhookSecret(secret: string) {
    return HashService.hash(secret)
  }
  public async listWebhooks(userId: number) {
    return this.postgresService.webhooks.findMany({
      where: {
        userId,
        enabled: true
      }
    })
  }
  public async getWebhook(id: number, userId: number) {
    const webhook = await this.postgresService.webhooks.findFirst({
      where: {
        id,
        userId
      }
    })
    if (!webhook) {
      throw new NotFoundException('Webhook not found')
    }
    return webhook
  }
  public async updateWebhook(id: number, userId: number, body: NewWebhook) {
    const webhook = await this.postgresService.webhooks.findFirst({
      where: {
        id,
        userId
      }
    })
    if (!webhook) {
      throw new NotFoundException('Webhook not found')
    }

    return this.postgresService.webhooks.update({
      where: {
        id,
        userId
      },
      data: {
        ...body,
        ...('filter' in body && { filter: JSON.stringify(body.filter) }),
      }
    })
  }
  public async deleteWebhook(id: number, userId: number) {
    const webhook = await this.postgresService.webhooks.findFirst({
      where: {
        id,
        userId
      }
    })
    if (!webhook) {
      throw new NotFoundException('Webhook not found')
    }
    return this.postgresService.webhooks.delete({
      where: {
        id,
        userId
      }
    })
  }
}
