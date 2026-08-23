// Real-browser smoke tests.
//
// Everything else in this repo runs on Node + jsdom, which cannot verify the
// claims that matter most in a browser: that the shipped ES module actually
// parses and loads, that `IntersectionObserver` (stubbed in the unit tests),
// `BroadcastChannel` (cross-context) and the History API behave as the README
// says. These exercise the built artifacts over http, exactly as a consumer
// would load them.
import { test, expect } from "@playwright/test";

// a blank page on the right origin, so dynamic imports of /dist resolve
const BLANK = "/examples/basic/import.html";

test.describe("the shipped bundles", () => {

	test("dist/app.js loads as a module and exposes the public API", async ({ page }) => {
		await page.goto( BLANK );
		const exports = await page.evaluate( async () => {
			const module = await import("/dist/app.js");
			return Object.keys( module ).sort();
		});
		expect( exports ).toEqual( expect.arrayContaining([
			"APP", "Collection", "Controller", "Events", "Layout", "Model",
			"Observable", "Router", "Session", "Template", "View", "history", "sync"
		]));
	});

	test("dist/app.min.js loads as a module and works", async ({ page }) => {
		await page.goto( BLANK );
		const title = await page.evaluate( async () => {
			const { Model } = await import("/dist/app.min.js");
			const model = new Model({ title: "minified" });
			return model.get("title");
		});
		expect( title ).toBe("minified");
	});

	test("window.APP is published for script-tag users", async ({ page }) => {
		await page.goto( BLANK );
		const type = await page.evaluate( async () => {
			await import("/dist/app.js");
			return typeof window.APP;
		});
		expect( type ).toBe("function");
	});
});

test.describe("the basic example", () => {

	test("renders from the model and re-renders on change", async ({ page }) => {
		await page.goto("/examples/basic/index.html");
		await expect( page.locator("#main") ).toContainText("Makis is 100");
		await page.getByRole("button", { name: "Happy birthday" }).click();
		await expect( page.locator("#main") ).toContainText("Makis is 101");
	});

	test("loads with no console errors", async ({ page }) => {
		const errors = [];
		page.on("console", ( message ) => { if( message.type() === "error" ) errors.push( message.text() ); });
		page.on("pageerror", ( error ) => errors.push( String( error ) ));
		await page.goto("/examples/basic/index.html");
		await expect( page.locator("#main") ).toContainText("Makis");
		expect( errors ).toEqual([]);
	});
});

test.describe("browser APIs the unit tests can only stub", () => {

	test("a real IntersectionObserver drives visible/hidden", async ({ page }) => {
		await page.goto( BLANK );
		const seen = await page.evaluate( async () => {
			const { View } = await import("/dist/app.js");

			// a tall spacer so the target starts well below the viewport
			document.body.innerHTML =
				'<div style="height:200vh"></div><div id="target">watch me</div>';

			const view = new View({ el: "#target", html: "<b>watch me</b>" });
			const events = [];
			view.on("visible", () => events.push("visible"));
			view.on("hidden", () => events.push("hidden"));

			// let the observer report the initial (off-screen) state
			await new Promise(( r ) => setTimeout( r, 100 ));
			const before = view.isVisible();

			view.el.scrollIntoView();
			await new Promise(( r ) => setTimeout( r, 300 ));

			return { before, after: view.isVisible(), events };
		});

		expect( seen.before ).toBe( false );
		expect( seen.after ).toBe( true );
		expect( seen.events ).toContain("visible");
	});

	test("the Events bus really crosses browsing contexts", async ({ context }) => {
		// two pages on the same origin === two tabs
		const publisher = await context.newPage();
		const subscriber = await context.newPage();
		await publisher.goto( BLANK );
		await subscriber.goto( BLANK );

		// arm the subscriber first, then publish from the other tab
		const received = subscriber.evaluate( async () => {
			const { Events } = await import("/dist/app.js");
			const bus = new Events("smoke");
			return new Promise(( resolve ) => {
				bus.on("slideshow:next", ( frame ) => { bus.close(); resolve( frame ); });
			});
		});
		await subscriber.waitForTimeout( 200 );

		await publisher.evaluate( async () => {
			const { Events } = await import("/dist/app.js");
			const bus = new Events("smoke");
			bus.trigger("slideshow:next", 42);
			bus.close();
		});

		expect( await received ).toBe( 42 );
		await publisher.close();
		await subscriber.close();
	});

	test("the Router drives real History pushState navigation", async ({ page }) => {
		await page.goto( BLANK );
		const result = await page.evaluate( async () => {
			const { Router, history } = await import("/dist/app.js");

			const seen = [];
			const router = new Router({});
			router.route("books/:id", "book", ( id ) => seen.push( id ));
			history.start({ pushState: true, root: "/examples/basic/" });

			router.navigate("books/42", { trigger: true });
			const afterPush = location.pathname;

			// a real back button, not a simulated one
			window.history.back();
			await new Promise(( r ) => setTimeout( r, 300 ));

			return { seen, afterPush, afterBack: location.pathname };
		});

		expect( result.seen ).toEqual(["42"]);
		expect( result.afterPush ).toBe("/examples/basic/books/42");
		expect( result.afterBack ).toBe("/examples/basic/import.html");
	});
});

test.describe("delegated events on a real DOM", () => {

	test("the events hash fires for elements added after binding", async ({ page }) => {
		await page.goto( BLANK );
		const hits = await page.evaluate( async () => {
			const { View } = await import("/dist/app.js");
			document.body.innerHTML = '<div id="panel"></div>';

			class Panel extends View {
				get events(){ return { "click .btn": "onBtn" }; }
				onBtn(){ this.hits = ( this.hits || 0 ) + 1; }
			}
			const view = new Panel({ el: "#panel", html: '<button class="btn">a</button>' });

			view.el.querySelector(".btn").click();
			view.el.insertAdjacentHTML("beforeend", '<button class="btn" id="late">b</button>');
			view.el.querySelector("#late").click();

			return view.hits;
		});
		expect( hits ).toBe( 2 );
	});
});
