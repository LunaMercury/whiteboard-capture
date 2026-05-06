import { z } from "zod";

export const workerResultStatusSchema = z.enum(["pending", "running", "succeeded", "failed", "skipped"]);

export const workerResultPacketSchema = z.object({
  role: z.enum(["frontend", "rust", "java", "mobile"]),
  status: workerResultStatusSchema,
  changedFiles: z.array(z.string()),
  summary: z.string(),
  contractsChanged: z.array(z.string()),
  verificationRun: z.array(z.string()),
  risks: z.array(z.string()),
  questions: z.array(z.string()),
});

export type WorkerResultPacket = z.infer<typeof workerResultPacketSchema>;
