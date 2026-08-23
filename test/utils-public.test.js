// `_` as public API — run with: npm test
//
// The utility belt is now exported, on the reasoning that anyone extending
// Model / View / Collection wants the same helpers those classes use. That also
// makes it directly testable for the first time.
import { test } from "node:test";
import assert from "node:assert/strict";
import { _, Utils, APP } from "../dist/app.js";

test("`_` is exported, and is the shared instance the framework uses", () => {
	assert.ok( _ instanceof Utils );
	assert.equal( APP._, _, "the same instance, also on the namespace" );
	assert.equal( APP.Utils, Utils );
});

test("the documented helpers are all present", () => {
	for( const name of [
		"extend", "result", "isEqual", "isEmpty", "uniqueId", "uuid", "each",
		"keys", "bindAll", "assignable", "mixin", "isNull", "isUndefined",
		"isString", "isFunction", "getSiblings", "after", "once", "bind"
	] ) assert.equal( typeof _[name], "function", `missing _.${name}` );
});

test("extend mutates and returns the destination", () => {
	const target = { a: 1 };
	const result = _.extend( target, { b: 2 }, { c: 3 } );
	assert.equal( result, target, "returns the same object it mutated" );
	assert.deepEqual( target, { a: 1, b: 2, c: 3 } );
});

test("extend skips falsy sources and later sources win", () => {
	assert.deepEqual( _.extend({}, null, { a: 1 }, undefined, { a: 2 }), { a: 2 } );
});

test("bindAll forwards the arguments it is given", () => {
	// regression: the old wrapper called f.apply(context) with NO arguments, so
	// every bound method silently lost its parameters. Untestable until now,
	// because `_` was not exported.
	const target = {
		name: "obj",
		greet( who, punctuation ){ return `${this.name} says hi ${who}${punctuation}`; }
	};
	_.bindAll( target, "greet" );

	const detached = target.greet;
	assert.equal( detached("Ada", "!"), "obj says hi Ada!" );
});

test("bindAll keeps the context when the method is detached", () => {
	const target = { value: 42, read(){ return this.value; } };
	_.bindAll( target, "read" );
	const detached = target.read;
	assert.equal( detached(), 42 );
});

test("bindAll ignores names that are not functions", () => {
	const target = { notAFunction: 1 };
	assert.doesNotThrow( () => _.bindAll( target, "notAFunction", "missing" ) );
	assert.equal( target.notAFunction, 1 );
});

test("result resolves a value, a getter and a method", () => {
	const plain = { url: "/a" };
	const method = { url(){ return "/b"; } };
	const getter = { get url(){ return "/c"; } };
	assert.equal( _.result( plain, "url" ), "/a" );
	assert.equal( _.result( method, "url" ), "/b" );
	assert.equal( _.result( getter, "url" ), "/c" );
	assert.equal( _.result( {}, "url", "/fallback" ), "/fallback" );
});

test("isEmpty keeps its documented PHP-style semantics", () => {
	for( const value of [ undefined, null, false, 0, "", "0", {}, [] ] ){
		assert.equal( _.isEmpty( value ), true, `${JSON.stringify(value)} should be empty` );
	}
	for( const value of [ 1, "a", { a: 1 }, [ 1 ] ] ){
		assert.equal( _.isEmpty( value ), false, `${JSON.stringify(value)} should not be empty` );
	}
});

test("isEqual compares by value and survives circular structures", () => {
	assert.equal( _.isEqual( { a: [ 1, 2 ] }, { a: [ 1, 2 ] } ), true );
	assert.equal( _.isEqual( { a: 1 }, { a: 2 } ), false );
	const circular = {}; circular.self = circular;
	assert.doesNotThrow( () => _.isEqual( circular, circular ) );
	assert.equal( _.isEqual( circular, {} ), false );
});

test("uniqueId is monotonic and honours a prefix", () => {
	const first = _.uniqueId("row");
	const second = _.uniqueId("row");
	assert.notEqual( first, second );
	assert.match( first, /^row-\d+$/ );
});

test("assignable reports whether a plain assignment would succeed", () => {
	class WithGetter { get locked(){ return 1; } }
	assert.equal( _.assignable( {}, "anything" ), true );
	assert.equal( _.assignable( new WithGetter(), "locked" ), false );
	assert.equal( _.assignable( new WithGetter(), "open" ), true );
});

test("mixin is the extension point for a template compiler", () => {
	const own = new Utils();
	const compiler = () => "compiled";
	own.mixin({ template: compiler });
	assert.equal( own.template, compiler );
});
