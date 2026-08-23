import { Model } from "./model.js";
declare class Template extends Model {
    html: string;
    /**
     * @param {string} [html] - inline markup to compile
     * @param {Object} [options] - { url, type, compiler }
     */
    constructor(html?: string, options?: Object);
    _setupTemplate(): void;
    compile(markup: any): any;
    static isIdentifier(name: any): boolean;
    fetch(): Promise<void>;
    parse(data: any): void;
    _sanitize(): (text: any) => string;
}
export { Template };
