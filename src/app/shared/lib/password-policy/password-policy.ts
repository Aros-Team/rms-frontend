/**
 * Client mirror of the backend password policy.
 *
 * Every auth DTO that accepts a password (`ResetPasswordRequest`,
 * `SetupPasswordRequest`, `ChangePasswordRequest`) declares:
 *
 * ```
 * ^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*\p{Punct})[\p{Graph}]{8,64}$
 * ```
 *
 * so the real contract is: 8 to 64 characters, every character printable ASCII
 * (`\p{Graph}` is ASCII-only here) and at least one lowercase, one uppercase,
 * one digit and one ASCII punctuation character (`\p{Punct}`).
 *
 * The forms used to check a narrow symbol list (`[!@#$%^&*()...]`), which
 * rejected passwords the API accepts (`_`, `~`, `/`, `;`, ...) and accepted
 * passwords the API rejects (anything with an accent). These helpers are the
 * single place where that policy is expressed.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;

/** ASCII punctuation, exactly what Java's `\p{Punct}` matches. */
const SYMBOL_PATTERN = /[!"#$%&'()*+,\-.\u002F:;<=>?@[\\\]^_`{|}~]/;

/** Printable ASCII, what `\p{Graph}` matches here. */
const PRINTABLE_ASCII_PATTERN = /^[\x21-\x7E]+$/;

export function hasMinPasswordLength(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH;
}

export function hasMaxPasswordLength(password: string): boolean {
  return password.length <= PASSWORD_MAX_LENGTH;
}

export function hasUpperCase(password: string): boolean {
  return /[A-Z]/.test(password);
}

export function hasLowerCase(password: string): boolean {
  return /[a-z]/.test(password);
}

export function hasNumber(password: string): boolean {
  return /\d/.test(password);
}

export function hasSymbol(password: string): boolean {
  return SYMBOL_PATTERN.test(password);
}

/** True only when every character is printable ASCII (accented letters included). */
export function isPrintableAscii(password: string): boolean {
  return PRINTABLE_ASCII_PATTERN.test(password);
}

/**
 * Full policy check, mirroring the API so the client never blocks a password the
 * server accepts nor accepts one the server rejects.
 */
export function isPasswordValid(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH &&
    isPrintableAscii(password) &&
    hasLowerCase(password) &&
    hasUpperCase(password) &&
    hasNumber(password) &&
    hasSymbol(password)
  );
}
