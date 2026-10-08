const DEFAULT_URL = "https://prlarcyfngvwkavmktex.supabase.co";
const DEFAULT_KEY = "sb_publishable_-ho_gmFMykjbQdHRKO4h9A_X6qtSz_U";

export const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] || DEFAULT_URL;
export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || DEFAULT_KEY;

const SESSION_KEY = "aeoi.supabase.session.v1";

const REQUEST_TIMEOUT_MS = 20000;

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (cause) {
    if ((cause as Error)?.name === "AbortError") {
      throw new Error("The filing workspace did not respond within 20 seconds. No retry was performed for this write.");
    }
    throw cause;
  } finally {
    clearTimeout(timer);
  }
}


export interface BackendUser {
  id: string;
  email?: string;
}

export interface BackendSession {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user: BackendUser;
}

export interface Organization {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface ReportingInstitution {
  id: string;
  organization_id: string;
  legal_name: string;
  jurisdiction: string;
  identifier_type: "TAN" | "TIN" | "GIIN" | "UEN" | "OTHER";
  identifier_value: string;
  city: string | null;
  active: boolean;
  pseudonym_key?: string;
}

export interface RemoteLedgerEntry {
  doc_ref_id: string;
  record_kind: "ReportingFI" | "AccountReport" | "NilReport";
  record_state: "pending" | "live" | "superseded" | "deleted" | "rejected";
  doc_type_indic: string;
  message_ref_id?: string;
  corr_doc_ref_id: string | null;
  parent_doc_ref_id: string | null;
  superseded_by: string | null;
  business_key: string;
  payload_digest: string;
  reporting_period_end: string;
  schema_version: string;
  filing_id: string;
  created_at: string;
}

export interface WorkspaceSelection {
  session: BackendSession;
  organization: Organization;
  institution: ReportingInstitution;
}

function headers(token?: string): HeadersInit {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function saveSession(session: BackendSession | null): void {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  const normalized = {
    ...session,
    expires_at:
      session.expires_at ??
      (session.expires_in ? Math.floor(Date.now() / 1000) + session.expires_in : undefined),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
}

export function readSession(): BackendSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BackendSession;
    return parsed.access_token && parsed.refresh_token && parsed.user?.id ? parsed : null;
  } catch {
    return null;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    const message =
      body && typeof body === "object"
        ? String(
            (body as Record<string, unknown>)["msg"] ??
              (body as Record<string, unknown>)["message"] ??
              (body as Record<string, unknown>)["error_description"] ??
              (body as Record<string, unknown>)["error"] ??
              response.statusText,
          )
        : response.statusText;
    throw new Error(message || `Request failed with HTTP ${response.status}`);
  }
  return body as T;
}

export async function signUp(email: string, password: string): Promise<BackendSession | null> {
  const response = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email, password }),
  });
  const data = await parseResponse<BackendSession | { user: BackendUser; session: BackendSession | null }>(response);
  const session = "session" in data ? data.session : data.access_token ? data : null;
  if (session) saveSession(session);
  return session;
}

export async function signIn(email: string, password: string): Promise<BackendSession> {
  const response = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email, password }),
  });
  const session = await parseResponse<BackendSession>(response);
  saveSession(session);
  return session;
}

async function refreshSession(session: BackendSession): Promise<BackendSession> {
  const response = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  const refreshed = await parseResponse<BackendSession>(response);
  saveSession(refreshed);
  return refreshed;
}

export async function validSession(): Promise<BackendSession | null> {
  const session = readSession();
  if (!session) return null;
  const expiresAt = session.expires_at ?? 0;
  if (expiresAt > Math.floor(Date.now() / 1000) + 60) return session;
  try {
    return await refreshSession(session);
  } catch {
    saveSession(null);
    return null;
  }
}

export async function signOut(): Promise<void> {
  const session = readSession();
  if (session) {
    await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: headers(session.access_token),
    }).catch(() => undefined);
  }
  saveSession(null);
}

export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let session = await validSession();
  if (!session) throw new Error("Sign in to use the connected filing workspace.");

  let response = await fetchWithTimeout(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: { ...headers(session.access_token), ...(init.headers ?? {}) },
  });
  if (response.status === 401) {
    session = await refreshSession(session);
    response = await fetchWithTimeout(`${SUPABASE_URL}${path}`, {
      ...init,
      headers: { ...headers(session.access_token), ...(init.headers ?? {}) },
    });
  }
  return response;
}

export async function listOrganizations(): Promise<Organization[]> {
  const r = await authedFetch("/rest/v1/organizations?select=id,name,created_by,created_at&order=created_at.asc");
  return parseResponse<Organization[]>(r);
}

export async function createOrganization(name: string): Promise<Organization> {
  const session = await validSession();
  if (!session) throw new Error("Sign in first.");
  const r = await authedFetch("/rest/v1/organizations?select=id,name,created_by,created_at", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ name: name.trim(), created_by: session.user.id }),
  });
  const rows = await parseResponse<Organization[]>(r);
  if (!rows[0]) throw new Error("Organization was not created.");
  return rows[0];
}

