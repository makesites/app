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

if ( window ) window.APP = APP;

export { APP, Collection, Controller, Layout, Model, Template, View };
