import { Injectable } from '@nestjs/common';

@Injectable()
export class GymCtrlService {
  getHello(): string {
    return 'Hello World!';
  }
}
