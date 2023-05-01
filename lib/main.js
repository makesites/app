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


var utils = new Utils();

if ( window ) window.APP = APP;

export { APP, Collection, Controller, Layout, Model, Template, View };
