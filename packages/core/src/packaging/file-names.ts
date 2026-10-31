import type { Packaging } from "../measure/schema.js";

/**
 * File names and sizes for the verification and issuance packages (F-06, F-11).
 */

/** Turns free text into a safe file name (no accents, spaces or forbidden characters). */
export function normalizeFileName(text: string, rules: Pick<Packaging, "forbidden_chars">): string {
  const forbidden = new Set(rules.forbidden_chars);
  const plain = text.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  let result = "";
  for (const ch of plain) result += forbidden.has(ch) || /\s/.test(ch) ? "_" : ch;
  return result.replace(/_+/g, "_").replace(/^_|_$/g, "");
}

/** Fills a pattern such as "{reference}_{type}" and normalizes it. */
export function buildFileName(
  pattern: string,
  variables: Record<string, string | number>,
  rules: Pick<Packaging, "forbidden_chars">,
): string {
  const filled = pattern.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = variables[k];
    if (v === undefined) throw new Error(`Missing variable "${k}" for file name`);
    return normalizeFileName(String(v), rules);
  });
  return normalizeFileName(filled, rules);
}

export interface PackageFile {
  /** Name without extension. */
  name: string;
  extension: string;
  bytes: number;
}

/** Returns the file's list of problems; empty when valid. */
export function validateFile(file: PackageFile, rules: Packaging): string[] {
  const errors: string[] = [];
  const fullName = `${file.name}.${file.extension}`;

  const forbidden = [...new Set([...file.name].filter((ch) => rules.forbidden_chars.includes(ch)))];
  if (forbidden.length > 0) errors.push(`${fullName}: contains forbidden characters (${forbidden.join(" ")})`);
  if (/\s/.test(file.name)) errors.push(`${fullName}: contains spaces`);
  if (fullName.length > rules.max_name_length) {
    errors.push(`${fullName}: name is longer than ${rules.max_name_length} characters`);
  }
  if (file.bytes > rules.max_size_mb * 1024 * 1024) {
    const mb = (file.bytes / 1024 / 1024).toFixed(1);
    errors.push(`${fullName}: is ${mb} MB and the maximum is ${rules.max_size_mb} MB`);
  }
  return errors;
}
