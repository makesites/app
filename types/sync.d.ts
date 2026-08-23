declare function configureSync(config: any): Object;
export type SyncOptions = {
    /**
     * - overrides the model/collection url
     */
    url?: string;
    /**
     * - extra request headers
     */
    headers?: Object;
    /**
     * - raw request body (bypasses JSON serialisation)
     */
    data?: any;
    /**
     * - attributes to send (defaults to model.toJSON())
     */
    attrs?: Object;
    /**
     * - passed through to fetch() (credentials, signal, ...)
     */
    fetchOptions?: Object;
    /**
     * - ms after which the request auto-aborts
     */
    timeout?: number;
    /**
     * - wire the request to your own controller
     */
    signal?: AbortSignal;
    /**
     * - retry count for transient read failures (default 0)
     */
    retry?: number;
    /**
     * - base backoff in ms (default 300)
     */
    retryDelay?: number;
    success?: (data: any, status: string, response: Response) => void;
    error?: (error: Error, status: string, response: Response) => void;
};
/**
 * Persist a model/collection to the server via the native fetch() API. Returns a
 * Promise and still fires the success/error callbacks + request/error events.
 *
 * Opt-in retry: pass `options.retry` (a count) to retry *transient* failures
 * with exponential backoff + jitter. Retries are gated to safe reads and genuine
 * network errors — an HTTP status (4xx/5xx) or an abort (timeout / caller cancel)
 * is never retried. Tune the base delay with `options.retryDelay` (ms, default
 * 300). The default `retry: 0` preserves the original single-attempt behaviour.
 * @param {("create"|"read"|"update"|"patch"|"delete")} method
 * @param {Base} model - a Model or Collection
 * @param {SyncOptions} [options]
 * @returns {Promise<*>}
 */
declare function sync(method: ("create" | "read" | "update" | "patch" | "delete"), model: Base, options?: SyncOptions): Promise<any>;
export { sync, configureSync };
