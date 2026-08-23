// Browser smoke tests. Run with: npm run test:browser
//
// Deliberately separate from `npm test`: this needs a downloaded browser, so it
// stays out of the fast unit loop and runs as its own CI job.
import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
	testDir: "./browser",
	testMatch: "**/*.spec.js",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? "list" : "line",
	use: {
		baseURL,
		trace: "on-first-retry"
	},
	// the bundle and the examples are ES modules, so they must be served over http
	webServer: {
		command: `node browser/server.js ${PORT}`,
		url: `${baseURL}/dist/app.js`,
		reuseExistingServer: !process.env.CI,
		timeout: 30_000
	},
	projects: [
		{
			name: "chromium",
			// the full Chromium build rather than the headless-shell variant, so a
			// plain `npx playwright install chromium` is enough
			use: { ...devices["Desktop Chrome"], channel: "chromium" }
		}
	]
});
