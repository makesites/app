// Observable — the event system on its own. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { Observable, Model, Collection, APP } from "../dist/app.js";

test("Observable is exported and can make an arbitrary class observable", () => {
	// regression: the event system was only reachable by extending Model, so a
	// plain object could not be made observable (Backbone exposes Backbone.Events
	// as a mixin for exactly this)
	assert.equal( typeof Observable, "function" );
	assert.equal( APP.Observable, Observable );

	class Player extends Observable {
		play( track ){ this.trigger("play", track); }
	}
	const player = new Player();
	let heard = null;
	player.on("play", (track) => { heard = track; });
	player.play("Blue Train");
	assert.equal( heard, "Blue Train" );
});

test("Observable carries the whole event API, without the DOM parts", () => {
	const observable = new Observable();
	for( const method of ["on", "off", "once", "trigger", "bind", "listenTo", "listenToOnce", "stopListening"] ){
		assert.equal( typeof observable[method], "function", `missing ${method}` );
	}
	// element handling stays on Base
	assert.equal( observable.delegateEvents, undefined );
	assert.equal( observable.setElement, undefined );
	assert.equal( observable.initStates, undefined );
});

test("Model and Collection still inherit the same API", () => {
	assert.ok( new Model() instanceof Observable );
	assert.ok( new Collection() instanceof Observable );

	const model = new Model({ a: 1 });
	let calls = 0;
	model.on("change", () => calls++);
	model.set({ a: 2 });
	assert.equal( calls, 1 );
});

test("listenToOnce fires once and then unbinds", () => {
	const source = new Observable();
	const listener = new Observable();
	let calls = 0, seen = null;

	listener.listenToOnce( source, "tick", function( value ){
		calls++;
		seen = value;
		assert.equal( this, listener, "runs with the listener as context" );
	});

	source.trigger("tick", 1);
	source.trigger("tick", 2);
	source.trigger("tick", 3);

	assert.equal( calls, 1 );
	assert.equal( seen, 1 );
	assert.deepEqual( listener._listeningTo, [], "the binding is dropped after firing" );
});

test("listenToOnce bindings are cleared by stopListening even if never fired", () => {
	const source = new Observable();
	const listener = new Observable();
	let calls = 0;

	listener.listenToOnce( source, "tick", () => calls++ );
	listener.stopListening();
	source.trigger("tick");

	assert.equal( calls, 0 );
	assert.deepEqual( listener._listeningTo, [] );
});

test("listenToOnce is independent per listener", () => {
	const source = new Observable();
	const a = new Observable(), b = new Observable();
	let aCalls = 0, bCalls = 0;

	a.listenToOnce( source, "ping", () => aCalls++ );
	b.listenTo( source, "ping", () => bCalls++ );

	source.trigger("ping");
	source.trigger("ping");

	assert.equal( aCalls, 1, "the once-listener stopped" );
	assert.equal( bCalls, 2, "the persistent listener kept going" );
});
