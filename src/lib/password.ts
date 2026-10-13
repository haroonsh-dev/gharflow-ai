import { hash, verify } from "argon2";
let active = false;
class PasswordBusy extends Error {
  status = 429;
  constructor() {
    super("Account service is busy. Try again shortly.");
  }
}
async function bounded<T>(work: () => Promise<T>) {
  if (active) throw new PasswordBusy();
  active = true;
  try {
    return await work();
  } finally {
    active = false;
  }
}
export const hashPassword = (password: string) =>
  bounded(() =>
    hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }),
  );
export const verifyPassword = (encoded: string, password: string) =>
  bounded(() => verify(encoded, password));
