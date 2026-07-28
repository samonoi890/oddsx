// packages/scripts/src/env.ts
//
// Centralised environment loading + credential sanitisation for the seed
// script. Import this module FIRST (before anything that reads process.env)
// so the .env files are loaded before other modules initialise.
//
// Env files are searched in this order; the FIRST file to define a given key
// wins (dotenv does not override variables already set in process.env, and
// real shell / CI variables therefore always take precedence):
//
//   1. packages/scripts/.env
//   2. packages/scripts/.env.local
//   3. apps/web/.env.local        <- the app's local env (common case)
//   4. <repo root>/.env
//   5. <repo root>/.env.local

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import type { Hex } from "viem";

const scriptDir = path.dirname(fileURLToPath(import.meta.url)); // packages/scripts/src
const scriptsRoot = path.resolve(scriptDir, ".."); // packages/scripts
const repoRoot = path.resolve(scriptDir, "../../.."); // <repo root>

const candidatePaths = [
  path.join(scriptsRoot, ".env"),
  path.join(scriptsRoot, ".env.local"),
  path.join(repoRoot, "apps", "web", ".env.local"),
  path.join(repoRoot, ".env"),
  path.join(repoRoot, ".env.local"),
];

// Values that are still the unfilled example text — treated as "not set" so a
// leftover `.env` full of placeholders can never shadow a real value in a
// later file (e.g. apps/web/.env.local).
const PLACEHOLDER_PATTERN = /YOUR_|REPLACE|CHANGE_?ME|XXXX|\.\.\./i;

// Merge the env files manually (in order) so we can (a) skip placeholders and
// (b) keep the "first real value wins" precedence, while real shell / CI
// variables always take precedence over any file.
export const loadedEnvFiles: string[] = [];

for (const file of candidatePaths) {
  if (!existsSync(file)) continue;
  loadedEnvFiles.push(file);

  const parsed = dotenv.parse(readFileSync(file));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] !== undefined) continue; // shell / earlier file wins
    const trimmed = value.trim();
    if (trimmed === "" || PLACEHOLDER_PATTERN.test(trimmed)) continue; // skip placeholders
    process.env[key] = value;
  }
}

export const searchedEnvPaths = candidatePaths;

/** Reads a required env var, trimming whitespace, or throws a helpful error. */
export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}.\n` +
        `Searched: ${candidatePaths.join("\n          ")}`,
    );
  }
  return value;
}

/**
 * Normalises a raw private key string into a 0x-prefixed Hex value.
 *  - trims whitespace and any surrounding single/double quotes
 *  - strips a leading 0x / 0X prefix
 *  - validates the remainder is exactly 64 hex chars (32 bytes)
 *  - returns it re-prefixed with 0x for viem
 */
export function sanitizePrivateKey(raw: string): Hex {
  const formattedKey = raw
    .trim()
    .replace(/^['"]|['"]$/g, "") // strip wrapping quotes
    .trim()
    .replace(/^0x/i, ""); // strip 0x / 0X prefix

  if (!/^[0-9a-fA-F]{64}$/.test(formattedKey)) {
    throw new Error(
      "ADMIN_PRIVATE_KEY must be a 32-byte hex private key " +
        "(64 hex characters, with or without a 0x prefix).",
    );
  }

  return `0x${formattedKey}` as Hex;
}
