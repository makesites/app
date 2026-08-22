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

// concatenate the class/function modules
const lib = manifest
	.map( name => readFileSync( join( root, "lib", name + ".js" ), "utf8" ).replace( /\s+$/, "" ) + "\n\n" )
	.join( "" );

// metadata for the header
const licenses = ( pkg.licenses || [] ).map( l => l.type ).join( ", " ) || pkg.license || "";
const repository = pkg.homepage || ( pkg.repository && pkg.repository.url ) || "";

// fill the lib/main.js template (split/join for {{{lib}}} so `$` sequences in the
// source aren't treated as replacement patterns)
let out = readFileSync( join( root, "lib", "main.js" ), "utf8" );
out = out.split( "{{{lib}}}" ).join( lib )
	.replace( /\{\{name\}\}/g, pkg.name || "" )
	.replace( /\{\{description\}\}/g, pkg.description || "" )
	.replace( /\{\{version\}\}/g, pkg.version || "" )
	.replace( /\{\{build_date\}\}/g, new Date().toUTCString() )
	.replace( /\{\{repository\}\}/g, repository )
	.replace( /\{\{author\}\}/g, pkg.author || "" )
	.replace( /\{\{#license licenses\}\}\{\{\/license\}\}/g, licenses );

mkdirSync( join( root, "dist" ), { recursive: true } );
const appPath = join( root, "dist", "app.js" );
writeFileSync( appPath, out );
console.log( "built dist/app.js" );

// minify to dist/app.min.js (terser; --module because the bundle is native ESM)
const minPath = join( root, "dist", "app.min.js" );
try {
	execSync( `terser "${appPath}" --compress --mangle --module -o "${minPath}"`, { stdio: "inherit" } );
	console.log( "built dist/app.min.js" );
} catch ( e ) {
	console.warn( "terser unavailable - skipped dist/app.min.js (run `npm install`)" );
}
