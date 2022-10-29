declare const log: any;
interface DBinterface {
    db: any;
    logid: number | null;
    heartbeat?: any;
    startCounter: number;
}
interface ILog {
    title?: string;
    msg?: string;
    props?: {
        [k: string]: any;
    };
    error?: {
        [k: string]: any;
    };
    status?: string;
}
declare type PlainObj = {
    [k: string]: any;
};
declare class DBLog implements DBinterface {
    db: any;
    logid: number | null;
    heartbeat: any;
    startCounter: number;
    constructor(db: any);
    start(title: string, msg: string, props: PlainObj): Promise<void>;
    startHeartbeat(): void;
    isReady(): Promise<void>;
    getFields(props: any): string;
    updateAll(props: PlainObj): Promise<void>;
    warning(msg: string, props: PlainObj): Promise<void>;
    error(err: Error, props: any): Promise<void>;
    success(msg: string, props: PlainObj): Promise<void>;
    update(msg: string, props: PlainObj): Promise<void>;
    setup(): Promise<void>;
}
