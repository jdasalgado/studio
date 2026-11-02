/**
 * Common input validation utilities and length limits for web application forms.
 */

export const MAX_LENGTHS = {
  NAME: 50,
  FIRST_NAME: 40,
  LAST_NAME: 40,
  EMAIL: 100,
  PHONE: 11,
  TITLE: 100,
  PURPOSE: 250,
  MESSAGE: 1000,
  NOTES: 2000,
  ADDRESS: 200,
  EMERGENCY_NAME: 50,
  MAX_PAX: 1000,
  MAX_TABLES: 5,
  MAX_CHAIRS: 60,
} as const;

/**
 * Validates whether a phone number matches standard 11-digit Philippine mobile format:
 * - Must be exactly 11 digits
 * - Must start with 09
 * - Must contain only digits (no letters or special characters)
 */
export function isValidPhilippineNumber(phone: string): boolean {
  if (!phone) return false;
  const trimmed = phone.trim();
  return /^09\d{9}$/.test(trimmed);
}

/**
 * Sanitizes phone number input:
 * - Removes any non-digit character (blocking letters, symbols, spaces)
 * - Limits length to maximum 11 digits
 */
export function cleanPhoneNumber(input: string, maxLength: number = MAX_LENGTHS.PHONE): string {
  if (!input) return "";
  return input.replace(/\D/g, "").slice(0, maxLength);
}

/**
 * Validates email format and maximum length.
 */
export function isValidEmail(email: string, maxLength: number = MAX_LENGTHS.EMAIL): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > maxLength) return false;
  // Standard email regex
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/**
 * Validates name fields (first name, last name, full name):
 * - Must contain only letters, spaces, hyphens, apostrophes, and periods
 * - Minimum length: 2 characters
 * - Maximum length: default 50 characters (prevents giant inputs / 100-word spam)
 * - Word count must be reasonable (no more than 8 words)
 */
export function isValidName(name: string, minLength: number = 2, maxLength: number = MAX_LENGTHS.NAME): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.length < minLength || trimmed.length > maxLength) return false;

  // Maximum 8 words in a name (blocks paragraphs or 100 words pasted in name)
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > 8) return false;

  // Allow letters (including Unicode/international characters), spaces, hyphens, apostrophes, and periods
  return /^[a-zA-ZÀ-ÿ\s'\-\.]+$/.test(trimmed);
}

/**
 * Sanitizes name input:
 * - Removes any numbers and special characters (except spaces, hyphens, apostrophes, and periods)
 * - Enforces maximum character length
 */
export function cleanName(input: string, maxLength: number = MAX_LENGTHS.NAME): string {
  if (!input) return "";
  // Keep only letters (including international), spaces, hyphens, apostrophes, and periods
  return input.replace(/[^a-zA-ZÀ-ÿ\s'\-\.]/g, "").slice(0, maxLength);
}

/**
 * Validates text length within bounds
 */
export function isValidLength(text: string, minLength: number = 1, maxLength: number = 1000): boolean {
  if (!text) return minLength === 0;
  const len = text.trim().length;
  return len >= minLength && len <= maxLength;
}

/**
 * Sanitizes generic text by capping its maximum length
 */
export function cleanText(input: string, maxLength: number = 1000): string {
  if (!input) return "";
  return input.slice(0, maxLength);
}
