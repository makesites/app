import { Router } from "./router.js";
import { Model } from "./model.js";
declare class Controller extends Router {
    data: Model;
    options: Object;
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
export { Controller };
