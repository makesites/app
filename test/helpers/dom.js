// A real DOM for the tests, via jsdom (devDependency only - the library itself
// stays dependency-free). Installs the browser globals the library reads
// (window/document/Element/Event/navigator) plus a controllable
// IntersectionObserver stub, and hands back a restore() to undo all of it.
//
//   const dom = mountDOM(`<div id="main"></div>`);
//   ... exercise a View against dom.document ...
//   dom.intersect( el, true );   // drive the visibility observer
//   dom.restore();
//
// Prefer this over hand-stubbed element objects: the previous approach (a bare
// EventTarget with `contains: () => true`) could not tell a working delegation
// implementation from a broken one.
import { JSDOM } from "jsdom";

// globals copied from the jsdom window onto globalThis for the duration of a test
const WINDOW_GLOBALS = [
	"Element", "HTMLElement", "Node", "NodeList", "Event", "CustomEvent",
	"MouseEvent", "KeyboardEvent", "DOMParser", "getComputedStyle", "navigator"
];

export function mountDOM( body = "", options = {} ){
	const dom = new JSDOM(
		`<!doctype html><html><head></head><body>${body}</body></html>`,
		{ url: options.url || "https://example.test/" }
	);
	const win = dom.window;

	// --- controllable IntersectionObserver (jsdom doesn't implement it) ---
	const observers = [];
	class IntersectionObserverStub {
		constructor( callback ){
			this.callback = callback;
			this.targets = new Set();
			this.disconnected = false;
			observers.push( this );
		}
		observe( el ){ this.targets.add( el ); }
		unobserve( el ){ this.targets.delete( el ); }
		disconnect(){ this.targets.clear(); this.disconnected = true; }
		takeRecords(){ return []; }
	}

	// --- install the globals, remembering how to put each one back ---
	const saved = [];
	const install = ( key, value ) => {
		saved.push([ key, Object.getOwnPropertyDescriptor( globalThis, key ) ]);
		try {
			Object.defineProperty( globalThis, key, {
				value, configurable: true, writable: true, enumerable: false
			});
		} catch ( e ) {
			// a non-configurable global (rare) - leave it alone rather than fail
			saved.pop();
		}
	};

	install( "window", win );
	install( "document", win.document );
	install( "IntersectionObserver", IntersectionObserverStub );
	for( const key of WINDOW_GLOBALS ){
		if( key in win ) install( key, win[key] );
	}

	return {
		dom,
		window: win,
		document: win.document,
		observers,

		// build a detached element from markup (first child)
		el( html ){
			const wrap = win.document.createElement("div");
			wrap.innerHTML = html;
			return wrap.firstElementChild;
		},

		// drive every observer watching `el`
		intersect( el, isIntersecting = true ){
			for( const observer of observers ){
				if( !observer.targets.has( el ) ) continue;
				observer.callback([
					{ target: el, isIntersecting, intersectionRatio: isIntersecting ? 1 : 0 }
				], observer );
			}
		},

		// a real, bubbling click on a real node
		click( el ){
			el.dispatchEvent( new win.MouseEvent("click", { bubbles: true, cancelable: true }) );
		},

		restore(){
			for( const [ key, descriptor ] of saved.reverse() ){
				if( descriptor ) Object.defineProperty( globalThis, key, descriptor );
				else delete globalThis[ key ];
			}
			saved.length = 0;
			win.close();
		}
	};
}
