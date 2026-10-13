import { createClient } from "@supabase/supabase-js";
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY)
  throw new Error("Private storage configuration is required");
const client = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const name = process.env.SUPABASE_STORAGE_BUCKET ?? "household-evidence";
const existing = await client.storage.getBucket(name);
if (existing.error) {
  const created = await client.storage.createBucket(name, {
    public: false,
    fileSizeLimit: 8 * 1024 * 1024,
  });
  if (created.error) throw new Error("Could not create private bucket");
} else if (existing.data.public)
  throw new Error(
    "Refusing to use a public bucket. Make this dedicated bucket private first.",
  );
console.log(
  "Private evidence bucket ready. No browser storage policies are required.",
);
