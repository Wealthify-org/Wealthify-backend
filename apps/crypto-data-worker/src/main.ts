import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { CryptoDataWorkerModule } from './crypto-data-worker.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

const log = new Logger('CryptoDataWorker.Bootstrap');

async function start() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    CryptoDataWorkerModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL ?? 'amqp://localhost:5672'],
        queue: process.env.WORKER_QUEUE ?? 'crypto_data_worker_rpc',
        queueOptions: {
          durable: true,
        },
      },
    },
  );

  // Включаем системные shutdown-хуки. Без этого Nest НЕ роутит SIGINT/SIGTERM/
  // SIGHUP на onApplicationShutdown / onModuleDestroy — и Puppeteer не получает
  // шанс закрыть браузеры. Это и было причиной "висящих" Chrome при ctrl+c.
  app.enableShutdownHooks();

  // Подстраховка: явные signal-хэндлеры. Некоторые wrapper'ы (nest-cli watch,
  // concurrently, docker) подавляют сигналы. Делаем app.close() (запустит весь
  // lifecycle, в т.ч. PuppeteerService.onApplicationShutdown), потом exit.
  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.warn(`Received ${signal} — closing app gracefully...`);
    try {
      await app.close();
      log.log('App closed cleanly');
    } catch (e) {
      log.error(`Error during app.close: ${(e as Error)?.message ?? e}`);
    } finally {
      // Hard fallback: если что-то залипло — через 8 сек убиваем процесс.
      // Безопасно для воркера: RMQ переотправит unack-сообщение.
      setTimeout(() => {
        log.error('Forcing process.exit(0) after timeout');
        process.exit(0);
      }, 8000).unref();
      process.exit(0);
    }
  };
  (['SIGINT', 'SIGTERM', 'SIGHUP'] as NodeJS.Signals[]).forEach((sig) =>
    process.on(sig, () => void shutdown(sig)),
  );

  process.on('unhandledRejection', (reason) => {
    log.error(
      `UNHANDLED REJECTION: ${reason instanceof Error ? reason.stack : reason}`,
    );
  });

  await app.listen();
  log.log('Crypto-data-worker started');
}

start();
