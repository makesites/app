export type EventCallback = (...args: any[]) => void;
/**
 * A listener invoked by {@link Observable#trigger}. Arguments are whatever the
 * emitter passed after the event name.
 * @typedef {(...args: any[]) => void} EventCallback
 */
declare class Observable {
    _events: {} | undefined;
    _listeningTo: any;
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
     * {@link Observable#stopListening} (e.g. when a view is removed).
     * @param {Observable} obj - the object to observe
     * @param {string} name - event name(s)
     * @param {EventCallback} callback - runs with THIS object as context
     * @returns {this}
     */
    listenTo(obj: Observable, name: string, callback: EventCallback): this;
    /**
     * Listen to another object's event exactly once, then drop the binding.
     * Tracked like {@link Observable#listenTo}, so {@link Observable#stopListening}
     * also clears it if the event never fires.
     * @param {Observable} obj - the object to observe
     * @param {string} name - event name(s)
     * @param {EventCallback} callback - runs with THIS object as context
     * @returns {this}
     */
    listenToOnce(obj: Observable, name: string, callback: EventCallback): this;
    /**
     * Stop listening. With no arguments drops every listenTo binding; otherwise
     * filters by object, event name and/or callback.
     * @param {Observable} [obj]
     * @param {string} [name]
     * @param {EventCallback} [callback]
     * @returns {this}
     */
    stopListening(obj?: Observable, name?: string, callback?: EventCallback): this;
}
export { Observable };
