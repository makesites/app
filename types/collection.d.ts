import { Base } from "./base.js";
import { Model } from "./model.js";
declare class Collection extends Base {
    model: any;
    options: Object;
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
export { Collection };
