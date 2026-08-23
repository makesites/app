declare function createState(): {
    fullscreen: boolean;
    online: boolean;
    browser: () => "android" | "chrome" | "firefox" | "ie" | "ios" | "opera-mini" | "other" | "safari";
    mobile: boolean | RegExpMatchArray | null;
    ipad: boolean;
    retina: any;
    touch: boolean;
    pushstate: () => boolean;
    scroll: boolean;
    ram: () => number;
    standalone: () => any;
    framed: boolean;
};
export { createState };
