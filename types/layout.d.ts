import { View } from "./view.js";
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
    /**
     * With a name, removes that child view (what this method has always done).
     * With no arguments, tears the layout itself down — the `View#remove()`
     * contract.
     *
     * The two used to be the same method with incompatible signatures, so
     * `layout.remove()` silently did nothing: it looked up `this.views[undefined]`,
     * found nothing and returned. A Layout could therefore never be torn down,
     * including through `app.views.remove( name )`, which calls `view.remove()`.
     * `removeView( name )` is the clearer name for the child-view case; `remove( name )`
     * still works.
     * @param {string} [name]
     * @returns {this}
     */
    remove(name?: string): this;
    /**
     * Remove a registered child view: drops the layout's bindings to it and its
     * data, tears the view down, and forgets it.
     * @param {string} name
     * @returns {this}
     */
    removeView(name: string): this;
    findLink(target: any): any;
    _preRender(): void;
    _postRender(): void;
    _viewLoaded(): void;
    _allViewsLoaded(): void;
    _syncData(model: any, collection: any, options: any): void;
    _clickLink(e: any): false | undefined;
}
export { Layout };
