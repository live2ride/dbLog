interface IDB {
    db: any;
    logid: number | null;
    heartbeat?: any;
    startCounter: number;
}
declare type PlainObj = {
    [k: string]: any;
};
export default class DBLog implements IDB {
    #private;
    db: any;
    logid: number | null;
    heartbeat: any;
    startCounter: number;
    constructor(db: any);
    start(title: string, msg: string, props: PlainObj): Promise<void>;
    isReady(): Promise<void>;
    updateAll(props: PlainObj): Promise<void>;
    warning(msg: string, props: PlainObj): Promise<void>;
    error(err: Error, props: any): Promise<void>;
    success(msg: string, props: PlainObj): Promise<void>;
    update(msg: string, props: PlainObj): Promise<void>;
    setup(): Promise<void>;
}
export {};
