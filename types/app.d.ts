import { Observable } from "./observable.js";
import { Model } from "./model.js";
import { View } from "./view.js";
import { Controller } from "./controller.js";
import { Router, history } from "./router.js";
import { Template } from "./template.js";
import { Collection } from "./collection.js";
import { Layout } from "./layout.js";
import { Session } from "./session.js";
import { Events } from "./events.js";
import { Utils, _ } from "./utils.js";
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
    export { Observable };
    export { Utils };
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
    export { _ };
    export var Models: {};
    export var Controllers: {};
    export var Collections: {};
    export var _a: {};
    export { _a as Views };
    export var Layouts: {};
    export var Templates: {};
}
export { APP, Views };
