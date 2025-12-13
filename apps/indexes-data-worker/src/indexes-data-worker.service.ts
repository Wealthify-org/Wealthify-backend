import { Injectable } from '@nestjs/common';

@Injectable()
export class IndexesDataWorkerService {
  health() {
    return { ok: true, time: new Date().toISOString() };
  }

  // async parseAll() { ... }
}
