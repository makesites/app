import { Observable } from "./observable.js";
declare class Base extends Observable {
    _optionStates: Object;
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
    remove(): this;
    unbind(name: any, cb: any): this;
    delegateEvents(events: any): this;
    undelegateEvents(): this;
    setElement(element: any): this;
    _setElement(el: any): void;
    initStates(): void;
}
export { Base };
