// ESLint flat config.
//
// Replaces the `jshint` devDependency, which was listed but never wired to a
// script and cannot parse the ES2022 this source uses.
//
// This used to carry a hand-maintained list of ~30 "globals" — every class and
// singleton the concatenated bundle put in one shared scope — plus a matching
// allow-list so `no-unused-vars` would not report a top-level `class Model {}` as
// dead code. Both are gone: `lib/*.js` are real ES modules now, so each file
// declares what it uses and exports what it provides, and ESLint can see it.
import js from "@eslint/js";
import globals from "globals";

// optional integrations the library feature-detects rather than depends on
const optionalGlobals = {
	app: "readonly",            // the APP facade publishes itself on window
	Handlebars: "readonly",     // optional template compiler
	PhoneGap: "readonly",       // legacy hybrid-app shim
	pageTracker: "readonly"     // legacy analytics hook
};

export default [
	{
		ignores: [
			"dist/**",
			"types/**",
			"node_modules/**",
		]
	},

	js.configs.recommended,

	{
		// the library itself — browser ES modules
		files: ["lib/**/*.js"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			globals: { ...globals.browser, ...optionalGlobals }
		},
		rules: {
			// `catch( e ){}` swallowing a probe failure is deliberate throughout
			// the storage/capability code
			"no-empty": ["error", { allowEmptyCatch: true }],
			"no-unused-vars": ["error", { args: "none", caughtErrors: "none" }]
		}
	},

	{
		// tooling and tests — Node
		files: ["build/**/*.js", "test/**/*.js", "browser/server.js", "playwright.config.js"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			globals: { ...globals.node }
		},
		rules: {
			"no-unused-vars": ["error", { args: "none", caughtErrors: "none" }]
		}
	},

	{
		// Playwright specs run in Node, but their page.evaluate() callbacks are
		// serialised and executed in the browser - so both global sets are legal
		// in the same file
		files: ["browser/**/*.spec.js"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			globals: { ...globals.node, ...globals.browser }
		},
		rules: {
			"no-unused-vars": ["error", { args: "none", caughtErrors: "none" }]
		}
	},

	{
		// example apps — browser modules
		files: ["examples/**/*.js"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			globals: { ...globals.browser, ...optionalGlobals }
		}
	}
];
