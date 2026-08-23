/**
 * The framework's utility belt. A single shared instance is exported as `_` — the
 * same one every framework class uses — so code extending Model / View /
 * Collection has the same helpers available:
 *
 *   import { _ } from "@makesites/app";
 *   _.extend( target, patch );
 *   _.result( this, "url" );
 *
 * The name is a convention carried over from the Underscore.js days; the
 * dependency is long gone and these are all hand-written or native.
 */
declare class Utils {
    templateSettings: {
        interpolate: RegExp;
        variable: string;
    };
    _idCounter: any;
    constructor();
    /**
     * Shallow-merge the own-enumerable properties of each source onto the first
     * argument and return it. Both `_.extend({}, a, b)` and the mutating
     * `_.extend(target, patch)` forms work; falsy sources are skipped.
     * @param {Object} destination
     * @param {...Object} sources
     * @returns {Object} destination
     */
    extend(destination: Object, ...sources: Object[]): Object;
    /**
     * A random RFC-4122 v4 identifier.
     * @returns {string}
     */
    uuid(): string;
    isPhonegap(): any;
    /**
     * Permanently bind the named methods to `context`, so they can be passed as
     * detached callbacks.
     * @param {Object} context
     * @param {...string} methods
     * @returns {Object} context
     */
    bindAll(context: Object, ...methods: string[]): Object;
    /**
     * PHP-style emptiness: `undefined`, `null`, `false`, `0`, `""`, `"0"` and an
     * object with no own keys are all empty.
     * @param {*} mixedVar
     * @returns {boolean}
     */
    isEmpty(mixedVar: any): boolean;
    isString(v: any): v is string;
    /**
     * The element siblings of a node (excluding itself and text nodes).
     * @param {Element} elem
     * @returns {Element[]}
     */
    getSiblings(elem: Element): Element[];
    /**
     * A process-unique id, optionally prefixed — used for `cid`s.
     * @param {string} [prefix]
     * @returns {string}
     */
    uniqueId(prefix?: string): string;
    isNull(obj: any): boolean;
    isUndefined(obj: any): boolean;
    /**
     * Resolve a property that may be a value, a getter or a method: walks `path`
     * on `obj`, invoking any function it finds with its parent as context.
     * @param {Object} obj
     * @param {(string|string[])} path
     * @param {*} [fallback]
     * @returns {*}
     */
    result(obj: Object, path: (string | string[]), fallback?: any): any;
    /**
     * Iterate an array's items or an object's own values.
     * @param {(Array|Object)} obj
     * @param {(value: *, key: (number|string), obj: *) => void} fn
     * @param {Object} [context]
     * @returns {(Array|Object)} obj
     */
    each(obj: (any[] | Object), fn: (value: any, key: (number | string), obj: any) => void, context?: Object): (any[] | Object);
    bind(fn: any, context: any): any;
    after(times: any, fn: any): () => any;
    once(fn: any): () => any;
    keys(obj: any): string[];
    isFunction(obj: any): boolean;
    /**
     * Can `obj[name] = value` succeed? False when the name resolves to an accessor
     * with no setter — assigning to one throws in strict mode.
     * @param {Object} obj
     * @param {string} name
     * @returns {boolean}
     */
    assignable(obj: Object, name: string): boolean;
    /**
     * Value equality: strict for primitives, structural (via JSON) for plain
     * objects and arrays. Circular structures compare unequal rather than throwing.
     * @param {*} a
     * @param {*} b
     * @returns {boolean}
     */
    isEqual(a: any, b: any): boolean;
    /**
     * Copy properties onto this utils instance — the extension point for
     * registering a template compiler, e.g. `_.mixin({ template: Handlebars.compile })`.
     * @param {Object} obj
     * @returns {this}
     */
    mixin(obj: Object): this;
}
declare const _: Utils;
export { Utils, _ };
