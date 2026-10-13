import { z } from "zod";
export const emailSchema = z
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
export const credentialsSchema = z.object({
  email: emailSchema,
  password: z.string().min(12).max(128),
});
export const signupSchema = credentialsSchema.extend({
  invitation: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
export const recoverySchema = credentialsSchema.extend({
  recoveryCode: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
export const checklistSchema = z.object({
  inspectSource: z.boolean().default(false),
  checkRecords: z.boolean().default(false),
  prepareReport: z.boolean().default(false),
  recordOutcome: z.boolean().default(false),
});
const date = z.iso.date();
const amount = z.coerce
  .number()
  .finite()
  .min(0)
  .max(100000000)
  .multipleOf(0.01);
const reading = z.coerce
  .number()
  .finite()
  .min(0)
  .max(1000000000)
  .multipleOf(0.001);
const meterIdentity = z.string().trim().min(1).max(80).nullable().default(null);
export const candidateSchema = z.object({
  value: z.string().max(100),
  page: z.number().int().min(1).max(2),
  confidence: z.number().min(0).max(100).nullable(),
  box: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
  }),
});
export const pageSchema = z.object({
  page: z.number().int().min(1).max(2),
  width: z.number().int().positive().max(30000),
  height: z.number().int().positive().max(30000),
  mime: z.enum(["image/png", "image/jpeg"]),
});
export const extractionSchema = z.object({
  candidates: z.record(z.string().max(80), candidateSchema),
  pages: z.array(pageSchema).max(2),
  verifiedFormat: z.literal(false),
});
export const ocrResponseSchema = z.object({
  fields: z.record(z.string().max(80), z.string().max(100)),
  candidates: z.record(z.string().max(80), candidateSchema),
  pages: z
    .array(pageSchema.extend({ imageBase64: z.string().max(12000000) }))
    .max(2),
});
export const billSchema = z.object({
  evidenceFileId: z.uuid().nullable().optional(),
  referenceNumber: z.string().regex(/^\d{14}$/),
  billMonth: date.refine(
    (value) => value.endsWith("-01"),
    "Bill month must use the first day of the month",
  ),
  previousReading: reading.nullable(),
  currentReading: reading.nullable(),
  multiplier: z.coerce
    .number()
    .finite()
    .positive()
    .max(10000)
    .multipleOf(0.001),
  billedUnits: reading.nullable(),
  totalAmount: amount,
  dueDate: date.nullable(),
  meterIdentity,
  readingDate: date.nullable().default(null),
  readingStatus: z.enum(["actual", "estimated", "unknown"]).default("unknown"),
  meterType: z
    .enum(["conventional", "unsupported", "unknown"])
    .default("unknown"),
  replacesBillId: z.uuid().nullable().optional(),
  confirmed: z.literal(true),
});
export const meterSchema = z.object({
  referenceNumber: z.string().regex(/^\d{14}$/),
  meterIdentity: z.string().trim().min(1).max(80),
  readingDate: date,
  readingValue: reading,
  meterType: z
    .enum(["conventional", "unsupported", "unknown"])
    .default("unknown"),
  multiplier: z.coerce
    .number()
    .finite()
    .positive()
    .max(10000)
    .multipleOf(0.001)
    .default(1),
  note: z.string().max(300).default(""),
  evidenceFileId: z.uuid().nullable().optional(),
});
export const paymentSchema = z.object({
  billId: z.uuid(),
  evidenceFileId: z.uuid().nullable().optional(),
  amount: amount.positive(),
  paidAt: date,
  channel: z.string().min(1).max(80),
  reference: z.string().max(120).default(""),
});
export const caseStatusSchema = z.enum([
  "open",
  "awaiting_response",
  "resolved",
  "dismissed",
]);
export const caseCreateSchema = z.object({
  findingId: z.string().min(1).max(120),
  notes: z.string().max(3000).default(""),
  evidenceIds: z.array(z.uuid()).max(10).default([]),
});
export const caseUpdateSchema = z.object({
  status: caseStatusSchema,
  notes: z.string().max(3000),
  outcome: z.string().max(3000),
  evidenceIds: z.array(z.uuid()).max(1000),
  checklist: checklistSchema.optional(),
});
export const aiInvestigationRequestSchema = z.object({
  findingId: z.string().min(1).max(120),
  question: z.string().trim().min(8).max(600),
  consent: z.literal(true),
});
export type BillInput = z.infer<typeof billSchema>;
export type Extraction = z.infer<typeof extractionSchema>;
