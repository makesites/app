import { APP } from "../../dist/app.js";

// register the app classes into the APP.* namespaces (side-effect imports)
import "./app/controllers.js";
import "./app/models.js";
import "./app/views.js";

// Boot the app: new APP() returns the FACADE and auto-starts (it resolves the
// controller in the background). Its sub-objects (events/state/views) are ready
// immediately; the router resolves asynchronously via app.ready.
const app = new APP({ pushState: false });

// expose on the global scope so the UI can reach app.state / app.events
window.app = app;

// the shared, decoupled event bus - subscribe before anything publishes
app.events.on("profile:open", (name) => console.log("bus: profile opened for", name));

// wait for the router, then demonstrate a bus round-trip
await app.ready;
console.log("app ready — controller cid:", app.router && app.router.cid);
app.events.trigger("profile:open", "Ada");
