import { el, serialize, text, type XmlElement, type XmlNode } from "@crs/core";
import type {
  FatcaAddress,
  FatcaFilingInput,
  FatcaAccountHolder,
  FatcaAccountRecord,
} from "./model.js";

const NS_FTC = "urn:oecd:ties:fatca:v2";
const NS_SFA = "urn:oecd:ties:stffatcatypes:v2";
const NS_ISO = "urn:oecd:ties:isofatcatypes:v1";

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`${name} is required for FATCA reporting.`);
  return value.trim();
}

function assertMauritiusSafe(value: unknown, path = "filing"): void {
  if (typeof value === "string") {
    if (value.includes("--") || value.includes("/*") || value.includes("&#")) {
      throw new Error(`${path} contains a prohibited FATCA character sequence.`);
    }
    if (/[#'&<>]/.test(value)) {
      throw new Error(
        `${path} contains a character MRA advises filers not to use in FATCA XML values (#, apostrophe, &, < or >).`,
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertMauritiusSafe(v, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      assertMauritiusSafe(v, `${path}.${k}`);
    }
  }
}

function address(a: FatcaAddress): XmlElement {
  return el("sfa:Address", {}, [
    el("sfa:CountryCode", {}, [text(required(a.countryCode, "Address country code"))]),
    el("sfa:AddressFix", {}, [
      a.street ? el("sfa:Street", {}, [text(a.street)]) : undefined,
      a.buildingIdentifier ? el("sfa:BuildingIdentifier", {}, [text(a.buildingIdentifier)]) : undefined,
      a.suiteIdentifier ? el("sfa:SuiteIdentifier", {}, [text(a.suiteIdentifier)]) : undefined,
      a.floorIdentifier ? el("sfa:FloorIdentifier", {}, [text(a.floorIdentifier)]) : undefined,
      a.districtName ? el("sfa:DistrictName", {}, [text(a.districtName)]) : undefined,
      a.poBox ? el("sfa:POB", {}, [text(a.poBox)]) : undefined,
      a.postCode ? el("sfa:PostCode", {}, [text(a.postCode)]) : undefined,
      el("sfa:City", {}, [text(required(a.city, "Address city"))]),
      a.countrySubentity ? el("sfa:CountrySubentity", {}, [text(a.countrySubentity)]) : undefined,
    ]),
  ]);
}

function docSpec(
  docType: string,
  docRefId: string,
  corrMessageRefId?: string,
  corrDocRefId?: string,
): XmlElement {
  return el("ftc:DocSpec", {}, [
    el("ftc:DocTypeIndic", {}, [text(docType)]),
    el("ftc:DocRefId", {}, [text(required(docRefId, "DocRefId"))]),
    corrMessageRefId ? el("ftc:CorrMessageRefId", {}, [text(corrMessageRefId)]) : undefined,
    corrDocRefId ? el("ftc:CorrDocRefId", {}, [text(corrDocRefId)]) : undefined,
  ]);
}

function holder(h: FatcaAccountHolder): XmlElement {
  if (h.kind === "individual") {
    return el("ftc:AccountHolder", {}, [
      el("ftc:Individual", {}, [
        h.residenceCountry ? el("sfa:ResCountryCode", {}, [text(h.residenceCountry)]) : undefined,
        h.tin ? el("sfa:TIN", { issuedBy: "US" }, [text(h.tin)]) : undefined,
        el("sfa:Name", {}, [
          el("sfa:FirstName", {}, [text(required(h.firstName, "First name"))]),
          el("sfa:LastName", {}, [text(required(h.lastName, "Last name"))]),
        ]),
        h.address ? address(h.address) : undefined,
      ]),
    ]);
  }
  return el("ftc:AccountHolder", {}, [
    el("ftc:Organisation", {}, [
      h.residenceCountry ? el("sfa:ResCountryCode", {}, [text(h.residenceCountry)]) : undefined,
      h.tin ? el("sfa:TIN", { issuedBy: "US" }, [text(h.tin)]) : undefined,
      el("sfa:Name", {}, [text(required(h.name, "Organisation name"))]),
      h.address ? address(h.address) : undefined,
    ]),
    el("ftc:AcctHolderType", {}, [text(h.holderType)]),
  ]);
}

function accountReport(
  record: FatcaAccountRecord,
  spec: { docType: string; docRefId: string; corrMessageRefId?: string; corrDocRefId?: string },
): XmlElement {
  return el("ftc:AccountReport", {}, [
    docSpec(spec.docType, spec.docRefId, spec.corrMessageRefId, spec.corrDocRefId),
    el(
      "ftc:AccountNumber",
      {
        ...(record.accountNumberType ? { AcctNumberType: record.accountNumberType } : {}),
      },
      [text(required(record.accountNumber, "Account number"))],
    ),
    record.closed !== undefined ? el("ftc:AccountClosed", {}, [text(String(record.closed))]) : undefined,
    holder(record.holder),
    ...(record.substantialOwners ?? []).map((owner) =>
      el("ftc:SubstantialOwner", {}, [
        el("ftc:Individual", {}, [
          owner.residenceCountry ? el("sfa:ResCountryCode", {}, [text(owner.residenceCountry)]) : undefined,
          owner.tin ? el("sfa:TIN", { issuedBy: "US" }, [text(owner.tin)]) : undefined,
          el("sfa:Name", {}, [
            el("sfa:FirstName", {}, [text(required(owner.firstName, "Substantial owner first name"))]),
            el("sfa:LastName", {}, [text(required(owner.lastName, "Substantial owner last name"))]),
          ]),
          owner.address ? address(owner.address) : undefined,
        ]),
      ]),
    ),
    el("ftc:AccountBalance", { currCode: required(record.currency, "Balance currency") }, [
      text(required(record.balance, "Account balance")),
    ]),
    ...(record.payments ?? []).map((p) =>
      el("ftc:Payment", {}, [
        el("ftc:Type", {}, [text(p.type)]),
        el("ftc:PaymentAmnt", { currCode: p.currency }, [text(p.amount)]),
      ]),
    ),
  ]);
}

/**
 * Emits the IRS FATCA XML v2 schema family used by MRA for Mauritius FATCA
 * submissions. It deliberately does NOT create the IDES transport package;
 * Mauritius FIs upload the FATCA XML to MRA eServices, which forwards it.
 */
export function emitFatcaXml(input: FatcaFilingInput): string {
  assertMauritiusSafe(input);
  const receivingCountry = input.receivingCountry ?? "US";
  const timestamp = input.timestamp ?? new Date().toISOString();

  const msgChildren: Array<XmlNode | undefined> = [
    el("sfa:SendingCompanyIN", {}, [text(required(input.reportingFi.giin, "Reporting FI GIIN"))]),
    el("sfa:TransmittingCountry", {}, [text(required(input.transmittingCountry, "Transmitting country"))]),
    el("sfa:ReceivingCountry", {}, [text(receivingCountry)]),
    el("sfa:MessageType", {}, [text("FATCA")]),
    input.contact ? el("sfa:Contact", {}, [text(input.contact)]) : undefined,
    el("sfa:MessageRefId", {}, [text(required(input.messageRefId, "MessageRefId"))]),
    input.corrMessageRefId ? el("sfa:CorrMessageRefId", {}, [text(input.corrMessageRefId)]) : undefined,
    el("sfa:ReportingPeriod", {}, [text(required(input.reportingPeriod, "Reporting period"))]),
    el("sfa:Timestamp", {}, [text(timestamp)]),
  ];

  const fi = input.reportingFi;
  const reportingFi = el("ftc:ReportingFI", {}, [
    el("sfa:ResCountryCode", {}, [text(required(fi.residenceCountry, "FI residence country"))]),
    el("sfa:TIN", { issuedBy: "US" }, [text(required(fi.giin, "FI GIIN"))]),
    el("sfa:Name", {}, [text(required(fi.name, "FI name"))]),
    fi.address ? address(fi.address) : undefined,
    el("ftc:FilerCategory", {}, [text(fi.filerCategory)]),
    docSpec(
      input.reportingFiDocType,
      input.reportingFiDocRefId,
      input.reportingFiCorrMessageRefId,
      input.reportingFiCorrDocRefId,
    ),
  ]);

  let groupChildren: XmlElement[];
  if (input.nilReport) {
    groupChildren = [
      el("ftc:NilReport", {}, [
        docSpec(
          input.nilReport.docType,
          input.nilReport.docRefId,
          input.nilReport.corrMessageRefId,
          input.nilReport.corrDocRefId,
        ),
        el("ftc:NoAccountToReport", {}, [text("yes")]),
      ]),
    ];
  } else {
    groupChildren = (input.accounts ?? []).map((x) =>
      accountReport(x.record, {
        docType: x.docType,
        docRefId: x.docRefId,
        ...(x.corrMessageRefId ? { corrMessageRefId: x.corrMessageRefId } : {}),
        ...(x.corrDocRefId ? { corrDocRefId: x.corrDocRefId } : {}),
      }),
    );
    if (groupChildren.length === 0) {
      throw new Error("FATCA filing must contain AccountReport records or a NilReport.");
    }
  }

  const root = el(
    "ftc:FATCA_OECD",
    {
      version: "2.0.1",
      "xmlns:ftc": NS_FTC,
      "xmlns:sfa": NS_SFA,
      "xmlns:iso": NS_ISO,
      "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      "xsi:schemaLocation": `${NS_FTC} FatcaXML_v2.0.1.xsd`,
    },
    [
      el("ftc:MessageSpec", {}, msgChildren),
      el("ftc:FATCA", {}, [
        reportingFi,
        el("ftc:ReportingGroup", {}, groupChildren),
      ]),
    ],
  );

  return serialize(root, { encoding: "UTF-8", indent: true });
}
