import { useEffect, useState } from "react";
import type { Organization } from "../backend.js";
import { createInstitution } from "../backend.js";
import {
  commercialRpc,
  money,
  paymentAction,
  type AdminDashboard,
  type CompanyBilling,
  type CommercialPlan,
  type PaymentRequest,
} from "../commercial.js";

const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", {
        timeZone: "UTC",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "None yet";

function Allowance({ billing }: { billing: CompanyBilling }) {
  return (
    <section className="card commercial-summary" aria-label="Company licence">
      <div className="commercial-heading">
        <div>
          <p className="eyebrow">Company licence</p>
          <h2>{billing.plan_name}</h2>
        </div>
        <span
          className={`state ${billing.status === "active" ? "live" : "pending"}`}
        >
          {billing.status}
        </span>
      </div>
      <p>
        {billing.status === "evaluation"
          ? "Evaluation ends"
          : "Current term ends"}{" "}
        {date(billing.period_end)}. Allowances are shared across this company's
        team and institutions.
      </p>
      <div className="commercial-metrics">
        <div>
          <span>
            Annual filing allowance
            {billing.status === "evaluation" ? " (pilot)" : ""}
          </span>
          <strong>
            {billing.filings_used} <small>/ {billing.filing_limit}</small>
          </strong>
          <progress
            aria-label="Company filing allowance used"
            value={Math.min(billing.filings_used, billing.filing_limit)}
            max={billing.filing_limit}
          />
        </div>
        <div>
          <span>Active reporting institutions</span>
          <strong>
            {billing.institution_count}{" "}
            <small>/ {billing.institution_limit}</small>
          </strong>
        </div>
      </div>
      <p className="hint">
        One successful new or nil filing saved to the connected ledger uses one
        allowance. Corrections, amendments and voids are tracked separately and
        consume no allowance. Failed validations and local evaluations are
        excluded.
      </p>
      {billing.status === "expired" || billing.status === "suspended" ? (
        <p role="status">
          You can still review filing history. Contact Evologics to renew or
          resolve the licence before recording more filings.
        </p>
      ) : null}
    </section>
  );
}

