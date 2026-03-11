/**
 * Shared password policy: min 12 chars, at least 3 of 4 character categories
 * (uppercase, lowercase, digit, symbol). Used at signup/invite-accept edge.
 */
const MIN_LENGTH = 12;
const MIN_CATEGORIES = 3;

const UPPERCASE = /[A-Z]/;
const LOWERCASE = /[a-z]/;
const DIGIT = /[0-9]/;
const SYMBOL = /[^A-Za-z0-9]/;

type PasswordPolicyResult =
  | { valid: true }
  | { valid: false; message: string };

export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  if (password.length < MIN_LENGTH) {
    return {
      valid: false,
      message: `Password must be at least ${MIN_LENGTH} characters`,
    };
  }
  let categories = 0;
  if (UPPERCASE.test(password)) categories++;
  if (LOWERCASE.test(password)) categories++;
  if (DIGIT.test(password)) categories++;
  if (SYMBOL.test(password)) categories++;
  if (categories < MIN_CATEGORIES) {
    return {
      valid: false,
      message: `Password must include at least ${MIN_CATEGORIES} of: uppercase, lowercase, digit, symbol`,
    };
  }
  return { valid: true };
}
