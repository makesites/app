/**
 * @name {{name}}
 * {{description}}
 *
 * Version: {{version}} ({{build_date}})
 * Source: {{repository}}
 *
 * @author {{author}}
 * Distributed by [Makesites.org](http://makesites.org)
 *
 * @license Released under the {{#license licenses}}{{/license}} licenses
 */

//import { APP } from "./app.js";


{{{lib}}}

// Initialize utilities
// convention carried from the legacy underscore.js
var _ = new Utils();

// expose on the global (guarded so the bundle also imports under Node/SSR)
if ( typeof window !== "undefined" ) window.APP = APP;

export { APP, Model, View, Controller, Router, history, Events, Collection, Layout, Template, Session, sync };
export { TouchMixin, MouseMixin, ScrollMixin, MotionMixin, GamepadMixin, KeysMixin };
