/**
 * Explicit success/failure. The domain layer never throws: a CRS filing is a
 * regulatory artefact, so every rejection must be a value we can collect,
 * aggregate and show against the cell that caused it.
 */
export type Result<T, E> = Ok<T> | Err<E>;

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const isOk = <T, E>(r: Result<T, E>): r is Ok<T> => r.ok;
export const isErr = <T, E>(r: Result<T, E>): r is Err<E> => !r.ok;

export function map<T, U, E>(r: Result<T, E>, f: (t: T) => U): Result<U, E> {
  return r.ok ? ok(f(r.value)) : r;
}

export function flatMap<T, U, E>(r: Result<T, E>, f: (t: T) => Result<U, E>): Result<U, E> {
  return r.ok ? f(r.value) : r;
}

export function unwrapOr<T, E>(r: Result<T, E>, fallback: T): T {
  return r.ok ? r.value : fallback;
}

/**
 * Collect a list of Results into a Result of list, accumulating *all* errors
 * rather than short-circuiting. Filers need every problem in one pass, not the
 * first one repeated across a dozen upload attempts.
 */
export function all<T, E>(results: readonly Result<T, E>[]): Result<T[], E[]> {
  const values: T[] = [];
  const errors: E[] = [];
  for (const r of results) {
    if (r.ok) values.push(r.value);
    else errors.push(r.error);
  }
  return errors.length > 0 ? err(errors) : ok(values);
}

/** Narrow a nullable to a Result with a caller-supplied error. */
export function fromNullable<T, E>(value: T | null | undefined, error: E): Result<T, E> {
  return value === null || value === undefined ? err(error) : ok(value);
}
