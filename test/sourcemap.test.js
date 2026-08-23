// dist source maps — run with: npm test  (after npm run build)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve( dirname( fileURLToPath( import.meta.url ) ), ".." );
const read = ( ...p ) => readFileSync( join( root, ...p ), "utf8" );

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function decodeVLQ( segment ){
	const values = [];
	let shift = 0, value = 0;
	for( const character of segment ){
		const digit = BASE64.indexOf( character );
		value += ( digit & 31 ) << shift;
		if( digit & 32 ){ shift += 5; continue; }
		const negative = value & 1;
		value >>= 1;
		values.push( negative ? -value : value );
		value = 0;
		shift = 0;
	}
	return values;
}

// generatedLine -> { source, line }, taking the first segment on each line
function decodeMappings( mappings ){
	const origins = [];
	let source = 0, line = 0;
	mappings.split(";").forEach(( entry, generated ) => {
		if( !entry ) return;
		let first = null;
		for( const segment of entry.split(",") ){
			const [ , sourceDelta, lineDelta ] = decodeVLQ( segment );
			if( sourceDelta === undefined ) continue;
			source += sourceDelta;
			line += lineDelta;
			if( first === null ) first = { source, line };
		}
		if( first ) origins[ generated ] = first;
	});
	return origins;
}

test("dist/app.js links to its source map", () => {
	assert.match( read("dist", "app.js"), /\/\/# sourceMappingURL=app\.js\.map/ );
});

test("dist/app.js.map is a well-formed v3 map over the whole module graph", () => {
	const map = JSON.parse( read("dist", "app.js.map") );
	assert.equal( map.version, 3 );
	assert.ok( map.sources.length >= 17, `expected the whole graph, got ${map.sources.length}` );
	for( const source of map.sources ) assert.match( source, /^\.\.\/lib\/[a-z]+\.js$/ );
	assert.ok( map.sources.includes("../lib/main.js"), "the entry point is mapped" );
	assert.equal( map.sourcesContent.length, map.sources.length, "self-contained" );
	assert.ok( map.mappings.length > 1000 );
});

test("sourcesContent matches the files on disk", () => {
	const map = JSON.parse( read("dist", "app.js.map") );
	map.sources.forEach(( source, index ) => {
		assert.equal( map.sourcesContent[index], read( "dist", source ), `${source} is stale` );
	});
});

test("every module in the graph carries mappings", () => {
	const map = JSON.parse( read("dist", "app.js.map") );
	const used = new Set( decodeMappings( map.mappings ).filter(Boolean).map( o => o.source ) );
	const unmapped = map.sources.filter( ( source, index ) => !used.has( index ) );
	assert.deepEqual( unmapped, [], "a listed source with no mappings means the map is wrong" );
});

test("a bundle line decodes back to the module it came from", () => {
	const map = JSON.parse( read("dist", "app.js.map") );
	const origins = decodeMappings( map.mappings );
	const bundle = read("dist", "app.js").split("\n");

	// A comment landmark, not a code one: a bundler reformats code (esbuild
	// rewrites `class X extends Y {` and normalises whitespace) but preserves
	// comments verbatim, so this stays valid if the bundler ever changes.
	const marker = "resolve the id of a model instance";
	const generated = bundle.findIndex( line => line.includes( marker ) );
	assert.ok( generated > -1, "landmark found in the bundle" );

	const origin = origins[ generated ];
	assert.ok( origin, "the landmark line is mapped" );
	assert.equal( map.sources[ origin.source ], "../lib/collection.js" );
});

test("dist/app.min.js has a map that still points at lib/", () => {
	assert.match( read("dist", "app.min.js"), /sourceMappingURL=app\.min\.js\.map/ );
	const map = JSON.parse( read("dist", "app.min.js.map") );
	assert.equal( map.version, 3 );
	assert.ok(
		map.sources.every( source => source.startsWith("../lib/") ),
		`minified map should point at lib/, got: ${map.sources.slice(0, 3).join(", ")}`
	);
	assert.ok( map.mappings.length > 1000 );
});

// The guarantee that actually matters to a consumer: a stack trace from the
// shipped bundle names the original file, with a line and column.
for( const bundle of [ "app.js", "app.min.js" ] ){
	test(`a stack trace from dist/${bundle} resolves to the original source`, () => {
		const probe = join( root, `.sourcemap-probe-${bundle}.mjs` );
		writeFileSync( probe, [
			`const { Model } = await import("./dist/${bundle}");`,
			`try { await new Model().fetch(); }`,
			`catch ( error ) { console.log( error.stack.split("\\n")[1].trim() ); }`
		].join("\n") );
		try {
			const frame = execFileSync(
				process.execPath, [ "--enable-source-maps", probe ],
				{ cwd: root, encoding: "utf8" }
			).trim();
			// sync.js throws when no url resolves - the frame must name that file
			assert.match( frame, /lib[/\\]sync\.js:\d+:\d+/, `got: ${frame}` );
		} finally {
			rmSync( probe, { force: true } );
		}
	});
}
