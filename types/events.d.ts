import { Base } from "./base.js";
import { Observable } from "./observable.js";
declare class Events extends Base {
    name: string;
    broadcast: boolean;
    _channel: BroadcastChannel | undefined;
    /**
     * @param {string} [name="app"] - channel/topic namespace (also the BroadcastChannel name)
     * @param {{broadcast?: boolean}} [options] - set broadcast:false to disable cross-tab
     */
    constructor(name?: string, options?: {
        broadcast?: boolean;
    });
    /**
     * Publish an event: deliver to local listeners now, then mirror to other tabs
     * via BroadcastChannel (structured-cloned; non-cloneable payloads stay local).
     * @param {string} name
     * @param {...*} args
     * @returns {this}
     */
    trigger(name: string, ...args: any[]): this;
    _emit(name: any, args: any): Observable;
    close(): void;
}
export { Events };
