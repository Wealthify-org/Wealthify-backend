import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

/**
 * Курс USD/RUB для конвертации стоимости портфелей. Источник — официальный
 * дневной курс ЦБ РФ (бесплатный JSON, без ключа). Кешируем в памяти и
 * обновляем не чаще раза в час; до первого успешного фетча и при сбоях
 * используем последнее известное (или разумный фолбэк). Прогреваем курс при
 * старте сервиса, чтобы первые запросы уже шли по реальному курсу.
 */
@Injectable()
export class FxService implements OnModuleInit {
  private readonly log = new Logger(FxService.name);
  // Фолбэк до первого успешного запроса (примерно актуальный порядок).
  private rubPerUsd = Number(process.env.FX_USD_RUB_FALLBACK) || 90;
  private fetchedAt = 0;
  private readonly ttlMs = 60 * 60 * 1000;
  private inFlight: Promise<number> | null = null;

  onModuleInit(): void {
    // прогрев в фоне — не блокируем старт
    void this.getRubPerUsd().catch(() => undefined);
  }

  /** Сколько рублей за 1 доллар. */
  async getRubPerUsd(): Promise<number> {
    if (Date.now() - this.fetchedAt < this.ttlMs) return this.rubPerUsd;
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.refresh().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async refresh(): Promise<number> {
    try {
      const res = await fetch('https://www.cbr-xml-daily.ru/daily_json.js', {
        signal: AbortSignal.timeout(8000),
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = (await res.json()) as { Valute?: { USD?: { Value?: number } } };
        const value = data?.Valute?.USD?.Value;
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
          this.rubPerUsd = value;
          this.fetchedAt = Date.now();
        }
      }
    } catch (e) {
      this.log.warn(`FX refresh failed, using ${this.rubPerUsd}: ${e instanceof Error ? e.message : e}`);
    }
    return this.rubPerUsd;
  }
}
