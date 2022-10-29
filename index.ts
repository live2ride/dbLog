const log = require("@live2ride/log");

interface IDB {
  db: any;
  logid: number | null;
  heartbeat?: any;
  startCounter: number;
}
interface ILog {
  title?: string;
  msg?: string;
  props?: { [k: string]: any };
  error?: { [k: string]: any };
  status?: string;
}
type PlainObj = { [k: string]: any };

export default class DBLog implements IDB {
  db: any;
  logid: number | null = null; //must be undefined, null means id has been cleared due to error
  heartbeat: any;
  startCounter = 0;

  constructor(db: any) {
    this.db = db;
  }

  async start(title: string, msg: string, props: PlainObj) {
    const qry = `insert into dbo.log (title, msg, props, heartbeat) 
                    select @_title, @_msg, @_props, sysdatetime()
                    select scope_identity() as logid`;
    // try {
    const params = { title: title, msg: msg, props: props };
    const { logid } = await this.db.exec(qry, params, true);
    this.logid = logid;
    this.#startHeartbeat();
  }
  #startHeartbeat() {
    this.heartbeat = setInterval(async () => {
      if (!this.logid) return;
      let qry = `update dbo.log set heartbeat = sysdatetime() where logid = @_logid`;
      await this.db.exec(qry, { logid: this.logid });
    }, 5000);
  }

  async isReady() {
    while (!this.logid) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  #getFields(props: any) {
    let fields = "";

    ["title", "msg", "props", "error", "status"].forEach((f) => {
      if (props[f]) {
        fields += `${f} = @_${f},`;
      }
    });

    return fields.slice(0, -1);
  }

  async updateAll(props: PlainObj) {
    if (!this.logid || !props) {
      //null id means id has been cleared due to error
      return;
    }
    await this.isReady();

    const fields = this.#getFields(props);
    const qry = `update dbo.log set 
                        ${props?.end_time ? " end_time = sysdatetime(), " : ""}
                        ${fields}
                    where logid = @_logid`;

    try {
      await this.db.exec(qry, {
        ...(props || {}),
        logid: this.logid,
      });
      if (props?.end_time) {
        this.logid = null;
        clearInterval(this.heartbeat);
      }
    } catch (err) {
      //in case requrest got blocked
      await this.updateAll(props);
    }
  }

  async warning(msg: string, props: PlainObj) {
    await this.updateAll({ status: "warning", end_time: true, msg, props });
  }

  async error(err: Error, props: any) {
    await this.updateAll({
      status: "error",
      end_time: true,
      msg: err?.message,
      props: props,
      error: {
        msg: err?.message,
        stack: err?.stack,
        error: err,
      },
    });
    this.logid = null;
  }

  async success(msg: string, props: PlainObj) {
    await this.updateAll({ status: "success", end_time: true, msg, props });
  }

  async update(msg: string, props: PlainObj) {
    await this.updateAll({ msg, props });
  }

  async setup() {
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
        await this.db.exec(obj.cmd);
        log.success("dbLog setup: created", obj.msg);
      } catch (err: any) {
        if (err?.msg?.includes("is already")) {
          // log.error("dbLog setup: ", obj.msg, " already exist");
        } else {
          log.error(
            "unable to execute following query due to error:",
            err.msg,
            "\n"
          );
          log.error(obj.cmd);

          throw err;
        }
      }
    }

    log.success("**************** db Log setup complete ****************");
  }
}
