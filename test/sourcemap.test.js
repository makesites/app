// dist source maps — run with: npm test  (after npm run build)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

// generatedLine -> { source, line } for every mapped line
function decodeMappings( mappings ){
	const origins = [];
	let source = 0, line = 0;
	mappings.split(";").forEach(( entry, generated ) => {
		if( !entry ) return;
		const [ , sourceDelta, lineDelta ] = decodeVLQ( entry.split(",")[0] );
		source += sourceDelta;
		line += lineDelta;
		origins[ generated ] = { source, line };
	});
	return origins;
}

test("dist/app.js links to its source map", () => {
	assert.match( read("dist", "app.js"), /\n\/\/# sourceMappingURL=app\.js\.map\n?$/ );
});

test("dist/app.js.map is a well-formed v3 map over lib/", () => {
	const map = JSON.parse( read("dist", "app.js.map") );
	assert.equal( map.version, 3 );
	assert.equal( map.file, "app.js" );
	assert.ok( map.sources.length >= 14, "every concatenated module is listed" );
	for( const source of map.sources ) assert.match( source, /^\.\.\/lib\/[a-z]+\.js$/ );
	assert.equal( map.sourcesContent.length, map.sources.length, "self-contained" );
	assert.ok( map.mappings.length > 1000 );
});

test("sourcesContent matches the files on disk", () => {
	const map = JSON.parse( read("dist", "app.js.map") );
	map.sources.forEach(( source, index ) => {
		assert.equal(
			map.sourcesContent[index],
			read( "dist", source ),
			`${source} content is stale`
		);
	});
});

test("a known bundle line decodes back to the right file and line", () => {
	const map = JSON.parse( read("dist", "app.js.map") );
	const origins = decodeMappings( map.mappings );
	const bundle = read("dist", "app.js").split("\n");

	// pick a landmark that appears exactly once in the bundle
	const marker = "class Collection extends Base {";
	const generated = bundle.findIndex( l => l.startsWith( marker ) );
	assert.ok( generated > -1, "landmark found in the bundle" );

	const origin = origins[ generated ];
	assert.ok( origin, "the landmark line is mapped" );
	assert.equal( map.sources[ origin.source ], "../lib/collection.js" );

	const original = read("lib", "collection.js").split("\n");
	assert.equal(
		original[ origin.line ],
		bundle[ generated ],
		"the mapped original line is the same text"
	);
});

test("dist/app.min.js.map chains back to lib/ through terser", () => {
	assert.match( read("dist", "app.min.js"), /sourceMappingURL=app\.min\.js\.map/ );
	const map = JSON.parse( read("dist", "app.min.js.map") );
	assert.equal( map.version, 3 );
	// terser rewrites the paths, but they must still resolve to the lib sources
	assert.ok(
		map.sources.some( s => s.includes("lib/") && s.endsWith(".js") ),
		`minified map points at lib/, got: ${map.sources.slice(0, 3).join(", ")}`
	);
	assert.ok( map.mappings.length > 1000 );
});
