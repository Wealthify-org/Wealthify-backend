import { Module } from "@nestjs/common";
import { OpenRouterModule } from "@libs/openrouter";
import { DescriptionTranslatorService } from "./description-translator.service";

/**
 * Маленький модуль-обёртка над DescriptionTranslator. Импортируется в
 * CryptoDataWorkerModule. Использует общий OpenRouterModule (тот же
 * ключ и модель что у chat-сервиса).
 */
@Module({
  imports: [OpenRouterModule],
  providers: [DescriptionTranslatorService],
  exports: [DescriptionTranslatorService],
})
export class TranslatorModule {}
