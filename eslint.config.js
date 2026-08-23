// ESLint flat config.
//
// Replaces the `jshint` devDependency, which was listed but never wired to a
// script and cannot parse the ES2022 this source uses.
//
// The lib/ block is the interesting one: those files are NOT modules. The build
// concatenates them into a single shared scope, so each file freely references
// classes and singletons defined in its siblings. Rather than switch `no-undef`
// off and lose the rule everywhere, the shared scope is declared explicitly
// below — which doubles as documentation of an implicit contract that has never
// been written down. When roadmap §2c turns these into real ES modules, this
// list should shrink to nothing.
import js from "@eslint/js";
import globals from "globals";

// everything the concatenated bundle puts in one scope
const bundleScope = {
	// classes, in build/index.js manifest order
	Observable: "readonly",
	Base: "readonly",
	Router: "readonly",
	History: "readonly",
	Model: "readonly",
	View: "readonly",
	Controller: "readonly",
	Collection: "readonly",
	Layout: "readonly",
	Session: "readonly",
	Template: "readonly",
	Events: "readonly",
	Utils: "readonly",
	Views: "readonly",
	APP: "readonly",
	// module-scope singletons and helpers
	_: "readonly",
	history: "readonly",
	store: "readonly",
	sync: "readonly",
	syncConfig: "readonly",
	methodMap: "readonly",
	configureSync: "readonly",
	createState: "readonly",
	sessionStore: "readonly",
	localStore: "readonly",
	cookieStore: "readonly",
	memoryStore: "readonly",
	RESERVED_WORDS: "readonly",
	// input mixins
	TouchMixin: "readonly",
	MouseMixin: "readonly",
	ScrollMixin: "readonly",
	MotionMixin: "readonly",
	GamepadMixin: "readonly",
	KeysMixin: "readonly"
};

// Each of those names is *declared* in one lib file and *consumed* in others.
// ESLint has no cross-file view of a concatenated scope, so a top-level
// `class Model {}` reads as dead code. Deriving the allow-list from the same
// object keeps one source of truth (and shrinks to nothing under §2c).
const sharedDeclarations = `^(${Object.keys( bundleScope ).join("|")})$`;

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
			// the build template: handlebars placeholders, not JavaScript
			"lib/main.js"
		]
	},

	js.configs.recommended,

	{
		// the library itself — browser code, concatenated into one scope
		files: ["lib/**/*.js"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			globals: { ...globals.browser, ...bundleScope, ...optionalGlobals }
		},
		rules: {
			// `catch( e ){}` swallowing a probe failure is deliberate throughout
			// the storage/capability code
			"no-empty": ["error", { allowEmptyCatch: true }],
			"no-unused-vars": ["error", {
				args: "none",
				caughtErrors: "none",
				varsIgnorePattern: sharedDeclarations
			}]
		}
	},

	{
		// tooling and tests — Node
		files: ["build/**/*.js", "test/**/*.js"],
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
		// example apps — browser modules
		files: ["examples/**/*.js"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			globals: { ...globals.browser, ...optionalGlobals }
		}
	}
];
