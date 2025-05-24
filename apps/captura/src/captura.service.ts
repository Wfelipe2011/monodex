import { Injectable } from '@nestjs/common';

@Injectable()
export class CapturaService {
  getHello(): string {
    return 'Hello World!';
  }
}
