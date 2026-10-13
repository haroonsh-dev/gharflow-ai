import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
export interface ObjectStore {
  put(key: string, bytes: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(keys: string[]): Promise<void>;
  health(): Promise<void>;
}
export function validateKey(key: string) {
  if (!/^[a-f0-9-]{36}\/[a-f0-9-]{36}(?:-preview-[12])?$/.test(key))
    throw new Error("Invalid storage key");
  return key;
}
function localStore(): ObjectStore {
  const root = path.resolve(
    /*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./private_uploads",
  );
  const location = (key: string) =>
    path.join(/*turbopackIgnore: true*/ root, validateKey(key));
  return {
    async put(key, bytes) {
      const target = location(key);
      await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
      await writeFile(target, bytes, { mode: 0o600 });
    },
    async get(key) {
      return readFile(location(key));
    },
    async remove(keys) {
      for (const key of keys) await rm(location(key), { force: true });
    },
    async health() {
      await mkdir(root, { recursive: true, mode: 0o700 });
    },
  };
}
function supabaseStore(): ObjectStore {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Cloud storage configuration is missing");
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(20000) }),
    },
  });
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "household-evidence";
  const objects = client.storage.from(bucket);
  return {
    async put(key, bytes) {
      const result = await objects.upload(validateKey(key), bytes, {
        contentType: "application/octet-stream",
        upsert: true,
      });
      if (result.error) throw new Error("Private storage write failed");
    },
    async get(key) {
      const result = await objects.download(validateKey(key));
      if (result.error || !result.data)
        throw new Error("Private storage read failed");
      return Buffer.from(await result.data.arrayBuffer());
    },
    async remove(keys) {
      if (!keys.length) return;
      const result = await objects.remove(keys.map(validateKey));
      if (result.error) throw new Error("Private storage deletion failed");
    },
    async health() {
      const result = await client.storage.getBucket(bucket);
      if (result.error || !result.data || result.data.public)
        throw new Error("A private storage bucket is required");
    },
  };
}
export function createObjectStore() {
  return process.env.STORAGE_DRIVER === "supabase"
    ? supabaseStore()
    : localStore();
}
let instance: ObjectStore | undefined;
export function objectStore() {
  return (instance ??= createObjectStore());
}
