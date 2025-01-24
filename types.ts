
export type DBProps = {
    db: any;
    logid: number | null;
    heartbeat?: any;
    startCounter: number;
    options: LogProps
}
export type PlainObj = { [k: string]: any };

export type LogProps = {
    title?: string
    msg?: string
}
