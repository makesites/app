declare const TouchMixin: (BaseClass: any) => {
    new (options?: {}): {
        [x: string]: any;
        touchState: {
            touching: boolean;
            swiping: boolean;
            direction: boolean;
        };
        touchParams: {
            start: null;
            previous: null;
            current: null;
        };
        touchOptions: any;
        get isTouch(): boolean;
        _bindTouchEvents(): void;
        _touchstart(e: any): void;
        _touchmove(e: any): void;
        _touchend(e: any): void;
        _calculateDirection(current: any, previous: any): "bottom" | "left" | "right" | "top" | false;
        getSwipeDistance(axis?: string): number;
    };
    [x: string]: any;
};
declare const MouseMixin: (BaseClass: any) => {
    new (options?: {}): {
        [x: string]: any;
        mouseState: {
            hover: boolean;
            drag: boolean;
            pressing: boolean;
        };
        mousePos: {
            x: number;
            y: number;
        };
        monitorMouse(): void;
        _onMouseMove(e: any): void;
        _mouseTicking: boolean | undefined;
    };
    [x: string]: any;
};
declare const ScrollMixin: (BaseClass: any) => {
    new (options?: {}): {
        [x: string]: any;
        scrollState: {
            top: number;
            height: number;
            max: number;
        };
        monitorScroll(): void;
        _onScroll(): void;
        _scrollTicking: boolean | undefined;
    };
    [x: string]: any;
};
declare const MotionMixin: (BaseClass: any) => {
    new (options?: {}): {
        [x: string]: any;
        motionState: {
            alpha: number;
            beta: number;
            gamma: number;
        };
        monitorMotion(): void;
        _onOrientation(e: any): void;
    };
    [x: string]: any;
};
declare const GamepadMixin: (BaseClass: any) => {
    new (options?: {}): {
        [x: string]: any;
        gamepads: {};
        _buttonStates: {};
        _axisStates: {};
        _pollingLoop: number | null;
        gamepadOptions: any;
        monitorGamepad(): void;
        _pollGamepads(): void;
        _processGamepadButtons(pad: any): void;
        _processGamepadAxes(pad: any): void;
    };
    [x: string]: any;
};
declare const KeysMixin: (BaseClass: any) => {
    new (options?: {}): {
        [x: string]: any;
        keyState: {};
        monitorKeys(): void;
        _onKeyDown(e: any): void;
        _onKeyUp(e: any): void;
        _executeKeyAction(e: any): void;
        isKeyHeld(code: any): boolean;
    };
    [x: string]: any;
};
export { TouchMixin, MouseMixin, ScrollMixin, MotionMixin, GamepadMixin, KeysMixin };
