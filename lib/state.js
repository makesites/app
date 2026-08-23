/*
 * state
 * Device / environment state, owned by the APP facade and read by the
 * Controller. Its own module so neither has to import the other for it.
 * Copyright © Makesites.org
 */
import { _ } from "./utils.js";

// Device / environment state. Owned by the APP facade (was built inside the
// Controller). SSR-safe: the eagerly-evaluated flags guard their globals so the
// object can be created outside a browser.
function createState(){
	var hasNav = ( typeof navigator !== "undefined" );
	var hasWin = ( typeof window !== "undefined" );
	var hasDoc = ( typeof document !== "undefined" );
	return {
		fullscreen: false,
		online: ( hasNav && ("onLine" in navigator) ) ? navigator.onLine : true,
		// find browser type
		browser: function(){
			if( !hasNav ) return 'other';
			if( /chrome/.test(navigator.userAgent.toLowerCase()) ) return 'chrome';
			if( /firefox/.test(navigator.userAgent.toLowerCase()) ) return 'firefox';
			if( /safari/.test(navigator.userAgent.toLowerCase()) ) return 'safari';
			if (navigator.appName == 'Microsoft Internet Explorer') return 'ie';
			if( /android/.test(navigator.userAgent.toLowerCase()) ) return 'android';
			if(/(iPhone|iPod).*OS 5.*AppleWebKit.*Mobile.*Safari/.test(navigator.userAgent) ) return 'ios';
			if (navigator.userAgent.indexOf("Opera Mini") !== -1) return 'opera-mini';
			return 'other';
		},
		mobile: hasNav ? (navigator.userAgent.match(/Android/i) || navigator.userAgent.match(/webOS/i) || navigator.userAgent.match(/iPhone/i) || navigator.userAgent.match(/iPod/i) ||navigator.userAgent.match(/BlackBerry/i)) : false,
		ipad: hasNav ? (navigator.userAgent.match(/iPad/i) !== null) : false,
		retina: hasWin ? (window.retina || window.devicePixelRatio > 1) : false,
		// check if there's a touch screen
		touch : hasDoc ? ('ontouchstart' in document.documentElement) : false,
		pushstate: function() {
			try {
				window.history.pushState({"pageTitle": document.title}, document.title, window.location);
				return true;
			}
			catch (e) {
				return false;
			}
		},
		scroll: true,
		ram: function(){
			return (typeof console !== "undefined" && console.memory) ? Math.round( 100 * (console.memory.usedJSHeapSize / console.memory.totalJSHeapSize)) : 0;
		},
		standalone: function(){ return (typeof navigator !== "undefined" && ("standalone" in navigator) && navigator.standalone) || (typeof PhoneGap !="undefined" && !_.isUndefined(PhoneGap.env) && PhoneGap.env.app ) || ((typeof external != "undefined") && (typeof external.msIsSiteMode == "function") && external.msIsSiteMode()); },
		framed: ( typeof self !== "undefined" && typeof top !== "undefined" ) ? (top !== self) : false
	};
}

export { createState };
