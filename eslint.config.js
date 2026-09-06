// @ts-check
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

/**
 * Exists for one reason: catch a hooks-after-an-early-return bug before it
 * ships, not after. That exact bug has taken the whole app down to a black
 * screen twice now (commits 13e65c6 and 423efa5) -- once from a hand-written
 * mistake, once resurrected by a merge whose two sides edited the same
 * function in incompatible ways without either side's diff looking wrong on
 * its own. Neither would have survived `npx eslint .`.
 *
 * Deliberately narrow. eslint-plugin-react-hooks v7 ships a much larger
 * "recommended" bundle built for React Compiler adoption (immutability,
 * purity, set-state-in-render, and a dozen more) -- this repo has not opted
 * into the compiler, and turning all of that on at once would bury the one
 * rule that actually matters here under unrelated noise on a codebase this
 * size. Only rules-of-hooks (the exact class of bug above) and
 * exhaustive-deps (warns only -- several effects in App.tsx deliberately
 * narrow their dependency array, e.g. the day-rollover poll, and a hard
 * error there would fight decisions already made on purpose) are enabled.
 * Widen this later if the plan changes.
 */
export default tseslint.config(
  {
    ignores: ["dist/**", "dev-dist/**", "node_modules/**", "coverage/**", "public/**"],
  },

  // React/TS source. Where the hooks rule actually needs to run.
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // The codebase leans on `!` where a value's non-null-ness is guaranteed
      // by a check a few lines up that TypeScript can't see through (e.g. a
      // gate rendered only once `myUser` is confirmed truthy) -- exactly the
      // kind of thing type-aware lint rules exist to flag, but doing that
      // properly needs the parser wired to the tsconfig (parserOptions.project),
      // which is a heavier, slower setup. Out of scope for what this file is
      // for: catching hook-order bugs, not auditing null-safety.
      "@typescript-eslint/no-non-null-assertion": "off",
      // A leading underscore already means "deliberately unused" throughout
      // this codebase (goalPoint's _taskCount, requirePin's _user/_pin, an
      // Express error handler's _req/_next) -- some of those sites even carry
      // an eslint-disable comment written in anticipation of a lint setup
      // like this one arriving eventually. Recognise the convention already
      // in use rather than fighting it.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },

  // Everything else that's TypeScript but not React (build/test config).
  {
    files: ["*.ts"],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
    },
  },

  // Server, scripts, tests: plain Node ESM, no hooks plugin -- there are no
  // React hooks to misuse here.
  {
    files: ["server/**/*.js", "scripts/**/*.{js,mjs}", "tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
  }
);
