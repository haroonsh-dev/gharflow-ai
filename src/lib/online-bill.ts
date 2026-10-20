/**
 * Online Utility Bill Verification & Ingestion Engine for Pakistan
 * Interfaces with PITC (Power Information Technology Company) and K-Electric.
 */

export type DiscoCode =
  | "LESCO"
  | "GEPCO"
  | "FESCO"
  | "IESCO"
  | "MEPCO"
  | "PESCO"
  | "HESCO"
  | "SEPCO"
  | "QESCO"
  | "TESCO"
  | "KE";

export type DiscoInfo = {
  code: DiscoCode;
  name: string;
  region: string;
  helpline: string;
  portalUrl: string;
  billQueryUrl: (ref: string) => string;
};

export const DISCO_DIRECTORY: Record<DiscoCode, DiscoInfo> = {
  LESCO: {
    code: "LESCO",
    name: "Lahore Electric Supply Company",
    region: "Lahore, Kasur, Okara, Sheikhupura, Nankana",
    helpline: "118 / 0800-00055",
    portalUrl: "https://lesco.gov.pk",
    billQueryUrl: (ref) =>
      `https://bill.pitc.com.pk/lescobill/general?refno=${ref}`,
  },
  GEPCO: {
    code: "GEPCO",
    name: "Gujranwala Electric Power Company",
    region: "Gujranwala, Sialkot, Gujrat, Hafizabad, Narowal, Mandi Bahauddin",
    helpline: "118 / 055-9200516",
    portalUrl: "https://gepco.com.pk",
    billQueryUrl: (ref) =>
      `https://bill.pitc.com.pk/gepcobill/general?refno=${ref}`,
  },
  FESCO: {
    code: "FESCO",
    name: "Faisalabad Electric Supply Company",
    region: "Faisalabad, Jhang, Toba Tek Singh, Chiniot, Sargodha, Mianwali, Khushab, Bhakkar",
    helpline: "118 / 041-9220184",
    portalUrl: "https://fesco.com.pk",
    billQueryUrl: (ref) =>
      `https://bill.pitc.com.pk/fescobill/general?refno=${ref}`,
  },
  IESCO: {
    code: "IESCO",
    name: "Islamabad Electric Supply Company",
    region: "Islamabad, Rawalpindi, Attock, Jhelum, Chakwal",
    helpline: "118 / 051-9252937",
    portalUrl: "https://iesco.com.pk",
    billQueryUrl: (ref) =>
      `https://bill.pitc.com.pk/iescobill/general?refno=${ref}`,
  },
  MEPCO: {
    code: "MEPCO",
    name: "Multan Electric Power Company",
    region: "Multan, Sahiwal, Bahawalpur, D.G. Khan, Rahim Yar Khan",
    helpline: "118 / 0800-63726",
    portalUrl: "https://mepco.com.pk",
    billQueryUrl: (ref) =>
      `https://bill.pitc.com.pk/mepcobill/general?refno=${ref}`,
  },
  PESCO: {
    code: "PESCO",
    name: "Peshawar Electric Supply Company",
    region: "Peshawar, Mardan, Swat, Abbottabad, Bannu, D.I. Khan",
    helpline: "118 / 091-9211997",
    portalUrl: "https://pesco.com.pk",
    billQueryUrl: (ref) =>
      `https://bill.pitc.com.pk/pescobill/general?refno=${ref}`,
  },
  HESCO: {
    code: "HESCO",
    name: "Hyderabad Electric Supply Company",
    region: "Hyderabad, Mirpurkhas, Nawabshah, Badin, Thatta",
    helpline: "118 / 022-9260161",
    portalUrl: "https://hesco.gov.pk",
    billQueryUrl: (ref) =>
      `https://bill.pitc.com.pk/hescobill/general?refno=${ref}`,
  },
  SEPCO: {
    code: "SEPCO",
    name: "Sukkur Electric Power Company",
    region: "Sukkur, Larkana, Shikarpur, Jacobabad, Ghotki",
    helpline: "118 / 071-9310797",
    portalUrl: "https://sepco.com.pk",
    billQueryUrl: (ref) =>
      `https://bill.pitc.com.pk/sepcobill/general?refno=${ref}`,
  },
  QESCO: {
    code: "QESCO",
    name: "Quetta Electric Supply Company",
    region: "Balochistan province",
    helpline: "118 / 081-9201750",
    portalUrl: "https://qesco.com.pk",
    billQueryUrl: (ref) =>
      `https://bill.pitc.com.pk/qescobill/general?refno=${ref}`,
  },
  TESCO: {
    code: "TESCO",
    name: "Tribal Electric Supply Company",
    region: "Khyber, Bajaur, Mohmand, Kurram, Waziristan",
    helpline: "118",
    portalUrl: "https://tesco.gov.pk",
    billQueryUrl: (ref) =>
      `https://bill.pitc.com.pk/tescobill/general?refno=${ref}`,
  },
  KE: {
    code: "KE",
    name: "K-Electric",
    region: "Karachi, Hub, Dhabeji",
    helpline: "118 / 021-99000",
    portalUrl: "https://www.ke.com.pk",
    billQueryUrl: (ref) =>
      `https://www.ke.com.pk/customer-services/bill-and-payment/duplicate-bill/?account=${ref}`,
  },
};

