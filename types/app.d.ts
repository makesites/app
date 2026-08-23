/**
 * @name @makesites/app
 * A zero-dependency, ES6 client-side application framework: models, collections, views, controllers, native router/history, templates, sessions and input mixins.
 *
 * Version: 0.7.0 (Sun, 23 Aug 2026 14:43:46 GMT)
 * Source: http://github.com/makesites/app
 *
 * @author makesites
 * Distributed by [Makesites.org](http://makesites.org)
 *
 * @license Released under the MPL v2.0, AGPL v3.0 licenses
 */
export type EventCallback = (...args: any[]) => void;
/**
 * A listener invoked by {@link Base#trigger}. Arguments are whatever the
 * emitter passed after the event name.
 * @typedef {(...args: any[]) => void} EventCallback
 */
declare class Base {
    _optionStates: Object;
    _events: {} | undefined;
    _listeningTo: any;
    _onResize: any;
    _resizeTimer: any;
    _delegateEvents: any;
    el: any;
    /**
     * @param {Object} [options]
     * @param {Object} [options.states] - state -> handler-name map, merged with the class's own
     */
    constructor(options?: {
        states?: Object;
    });
    bind(name: any, cb: any, context: any): this;
    /**
     * Subscribe to an event. Supports space-separated names ("add remove").
     * @param {string} name - event name(s)
     * @param {EventCallback} callback
     * @param {Object} [context] - `this` inside the callback (defaults to this object)
     * @returns {this}
     */
    on(name: string, callback: EventCallback, context?: Object): this;
    /**
     * Subscribe to an event, firing the callback at most once.
     * @param {string} name - event name(s)
     * @param {EventCallback} callback
     * @param {Object} [context]
     * @returns {this}
     */
    once(name: string, callback: EventCallback, context?: Object): this;
    /**
     * Remove callbacks. With no arguments removes all; otherwise filters by
     * event name, callback and/or context.
     * @param {string} [name]
     * @param {EventCallback} [callback]
     * @param {Object} [context]
     * @returns {this}
     */
    off(name?: string, callback?: EventCallback, context?: Object): this;
    /**
     * Emit an event, passing any extra arguments to the listeners.
     * @param {string} name - event name(s)
     * @param {...*} args - forwarded to each listener
     * @returns {this}
     */
    trigger(name: string, ...args: any[]): this;
    _triggerHandlers(handlers: any, args: any): void;
    /**
     * Listen to another object's event, tracked so it can be torn down via
     * {@link Base#stopListening} (e.g. when a view is removed).
     * @param {Base} obj - the object to observe
     * @param {string} name - event name(s)
     * @param {EventCallback} callback - runs with THIS object as context
     * @returns {this}
     */
    listenTo(obj: Base, name: string, callback: EventCallback): this;
    /**
     * Stop listening. With no arguments drops every listenTo binding; otherwise
     * filters by object, event name and/or callback.
     * @param {Base} [obj]
     * @param {string} [name]
     * @param {EventCallback} [callback]
     * @returns {this}
     */
    stopListening(obj?: Base, name?: string, callback?: EventCallback): this;
    remove(): this;
    unbind(name: any, cb: any): this;
    delegateEvents(events: any): this;
    undelegateEvents(): this;
    setElement(element: any): this;
    _setElement(el: any): void;
    initStates(): void;
}
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
declare var history: History;
declare class Model extends Base {
    attributes: {};
    changed: {};
    _previousAttributes: {};
    idAttribute: string;
    options: any;
    cid: string;
    _changing: boolean | undefined;
    id: any;
    _pending: boolean | {
        silent?: boolean;
    } | undefined;
    validationError: any;
    constructor(model: any, options?: {});
    _optionDefaults(): {
        autofetch: boolean;
        cache: boolean;
    };
    initialize(): void;
    _autofetch(): Promise<any>;
    add(obj: any): void;
    /**
     * Get the value of an attribute.
     * @param {string} attr
     * @returns {*}
     */
    get(attr: string): any;
    has(attr: any): boolean;
    /**
     * Set attribute(s), firing `change:<attr>` then `change` for what actually
     * changed. Accepts `(key, value)` or `({key: value})`.
     * @param {(string|Object)} key - attribute name, or a {attr: value} hash
     * @param {*} [val] - value (when key is a string)
     * @param {{silent?: boolean}} [options]
     * @returns {this}
     */
    set(key: (string | Object), val?: any, options?: {
        silent?: boolean;
    }): this;
    _validate(attrs: any, options: any): boolean;
    hasChanged(attr: any): boolean;
    changedAttributes(diff: any): any;
    previous(attr: any): any;
    previousAttributes(): any;
    reset(): this;
    clear(options: any): this;
    cache(data: any): void | string | false | null;
    sync(method: any, model: any, options: any): Promise<any>;
    url(): any;
    isNew(): boolean;
    /**
     * Fetch the model from the server (GET) and apply the response.
     * @param {SyncOptions} [options]
     * @returns {Promise<*>}
     */
    fetch(options?: SyncOptions): Promise<any>;
    /**
     * Save the model to the server (POST when new, else PUT/PATCH).
     * @param {Object} [attrs] - attributes to set before saving
     * @param {SyncOptions} [options]
     * @returns {Promise<*>}
     */
    save(attrs?: Object, options?: SyncOptions): Promise<any>;
    destroy(options: any): false | Promise<any>;
    isOnline(): any;
    getValue(object: any, prop: any): any;
    parse(data: any): any;
    toJSON(options: any): any;
    output(): any;
}
declare class View extends Base {
    model: any;
    collection: any;
    data: any;
    state: Model;
    _baseStates: {
        scroll: string;
    };
    _baseEvents: {
        "click a[rel='external']": string;
    };
    options: any;
    cid: string;
    url: ((options: any) => any) | undefined;
    template: any;
    __inherit: any;
    observer: IntersectionObserver | undefined;
    /**
     * @param {Object} [options] - { el, model, collection, data, html, url, template, ... }
     */
    constructor(options?: Object);
    initialize(): void;
    _viewDefaults(): {
        data: boolean;
        html: boolean;
        template: boolean;
        url: boolean;
        bind: string;
        type: boolean;
        parentEl: boolean;
        autoRender: boolean;
        inRender: boolean;
        silentRender: boolean;
        renderTarget: boolean;
        resizeDelay: number;
    };
    _url(options: any): any;
    preRender(): void;
    /**
     * Render the view's template into its element (or renderTarget). Override for
     * custom rendering.
     * @returns {void}
     */
    render(): void;
    postRender(): void;
    listen(obj: any, event: any, callback: any): void;
    resize(e: any): void;
    clickExternal(e: any): boolean;
    clickTab(e: any): void;
    findLink(obj: any): any;
    toJSON(): any;
    onLoaded(): void;
    parent(method: any, options: any): any;
    _getEl(options: any): any;
    _initRender(): boolean;
    _preRender(): void;
    _postRender(): void;
    _toJSON(): any;
    _getTemplate(): any;
    _onLoaded(): void;
    _findContainer(): any;
    _inDOM(el: any): boolean | undefined;
    _navigate(e: any): void;
    _resize(): void;
    _scroll(): void;
    isVisible(): any;
    _setupVisibilityObserver(): void;
    /**
     * Tear the view down: drop all listenTo bindings, stop the visibility
     * observer, and detach the element from the DOM.
     * @returns {this}
     */
    remove(): this;
}
declare class Controller extends Router {
    data: Model;
    options: any;
    _baseRoutes: {
        "": string;
        "_=_": string;
        "access_token=:token": string;
        logout: string;
    };
    app: any;
    state: any;
    cid: string;
    session: any;
    /**
     * @param {Object} [options] - { api, autostart, pushState, location, p404, session, app }
     */
    constructor(options?: Object);
    _optionDefaults(): {
        api: boolean;
        autostart: boolean;
        location: boolean;
        pushState: boolean;
        p404: string;
    };
    initialize(): void;
    update(): void;
    index(): void;
    logout(): void;
    preRoute(options: any, callback: any): any;
    access_token(token: any): void;
    _setup(): void;
    _setupConnectivity(): void;
    _setupLinks(): void;
    _setupSession(): void;
    _ajaxPrefilter(api: any): void;
    _fixFB(): void;
    _layoutUpdate(path: any): void;
    _bindRoutes(): void;
    _callRoute(route: any): () => void;
    _geoLocation(): void;
    _404(path: any): void;
}
declare class Collection extends Base {
    model: any;
    options: any;
    _comparator: any;
    cid: string;
    data: any[] | undefined;
    _byId: any;
    /**
     * @param {Array} [models] - models (or plain attribute objects) to populate with
     * @param {Object} [options]
     */
    constructor(models?: any[], options?: Object);
    _optionDefaults(): {
        _synced: boolean;
        autofetch: boolean;
        cache: boolean;
    };
    _reset(): void;
    initialize(models: any, options: any): void;
    _autofetch(): Promise<any>;
    update(): void;
    /**
     * Add one or many models/objects (deduped by id via set()). Fires "add".
     * @param {(Object|Model|Array)} models
     * @param {Object} [options]
     * @returns {(Model|Array)}
     */
    add(models: (Object | Model | any[]), options?: Object): (Model | any[]);
    /**
     * The "smart" update: add new models, merge existing ones (matched by id) and
     * remove any not present in `models`. Options { add, remove, merge, sort,
     * silent } (all default true except silent). Fires add / remove / sort / update.
     * @param {(Object|Model|Array)} models
     * @param {Object} [options] - { add, remove, merge, sort, silent }
     * @returns {(Model|Array)}
     */
    set(models: (Object | Model | any[]), options?: Object): (Model | any[]);
    _idOf(item: any): any;
    _prepareModel(attrs: any, options: any): any;
    /**
     * Sort by the comparator (function(model)->key, function(a,b)->number, or an
     * attribute-name string). Fires "sort".
     * @returns {this}
     */
    /** @param {Object} [options] */
    sort(options?: Object): this;
    /**
     * Remove a model - accepts a model, an id, or a cid. Fires "remove".
     * @param {(Model|string|number|Array)} target
     * @param {Object} [options]
     * @returns {?Model}
     */
    remove(target: (Model | string | number | any[]), options?: Object): Model | null;
    /**
     * Replace all models at once, firing a single "reset".
     * @param {Array} [models]
     * @param {Object} [options]
     * @returns {this}
     */
    reset(models?: any[], options?: Object): this;
    _index(model: any): void;
    _addReference(model: any): void;
    _removeReference(model: any): void;
    _onModelEvent(): void;
    /**
     * Save every model in the collection. Resolves when all have saved.
     * @param {SyncOptions} [options]
     * @returns {Promise<Array>}
     */
    save(options?: SyncOptions): Promise<any[]>;
    sync(method: any, model: any, options: any): Promise<any>;
    fetch(options: any): Promise<any>;
    /**
     * Retrieve a single model by array index, id, name, or cid.
     * @param {(number|string)} key
     * @returns {?Model}
     */
    get(key: (number | string)): Model | null;
    at(index: any): any;
    forEach(callback: any, thisArg: any): void;
    each(callback: any, thisArg: any): void;
    map(callback: any, thisArg: any): any[];
    collect(callback: any, thisArg: any): any[];
    reduce(callback: any, initial: any): any;
    reduceRight(callback: any, initial: any): any;
    find(callback: any, thisArg: any): any;
    findIndex(callback: any, thisArg: any): number;
    filter(callback: any, thisArg: any): any[];
    reject(callback: any, thisArg: any): any[];
    every(callback: any, thisArg: any): boolean;
    all(callback: any, thisArg: any): boolean;
    some(callback: any, thisArg: any): boolean;
    any(callback: any, thisArg: any): boolean;
    includes(model: any, fromIndex: any): boolean;
    contains(model: any, fromIndex: any): boolean;
    indexOf(model: any, fromIndex: any): number;
    lastIndexOf(model: any, fromIndex: any): number;
    slice(start: any, end: any): any[];
    toArray(): any[];
    pluck(attr: any): any[];
    where(attrs: any, first: any): any;
    findWhere(attrs: any): any;
    isEmpty(): boolean;
    _iteratee(iter: any): any;
    _group(iter: any, behavior: any): {};
    groupBy(iter: any): {};
    countBy(iter: any): {};
    sortBy(iter: any): any[];
    invoke(method: any): any[];
    partition(predicate: any): any[][];
    min(iter: any): undefined;
    max(iter: any): undefined;
    sample(n: any): any;
    get length(): number;
    get models(): any[] | undefined;
    get size(): number;
    cache(data: any): any;
    parse(data: any): any;
    toJSON(options: any): any[];
    output(): any[];
    isNew(): boolean;
    isOnline(): any;
}
declare class Layout extends View {
    _onClick: (e: any) => void;
    views: {} | undefined;
    _loaded: boolean | undefined;
    /**
     * @param {Object} [options] - { el (defaults to body), url, autosync, sync_events }
     */
    constructor(options?: Object);
    initialize(): void;
    preRender(): void;
    render(): void;
    postRender(): void;
    update(e: any): void;
    set(views: any): {} | undefined;
    get(view: any): any;
    remove(name: any): void;
    findLink(target: any): any;
    _preRender(): void;
    _postRender(): void;
    _viewLoaded(): void;
    _allViewsLoaded(): void;
    _syncData(model: any, collection: any, options: any): void;
    _clickLink(e: any): false | undefined;
}
declare class Session extends Model {
    state: boolean | undefined;
    store: {
        available: () => boolean;
        get: (name: any) => string | null;
        set: (name: any, val: any) => void | false;
        check: (name: any) => boolean;
        clear: (name: any) => void | false;
    } | {
        available: () => boolean;
        get: (name: any) => string | null;
        set: (name: any, val: any) => void | false;
        check: (name: any) => boolean;
        clear: (name: any) => void | false;
    } | {
        available: () => boolean;
        get: (name: any) => string | null;
        set: (name: any, val: any) => void;
        check: (name: any) => boolean;
        clear: (name: any) => void;
    } | {
        _data: any;
        available: () => boolean;
        get: (name: any) => any;
        set: (name: any, val: any) => boolean;
        check: (name: any) => boolean;
        clear: (name: any) => boolean;
    } | undefined;
    /**
     * @param {Object} [model] - initial attributes
     * @param {Object} [options] - { host, url, local, remote, broadcast, persist }
     */
    constructor(model?: Object, options?: Object);
    initialize(): void;
    url(): string;
    parse(data: any): any;
    sync(method: any, model: any, options: any): Promise<any>;
    update(): void;
    cache(): void;
    logout(options: any): void;
    error(model: any, req: any, options: any, error: any): void;
    generateUid(separator: any): string;
}
declare class Template extends Model {
    html: string;
    /**
     * @param {string} [html] - inline markup to compile
     * @param {Object} [options] - { url, type, compiler }
     */
    constructor(html?: string, options?: Object);
    _setupTemplate(): void;
    compile(markup: any): any;
    static isIdentifier(name: any): boolean;
    fetch(): Promise<void>;
    parse(data: any): void;
    _sanitize(): (text: any) => string;
}
export type SyncOptions = {
    /**
     * - overrides the model/collection url
     */
    url?: string;
    /**
     * - extra request headers
     */
    headers?: Object;
    /**
     * - raw request body (bypasses JSON serialisation)
     */
    data?: any;
    /**
     * - attributes to send (defaults to model.toJSON())
     */
    attrs?: Object;
    /**
     * - passed through to fetch() (credentials, signal, ...)
     */
    fetchOptions?: Object;
    /**
     * - ms after which the request auto-aborts
     */
    timeout?: number;
    /**
     * - wire the request to your own controller
     */
    signal?: AbortSignal;
    /**
     * - retry count for transient read failures (default 0)
     */
    retry?: number;
    /**
     * - base backoff in ms (default 300)
     */
    retryDelay?: number;
    success?: (data: any, status: string, response: Response) => void;
    error?: (error: Error, status: string, response: Response) => void;
};
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
declare function sync(method: ("create" | "read" | "update" | "patch" | "delete"), model: Base, options?: SyncOptions): Promise<any>;
declare const TouchMixin: (BaseClass: any) => {
    new (options?: {}): {
        [x: string]: any;
        touchState: {
            touching: boolean;
            swiping: boolean;
            direction: boolean;
        };
        touchParams: {
            start: null;
            previous: null;
            current: null;
        };
        touchOptions: any;
        get isTouch(): boolean;
        _bindTouchEvents(): void;
        _touchstart(e: any): void;
        _touchmove(e: any): void;
        _touchend(e: any): void;
        _calculateDirection(current: any, previous: any): "bottom" | "left" | "right" | "top" | false;
        getSwipeDistance(axis?: string): number;
    };
    [x: string]: any;
};
declare const MouseMixin: (BaseClass: any) => {
    new (options?: {}): {
        [x: string]: any;
        mouseState: {
            hover: boolean;
            drag: boolean;
            pressing: boolean;
        };
        mousePos: {
            x: number;
            y: number;
        };
        monitorMouse(): void;
        _onMouseMove(e: any): void;
        _mouseTicking: boolean | undefined;
    };
    [x: string]: any;
};
declare const ScrollMixin: (BaseClass: any) => {
    new (options?: {}): {
        [x: string]: any;
        scrollState: {
            top: number;
            height: number;
            max: number;
        };
        monitorScroll(): void;
        _onScroll(): void;
        _scrollTicking: boolean | undefined;
    };
    [x: string]: any;
};
declare const MotionMixin: (BaseClass: any) => {
    new (options?: {}): {
        [x: string]: any;
        motionState: {
            alpha: number;
            beta: number;
            gamma: number;
        };
        monitorMotion(): void;
        _onOrientation(e: any): void;
    };
    [x: string]: any;
};
declare const GamepadMixin: (BaseClass: any) => {
    new (options?: {}): {
        [x: string]: any;
        gamepads: {};
        _buttonStates: {};
        _axisStates: {};
        _pollingLoop: number | null;
        gamepadOptions: any;
        monitorGamepad(): void;
        _pollGamepads(): void;
        _processGamepadButtons(pad: any): void;
        _processGamepadAxes(pad: any): void;
    };
    [x: string]: any;
};
declare const KeysMixin: (BaseClass: any) => {
    new (options?: {}): {
        [x: string]: any;
        keyState: {};
        monitorKeys(): void;
        _onKeyDown(e: any): void;
        _onKeyUp(e: any): void;
        _executeKeyAction(e: any): void;
        isKeyHeld(code: any): boolean;
    };
    [x: string]: any;
};
declare class Events extends Base {
    name: string;
    broadcast: boolean;
    _channel: BroadcastChannel | undefined;
    /**
     * @param {string} [name="app"] - channel/topic namespace (also the BroadcastChannel name)
     * @param {{broadcast?: boolean}} [options] - set broadcast:false to disable cross-tab
     */
    constructor(name?: string, options?: {
        broadcast?: boolean;
    });
    /**
     * Publish an event: deliver to local listeners now, then mirror to other tabs
     * via BroadcastChannel (structured-cloned; non-cloneable payloads stay local).
     * @param {string} name
     * @param {...*} args
     * @returns {this}
     */
    trigger(name: string, ...args: any[]): this;
    _emit(name: any, args: any): Base;
    close(): void;
}
declare class Views {
    _views: {};
    constructor();
    add(name: any, view: any): any;
    get(name: any): any;
    remove(name: any): this;
    each(fn: any): this;
    get all(): {};
}
/**
 * Application facade. `new APP()` returns this object; its sub-objects
 * (events/state/views/session) are ready synchronously, while `router` resolves
 * asynchronously - await {@link APP#ready}.
 * @property {Events} events - the shared, decoupled, cross-tab event bus
 * @property {Object} state - device/environment state (online, touch, mobile, ...)
 * @property {Views} views - registry of mounted views
 * @property {?Session} session - the app session (when options.session is set)
 * @property {?Controller} router - the resolved controller (available after `ready`)
 * @property {Promise<APP>} ready - resolves once the router is loaded
 */
