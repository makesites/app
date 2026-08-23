import { _ } from "./utils.js";

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

// App-wide sync configuration (native replacement for the jQuery ajaxPrefilter).
// Configure via configureSync() - e.g. the Controller sets the API base URL,
// credentials and a CSRF header getter here.
var syncConfig = {
	base: "",           // prepended to relative (non-absolute) request URLs
	credentials: null,  // e.g. "include" to send cookies cross-origin
	headers: null       // an object, or a function returning per-request headers
};

function configureSync( config ){
	return _.extend( syncConfig, config || {} );
}

/**
 * @typedef {Object} SyncOptions
 * @property {string} [url] - overrides the model/collection url
 * @property {Object} [headers] - extra request headers
 * @property {*} [data] - raw request body (bypasses JSON serialisation)
 * @property {Object} [attrs] - attributes to send (defaults to model.toJSON())
 * @property {Object} [fetchOptions] - passed through to fetch() (credentials, signal, ...)
 * @property {number} [timeout] - ms after which the request auto-aborts
 * @property {AbortSignal} [signal] - wire the request to your own controller
 * @property {number} [retry] - retry count for transient read failures (default 0)
 * @property {number} [retryDelay] - base backoff in ms (default 300)
 * @property {(data: *, status: string, response: Response) => void} [success]
 * @property {(error: Error, status: string, response: Response) => void} [error]
 */

/**
 * Perform a single native fetch() request: assemble → fetch → parse → check →
 * cache-on-success → success callback. Throws the raw error on failure; the
 * retry / cache-fallback / error-event handling lives in sync() so it happens
 * once per call rather than once per network attempt.
 * @param {("create"|"read"|"update"|"patch"|"delete")} method
 * @param {Base} model
 * @param {SyncOptions} options
 * @returns {Promise<*>}
 */
async function _syncRequest( method, model, options ){
	var type = methodMap[ method ];

	// assemble the request
	var params = {
		method: type,
		headers: {
			"Accept": "application/json, text/javascript, */*; q=0.01"
		}
	};
	// apply the app-wide credentials + headers (from configureSync)
	if( syncConfig.credentials ) params.credentials = syncConfig.credentials;
	if( syncConfig.headers ){
		var extra = ( typeof syncConfig.headers === "function" ) ? syncConfig.headers() : syncConfig.headers;
		if( extra ) params.headers = _.extend( params.headers, extra );
	}
	// allow custom fetch options (credentials, mode, signal, etc.)
	if( options.fetchOptions ) params = _.extend( params, options.fetchOptions );
	// merge any custom headers (assign the result: _.extend mutates & returns it)
	if( options.headers ) params.headers = _.extend( params.headers || {}, options.headers );

	// ensure that we have a URL
	var url = options.url || _.result( model, "url" );
	if( !url ) throw new Error('A "url" property or function must be specified');
	// prepend the configured API base for relative URLs
	if( syncConfig.base && !/^https?:\/\//.test( url ) ) url = syncConfig.base + url;

	// ensure the request has the appropriate body for write operations
	if( options.data == null && model && (method === "create" || method === "update" || method === "patch") ){
		params.headers["Content-Type"] = "application/json";
		params.body = JSON.stringify( options.attrs || model.toJSON( options ) );
	} else if( options.data != null ){
		// raw body (URLSearchParams, FormData, string...)
		params.body = options.data;
	}

	// cancellation / timeout via AbortController. Pass options.signal to wire the
	// request to your own controller, or options.timeout (ms) to auto-abort. The
	// created controller is exposed as options.controller so you can abort early.
	// A fresh controller/timer is created per attempt so every retry gets a full
	// timeout budget.
	var timer;
	if( typeof AbortController !== "undefined" ){
		if( options.signal ){
			params.signal = options.signal;
		} else if( options.timeout ){
			var controller = new AbortController();
			params.signal = controller.signal;
			options.controller = controller;
			timer = setTimeout(function(){ controller.abort(); }, options.timeout );
		}
	}

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

	} finally {
		// clear the timeout timer regardless of outcome
		if( timer ) clearTimeout( timer );
	}
}

/**
 * Persist a model/collection to the server via the native fetch() API. Returns a
 * Promise and still fires the success/error callbacks + request/error events.
 *
 * Opt-in retry: pass `options.retry` (a count) to retry *transient* failures
 * with exponential backoff + jitter. Retries are gated to safe reads and genuine
 * network errors — an HTTP status (4xx/5xx) or an abort (timeout / caller cancel)
 * is never retried. Tune the base delay with `options.retryDelay` (ms, default
 * 300). The default `retry: 0` preserves the original single-attempt behaviour.
 * @param {("create"|"read"|"update"|"patch"|"delete")} method
 * @param {Base} model - a Model or Collection
 * @param {SyncOptions} [options]
 * @returns {Promise<*>}
 */
async function sync( method, model, options ){
	// fallback(s)
	options = options || {};
	var retries = options.retry || 0;
	var base = options.retryDelay || 300;
	var attempt = 0;

	// let listeners know a request is under way (parity with Backbone) — once,
	// regardless of how many network attempts follow
	model.trigger("request", model, null, options);

	while( true ){
		try {
			return await _syncRequest( method, model, options );
		} catch( error ){
			// retry only genuine network failures on safe reads: an HTTP status
			// (4xx/5xx) or an abort is never retried
			var retriable = method === "read"
				&& error.name !== "AbortError"
				&& error.status == null;
			if( retriable && attempt < retries ){
				// exponential backoff with jitter: base·2^n + rand·base
				var delay = base * Math.pow( 2, attempt ) + Math.random() * base;
				attempt++;
				await new Promise(function( resolve ){ setTimeout( resolve, delay ); });
				// honour a cancellation requested between tries
				if( !( options.signal && options.signal.aborted ) ) continue;
			}

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
}

export { sync, configureSync };
