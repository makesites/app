import { APP } from "/build/app.js";

// app-specific code
import * as Controllers from "./app/controllers.js";
import * as Models  from "./app/models.js";
import * as Views  from "./app/views.js";


// init
var app = new APP();

// save on the global scope
window.app = app;
