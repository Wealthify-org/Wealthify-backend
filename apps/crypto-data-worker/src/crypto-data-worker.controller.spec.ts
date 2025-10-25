import { Test, TestingModule } from '@nestjs/testing';
import { CryptoDataWorkerController } from './crypto-data-worker.controller';
import { CryptoDataWorkerService } from './crypto-data-worker.service';

describe('CryptoDataWorkerController', () => {
  let cryptoDataWorkerController: CryptoDataWorkerController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [CryptoDataWorkerController],
      providers: [CryptoDataWorkerService],
    }).compile();

    cryptoDataWorkerController = app.get<CryptoDataWorkerController>(CryptoDataWorkerController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(cryptoDataWorkerController.getHello()).toBe('Hello World!');
    });
  });
});
