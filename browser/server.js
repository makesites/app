#!/usr/bin/env node
/**
 * A dependency-free static server for the browser tests.
 *
 * The examples and the bundle are ES modules, so they cannot be loaded over
 * file:// — the browser blocks module requests from an opaque origin. This
 * serves the repo root over http so Playwright can exercise the real artifacts
 * exactly as a consumer would.
 *
 * Usage: node browser/server.js [port]        (default 4173)
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve( dirname( fileURLToPath( import.meta.url ) ), ".." );
const port = Number( process.argv[2] || process.env.PORT || 4173 );

const TYPES = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".map": "application/json; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".svg": "image/svg+xml"
};

const server = createServer( async ( request, response ) => {
	try {
		const url = new URL( request.url, "http://localhost" );
		// normalize() collapses "..", and the prefix check keeps the server inside root
		const target = join( root, normalize( decodeURIComponent( url.pathname ) ) );
		if( !target.startsWith( root ) ){
			response.writeHead( 403 ).end( "forbidden" );
			return;
		}

		const info = await stat( target );
		const file = info.isDirectory() ? join( target, "index.html" ) : target;
		const body = await readFile( file );

		response.writeHead( 200, {
			"content-type": TYPES[ extname( file ) ] || "application/octet-stream",
			"cache-control": "no-store"
		}).end( body );
	} catch ( error ) {
		response.writeHead( error.code === "ENOENT" ? 404 : 500 ).end( String( error.code || error ) );
	}
});

server.listen( port, "127.0.0.1", () => {
	console.log( `serving ${root} on http://127.0.0.1:${port}` );
});