/**
 * Automatically identifies the utility company (DISCO) from the connection reference number.
 */
export function identifyDisco(referenceNumber: string): DiscoInfo {
  const clean = referenceNumber.replace(/\D/g, "");
  if (clean.length === 13) {
    return DISCO_DIRECTORY.KE;
  }

  if (clean.length === 14) {
    const prefix = parseInt(clean.slice(0, 2), 10);
    if (prefix >= 1 && prefix <= 8) return DISCO_DIRECTORY.LESCO;
    if (prefix >= 9 && prefix <= 11) return DISCO_DIRECTORY.GEPCO;
    if (prefix >= 12 && prefix <= 15) return DISCO_DIRECTORY.FESCO;
    if (prefix >= 16 && prefix <= 19) return DISCO_DIRECTORY.IESCO;
    if (prefix >= 20 && prefix <= 24) return DISCO_DIRECTORY.MEPCO;
    if (prefix >= 25 && prefix <= 28) return DISCO_DIRECTORY.PESCO;
    if (prefix >= 29 && prefix <= 30) return DISCO_DIRECTORY.HESCO;
    if (prefix >= 31 && prefix <= 32) return DISCO_DIRECTORY.SEPCO;
    if (prefix >= 33 && prefix <= 34) return DISCO_DIRECTORY.QESCO;
    if (prefix >= 35 && prefix <= 38) return DISCO_DIRECTORY.TESCO;
  }

  // Default fallback to LESCO
  return DISCO_DIRECTORY.LESCO;
}

export type ParsedOnlineBill = {
  referenceNumber: string;
  disco: DiscoCode;
  consumerName?: string;
  billMonth?: string;
  readingDate?: string;
  dueDate?: string;
  unitsConsumed?: number;
  totalAmount?: number;
  tariff?: string;
  meterNumber?: string;
  isVerified: boolean;
};

/**
 * Extracts key fields from raw PITC HTML responses.
 */
export function parsePitcHtml(html: string, referenceNumber: string): ParsedOnlineBill {
  const disco = identifyDisco(referenceNumber);
  const result: ParsedOnlineBill = {
    referenceNumber,
    disco: disco.code,
    isVerified: false,
  };

  // Strip scripts and tags for basic regex matching
  const cleanText = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();

  const unitsMatch = cleanText.match(/(?:UNITS\s+CONSUMED|TOTAL\s+UNITS|CONSUMED\s+UNITS)[\s:.]*([0-9]{1,8})/);
  if (unitsMatch) result.unitsConsumed = parseInt(unitsMatch[1], 10);

  const amountMatch = cleanText.match(/(?:PAYABLE\s+WITHIN\s+DUE\s+DATE|AMOUNT\s+PAYABLE|TOTAL\s+AMOUNT)[\s:.]*([0-9,]{1,12})/);
  if (amountMatch) result.totalAmount = parseFloat(amountMatch[1].replace(/,/g, ""));

  const meterMatch = cleanText.match(/METER\s*(?:NO|#)[\s:.]*([A-Z0-9-]{3,30})/);
  if (meterMatch) result.meterNumber = meterMatch[1];

  const dateMatch = cleanText.match(/READING\s+DATE[\s:.]*(\d{2}-[A-Z]{3}-\d{2,4}|\d{4}-\d{2}-\d{2})/);
  if (dateMatch) result.readingDate = dateMatch[1];

  if (result.unitsConsumed !== undefined && result.totalAmount !== undefined) {
    result.isVerified = true;
  }

  return result;
}
