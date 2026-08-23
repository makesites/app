/*
 * Input Mixins
 * Modern, zero-dependency ES6 mixins for Touch, Mouse, Scroll, Motion,
 * Gamepad and Keys. Compose them over any class that exposes `this.el`,
 * `this.options` and `this.trigger()` (e.g. View):
 *
 *   class CarouselView extends TouchMixin( View ) { ... }
 *   class GameView extends KeysMixin( GamepadMixin( View ) ) { ... }
 *
 * Based on the backbone.input.* plugins.
 * Copyright © Makesites.org
 */

// -----------------------------------------------------------------------------
// 1. Touch
// -----------------------------------------------------------------------------
const TouchMixin = ( BaseClass ) => class extends BaseClass {
	constructor( options = {} ){
		super( options );
		this.touchState = { touching: false, swiping: false, direction: false };
		this.touchParams = { start: null, previous: null, current: null };

		this.touchOptions = Object.assign({
			threshold: 10,
			inertia: 0,
			blocking: true,
			monitor: true
		}, options.touch || {});

		if( this.isTouch && this.touchOptions.monitor ){
			this._bindTouchEvents();
		}
	}

	get isTouch(){
		return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
	}

	_bindTouchEvents(){
		const opts = this.touchOptions.blocking ? { passive: false } : { passive: true };
		this.el.addEventListener('touchstart', this._touchstart.bind(this), opts);
		this.el.addEventListener('touchmove', this._touchmove.bind(this), opts);
		this.el.addEventListener('touchend', this._touchend.bind(this), opts);
	}

	_touchstart( e ){
		const touch = e.touches[0];
		const coords = { x: touch.clientX, y: touch.clientY };
		this.touchState.touching = true;
		this.touchParams.start = coords;
		this.touchParams.previous = coords;
		this.touchParams.current = coords;
		this.trigger('touchstart', e);
	}

	_touchmove( e ){
		if( !this.touchState.touching ) return;
		const touch = e.touches[0];
		const current = { x: touch.clientX, y: touch.clientY };
		const previous = this.touchParams.previous;

		const direction = this._calculateDirection(current, previous);
		this.touchState.swiping = !!direction;
		this.touchState.direction = direction;

		if( direction && this.touchOptions.blocking && e.cancelable ) e.preventDefault();

		this.touchParams.previous = this.touchParams.current;
		this.touchParams.current = current;
		this.trigger('touchmove', e);
	}

	_touchend( e ){
		if( e.touches.length === 0 ){
			this.touchState.touching = false;
			this.touchState.swiping = false;
			this.touchParams.start = null;
		}
		this.trigger('touchend', e);
	}

	_calculateDirection( current, previous ){
		const dx = current.x - previous.x;
		const dy = current.y - previous.y;
		const { inertia, threshold } = this.touchOptions;

		if( dx > inertia && Math.abs(dy) < threshold ) return "right";
		if( dx < -inertia && Math.abs(dy) < threshold ) return "left";
		if( dy > inertia && Math.abs(dx) < threshold ) return "bottom";
		if( dy < -inertia && Math.abs(dx) < threshold ) return "top";
		return false;
	}

	getSwipeDistance( axis = 'x' ){
		if( !this.touchParams.start || !this.touchParams.current ) return 0;
		return this.touchParams.current[axis] - this.touchParams.start[axis];
	}
};

// -----------------------------------------------------------------------------
// 2. Mouse
// -----------------------------------------------------------------------------
const MouseMixin = ( BaseClass ) => class extends BaseClass {
	constructor( options = {} ){
		super( options );
		this.mouseState = { hover: false, drag: false, pressing: false };
		this.mousePos = { x: 0, y: 0 };
		if( options.monitorMouse ) this.monitorMouse();
	}

	monitorMouse(){
		this.el.addEventListener('mousemove', this._onMouseMove.bind(this), { passive: true });
		this.el.addEventListener('mousedown', () => { this.mouseState.pressing = true; }, { passive: true });
		this.el.addEventListener('mouseup', () => { this.mouseState.pressing = false; }, { passive: true });
	}

	_onMouseMove( e ){
		if( this._mouseTicking ) return;
		this._mouseTicking = true;
		requestAnimationFrame(() => {
			this.mousePos.x = e.clientX;
			this.mousePos.y = e.clientY;
			this.trigger('mousemove', this.mousePos);
			this._mouseTicking = false;
		});
	}
};

// -----------------------------------------------------------------------------
// 3. Scroll
// -----------------------------------------------------------------------------
const ScrollMixin = ( BaseClass ) => class extends BaseClass {
	constructor( options = {} ){
		super( options );
		this.scrollState = { top: 0, height: 0, max: 0 };
		if( options.monitorScroll ) this.monitorScroll();
	}

	monitorScroll(){
		window.addEventListener('scroll', this._onScroll.bind(this), { passive: true });
	}

	_onScroll(){
		if( this._scrollTicking ) return;
		this._scrollTicking = true;
		requestAnimationFrame(() => {
			this.scrollState.top = window.scrollY;
			this.scrollState.height = document.documentElement.scrollHeight;
			this.scrollState.max = this.scrollState.height - window.innerHeight;
			this.trigger('scroll', this.scrollState);
			this._scrollTicking = false;
		});
	}
};

