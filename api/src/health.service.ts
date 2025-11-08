import { Injectable, HttpCode } from '@nestjs/common';

@Injectable()
export class HealthService {
  @HttpCode(200)
  getHealth(): void {
    console.log('healthy');
  }
}
