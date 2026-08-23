#!/usr/bin/env node
/**
 * Build script for @makesites/app.
 *
 * Concatenates the lib/ modules (in dependency order) into the lib/main.js
 * wrapper, fills the handlebars-style header placeholders from package.json, and
 * writes dist/app.js. Then minifies it to dist/app.min.js with terser.
 *
 * Usage:  npm run build   (or: node build/index.js)
 * Requires: terser (devDependency; resolved from node_modules/.bin or PATH).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join( dirname( fileURLToPath( import.meta.url ) ), ".." );
const pkg = JSON.parse( readFileSync( join( root, "package.json" ), "utf8" ) );

// Concatenation manifest (dependency order):
// - base first (everything extends it)
// - router before controller (Controller extends Router)
// - events before app (APP instantiates Events)
// - utils/app last
const manifest = [
	"base", "router", "model", "view", "controller", "collection", "layout",
	"session", "template", "cache", "sync", "input", "events", "utils", "app"
];

// concatenate the class/function modules, recording where every generated line
// came from so we can emit a source map (see below)
const chunks = manifest.map( name => {
	const file = join( root, "lib", name + ".js" );
	const raw = readFileSync( file, "utf8" );
	return { file, raw, body: raw.replace( /\s+$/, "" ) };
});
const lib = chunks.map( c => c.body + "\n\n" ).join( "" );

// metadata for the header
const licenses = ( pkg.licenses || [] ).map( l => l.type ).join( ", " ) || pkg.license || "";
const repository = pkg.homepage || ( pkg.repository && pkg.repository.url ) || "";

// fill the lib/main.js template. The header placeholders are resolved FIRST, so
// the line offset of the {{{lib}}} slot is known exactly before the sources are
// spliced in - that offset is what the source map is built from.
const template = readFileSync( join( root, "lib", "main.js" ), "utf8" )
	.replace( /\{\{name\}\}/g, pkg.name || "" )
	.replace( /\{\{description\}\}/g, pkg.description || "" )
	.replace( /\{\{version\}\}/g, pkg.version || "" )
	.replace( /\{\{build_date\}\}/g, new Date().toUTCString() )
	.replace( /\{\{repository\}\}/g, repository )
	.replace( /\{\{author\}\}/g, pkg.author || "" )
	.replace( /\{\{#license licenses\}\}\{\{\/license\}\}/g, licenses );

// split/join (not replace) so `$` sequences in the sources aren't read as
// replacement patterns
const slot = template.indexOf( "{{{lib}}}" );
const before = template.slice( 0, slot );
const after = template.slice( slot + "{{{lib}}}".length );
let out = before + lib + after;

// --- source map -------------------------------------------------------------
// The bundle is a pure concatenation, so every generated line maps 1:1 to a line
// of some lib/*.js at column 0. That makes a line-granular map both exact and
// cheap - no parsing, no dependency.
const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function vlq( value ){
	let rest = value < 0 ? ( ( -value ) << 1 ) | 1 : value << 1;
	let encoded = "";
	do {
		let digit = rest & 31;
		rest >>>= 5;
		if( rest > 0 ) digit |= 32;
		encoded += BASE64[ digit ];
	} while( rest > 0 );
	return encoded;
}

// generated line index at which the concatenated sources start
const slotLine = before.split( "\n" ).length - 1;
// generatedLine -> { source, line } (0-based), sparse
const origins = [];
let cursor = slotLine;
chunks.forEach( ( chunk, source ) => {
	const lines = chunk.body.split( "\n" ).length;
	for( let line = 0; line < lines; line++ ) origins[ cursor + line ] = { source, line };
	cursor += lines + 1;                 // + the blank line the "\n\n" join adds
});

const totalLines = out.split( "\n" ).length;
let prevSource = 0, prevLine = 0;
const mappings = [];
for( let generated = 0; generated < totalLines; generated++ ){
	const origin = origins[ generated ];
	if( !origin ){ mappings.push( "" ); continue; }
	// [ generatedColumn, sourceIndex, originalLine, originalColumn ], all relative
	mappings.push( vlq( 0 ) + vlq( origin.source - prevSource ) + vlq( origin.line - prevLine ) + vlq( 0 ) );
	prevSource = origin.source;
	prevLine = origin.line;
}

const sourceMap = {
	version: 3,
	file: "app.js",
	sourceRoot: "",
	sources: chunks.map( c => "../lib/" + c.file.split( /[\\/]/ ).pop() ),
	sourcesContent: chunks.map( c => c.raw ),
	names: [],
	mappings: mappings.join( ";" )
};

mkdirSync( join( root, "dist" ), { recursive: true } );
const appPath = join( root, "dist", "app.js" );
const mapPath = appPath + ".map";
out += "\n//# sourceMappingURL=app.js.map\n";
writeFileSync( appPath, out );
writeFileSync( mapPath, JSON.stringify( sourceMap ) );
console.log( "built dist/app.js + app.js.map" );

// minify to dist/app.min.js (terser; --module because the bundle is native ESM).
// The input map is chained in, so the minified map points at lib/*.js too.
const minPath = join( root, "dist", "app.min.js" );
try {
	execSync(
		`terser "${appPath}" --compress --mangle --module ` +
		`--source-map "content='${mapPath}',url='app.min.js.map'" -o "${minPath}"`,
		{ stdio: "inherit" }
	);
	console.log( "built dist/app.min.js + app.min.js.map" );
} catch ( e ) {
	console.warn( "terser unavailable - skipped dist/app.min.js (run `npm install`)" );
}
