// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import angular from "angular-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "app",
          style: "kebab-case",
        },
      ],

      // Design-system guardrails (docs/DESIGN.md section 11.1).
      // `registerables` registers every Chart.js controller and element, which
      // is how the chart chunk reached 214 kB for four chart types.
      // Kept at "warn" while the migration lanes land; promote to "error" once
      // `shared/ui/chart/chart-theme.ts` registers only what it uses.
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "chart.js",
              importNames: ["registerables"],
              message:
                "Register only the controllers/elements/scales you use (docs/DESIGN.md 11.1).",
            },
          ],
          patterns: [
            {
              group: ["chart.js/auto"],
              message: "Import from 'chart.js' and register explicitly.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {
      // Inline styles cannot follow light/dark/high-contrast tokens. The one
      // remaining use (a chart legend swatch reading `var(--rms-chart-*)`) is
      // reported as a warning until it moves to a class.
      "@angular-eslint/template/no-inline-styles": "warn",
    },
  },
]);