function InstitutionUsage({ billing }: { billing: CompanyBilling }) {
  return (
    <section className="card">
      <h2>Usage by reporting institution</h2>
      <p className="hint">
        Lifetime successful filings recorded in the connected workspace,
        including corrections. A generated file is not evidence of authority
        acceptance.
      </p>
      {billing.institutions.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reporting institution</th>
                <th>CRS filings</th>
                <th>FATCA filings</th>
              </tr>
            </thead>
            <tbody>
              {billing.institutions.map((fi) => (
                <tr key={fi.id}>
                  <td>{fi.name}</td>
                  <td>{fi.crs_filings}</td>
                  <td>{fi.fatca_filings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No reporting institutions yet.</p>
      )}
    </section>
  );
}

function PaymentRows({
  billing,
  operator,
  busy,
  onAction,
}: {
  billing: CompanyBilling;
  operator: boolean;
  busy: boolean;
  onAction: (r: PaymentRequest, action: string, evidence: string) => void;
}) {
  const [selected, setSelected] = useState<PaymentRequest | null>(null);
  const [action, setAction] = useState("bank");
  const [evidence, setEvidence] = useState("");
  return (
    <section className="card">
      <h2>Payments and annual licences</h2>
      <p>
        Annual licences renew with a new payment request. No automatic recurring
        charge is made. Payment must be confirmed before access changes.
      </p>
      {billing.payment_requests.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Request</th>
                <th>Plan / total due</th>
                <th>Status</th>
                <th>Payment / term</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {billing.payment_requests.map((r) => (
                <tr key={r.id}>
                  <td>
                    <code>{r.id.slice(0, 8)}</code>
                    <small className="block">Issued {date(r.created_at)}</small>
                  </td>
                  <td>
                    {r.plan_name}
                    <strong className="block">
                      {money(r.amount_minor, r.currency)}
                    </strong>
                    <small className="block">
                      {r.filing_limit} new/nil filings per year ·{" "}
                      {r.institution_limit} reporting institutions
                    </small>
                  </td>
                  <td>
                    <span
                      className={`state ${r.status === "paid" ? "live" : "pending"}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td>
                    {r.payment_method?.replace("_", " ") || "Awaiting payment"}
                    <small className="block">
                      {r.period_end
                        ? `Through ${date(r.period_end)}`
                        : "No active term"}
                    </small>
                  </td>
                  <td>
                    {operator ? (
                      <button
                        disabled={
                          busy || r.status === "void" || r.status === "refunded"
                        }
                        onClick={() => {
                          setSelected(r);
                          setAction(r.status === "issued" ? "bank" : "suspend");
                          setEvidence("");
                        }}
                      >
                        Manage
                      </button>
                    ) : r.status === "issued" && billing.can_manage ? (
                      <button
                        disabled={busy}
                        onClick={() => onAction(r, "checkout", "")}
                      >
                        {r.currency === "MUR"
                          ? "Payment instructions"
                          : "Pay annual licence"}
                      </button>
                    ) : (
                      <span className="hint">
                        {r.status === "issued"
                          ? "Company owner or admin pays"
                          : "No action needed"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>
          No payment requests yet. Contact{" "}
          <a href="mailto:contacts@evologics.ai">Evologics</a> to arrange a
          company licence.
        </p>
      )}
      {selected && operator ? (
        <form
          className="commercial-form"
          onSubmit={(e) => {
            e.preventDefault();
            onAction(selected, action, evidence);
            setSelected(null);
          }}
        >
          <h3>Manage request {selected.id.slice(0, 8)}</h3>
          <label>
            Action
            <select value={action} onChange={(e) => setAction(e.target.value)}>
              {selected.status === "issued" ? (
                <>
                  <option value="bank">Record received bank transfer</option>
                  <option value="void">
                    Void unpaid request (before online checkout)
                  </option>
                </>
              ) : (
                <>
                  <option value="suspend">Suspend company access</option>
                  <option value="restore">Restore paid company access</option>
                </>
              )}
            </select>
          </label>
          <p>
            {action === "bank"
              ? `Confirm that ${money(selected.amount_minor, selected.currency)} has reached Evologics' bank account. This records a received payment; it does not transfer money.`
              : "This changes company access and records your reason in the operator audit."}
          </p>
          <label>
            {action === "bank"
              ? "Bank statement / transfer reference"
              : "Reason"}
            <input
              required
              minLength={action === "bank" ? 3 : 5}
              maxLength={200}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
            />
          </label>
          <div className="actions">
            <button className="primary" disabled={busy}>
              Confirm and record
            </button>
            <button type="button" onClick={() => setSelected(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

export function CompanyBillingPanel({
  organization,
  onInstitutionsChanged,
}: {
  organization: Organization | null;
  onInstitutionsChanged?: () => void;
}) {
  const [billing, setBilling] = useState<CompanyBilling | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [institutionName, setInstitutionName] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [identifierType, setIdentifierType] = useState<
    "TAN" | "GIIN" | "TIN" | "UEN"
  >("TAN");
  useEffect(() => {
    let current = true;
    setBilling(null);
    setMessage("");
    if (!organization) return;
    setBusy(true);
    void commercialRpc<CompanyBilling>("aeoi_company_billing", {
      p_org: organization.id,
    })
      .then((data) => {
        if (current) setBilling(data);
      })
      .catch((e) => {
        if (current) setMessage((e as Error).message);
      })
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [organization?.id, revision]);
  const act = async (r: PaymentRequest, action: string) => {
    setBusy(true);
    setMessage("");
    try {
      if (r.currency === "MUR") {
        setMessage(
          "Contact contacts@evologics.ai with request " +
            r.id +
            " for Evologics' verified bank payment instructions.",
        );
        return;
      }
      const result = await paymentAction(
        r.id,
        action === "capture" ? "capture" : "checkout",
      );
      if (result.approval_url) {
        window.location.assign(result.approval_url);
        return;
      }
      if (result.status === "approved") {
        setPendingId(r.id);
        setMessage(
          "Checkout was approved. Use Confirm payment to verify the provider capture and activate the licence.",
        );
        return;
      }
      setMessage("Payment verified. Your company licence has been updated.");
      setRevision((x) => x + 1);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const returnedId =
    pendingId ||
    new URLSearchParams(window.location.search).get("billing_request");
  const cancelled =
    !pendingId &&
    new URLSearchParams(window.location.search).get("billing_return") ===
      "cancelled";
  const returned = billing?.payment_requests.find((r) => r.id === returnedId);
  return (
    <div className="commercial-page">
      <p className="eyebrow">Workspace administration</p>
      <h1>Company and billing</h1>
      <p>
        {organization?.name ||
          "Create or select a company in the connected workspace."}
      </p>
      {busy ? <p role="status">Updating company billing…</p> : null}
      {message ? (
        <p className="diagnostic info" role="status">
          {message}
        </p>
      ) : null}
      {returned?.status === "issued" ? (
        <section className="card">
          <h2>{cancelled ? "Checkout cancelled" : "Confirm your payment"}</h2>
          <p>
            {cancelled
              ? "Checkout was cancelled. Your company licence has not changed. You can resume payment when ready."
              : "Returning from checkout does not confirm payment. Verify it with the provider to activate your licence."}
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void act(returned, cancelled ? "checkout" : "capture")
            }
          >
            {cancelled ? "Resume checkout" : "Confirm payment"}
          </button>
        </section>
      ) : null}
      {billing ? (
        <>
          <Allowance billing={billing} />
          <InstitutionUsage billing={billing} />
          {billing.can_manage ? (
            <section className="card">
              <h2>Add a reporting institution</h2>
              <p>
                The institution shares this company's annual licence and
                allowance. The server checks available institution capacity.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!organization) return;
                  setBusy(true);
                  setMessage("");
                  void createInstitution(organization.id, {
                    legal_name: institutionName.trim(),
                    jurisdiction: "MU",
                    identifier_type: identifierType,
                    identifier_value: institutionId.trim(),
                    city: "Port Louis",
                  })
                    .then(() => {
                      setInstitutionName("");
                      setInstitutionId("");
                      setRevision((x) => x + 1);
                      onInstitutionsChanged?.();
                    })
                    .catch((e) => setMessage((e as Error).message))
                    .finally(() => setBusy(false));
                }}
              >
                <div className="form-grid">
                  <label>
                    Reporting institution legal name
                    <input
                      required
                      minLength={2}
                      maxLength={200}
                      value={institutionName}
                      onChange={(e) => setInstitutionName(e.target.value)}
                    />
                  </label>
                  <label>
                    Identifier type
                    <select
                      value={identifierType}
                      onChange={(e) =>
                        setIdentifierType(
                          e.target.value as typeof identifierType,
                        )
                      }
                    >
                      {["TAN", "GIIN", "TIN", "UEN"].map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Institution identifier
                    <input
                      required
                      maxLength={100}
                      value={institutionId}
                      onChange={(e) => setInstitutionId(e.target.value)}
                    />
                  </label>
                </div>
                <button
                  disabled={
                    busy ||
                    billing.institution_count >= billing.institution_limit ||
                    ["expired", "suspended"].includes(billing.status)
                  }
                >
                  Add reporting institution
                </button>
                {billing.institution_count >= billing.institution_limit ? (
                  <p className="hint">
                    Current institution allowance is full. Arrange a larger
                    company plan before adding another institution.
                  </p>
                ) : null}
              </form>
            </section>
          ) : null}
          <PaymentRows
            billing={billing}
            operator={false}
            busy={busy}
            onAction={(r) => void act(r, "checkout")}
          />
        </>
      ) : null}
    </div>
  );
}

function PlanEditor({
  plan,
  busy,
  save,
}: {
  plan: CommercialPlan;
  busy: boolean;
  save: (p: CommercialPlan) => void;
}) {
  const [price, setPrice] = useState(
    plan.price_minor === null ? "" : (plan.price_minor / 100).toFixed(2),
  );
  const [currency, setCurrency] = useState(plan.currency);
  const [filings, setFilings] = useState(plan.filing_limit);
  const [institutions, setInstitutions] = useState(plan.institution_limit);
  const [available, setAvailable] = useState(plan.available);
  return (
    <form
      className="commercial-form"
      onSubmit={(e) => {
        e.preventDefault();
        save({
          ...plan,
          price_minor: price ? Math.round(Number(price) * 100) : null,
          currency,
          filing_limit: filings,
          institution_limit: institutions,
          available,
        });
      }}
    >
      <h3>{plan.name}</h3>
      <div className="form-grid">
        <label>
          Annual total price
          <input
            aria-label={`${plan.name} annual price`}
            type="number"
            min="0.01"
            max="1000000"
            step="0.01"
            required={available}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <label>
          Currency
          <select
            aria-label={`${plan.name} currency`}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {["USD", "EUR", "GBP", "MUR"].map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </label>
        <label>
          Annual filings
          <input
            aria-label={`${plan.name} annual filings`}
            type="number"
            min="1"
            max="1000000"
            required
            value={filings}
            onChange={(e) => setFilings(Number(e.target.value))}
          />
        </label>
        <label>
          Reporting institutions
          <input
            aria-label={`${plan.name} institutions`}
            type="number"
            min="1"
            max="10000"
            required
            value={institutions}
            onChange={(e) => setInstitutions(Number(e.target.value))}
          />
        </label>
      </div>
      <label className="commercial-checkbox">
        <input
          type="checkbox"
          checked={available}
          onChange={(e) => setAvailable(e.target.checked)}
        />{" "}
        Available for payment requests
      </label>
      <button disabled={busy}>Save {plan.name} plan</button>
    </form>
  );
}

export function EvologicsAdminPanel() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [selected, setSelected] = useState("");
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    setBusy(true);
    void commercialRpc<AdminDashboard>("aeoi_admin_dashboard")
      .then((data) => {
        if (current) setDashboard(data);
      })
      .catch((e) => {
        if (current) {
          setDashboard(null);
          setMessage((e as Error).message);
        }
      })
      .finally(() => {
        if (current) setBusy(false);
      });
    return () => {
      current = false;
    };
  }, [revision]);
  const mutate = async (
    name: string,
    input: Record<string, unknown>,
    success: string,
  ) => {
    setBusy(true);
    setMessage("");
    try {
      await commercialRpc(name, input);
      setMessage(success);
      setRevision((x) => x + 1);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const companies =
    dashboard?.companies.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()),
    ) || [];
  const company = dashboard?.companies.find((c) => c.id === selected);
  return (
    <div className="commercial-page">
      <p className="eyebrow">Evologics operations</p>
      <h1>Company portfolio</h1>
      <p>
        Connected workspace usage and annual company licences. Access is
        restricted to Evologics operators, independently of company
        administrator roles.
      </p>
      <div className="actions">
        <button disabled={busy} onClick={() => setRevision((x) => x + 1)}>
          Refresh portfolio
        </button>
        {busy ? <span role="status">Updating portfolio…</span> : null}
      </div>
      {message ? (
        <p className="diagnostic info" role="status">
          {message}
        </p>
      ) : null}
      {dashboard ? (
        <>
          <section className="card commercial-metrics">
            <div>
              <span>Companies</span>
              <strong>{dashboard.companies.length}</strong>
            </div>
            <div>
              <span>Recorded filings · last 30 days</span>
              <strong>
                {dashboard.companies.reduce((n, c) => n + c.filings_30_days, 0)}
              </strong>
            </div>
            <div>
              <span>Paid annual licences</span>
              <strong>
                {
                  dashboard.companies.filter(
                    (c) => c.billing.status === "active",
                  ).length
                }
              </strong>
            </div>
          </section>
          <section className="card">
            <h2>Paid payment requests by currency</h2>
            <p className="hint">
              Confirmed requests, excluding refunded requests. These totals are
              operational indicators, not an accounting revenue statement.
            </p>
            {dashboard.paid_totals.length ? (
              dashboard.paid_totals.map((t) => (
                <p key={t.currency}>
                  <strong>{money(t.amount_minor, t.currency)}</strong> ·{" "}
                  {t.requests} paid requests
                </p>
              ))
            ) : (
              <p>No confirmed payments yet.</p>
            )}
          </section>
          <section className="card">
            <div className="commercial-heading">
              <h2>Companies</h2>
              <label>
                Find company
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Company name"
                />
              </label>
            </div>
            {companies.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Licence</th>
                      <th>Allowance</th>
                      <th>Lifetime filings</th>
                      <th>Last activity</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((c) => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>
                          {c.billing.plan_name}
                          <small className="block">{c.billing.status}</small>
                        </td>
                        <td>
                          {c.billing.filings_used} / {c.billing.filing_limit}
                        </td>
                        <td>{c.filings_total}</td>
                        <td>{date(c.last_filing_at)}</td>
                        <td>
                          <button
                            onClick={() => {
                              setSelected(c.id);
                              setPlan("");
                            }}
                          >
                            View {c.name}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No companies match this search.</p>
            )}
          </section>
          {company ? (
            <section aria-label={`Company details: ${company.name}`}>
              <h2>{company.name}</h2>
              <Allowance billing={company.billing} />
              <InstitutionUsage billing={company.billing} />
              <section className="card">
                <h3>Issue annual payment request</h3>
                <p>
                  Use an agreed plan and total price. Tax treatment and bank
                  payment instructions must be agreed before sending this
                  request to the customer.
                </p>
                <form
                  className="actions"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void mutate(
                      "aeoi_issue_payment_request",
                      { p_org: company.id, p_plan: plan },
                      "Payment request issued. It is visible to the company; no email was sent.",
                    );
                  }}
                >
                  <select
                    required
                    aria-label="Annual plan for payment request"
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                  >
                    <option value="">Select published plan</option>
                    {dashboard.plans
                      .filter((p) => p.available && p.price_minor !== null)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {money(p.price_minor!, p.currency)}
                        </option>
                      ))}
                  </select>
                  <button
                    disabled={
                      busy ||
                      !plan ||
                      company.billing.payment_requests.some(
                        (r) => r.status === "issued",
                      )
                    }
                  >
                    Issue payment request
                  </button>
                </form>
              </section>
              <PaymentRows
                key={company.id + revision}
                billing={company.billing}
                operator
                busy={busy}
                onAction={(r, action, evidence) =>
                  void mutate(
                    action === "bank"
                      ? "aeoi_record_bank_payment"
                      : "aeoi_change_payment_request",
                    action === "bank"
                      ? {
                          p_id: r.id,
                          p_reference: evidence,
                          p_amount: r.amount_minor,
                          p_currency: r.currency,
                        }
                      : { p_id: r.id, p_action: action, p_reason: evidence },
                    "Company billing updated and recorded in the operator audit.",
                  )
                }
              />
            </section>
          ) : null}
          <section className="card">
            <h2>Annual plans</h2>
            <p>
              Prices start unconfigured. Agree commercial terms before
              publishing. Changes affect new requests; existing requests and
              paid allowances retain their original terms. MUR requests use bank
              transfer.
            </p>
            {dashboard.plans
              .filter((p) => p.id !== "evaluation")
              .map((p) => (
                <PlanEditor
                  key={p.id + revision}
                  plan={p}
                  busy={busy}
                  save={(changed) =>
                    void mutate(
                      "aeoi_configure_plan",
                      {
                        p_id: changed.id,
                        p_name: changed.name,
                        p_filings: changed.filing_limit,
                        p_institutions: changed.institution_limit,
                        p_price: changed.price_minor,
                        p_currency: changed.currency,
                        p_available: changed.available,
                      },
                      "Plan saved. Existing payment requests retain their agreed price.",
                    )
                  }
                />
              ))}
          </section>
          <section className="card">
            <h2>Recent commercial audit</h2>
            {dashboard.audit.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Event</th>
                      <th>Company</th>
                      <th>Request</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.audit.map((a) => (
                      <tr key={a.id}>
                        <td>{date(a.created_at)}</td>
                        <td>{a.event_type.replaceAll("_", " ")}</td>
                        <td>
                          {dashboard.companies.find(
                            (c) => c.id === a.organization_id,
                          )?.name || "Plan catalogue"}
                        </td>
                        <td>{a.request_id?.slice(0, 8) || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No commercial changes recorded yet.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
