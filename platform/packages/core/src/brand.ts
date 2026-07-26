/**
 * Branded primitives with smart constructors.
 *
 * The point is that an `Iso3166Alpha2` must be *unconstructible* from an
 * arbitrary string. A placeholder like "XX" cannot reach generated output by
 * accident, because there is no code path that produces one without passing
 * validation first.
 */
import { type Result, ok, err } from "./result.js";

declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

export type Iso3166Alpha2 = Brand<string, "Iso3166Alpha2">;
export type Iso4217 = Brand<string, "Iso4217">;
export type Giin = Brand<string, "Giin">;
export type DocRefId = Brand<string, "DocRefId">;
export type MessageRefId = Brand<string, "MessageRefId">;
export type AccountNumber = Brand<string, "AccountNumber">;
export type Tin = Brand<string, "Tin">;
/** ISO 8601 calendar date, always YYYY-MM-DD. */
export type IsoDate = Brand<string, "IsoDate">;

export interface BrandError {
  readonly kind: "brand";
  readonly type: string;
  readonly input: string;
  readonly reason: string;
}

const fail = (type: string, input: unknown, reason: string): BrandError => ({
  kind: "brand",
  type,
  input: typeof input === "string" ? input : String(input),
  reason,
});

/**
 * ISO 3166-1 alpha-2. Deliberately excludes the "XX" / "ZZ" user-assigned
 * range: those are what placeholder-substituting code reaches for, and they are
 * not valid CRS country codes.
 */
const USER_ASSIGNED = new Set(["XX", "XY", "XZ", "ZZ", "QQ", "AA", "OO"]);

export function iso3166Alpha2(input: unknown): Result<Iso3166Alpha2, BrandError> {
  if (typeof input !== "string") return err(fail("Iso3166Alpha2", input, "not a string"));
  const v = input.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(v)) {
    return err(fail("Iso3166Alpha2", input, "must be exactly two letters (ISO 3166-1 alpha-2)"));
  }
  if (USER_ASSIGNED.has(v)) {
    return err(
      fail("Iso3166Alpha2", input, `"${v}" is a user-assigned placeholder, not a reportable jurisdiction`),
    );
  }
  return ok(v as Iso3166Alpha2);
}

export function iso4217(input: unknown): Result<Iso4217, BrandError> {
  if (typeof input !== "string") return err(fail("Iso4217", input, "not a string"));
  const v = input.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(v)) {
    return err(fail("Iso4217", input, "must be exactly three letters (ISO 4217)"));
  }
  return ok(v as Iso4217);
}

/** GIIN: XXXXXX.XXXXX.XX.XXX — a FATCA identifier, not universally the CRS one. */
export function giin(input: unknown): Result<Giin, BrandError> {
  if (typeof input !== "string") return err(fail("Giin", input, "not a string"));
  const v = input.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}\.[A-Z0-9]{5}\.(LE|SL|ME|BR|SF|SD|SS|SB)\.[0-9]{3}$/.test(v)) {
    return err(
      fail("Giin", input, "expected format XXXXXX.XXXXX.CC.NNN with a valid category code"),
    );
  }
  return ok(v as Giin);
}

/** XSD stf:StringMin1Max200_Type. Uniqueness is a ledger concern, not a format one. */
export function docRefId(input: unknown): Result<DocRefId, BrandError> {
  if (typeof input !== "string") return err(fail("DocRefId", input, "not a string"));
  const v = input.trim();
  if (v.length < 1) return err(fail("DocRefId", input, "must not be empty"));
  if (v.length > 200) return err(fail("DocRefId", input, `exceeds the 200-character schema limit (${v.length})`));
  return ok(v as DocRefId);
}

/** XSD stf:StringMin1Max170_Type. Jurisdictions narrow this further. */
export function messageRefId(input: unknown): Result<MessageRefId, BrandError> {
  if (typeof input !== "string") return err(fail("MessageRefId", input, "not a string"));
  const v = input.trim();
  if (v.length < 1) return err(fail("MessageRefId", input, "must not be empty"));
  if (v.length > 170) return err(fail("MessageRefId", input, `exceeds the 170-character schema limit (${v.length})`));
  return ok(v as MessageRefId);
}

export function accountNumber(input: unknown): Result<AccountNumber, BrandError> {
  if (typeof input !== "string" && typeof input !== "number") {
    return err(fail("AccountNumber", input, "not a string or number"));
  }
  const v = String(input).trim();
  if (v.length < 1) return err(fail("AccountNumber", input, "must not be empty"));
  if (v.length > 200) return err(fail("AccountNumber", input, `exceeds the 200-character schema limit (${v.length})`));
  return ok(v as AccountNumber);
}

export function tin(input: unknown): Result<Tin, BrandError> {
  if (typeof input !== "string" && typeof input !== "number") {
    return err(fail("Tin", input, "not a string or number"));
  }
  const v = String(input).trim();
  if (v.length < 1) return err(fail("Tin", input, "must not be empty"));
  if (v.length > 200) return err(fail("Tin", input, "exceeds the 200-character schema limit"));
  return ok(v as Tin);
}

/**
 * Strict ISO date only.
 *
 * We deliberately refuse ambiguous input like "03/04/2025". The legacy
 * implementation guessed DD/MM then fell back to MM/DD, which silently
 * misreports birth dates — a reporting-accuracy failure no validator catches.
 * Ambiguity is the caller's problem to resolve, explicitly.
 */
export function isoDate(input: unknown): Result<IsoDate, BrandError> {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return err(fail("IsoDate", "Invalid Date", "not a valid date"));
    return ok(input.toISOString().slice(0, 10) as IsoDate);
  }
  if (typeof input !== "string") return err(fail("IsoDate", input, "not a string or Date"));
  const v = input.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) {
    return err(
      fail("IsoDate", input, "must be an unambiguous ISO date (YYYY-MM-DD); ambiguous formats are rejected"),
    );
  }
  const [, y, mo, d] = m as unknown as [string, string, string, string];
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12) return err(fail("IsoDate", input, "month out of range"));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return err(fail("IsoDate", input, "not a real calendar date"));
  }
  return ok(v as IsoDate);
}

/** Escape hatch for values already validated at a trust boundary (fixtures, ledger reads). */
export const unsafeBrand = {
  iso3166: (s: string) => s as Iso3166Alpha2,
  iso4217: (s: string) => s as Iso4217,
  giin: (s: string) => s as Giin,
  docRefId: (s: string) => s as DocRefId,
  messageRefId: (s: string) => s as MessageRefId,
  accountNumber: (s: string) => s as AccountNumber,
  tin: (s: string) => s as Tin,
  isoDate: (s: string) => s as IsoDate,
} as const;
