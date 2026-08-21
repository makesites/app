/*
 * sync
 * Native fetch() replacement for Backbone.sync / jQuery $.ajax
 * Copyright © Makesites.org
 */

// map the CRUD methods to HTTP verbs
var methodMap = {
	"create" : "POST",
	"update" : "PUT",
	"patch"  : "PATCH",
	"delete" : "DELETE",
	"read"   : "GET"
};

// Persists the state of a model/collection to the server using the native
// fetch() API. Returns a Promise that resolves with the parsed response and
// still fires the legacy success/error callbacks the components rely on.
async function sync( method, model, options ){
	// fallback(s)
	options = options || {};
	var type = methodMap[ method ];

	// assemble the request
	var params = {
		method: type,
		headers: {
			"Accept": "application/json, text/javascript, */*; q=0.01"
		}
	};
	// allow custom fetch options (credentials, mode, signal, etc.)
	if( options.fetchOptions ) _.extend( params, options.fetchOptions );
	// merge any custom headers
	if( options.headers ) _.extend( params.headers, options.headers );

	// ensure that we have a URL
	var url = options.url || _.result( model, "url" );
	if( !url ) throw new Error('A "url" property or function must be specified');

	// ensure the request has the appropriate body for write operations
	if( options.data == null && model && (method === "create" || method === "update" || method === "patch") ){
		params.headers["Content-Type"] = "application/json";
		params.body = JSON.stringify( options.attrs || model.toJSON( options ) );
	} else if( options.data != null ){
		// raw body (URLSearchParams, FormData, string...)
		params.body = options.data;
	}

	// let listeners know a request is under way (parity with Backbone)
	model.trigger("request", model, null, options);

	try {
		// execute the native request
		var response = await fetch( url, params );

		// parse the response based on its Content-Type
		var responseData;
		var contentType = response.headers.get("content-type");
		if( contentType && contentType.includes("application/json") ){
			responseData = await response.json();
		} else {
			// fallback for empty responses (204) or plain text
			var text = await response.text();
			responseData = text ? text : null;
		}

		// native fetch() does not reject on 4xx/5xx, so we check manually
		if( !response.ok ){
			var error = new Error( response.statusText || ("HTTP Error " + response.status) );
			error.status = response.status;
			error.response = response;
			error.responseData = responseData;
			throw error;
		}

		// CACHE: update the local cache with the fresh server data (opt-in via
		// the model's `cache` option). Keeps localStorage in sync on every
		// successful read/write.
		if( model.options && model.options.cache && typeof model.cache === "function" &&
			(method === "read" || method === "create" || method === "update" || method === "patch") ){
			model.cache( responseData );
		}

		// fire the success callback (models/collections wrap this to set data)
		if( options.success ) options.success( responseData, response.statusText, response );

		return responseData;

	} catch( error ){
		// CACHE: on a failed read, transparently fall back to the local cache
		// so the UI can still render while offline (stale-while-revalidate).
		if( method === "read" && model.options && model.options.cache && typeof model.cache === "function" ){
			var cached = model.cache();
			var hasData = Array.isArray( cached ) ? cached.length > 0 : ( cached && Object.keys( cached ).length > 0 );
			if( hasData ){
				if( options.success ) options.success( cached, "success-from-cache", null );
				return cached;
			}
		}
		// fire the error callback
		if( options.error ) options.error( error, error.statusText, error.response );
		// bubble up a global error event
		model.trigger("error", model, error, options);
		// re-throw so callers awaiting the promise can catch it
		throw error;
	}
}
