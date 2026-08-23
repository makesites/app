declare var store: {
    available: () => boolean;
    get: (name: any) => string | null;
    set: (name: any, val: any) => void | false;
    check: (name: any) => boolean;
    clear: (name: any) => void | false;
};
export { store };
