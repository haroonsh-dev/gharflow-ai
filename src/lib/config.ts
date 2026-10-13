export const householdLimit = () => Number(process.env.HOUSEHOLD_LIMIT ?? 10);
export const storageLimit = () =>
  Number(process.env.HOUSEHOLD_STORAGE_BYTES ?? 50 * 1024 * 1024);
export const demoEnabled = () =>
  process.env.DEMO_ENABLED === "true" && process.env.PILOT_MODE !== "true";
export const secureCookies = () =>
  process.env.PILOT_MODE === "true" || process.env.COOKIE_SECURE === "true";
