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
    remove(name: any): void;
    findLink(target: any): any;
    _preRender(): void;
    _postRender(): void;
    _viewLoaded(): void;
    _allViewsLoaded(): void;
    _syncData(model: any, collection: any, options: any): void;
    _clickLink(e: any): false | undefined;
}
export { Layout };
