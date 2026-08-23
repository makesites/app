import { Model } from "./model.js";
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
export { Session };
