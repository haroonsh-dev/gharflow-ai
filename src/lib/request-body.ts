class BodyError extends Error {
  status = 413;
  constructor() {
    super("Request body is too large");
  }
}
export async function boundedBody(request: Request, maximum: number) {
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const parts: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      total += item.value.byteLength;
      if (total > maximum) {
        await reader.cancel();
        throw new BodyError();
      }
      parts.push(item.value);
    }
    return Buffer.concat(parts);
  } finally {
    reader.releaseLock();
  }
}
export async function jsonBody(
  request: Request,
  maximum = 16384,
): Promise<unknown> {
  return JSON.parse((await boundedBody(request, maximum)).toString("utf8"));
}
