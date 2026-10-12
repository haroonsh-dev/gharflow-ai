import { z } from "zod";

export const emailSchema = z.email().max(254).transform((value) => value.toLowerCase());
export const credentialsSchema = z.object({ email: emailSchema, password: z.string().min(12).max(128) });
const date = z.iso.date();
const amount = z.coerce.number().finite().min(0).max(100000000);
const reading = z.coerce.number().finite().min(0).max(1000000000);

export const billSchema = z.object({
  evidenceFileId: z.uuid().nullable().optional(),
  referenceNumber: z.string().regex(/^\d{14}$/),
  billMonth: date,
  previousReading: reading.nullable(),
  currentReading: reading.nullable(),
  multiplier: z.coerce.number().finite().positive().max(10000),
  billedUnits: reading.nullable(),
  totalAmount: amount,
  dueDate: date.nullable(),
  fieldSources: z.record(z.string(), z.enum(["ocr", "user"])),
  ocrStatus: z.enum(["extracted", "failed", "manual"]),
});
export const meterSchema = z.object({ readingDate: date, readingValue: reading, note: z.string().max(300).default("") });
export const paymentSchema = z.object({ billId: z.uuid(), evidenceFileId: z.uuid().nullable().optional(), amount: amount.positive(), paidAt: date, channel: z.string().min(1).max(80), reference: z.string().max(120).default("") });

export type BillInput = z.infer<typeof billSchema>;
