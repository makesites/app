import { APP } from "../../dist/app.js";

// `new APP()` returns the facade and auto-starts. Its sub-objects are ready
// synchronously; only the router is resolved in the background.
const app = new APP({ pushState: false });
window.app = app;

// the decoupled bus — subscribe before anything publishes
app.events.on("init:done", (detail) => console.log("bus:", detail));

const list = document.querySelector("#main");
const row = (term, value) => {
	list.insertAdjacentHTML("beforeend", `<dt>${term}</dt><dd>${value}</dd>`);
};

row("online", app.state.online);
row("touch", app.state.touch);
row("views", "registry ready: " + (typeof app.views.add === "function"));
row("events", "bus ready: " + (typeof app.events.trigger === "function"));

// the router is the one asynchronous piece
await app.ready;
row("router", app.router ? app.router.constructor.name + " (" + app.router.cid + ")" : "none");

app.events.trigger("init:done", { router: !!app.router });

export { app };
