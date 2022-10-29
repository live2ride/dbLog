"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _DBLog_instances, _DBLog_startHeartbeat, _DBLog_getFields;
Object.defineProperty(exports, "__esModule", { value: true });
const log = require("@live2ride/log");
class DBLog {
    constructor(db) {
        _DBLog_instances.add(this);
        this.logid = null; //must be undefined, null means id has been cleared due to error
        this.startCounter = 0;
        this.db = db;
    }
    start(title, msg, props) {
        return __awaiter(this, void 0, void 0, function* () {
            const qry = `insert into dbo.log (title, msg, props, heartbeat) 
                    select @_title, @_msg, @_props, sysdatetime()
                    select scope_identity() as logid`;
            // try {
            const params = { title: title, msg: msg, props: props };
            const { logid } = yield this.db.exec(qry, params, true);
            this.logid = logid;
            __classPrivateFieldGet(this, _DBLog_instances, "m", _DBLog_startHeartbeat).call(this);
        });
    }
    isReady() {
        return __awaiter(this, void 0, void 0, function* () {
            while (!this.logid) {
                yield new Promise((resolve) => setTimeout(resolve, 100));
            }
        });
    }
    updateAll(props) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.logid || !props) {
                //null id means id has been cleared due to error
                return;
            }
            yield this.isReady();
            const fields = __classPrivateFieldGet(this, _DBLog_instances, "m", _DBLog_getFields).call(this, props);
            const qry = `update dbo.log set 
                        ${(props === null || props === void 0 ? void 0 : props.end_time) ? " end_time = sysdatetime(), " : ""}
                        ${fields}
                    where logid = @_logid`;
            try {
                yield this.db.exec(qry, Object.assign(Object.assign({}, (props || {})), { logid: this.logid }));
                if (props === null || props === void 0 ? void 0 : props.end_time) {
                    this.logid = null;
                    clearInterval(this.heartbeat);
                }
            }
            catch (err) {
                //in case requrest got blocked
                yield this.updateAll(props);
            }
        });
    }
    warning(msg, props) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.updateAll({ status: "warning", end_time: true, msg, props });
        });
    }
    error(err, props) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.updateAll({
                status: "error",
                end_time: true,
                msg: err === null || err === void 0 ? void 0 : err.message,
                props: props,
                error: {
                    msg: err === null || err === void 0 ? void 0 : err.message,
                    stack: err === null || err === void 0 ? void 0 : err.stack,
                    error: err,
                },
            });
            this.logid = null;
        });
    }
    success(msg, props) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.updateAll({ status: "success", end_time: true, msg, props });
        });
    }
    update(msg, props) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.updateAll({ msg, props });
        });
    }
    setup() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            let commands = [
                {
                    msg: "function dbo.timeInSeconds",
                    cmd: `create function dbo.timeInSeconds (@time1 datetime2, @time2 datetime2)
returns int
as begin
    return datediff(second, @time1, @time2)
end
`,
                },
                {
                    msg: "tables dbo.log and dbo.logDetails",
                    cmd: `create table dbo.log(
    logid int identity(1000000000,1) primary key,
    status nvarchar(100),
    title nvarchar(300) not null,
    msg nvarchar(max),
    start_time datetime2 default (sysdatetime()),
    end_time datetime2,
    props nvarchar(max),
    error nvarchar(max),
    heartbeat datetime2,
    run_time  as (dbo.timeInSeconds(start_time,isnull(end_time,heartbeat)))
) 

create table dbo.logDetails (
    ldid bigint identity(200000000000,1) primary key,
    logid int foreign key references [log](logid),
    start_time datetime2 default (sysdatetime()),
    status nvarchar(100),
    msg nvarchar(max),
)`,
                },
                {
                    msg: "trigger tr_log_changes",
                    cmd: `create trigger tr_log_changes on dbo.log
    for  update
as
begin
    insert into dbo.logDetails(logid, status, msg)
    select i.logid, i.status, i.msg 
    from inserted i
    left join deleted d on i.logid = d.logid
        and i.msg = d.msg
    where d.logid is null
end`,
                },
            ];
            log.success("**************** db Log setup start ****************");
            for (const obj of commands) {
                try {
                    yield this.db.exec(obj.cmd);
                    log.success("dbLog setup: created", obj.msg);
                }
                catch (err) {
                    if ((_a = err === null || err === void 0 ? void 0 : err.msg) === null || _a === void 0 ? void 0 : _a.includes("is already")) {
                        // log.error("dbLog setup: ", obj.msg, " already exist");
                    }
                    else {
                        log.error("unable to execute following query due to error:", err.msg, "\n");
                        log.error(obj.cmd);
                        throw err;
                    }
                }
            }
            log.success("**************** db Log setup complete ****************");
        });
    }
}
exports.default = DBLog;
_DBLog_instances = new WeakSet(), _DBLog_startHeartbeat = function _DBLog_startHeartbeat() {
    this.heartbeat = setInterval(() => __awaiter(this, void 0, void 0, function* () {
        if (!this.logid)
            return;
        let qry = `update dbo.log set heartbeat = sysdatetime() where logid = @_logid`;
        yield this.db.exec(qry, { logid: this.logid });
    }), 5000);
}, _DBLog_getFields = function _DBLog_getFields(props) {
    let fields = "";
    ["title", "msg", "props", "error", "status"].forEach((f) => {
        if (props[f]) {
            fields += `${f} = @_${f},`;
        }
    });
    return fields.slice(0, -1);
};
