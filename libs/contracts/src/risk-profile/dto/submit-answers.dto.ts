import { z } from "zod";
import { createZodDto } from "nestjs-zod";

export const SubmitRiskAnswerSchema = z.object({
  questionId: z.string().min(1, "questionId is required"),
  optionId: z.string().min(1, "optionId is required"),
});

export const SubmitRiskAnswersSchema = z
  .object({
    answers: z
      .array(SubmitRiskAnswerSchema)
      .min(1, "answers must contain at least one element"),
  })
  .strict();

export class SubmitRiskAnswersDto extends createZodDto(
  SubmitRiskAnswersSchema,
) {}
