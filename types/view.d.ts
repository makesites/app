import { Base } from "./base.js";
declare class View extends Base {
    model: any;
    collection: any;
    data: any;
    _baseStates: {
        scroll: string;
    };
    _baseEvents: {
        "click a[rel='external']": string;
    };
    options: Object;
    cid: string;
    url: ((options: any) => any) | undefined;
    template: any;
    _state: any;
    __inherit: any;
    observer: IntersectionObserver | undefined;
    /**
     * @param {Object} [options] - { el, model, collection, data, html, url, template, ... }
     */
    constructor(options?: Object);
    initialize(): void;
    get state(): any;
    set state(value: any);
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
    /**
     * Subscribe to an event. Overridden so that asking for "visible" / "hidden"
     * starts the IntersectionObserver - it is not created until something wants it.
     * @param {string} name
     * @param {EventCallback} callback
     * @param {Object} [context]
     * @returns {this}
     */
    on(name: string, callback: EventCallback, context?: Object): this;
    isVisible(): any;
    _setupVisibilityObserver(): void;
    /**
     * Tear the view down: drop all listenTo bindings, stop the visibility
     * observer, and detach the element from the DOM.
     * @returns {this}
     */
    remove(): this;
}
export { View };