declare class APP {
    name: string;
    options: {
        pushState?: boolean;
        controllers?: string[];
        session?: Object;
    };
    _routes: any[];
    Routers: {};
    state: {
        fullscreen: boolean;
        online: boolean;
        browser: () => "android" | "chrome" | "firefox" | "ie" | "ios" | "opera-mini" | "other" | "safari";
        mobile: boolean | RegExpMatchArray | null;
        ipad: boolean;
        retina: any;
        touch: boolean;
        pushstate: () => boolean;
        scroll: boolean;
        ram: () => number;
        standalone: () => any;
        framed: boolean;
    };
    events: Events;
    views: Views;
    session: Session | null;
    router: any;
    ready: Promise<this>;
    /**
     * @param {Object} [options]
     * @param {boolean} [options.pushState] - use the History pushState API
     * @param {string[]} [options.controllers] - controller names available to lazy-import
     * @param {Object} [options.session] - session config (enables app.session)
     */
    constructor(options?: {
        pushState?: boolean;
        controllers?: string[];
        session?: Object;
    });
    start(): Promise<this>;
    _resolveController(): Promise<any>;
    routes(): any[];
}
declare namespace APP {
    var ready: (callback: any) => any;
    export { Model };
    export { View };
    export { Controller };
    export { Router };
    export { Template };
    export { Collection };
    export { Layout };
    export { Session };
    export { Events };
    export { history };
    export var Models: {};
    export var Controllers: {};
    export var Collections: {};
    export var _a: {};
    export { _a as Views };
    export var Layouts: {};
    export var Templates: {};
}
export { APP, Model, View, Controller, Router, history, Events, Collection, Layout, Template, Session, sync };
export { TouchMixin, MouseMixin, ScrollMixin, MotionMixin, GamepadMixin, KeysMixin };
