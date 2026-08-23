// The examples must actually run — run with: npm test
//
// Every defect these check for was really shipped: an ES module loaded with
// `<script type="text/javascript">` (a guaranteed "Unexpected token 'export'"),
// `src`/`import` paths pointing at files that do not exist, and a server-absolute
// "/dist/app.js" that only resolves if the repo root happens to be the web root.
// Docs rot silently; this makes it fail the build instead.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = resolve( dirname( fileURLToPath( import.meta.url ) ), ".." );
const examples = join( root, "examples" );

function walk( dir, extension ){
	const found = [];
	for( const entry of readdirSync( dir ) ){
		const full = join( dir, entry );
		if( statSync( full ).isDirectory() ) found.push( ...walk( full, extension ) );
		else if( entry.endsWith( extension ) ) found.push( full );
	}
	return found;
}

// a local (non-absolute-URL, non-anchor) reference we can resolve on disk
const isLocal = ( href ) =>
	href && !/^(https?:)?\/\//.test( href ) && !href.startsWith("#") && !href.startsWith("data:");

const isModule = ( file ) => {
	const source = readFileSync( file, "utf8" );
	// `export {` / `export default` / a top-level `import … from` — the bare
	// line-anchored form is not enough: a minified bundle carries its whole body
	// on one line, so dist/app.min.js has to match `export{…}` mid-line too
	return /\bexport\s*[{*]/.test( source )
		|| /^\s*export\s/m.test( source )
		|| /^\s*import\s.+from\s/m.test( source );
};

const pages = walk( examples, ".html" );
const scripts = walk( examples, ".js" );

test("there are examples to check", () => {
	assert.ok( pages.length >= 4, `found ${pages.length} example pages` );
});

for( const page of pages ){
	const name = relative( root, page );

	test(`${name}: every local reference resolves`, () => {
		const { window } = new JSDOM( readFileSync( page, "utf8" ) );
		const base = dirname( page );
		const missing = [];

		for( const el of window.document.querySelectorAll("script[src]") ){
			const src = el.getAttribute("src");
			if( !isLocal( src ) ) continue;
			if( !existsSync( join( base, src ) ) ) missing.push( `script src="${src}"` );
		}
		for( const el of window.document.querySelectorAll("link[href]") ){
			const href = el.getAttribute("href");
			if( !isLocal( href ) ) continue;
			if( !existsSync( join( base, href ) ) ) missing.push( `link href="${href}"` );
		}
		// bare specifiers in inline modules
		for( const el of window.document.querySelectorAll('script[type="module"]:not([src])') ){
			for( const match of el.textContent.matchAll(/from\s+["']([^"']+)["']/g) ){
				const specifier = match[1];
				if( !isLocal( specifier ) ) continue;
				if( !existsSync( join( base, specifier ) ) ) missing.push( `import "${specifier}"` );
			}
		}

		assert.deepEqual( missing, [], `${name} references files that do not exist` );
	});

	test(`${name}: ES modules are loaded as modules`, () => {
		const { window } = new JSDOM( readFileSync( page, "utf8" ) );
		const base = dirname( page );
		const wrong = [];

		for( const el of window.document.querySelectorAll("script[src]") ){
			const src = el.getAttribute("src");
			if( !isLocal( src ) ) continue;
			const target = join( base, src );
			if( !existsSync( target ) ) continue;         // reported by the test above
			if( isModule( target ) && el.getAttribute("type") !== "module" ){
				wrong.push( `${src} (type="${el.getAttribute("type") || "text/javascript"}")` );
			}
		}

		assert.deepEqual( wrong, [], `${name} loads an ES module as a classic script` );
	});
}

for( const script of scripts ){
	const name = relative( root, script );
	test(`${name}: parses`, () => {
		execFileSync( process.execPath, ["--check", script], { stdio: "pipe" } );
	});
}
