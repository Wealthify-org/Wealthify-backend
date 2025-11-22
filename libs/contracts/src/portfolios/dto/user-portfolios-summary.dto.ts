import { createZodDto } from "nestjs-zod";
import z from "zod";

export const UserPortfoliosSummarySchema = z
  .object({
    totalValueUsd: z
      .number()
      .describe("Текущая стоимость всех портфелей пользователя в USD"),

    change24hAbsUsd: z
      .number()
      .describe("Абсолютное изменение стоимости портфелей за 24ч USD"),

    change24hPct: z
      .number()
      .describe("Изменение стоимости портфелей за 24ч в процентах"),
})
.strict();

export class UserPortfoliosSummaryDto extends createZodDto(
  UserPortfoliosSummarySchema,
) {}

