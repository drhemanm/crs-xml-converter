import { useEffect, useState } from "react";
import {
  createInstitution,
  createOrganization,
  listInstitutions,
  listOrganizations,
  hydrateInstitutionForFiling,
  signIn,
  signOut,
  signUp,
  validSession,
  type BackendSession,
  type Organization,
  type ReportingInstitution,
  type WorkspaceSelection,
} from "../backend.js";

interface Props {
  value: WorkspaceSelection | null;
  onChange: (workspace: WorkspaceSelection | null) => void;
  onIdentityChange?: (session: BackendSession | null) => void;
  onCompanyChange?: (organization: Organization | null) => void;
  revision?: number;
}

export function WorkspaceBar({
  value,
  onChange,
  onIdentityChange,
  onCompanyChange,
  revision = 0,
}: Props) {
  const [session, setSession] = useState<BackendSession | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [institutions, setInstitutions] = useState<ReportingInstitution[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [fiName, setFiName] = useState("");
  const [fiId, setFiId] = useState("");
  const [fiCity, setFiCity] = useState("Port Louis");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const reloadOrganizations = async (s: BackendSession) => {
    setSession(s);
    onIdentityChange?.(s);
    const rows = await listOrganizations();
    setOrganizations(rows);
    if (!rows.length) {
      setInstitutions([]);
      onCompanyChange?.(null);
      onChange(null);
      return;
    }
    const org =
      value?.organization && rows.some((o) => o.id === value.organization.id)
        ? value.organization
        : rows[0]!;
    setSelectedOrgId(org.id);
    onCompanyChange?.(org);
    const fis = await listInstitutions(org.id);
    setInstitutions(fis);
    if (fis.length) {
      const selected =
        value?.institution && fis.some((fi) => fi.id === value.institution.id)
          ? value.institution
          : fis[0]!;
      const institution = await hydrateInstitutionForFiling(selected);
      onChange({ session: s, organization: org, institution });
    } else {
      onChange(null);
    }
  };

  useEffect(() => {
    setBusy(true);
    void validSession()
      .then((s) => {
        if (s) return reloadOrganizations(s);
        return undefined;
      })
      .catch((e) => setMessage((e as Error).message))
      .finally(() => setBusy(false));
    // Startup and explicit institution additions. Selection changes are driven below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);

  const authenticate = async (kind: "signin" | "signup") => {
    setBusy(true);
    setMessage("");
    try {
      if (!email.trim() || password.length < 8) {
        throw new Error(
          "Enter a valid email and a password of at least 8 characters.",
        );
      }
      if (kind === "signin") {
        const s = await signIn(email.trim(), password);
        await reloadOrganizations(s);
      } else {
        const s = await signUp(email.trim(), password);
        if (s) await reloadOrganizations(s);
        else
          setMessage(
            "Account created. Check your email if confirmation is enabled, then sign in.",
          );
      }
      setPassword("");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addOrganization = async () => {
    setBusy(true);
    setMessage("");
    try {
      if (!session) throw new Error("Sign in first.");
      const org = await createOrganization(orgName);
      const rows = await listOrganizations();
      setOrganizations(rows);
      setSelectedOrgId(org.id);
      onCompanyChange?.(org);
      setInstitutions([]);
      setOrgName("");
      onChange(null);
      setMessage(
        `Organization "${org.name}" created. Add its first reporting institution.`,
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const selectOrganization = async (id: string) => {
    if (!session) return;
    const org = organizations.find((o) => o.id === id);
    if (!org) return;
    setBusy(true);
    setMessage("");
    setSelectedOrgId(org.id);
    onCompanyChange?.(org);
    onChange(null);
    try {
      const fis = await listInstitutions(org.id);
      setInstitutions(fis);
      if (fis[0]) {
        const institution = await hydrateInstitutionForFiling(fis[0]);
        onChange({ session, organization: org, institution });
      } else {
        onChange(null);
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addInstitution = async () => {
    if (!session) return;
    const org =
      organizations.find((o) => o.id === selectedOrgId) ??
      value?.organization ??
      organizations[0];
    if (!org) {
      setMessage("Create an organization first.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      if (!fiName.trim() || !fiId.trim())
        throw new Error("Institution name and identifier are required.");
      const fi = await createInstitution(org.id, {
        legal_name: fiName.trim(),
        jurisdiction: "MU",
        identifier_type: "TAN",
        identifier_value: fiId.trim(),
        city: fiCity.trim() || "Port Louis",
      });
      const fis = await listInstitutions(org.id);
      setInstitutions(fis);
      setFiName("");
      setFiId("");
      onChange({
        session,
        organization: org,
        institution: await hydrateInstitutionForFiling(fi),
      });
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!session) {
    return (
      <section className="workspace-bar" aria-label="Connected workspace">
        <div>
          <strong>Local evaluation mode</strong>
          <span className="hint">
            {" "}
            Account data stays on this device. Sign in to persist filing
            metadata and correction history.
          </span>
        </div>
        <div className="workspace-actions">
          <input
            aria-label="Workspace email"
            type="email"
            autoComplete="username"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            aria-label="Workspace password"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button disabled={busy} onClick={() => void authenticate("signin")}>
            Sign in
          </button>
          <button disabled={busy} onClick={() => void authenticate("signup")}>
            Create account
          </button>
        </div>
        {message ? (
          <p className="hint" role="status">
            {message}
          </p>
        ) : null}
      </section>
    );
  }

  const activeOrg =
    organizations.find((o) => o.id === selectedOrgId) ??
    value?.organization ??
    organizations[0] ??
    null;
  return (
    <section
      className="workspace-bar connected"
      aria-label="Connected workspace"
    >
      <div className="workspace-title">
        <strong>Connected filing workspace</strong>
        <span className="state live">durable ledger</span>
        <span className="hint">
          Only filing metadata and reference history are synchronised.
          Account-holder source data stays local.
        </span>
      </div>

      <div className="workspace-actions">
        {organizations.length ? (
          <select
            aria-label="Organization"
            disabled={busy}
            value={activeOrg?.id ?? selectedOrgId}
            onChange={(e) => void selectOrganization(e.target.value)}
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        ) : (
          <>
            <input
              aria-label="New organization name"
              placeholder="Organization name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
            <button disabled={busy} onClick={() => void addOrganization()}>
              Create organization
            </button>
          </>
        )}

        {activeOrg && institutions.length ? (
          <select
            aria-label="Reporting institution"
            disabled={busy}
            value={value?.institution.id ?? institutions[0]!.id}
            onChange={(e) => {
              const fi = institutions.find((x) => x.id === e.target.value);
              if (fi) {
                setBusy(true);
                setMessage("");
                void hydrateInstitutionForFiling(fi)
                  .then((institution) =>
                    onChange({ session, organization: activeOrg, institution }),
                  )
                  .catch((e) => setMessage((e as Error).message))
                  .finally(() => setBusy(false));
              }
            }}
          >
            {institutions.map((fi) => (
              <option key={fi.id} value={fi.id}>
                {fi.legal_name}
              </option>
            ))}
          </select>
        ) : activeOrg ? (
          <>
            <input
              aria-label="New institution name"
              placeholder="Institution name"
              value={fiName}
              onChange={(e) => setFiName(e.target.value)}
            />
            <input
              aria-label="New institution TAN"
              placeholder="TAN"
              value={fiId}
              onChange={(e) => setFiId(e.target.value)}
            />
            <input
              aria-label="New institution city"
              placeholder="City"
              value={fiCity}
              onChange={(e) => setFiCity(e.target.value)}
            />
            <button disabled={busy} onClick={() => void addInstitution()}>
              Add institution
            </button>
          </>
        ) : null}

        <button
          disabled={busy}
          onClick={() =>
            void signOut().then(() => {
              setSession(null);
              onIdentityChange?.(null);
              onCompanyChange?.(null);
              setOrganizations([]);
              setInstitutions([]);
              setSelectedOrgId("");
              onChange(null);
            })
          }
        >
          Sign out
        </button>
      </div>
      {message ? (
        <p className="hint" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
