import { Injectable } from '@nestjs/common';

@Injectable()
export class NotiflyService {
  getHello(): string {
    return 'Hello World!';
  }
}
