import { Base } from "./base.js";
declare class Router extends Base {
    _optionRoutes: Object | undefined;
    /**
     * @param {Object} [options]
     * @param {Object} [options.routes] - route -> handler-name map
     */
    constructor(options?: {
        routes?: Object;
    });
    initialize(): void;
    _bindRoutes(): void;
    /**
     * Register a route. `route` may be a pattern string (":id", "*splat",
     * "(/optional)") or a RegExp.
     * @param {(string|RegExp)} route
     * @param {(string|Function)} name - handler name, or the handler itself
     * @param {Function} [callback]
     * @returns {this}
     */
    route(route: (string | RegExp), name: (string | Function), callback?: Function): this;
    /**
     * Run a matched route handler. Override to add pre/post logic (e.g. auth
     * guards); return `false` to cancel the route.
     * @param {Function} callback
     * @param {Array} args - extracted route params
     * @param {string} [name]
     * @returns {(boolean|void)}
     */
    execute(callback: Function, args: any[], name?: string): (boolean | void);
    /**
     * Navigate to a URL fragment via history.
     * @param {string} fragment
     * @param {{trigger?: boolean, replace?: boolean}} [options]
     * @returns {this}
     */
    navigate(fragment: string, options?: {
        trigger?: boolean;
        replace?: boolean;
    }): this;
    _routeToRegExp(route: any): RegExp;
    _extractParameters(route: any, fragment: any): any;
}
declare class History extends Base {
    handlers: any[];
    location: Location | undefined;
    history: globalThis.History | undefined;
    options: any;
    root: any;
    _wantsHashChange: boolean | undefined;
    _wantsPushState: boolean | undefined;
    _hasPushState: boolean | undefined;
    fragment: any;
    constructor();
    atRoot(): boolean;
    getHash(win: any): any;
    getFragment(fragment: any, forcePushState: any): any;
    start(options: any): boolean | undefined;
    stop(): void;
    route(route: any, callback: any): void;
    checkUrl(): false | undefined;
    loadUrl(fragment: any): boolean;
    navigate(fragment: any, options: any): void | boolean;
    _updateHash(location: any, fragment: any, replace: any): void;
}
declare namespace History {
    var started: boolean;
}
declare var history: History;
export { Router, History, history };
