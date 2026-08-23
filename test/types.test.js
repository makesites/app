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

test("types/app.d.ts is present and declared in package.json", () => {
	assert.ok( existsSync( join( root, "types", "app.d.ts" ) ), "run `npm run build`" );
	const pkg = JSON.parse( read("package.json") );
	assert.equal( pkg.types, "./types/app.d.ts" );
	assert.equal( pkg.exports["."].types, "./types/app.d.ts" );
	assert.ok( pkg.files.includes("types"), "types/ is published" );
});

test("the declarations export exactly what the bundle exports", () => {
	const fromBundle = exportedNames( read("dist", "app.js") );
	const fromTypes = exportedNames( read("types", "app.d.ts") );

	const missing = [...fromBundle].filter( name => !fromTypes.has( name ) );
	assert.deepEqual( missing, [], "declarations are stale - re-run `npm run build`" );
	assert.ok( fromBundle.size >= 18, `expected the full public surface, got ${fromBundle.size}` );
});

test("the public classes carry real signatures, not just `any`", () => {
	const types = read("types", "app.d.ts");
	for( const declaration of [
		"declare class Model extends Base",
		"declare class Collection extends Base",
		"declare class View extends Base",
		"declare class Controller extends Router",
		"declare class Events extends Base",
		"declare class APP"
	] ) assert.ok( types.includes( declaration ), `missing: ${declaration}` );

	// a spot-check that the JSDoc actually made it through as types
	assert.match( types, /on\(name: string, callback: EventCallback, context\?: Object\): this/ );
	assert.match( types, /trigger\(name: string, \.\.\.args: any\[\]\): this/ );
	assert.match( types, /type SyncOptions = \{/ );
});

test("optional parameters are declared optional", () => {
	const types = read("types", "app.d.ts");
	// regression: these emitted as REQUIRED, so `collection.add(x)` and
	// `new Template(html)` were type errors for consumers
	assert.match( types, /add\(models: \(Object \| Model \| any\[\]\), options\?: Object\)/ );
	assert.match( types, /remove\(target: \(Model \| string \| number \| any\[\]\), options\?: Object\)/ );
	assert.match( types, /constructor\(html\?: string, options\?: Object\)/ );
});
