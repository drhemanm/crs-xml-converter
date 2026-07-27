/**
 * Reference identifiers.
 *
 * The OECD requires a DocRefId to be globally unique and to begin with the
 * transmitting jurisdiction's country code; jurisdictions validate the prefix
 * on upload, so a reference without one is rejected before the file is read.
 *
 * Minting lives here rather than inside the generator because the filing plan
 * has to mint references too — a correction's DocRefId is decided while
 * planning, and the generator must emit that exact value, not a second one.
 * One minter, one sequence, no collisions.
 */

/** Format: <CC><YYYY><batch><sequence>, capped at the 200-character limit. */
export function createRefMinter({ country, taxYear, batch }) {
  const prefix = `${String(country || '').toUpperCase()}${taxYear}`;
  const batchId = (
    batch || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  ).toUpperCase();
  let sequence = 0;

  return () => {
    sequence += 1;
    return `${prefix}${batchId}${sequence}`.slice(0, 200);
  };
}

/**
 * A MessageRefId carries the same country-code requirement. An identifier the
 * filer supplied is honoured only if it already satisfies it — the default the
 * app seeds at start-up cannot, because the jurisdiction is not known then.
 */
export function resolveMessageRefId(supplied, country, mint) {
  const prefix = String(country || '').toUpperCase();
  if (supplied && prefix && supplied.toUpperCase().startsWith(prefix)) return supplied;
  return mint();
}
