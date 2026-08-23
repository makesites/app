// Generated TypeScript declarations — run with: npm test  (after npm run build)
//
// The heavy check (tsc against a sample consumer) is `npm run types`, wired into
// `npm run build` and CI. These are the fast guards that catch the common
// failure: shipping a stale or partial types/app.d.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve( dirname( fileURLToPath( import.meta.url ) ), ".." );
const read = ( ...p ) => readFileSync( join( root, ...p ), "utf8" );

// pull the names out of every `export { A, B as C }` statement
function exportedNames( source ){
	const names = new Set();
	for( const match of source.matchAll( /export\s*\{([^}]*)\}/g ) ){
		for( const entry of match[1].split(",") ){
			const name = entry.trim().split( /\s+as\s+/ ).pop().trim();
			if( name ) names.add( name );
		}
	}
	return names;
}

test("types/ is present and declared in package.json", () => {
	// one declaration file per module, mirroring lib/ — generated from the source
	// graph rather than from the bundle, so the class hierarchy survives
	for( const file of [ "main.d.ts", "model.d.ts", "collection.d.ts", "view.d.ts" ] ){
		assert.ok( existsSync( join( root, "types", file ) ), `missing types/${file} — run \`npm run build\`` );
	}
	const pkg = JSON.parse( read("package.json") );
	assert.equal( pkg.types, "./types/main.d.ts" );
	assert.equal( pkg.exports["."].types, "./types/main.d.ts" );
	assert.ok( pkg.files.includes("types"), "types/ is published" );
});

test("the declarations export exactly what the bundle exports", () => {
	const fromBundle = exportedNames( read("dist", "app.js") );
	const fromTypes = exportedNames( read("types", "main.d.ts") );

	const missing = [...fromBundle].filter( name => !fromTypes.has( name ) );
	assert.deepEqual( missing, [], "declarations are stale - re-run `npm run build`" );
	assert.ok( fromBundle.size >= 18, `expected the full public surface, got ${fromBundle.size}` );
});

test("the class hierarchy survives into the declarations", () => {
	// regression: generating these from the *bundle* produced
	// `declare var Model: {...}` — esbuild rewrites `class X extends Y {` to
	// `var X = class extends Y {`, so every `extends` relationship was lost
	for( const [ file, declaration ] of [
		[ "model.d.ts", "declare class Model extends Base" ],
		[ "collection.d.ts", "declare class Collection extends Base" ],
		[ "view.d.ts", "declare class View extends Base" ],
		[ "controller.d.ts", "declare class Controller extends Router" ],
		[ "events.d.ts", "declare class Events extends Base" ],
		[ "base.d.ts", "declare class Base extends Observable" ],
		[ "app.d.ts", "declare class APP" ]
	] ) assert.ok( read( "types", file ).includes( declaration ), `missing in ${file}: ${declaration}` );
});

test("the JSDoc made it through as real types", () => {
	assert.match( read("types", "observable.d.ts"), /on\(name: string, callback: EventCallback, context\?: Object\): this/ );
	assert.match( read("types", "observable.d.ts"), /trigger\(name: string, \.\.\.args: any\[\]\): this/ );
	assert.match( read("types", "sync.d.ts"), /type SyncOptions = \{/ );
});

test("optional parameters are declared optional", () => {
	const types = read("types", "collection.d.ts") + read("types", "template.d.ts");
	// regression: these emitted as REQUIRED, so `collection.add(x)` and
	// `new Template(html)` were type errors for consumers
	assert.match( types, /add\(models: \(Object \| Model \| any\[\]\), options\?: Object\)/ );
	assert.match( types, /remove\(target: \(Model \| string \| number \| any\[\]\), options\?: Object\)/ );
	assert.match( types, /constructor\(html\?: string, options\?: Object\)/ );
});
