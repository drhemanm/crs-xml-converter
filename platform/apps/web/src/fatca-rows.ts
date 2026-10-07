import { FatcaAccountHolderType, FatcaDocTypeIndic, FatcaPaymentType, type FatcaAccountRecord, type FatcaFilingInput } from "@aeoi/fatca";

export type Mode = "new" | "corrected" | "void" | "amended" | "nil";

export interface Row {
  account_number?: string;
  account_number_type?: string;
  account_closed?: string;
  holder_kind?: string;
  first_name?: string;
  last_name?: string;
  holder_name?: string;
  holder_tin?: string;
  holder_residence_country?: string;
  holder_address_country?: string;
  holder_address_city?: string;
  holder_address_street?: string;
  account_holder_type?: string;
  account_balance?: string;
  currency?: string;
  payment_type?: string;
  payment_amount?: string;
  payment_currency?: string;
  doc_ref_id?: string;
  corr_message_ref_id?: string;
  corr_doc_ref_id?: string;
}

export const modeCode: Record<Mode, string> = {
  new: FatcaDocTypeIndic.New,
  corrected: FatcaDocTypeIndic.Corrected,
  void: FatcaDocTypeIndic.Void,
  amended: FatcaDocTypeIndic.Amended,
  nil: FatcaDocTypeIndic.New,
};

function money(value: string, field: string): string {
  const v = value.trim();
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(v)) throw new Error(`${field} must be a decimal amount, e.g. 1234.56`);
  return v;
}

export function parseRows(rows: Row[], mode: Exclude<Mode, "nil">): NonNullable<FatcaFilingInput["accounts"]> {
  if (!rows.length) throw new Error("No account rows loaded. Upload source data, or select Nil if there is nothing to report.");
  return rows.map((r, i) => {
    const n = i + 2;
    const holderType = (r.holder_kind || "").trim().toLowerCase();
    if (!["individual", "organisation", "organization"].includes(holderType)) {
      throw new Error(`Row ${n}: holder_kind must explicitly be individual or organisation`);
    }
    const closed = r.account_closed?.trim().toLowerCase();
    if (closed && !["true", "false", "yes", "no", "1", "0"].includes(closed)) {
      throw new Error(`Row ${n}: account_closed must be true, false, yes, no, 1 or 0`);
    }
    const paymentType = r.payment_type?.trim();
    const paymentAmount = r.payment_amount?.trim();
    if ((paymentType || paymentAmount || r.payment_currency?.trim()) && !(paymentType && paymentAmount)) {
      throw new Error(`Row ${n}: payment_type and payment_amount must both be provided; payment data cannot be silently omitted`);
    }
    if (paymentType && !Object.values(FatcaPaymentType).includes(paymentType as FatcaPaymentType)) {
      throw new Error(`Row ${n}: payment_type must be a recognised FATCA payment code`);
    }
    const organisation = holderType === "organisation" || holderType === "organization";
    if (organisation && r.account_holder_type?.trim() && !Object.values(FatcaAccountHolderType).includes(r.account_holder_type.trim() as FatcaAccountHolderType)) {
      throw new Error(`Row ${n}: account_holder_type must be the institution's actual recognised FATCA classification`);
    }
    const addressCountry = (r.holder_address_country || r.holder_residence_country || "").trim().toUpperCase();
    const addressCity = (r.holder_address_city || "").trim();
    if (!addressCountry || !addressCity) {
      throw new Error(`Row ${n}: holder_address_country and holder_address_city are required by the FATCA schema`);
    }
    const holderAddress = {
      countryCode: addressCountry,
      city: addressCity,
      ...(r.holder_address_street?.trim() ? { street: r.holder_address_street.trim() } : {}),
    };
    const record: FatcaAccountRecord = {
      accountNumber: (r.account_number || "").trim(),
      ...(r.account_number_type?.trim() ? { accountNumberType: r.account_number_type.trim() } : {}),
      ...(r.account_closed?.trim() ? { closed: /^(true|yes|1)$/i.test(r.account_closed.trim()) } : {}),
      holder: organisation
        ? {
            kind: "organisation",
            name: (r.holder_name || "").trim(),
            ...(r.holder_tin?.trim() ? { tin: r.holder_tin.trim() } : {}),
            ...(r.holder_residence_country?.trim()
              ? { residenceCountry: r.holder_residence_country.trim().toUpperCase() }
              : {}),
            holderType:
              (r.account_holder_type?.trim() as FatcaAccountHolderType),
            address: holderAddress,
          }
        : {
            kind: "individual",
            firstName: (r.first_name || "").trim(),
            lastName: (r.last_name || "").trim(),
            ...(r.holder_tin?.trim() ? { tin: r.holder_tin.trim() } : {}),
            ...(r.holder_residence_country?.trim()
              ? { residenceCountry: r.holder_residence_country.trim().toUpperCase() }
              : {}),
            address: holderAddress,
          },
      balance: money(r.account_balance || "", `Row ${n} account_balance`),
      currency: (r.currency || "").trim().toUpperCase(),
      ...(r.payment_type?.trim() && r.payment_amount?.trim()
        ? {
            payments: [
              {
                type: r.payment_type.trim() as FatcaPaymentType,
                amount: money(r.payment_amount, `Row ${n} payment_amount`),
                currency: (r.payment_currency || r.currency || "").trim().toUpperCase(),
              },
            ],
          }
        : {}),
    };
    if (!record.accountNumber) throw new Error(`Row ${n}: account_number is required`);
    if (!record.currency) throw new Error(`Row ${n}: currency is required`);
    if (record.holder.kind === "individual" && (!record.holder.firstName || !record.holder.lastName)) {
      throw new Error(`Row ${n}: first_name and last_name are required for an individual`);
    }
    if (record.holder.kind === "organisation" && !record.holder.name) {
      throw new Error(`Row ${n}: holder_name is required for an organisation`);
    }
    if (record.holder.kind === "organisation" && !r.account_holder_type?.trim()) {
      throw new Error(
        `Row ${n}: account_holder_type is required for an organisation; the tool will not infer a FATCA classification`,
      );
    }

    const docRefId = (r.doc_ref_id || "").trim();
    if (!docRefId) throw new Error(`Row ${n}: doc_ref_id is required`);
    const correcting = mode !== "new";
    if (!correcting && (r.corr_message_ref_id?.trim() || r.corr_doc_ref_id?.trim())) {
      throw new Error(`Row ${n}: new information must not contain correction reference IDs`);
    }
    const corrMessageRefId = (r.corr_message_ref_id || "").trim();
    const corrDocRefId = (r.corr_doc_ref_id || "").trim();
    if (correcting && (!corrMessageRefId || !corrDocRefId)) {
      throw new Error(`Row ${n}: correction/amendment/void requires corr_message_ref_id and corr_doc_ref_id`);
    }
    return {
      record,
      docRefId,
      docType: modeCode[mode] as FatcaDocTypeIndic,
      ...(corrMessageRefId ? { corrMessageRefId } : {}),
      ...(corrDocRefId ? { corrDocRefId } : {}),
    };
  });
}

