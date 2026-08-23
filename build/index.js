#!/usr/bin/env node
/**
 * Build script for @makesites/app.
 *
 * Bundles the lib/ module graph from lib/main.js into dist/app.js (readable) and
 * dist/app.min.js (minified), both with source maps that resolve back to the
 * original lib/*.js.
 *
 * There is no concatenation manifest any more: `lib/*.js` are real ES modules
 * with explicit imports, so esbuild derives the order from the graph. The old
 * hand-maintained list had to be kept in dependency order by eye, and getting it
 * wrong - or forgetting to register a new file - failed silently.
 *
 * Usage:  npm run build   (or: node build/index.js)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = join( dirname( fileURLToPath( import.meta.url ) ), ".." );
const pkg = JSON.parse( readFileSync( join( root, "package.json" ), "utf8" ) );

// the banner that used to be the head of the lib/main.js template
const licenses = ( pkg.licenses || [] ).map( l => l.type ).join( ", " ) || pkg.license || "";
const repository = pkg.homepage || ( pkg.repository && pkg.repository.url ) || "";
const banner = `/**
 * @name ${pkg.name}
 * ${pkg.description}
 *
 * Version: ${pkg.version} (${new Date().toUTCString()})
 * Source: ${repository}
 *
 * @author ${pkg.author}
 * Distributed by [Makesites.org](http://makesites.org)
 *
 * @license Released under the ${licenses} licenses
 */`;

mkdirSync( join( root, "dist" ), { recursive: true } );

const shared = {
	entryPoints: [ join( root, "lib", "main.js" ) ],
	bundle: true,
	format: "esm",
	target: [ "es2022" ],
	platform: "browser",
	sourcemap: true,
	sourcesContent: true,
	absWorkingDir: root,
	banner: { js: banner },
	logLevel: "warning"
};

// the readable bundle stays readable: no mangling, no dead-code removal
const readable = await esbuild.build({
	...shared,
	outfile: join( root, "dist", "app.js" ),
	minify: false
});
console.log( "built dist/app.js + app.js.map" );

const minified = await esbuild.build({
	...shared,
	outfile: join( root, "dist", "app.min.js" ),
	minify: true,
	legalComments: "none"
});
console.log( "built dist/app.min.js + app.min.js.map" );

for( const result of [ readable, minified ] ){
	if( result.warnings.length ) console.warn( result.warnings );
}

// `legalComments: "none"` strips the banner from the minified output - put it
// back so the licence travels with the file
const minPath = join( root, "dist", "app.min.js" );
const min = readFileSync( minPath, "utf8" );
if( !min.startsWith( "/**" ) ) writeFileSync( minPath, banner + "\n" + min );
