import { Base } from "./base.js";
declare class Model extends Base {
    attributes: {};
    changed: {};
    _previousAttributes: {};
    idAttribute: string;
    options: Object;
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
    get data(): {};
    set data(value: {});
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
    changedAttributes(diff: any): Object;
    previous(attr: any): any;
    previousAttributes(): Object;
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
    toJSON(options: any): Object;
    output(): Object;
}
export { Model };