export async function listInstitutions(organizationId: string): Promise<ReportingInstitution[]> {
  const query = new URLSearchParams({
    select: "id,organization_id,legal_name,jurisdiction,identifier_type,identifier_value,city,active",
    organization_id: `eq.${organizationId}`,
    active: "eq.true",
    order: "legal_name.asc",
  });
  const r = await authedFetch(`/rest/v1/reporting_institutions?${query.toString()}`);
  return parseResponse<ReportingInstitution[]>(r);
}

export async function createInstitution(
  organizationId: string,
  input: Pick<
    ReportingInstitution,
    "legal_name" | "jurisdiction" | "identifier_type" | "identifier_value" | "city"
  >,
): Promise<ReportingInstitution> {
  const r = await authedFetch("/rest/v1/reporting_institutions?select=id,organization_id,legal_name,jurisdiction,identifier_type,identifier_value,city,active", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ organization_id: organizationId, ...input }),
  });
  const rows = await parseResponse<ReportingInstitution[]>(r);
  if (!rows[0]) throw new Error("Reporting institution was not created.");
  return rows[0];
}

export async function loadRemoteLedger(
  organizationId: string,
  institutionId: string,
  regime: "CRS" | "FATCA",
): Promise<RemoteLedgerEntry[]> {
  const query = new URLSearchParams({
    select:
      "doc_ref_id,record_kind,record_state,doc_type_indic,corr_doc_ref_id,parent_doc_ref_id,superseded_by,business_key,payload_digest,reporting_period_end,schema_version,filing_id,created_at,filings(message_ref_id)",
    organization_id: `eq.${organizationId}`,
    institution_id: `eq.${institutionId}`,
    regime: `eq.${regime}`,
    order: "created_at.asc",
  });
  const r = await authedFetch(`/rest/v1/ledger_entries?${query.toString()}`);
  const rows = await parseResponse<Array<RemoteLedgerEntry & { filings?: { message_ref_id?: string } | null }>>(r);
  return rows.map(({ filings, ...row }) => ({
    ...row,
    ...(filings?.message_ref_id ? { message_ref_id: filings.message_ref_id } : {}),
  }));
}

export interface FilingMetadataEntry {
  record_kind: "ReportingFI" | "AccountReport" | "NilReport";
  doc_ref_id: string;
  corr_doc_ref_id?: string;
  parent_doc_ref_id?: string;
  business_key: string;
  payload_digest: string;
  record_state: "pending" | "live" | "superseded" | "deleted" | "rejected";
  doc_type_indic: string;
  superseded_by?: string;
}

export async function recordRemoteFiling(input: {
  organizationId: string;
  institutionId: string;
  regime: "CRS" | "FATCA";
  reportingPeriodEnd: string;
  schemaVersion: string;
  filingKind: "new" | "correction" | "void" | "amended" | "nil";
  messageRefId: string;
  xmlSha256: string;
  entries: FilingMetadataEntry[];
}): Promise<string> {
  const r = await authedFetch("/rest/v1/rpc/aeoi_record_filing", {
    method: "POST",
    body: JSON.stringify({
      p_organization_id: input.organizationId,
      p_institution_id: input.institutionId,
      p_regime: input.regime,
      p_reporting_period_end: input.reportingPeriodEnd,
      p_schema_version: input.schemaVersion,
      p_filing_kind: input.filingKind,
      p_message_ref_id: input.messageRefId,
      p_xml_sha256: input.xmlSha256,
      p_entries: input.entries,
    }),
  });
  return parseResponse<string>(r);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}


export interface AuthorityLedgerUpdate {
  doc_ref_id: string;
  record_state: "pending" | "live" | "superseded" | "deleted" | "rejected";
  superseded_by?: string;
}

export async function applyRemoteAuthorityStatus(input: {
  organizationId: string;
  filingId: string;
  authority: string;
  overallStatus: string;
  responseRef?: string;
  responseSha256?: string;
  parsedErrors: unknown[];
  updates: AuthorityLedgerUpdate[];
}): Promise<void> {
  const r = await authedFetch("/rest/v1/rpc/aeoi_apply_authority_status", {
    method: "POST",
    body: JSON.stringify({
      p_organization_id: input.organizationId,
      p_filing_id: input.filingId,
      p_authority: input.authority,
      p_overall_status: input.overallStatus,
      p_response_ref: input.responseRef ?? "",
      p_response_sha256: input.responseSha256 ?? "",
      p_parsed_errors: input.parsedErrors,
      p_updates: input.updates,
    }),
  });
  if (!r.ok) await parseResponse<unknown>(r);
}


export async function getInstitutionPseudonymKey(institutionId: string): Promise<string> {
  const r = await authedFetch("/rest/v1/rpc/aeoi_get_pseudonym_key", {
    method: "POST",
    body: JSON.stringify({ p_institution_id: institutionId }),
  });
  return parseResponse<string>(r);
}

export async function hydrateInstitutionForFiling(
  institution: ReportingInstitution,
): Promise<ReportingInstitution> {
  try {
    const pseudonym_key = await getInstitutionPseudonymKey(institution.id);
    return { ...institution, pseudonym_key };
  } catch {
    return institution;
  }
}
