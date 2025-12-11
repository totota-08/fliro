import tseslint from "typescript-eslint";
import pluginJs from "@eslint/js";

export default tseslint.config(
  {
    ignores: ["dist", "node_modules", "**/*.vue"],
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,ts}"],
    languageOptions: {
      sourceType: "module",
    },
    rules: {
      "no-undef": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
);
