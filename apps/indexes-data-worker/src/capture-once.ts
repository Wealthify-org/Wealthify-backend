/**
 * Разовый сбор снэпшота рыночных индексов «прямо сейчас», вне расписания.
 *
 * Поднимает application-context воркера (БЕЗ RMQ-транспорта — нужен только
 * Postgres + интернет), один раз дёргает `captureSnapshot()` и выходит.
 * Ежечасный `@Cron` в самом воркере НЕ затрагивается — он продолжает работать
 * как обычно, когда воркер запущен штатно.
 *
 * Запуск:
 *   npm run capture:indexes
 *   (= cross-env NODE_ENV=development ts-node -r tsconfig-paths/register \
 *        apps/indexes-data-worker/src/capture-once.ts)
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { IndexesDataWorkerModule } from './indexes-data-worker.module';
import { IndexesDataWorkerService } from './indexes-data-worker.service';

async function run(): Promise<void> {
  const logger = new Logger('capture-once');

  // createApplicationContext поднимает Config + Sequelize + Schedule, но НЕ
  // открывает RMQ-транспорт — поэтому RabbitMQ для разового сбора не нужен.
  const app = await NestFactory.createApplicationContext(IndexesDataWorkerModule, {
    logger: ['log', 'warn', 'error'],
  });

  try {
    const service = app.get(IndexesDataWorkerService);
    logger.log('Снимаю свежий снэпшот индексов прямо сейчас…');
    const snap = await service.captureSnapshot();
    logger.log(
      `Готово. id=${snap.id}, capturedAt=${snap.capturedAt.toISOString()}, ` +
        `F&G=${snap.fearGreedValue}, BTC dom=${snap.btcDominancePct.toFixed(2)}%, ` +
        `Altseason=${snap.altseasonScore}, S&P=${snap.sp500Value}, Gold=${snap.goldValue}`,
    );
  } finally {
    await app.close();
  }
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('capture-once failed:', e);
    process.exit(1);
  });
