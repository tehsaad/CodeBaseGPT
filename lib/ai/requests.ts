import { z } from "zod";

export const FocusSchema = z
  .object({
    fileId: z.uuid().optional(),
    symbolId: z.uuid().optional(),
    startLine: z.number().int().positive().max(1_000_000).optional(),
    endLine: z.number().int().positive().max(1_000_000).optional(),
  })
  .optional();

export const ChatBody = z.object({
  conversationId: z.uuid().optional(),
  message: z.string().trim().min(1).max(4000),
  focus: FocusSchema,
});

export const StuckBody = z.object({
  conversationId: z.uuid().optional(),
  problem: z.string().trim().min(3).max(4000),
  errorText: z.string().max(8000).optional(),
  code: z.string().max(8000).optional(),
  focus: FocusSchema,
  queries: z.array(z.string().trim().min(3).max(300)).max(3).default([]),
  searchWeb: z.boolean().default(true),
  level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
});