// -----------------------------------------------------------------------------
// 4. Motion
// -----------------------------------------------------------------------------
const MotionMixin = ( BaseClass ) => class extends BaseClass {
	constructor( options = {} ){
		super( options );
		this.motionState = { alpha: 0, beta: 0, gamma: 0 };
		if( options.monitorMotion ) this.monitorMotion();
	}

	monitorMotion(){
		if( window.DeviceOrientationEvent ){
			window.addEventListener('deviceorientation', this._onOrientation.bind(this), { passive: true });
		}
	}

	_onOrientation( e ){
		this.motionState = { alpha: e.alpha, beta: e.beta, gamma: e.gamma };
		this.trigger('deviceorientation', this.motionState);
	}
};

// -----------------------------------------------------------------------------
// 5. Gamepad
// -----------------------------------------------------------------------------
const BUTTON_MAP = ['button_a','button_b','button_x','button_y','bumper_left','bumper_right','trigger_left','trigger_right','button_select','button_start','stick_left_click','stick_right_click','dpad_up','dpad_down','dpad_left','dpad_right','button_home'];
const AXIS_MAP = ['stick_left_x','stick_left_y','stick_right_x','stick_right_y'];

function applyDeadzone( value, deadzone, maximizeThreshold ){
	if( value >= 0 ){
		if( value < deadzone ) return 0.0;
		if( value > maximizeThreshold ) return 1.0;
	} else {
		if( value > -deadzone ) return 0.0;
		if( value < -maximizeThreshold ) return -1.0;
	}
	return value;
}

const GamepadMixin = ( BaseClass ) => class extends BaseClass {
	constructor( options = {} ){
		super( options );
		this.gamepads = {};
		this._buttonStates = {};
		this._axisStates = {};
		this._pollingLoop = null;

		this.gamepadOptions = Object.assign({ deadzone: 0.05, maximizeThreshold: 0.97 }, options.gamepad || {});
		if( options.monitorGamepad ) this.monitorGamepad();
	}

	monitorGamepad(){
		window.addEventListener('gamepadconnected', ( e ) => {
			this.gamepads[e.gamepad.index] = e.gamepad;
			this.trigger('gamepad-connect', e.gamepad);
			if( !this._pollingLoop ) this._pollGamepads();
		});
		window.addEventListener('gamepaddisconnected', ( e ) => {
			delete this.gamepads[e.gamepad.index];
			this.trigger('gamepad-disconnect', e.gamepad);
			if( Object.keys(this.gamepads).length === 0 ){
				cancelAnimationFrame(this._pollingLoop);
				this._pollingLoop = null;
			}
		});
	}

	_pollGamepads(){
		const hardwarePads = navigator.getGamepads ? navigator.getGamepads() : [];
		for( let pad of hardwarePads ){
			if( pad ){
				this._processGamepadButtons(pad);
				this._processGamepadAxes(pad);
				this.trigger('gamepad-update', pad);
			}
		}
		this._pollingLoop = requestAnimationFrame(this._pollGamepads.bind(this));
	}

	_processGamepadButtons( pad ){
		if( !this._buttonStates[pad.index] ) this._buttonStates[pad.index] = [];
		const prevStates = this._buttonStates[pad.index];

		pad.buttons.forEach(( button, index ) => {
			const buttonName = BUTTON_MAP[index] || `button_${index}`;
			const wasPressed = prevStates[index];
			const isPressed = button.pressed;

			if( isPressed && !wasPressed ){
				this.trigger('gamepad-buttondown', { padIndex: pad.index, button: buttonName, value: button.value });
			} else if( !isPressed && wasPressed ){
				this.trigger('gamepad-buttonup', { padIndex: pad.index, button: buttonName });
			}
			prevStates[index] = isPressed;
		});
	}

	_processGamepadAxes( pad ){
		if( !this._axisStates[pad.index] ) this._axisStates[pad.index] = [];
		const prevStates = this._axisStates[pad.index];
		const { deadzone, maximizeThreshold } = this.gamepadOptions;

		pad.axes.forEach(( rawAxisValue, index ) => {
			const axisName = AXIS_MAP[index] || `axis_${index}`;
			const filteredValue = applyDeadzone(rawAxisValue, deadzone, maximizeThreshold);
			const prevValue = prevStates[index] || 0.0;

			if( filteredValue !== prevValue ){
				this.trigger('gamepad-axis', { padIndex: pad.index, axis: axisName, value: filteredValue });
			}
			prevStates[index] = filteredValue;
		});
	}
};

// -----------------------------------------------------------------------------
// 6. Keys
// -----------------------------------------------------------------------------
const KeysMixin = ( BaseClass ) => class extends BaseClass {
	constructor( options = {} ){
		super( options );
		this.keyState = {};
		if( options.monitorKeys ) this.monitorKeys();
	}

	monitorKeys(){
		const target = this.options.globalKeys ? window : this.el;
		target.addEventListener('keydown', this._onKeyDown.bind(this));
		target.addEventListener('keyup', this._onKeyUp.bind(this));
	}

	_onKeyDown( e ){
		this.keyState[e.code] = true;
		this.trigger('keydown', e);
		this._executeKeyAction(e);
	}

	_onKeyUp( e ){
		this.keyState[e.code] = false;
		this.trigger('keyup', e);
	}

	_executeKeyAction( e ){
		if( !this.keys ) return;
		const methodName = this.keys[e.code] || this.keys[e.key];
		if( methodName && typeof this[methodName] === 'function' ){
			this[methodName](e);
		}
	}

	isKeyHeld( code ){
		return !!this.keyState[code];
	}
};

export { TouchMixin, MouseMixin, ScrollMixin, MotionMixin, GamepadMixin, KeysMixin };
