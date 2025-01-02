export { dbLogSetup } from "./utils/setup"

type DBProps = {
  db: any;
  logid: number | null;
  heartbeat?: any;
  startCounter: number;
}
type PlainObj = { [k: string]: any };

type LogProps = {
  print?: boolean
}
const sleep = (timeout: number = 100) => new Promise((resolve) => setTimeout(resolve, timeout));

export default class DBLog implements DBProps {
  db: any;

  logid: number | null = null; // must be undefined, null means id has been cleared due to error

  heartbeat: any;

  startCounter = 0;

  options = {
    print: false
  };

  /**
   * 
   * db: MSSQL Database connection
   * props
   * props.print - boolean - print instead of logging to database
   */
  constructor(db: any, options?: LogProps) {
    this.db = db;

    const { print } = options || {};
    if (print) {
      this.options.print = true;
    }
  }

  async isRunning(title: string) {

    const qry = `select top 1 logid,
                case 
                  when end_time is not null then 'true'
                  when datediff(second, heartbeat, getdate()) < 60 then 'true'
                else 'false'
                end as isRunning
     from mp..log where title = @_title order by logid desc`;
    const res = await this.db.exec(qry, { title }, true);
    const { isRunning } = res || {};
    return Boolean(isRunning);
  }

  async continue(title: string, msg?: string, props?: PlainObj) {
    const last = await this.#get.last(title);
    if (last) {
      this.logid = last.logid;
      this.#startHeartbeat();
    } else {
      await this.start(title, msg, props);
    }
    return last;
  }

  async start(title: string, msg?: string, props?: PlainObj) {
    if (this.options.print) return console.log(msg, props);

    const qry = `insert into dbo.log (title, msg, props, heartbeat) 
                    select @_title, @_msg, @_props, sysdatetime()
                    select scope_identity() as logid`;
    // try {
    const params = { title, msg, props };
    const { logid } = await this.db.exec(qry, params, true);
    this.logid = logid;
    this.#startHeartbeat();
  }

  #startHeartbeat() {
    this.heartbeat = setInterval(async () => {
      if (!this.logid) return;
      const qry = `update dbo.log set heartbeat = sysdatetime() where logid = @_logid`;
      await this.db.exec(qry, { logid: this.logid });
    }, 5000);
  }

  async isReady() {
    while (!this.logid) {
      await sleep();
    }
  }

  #clear() {
    this.logid = null;
    clearInterval(this.heartbeat);
  }

  #get = {
    last: async (title: string) => {

      const qry = `select top 1 *,
                case 
                  when end_time is not null then 'true'
                  when datediff(second, heartbeat, getdate()) < 60 then 'true'
                else 'false'
                end as isRunning
        from dbo.log 
        where title = @_title 
        order by logid desc`;
      const res = await this.db.exec(qry, { title }, true);
      return res;
    },
    fields: (props: any) => {
      let fields = "";

      ["title", "msg", "props", "error", "status"].forEach((f) => {
        if (props[f]) {
          fields += `${f} = @_${f},`;
        }
      });

      return fields.slice(0, -1);
    }
  };


  async updateAll(props: PlainObj) {
    if (!props) {
      // null id means id has been cleared due to error
      return;
    } if (!this.logid) {
      for (let i = 0; i < 100; i += 1) {
        if (this.logid) break;
        await sleep()
      }
      if (!this.logid) return;
    }
    await this.isReady();

    const fields = this.#get.fields(props);
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
        this.#clear();
      }
    } catch (err: any) {
      // in case requrest got blocked
      console.error(err);
      console.trace("DBLog updateAll err:", err?.message);
      // await this.updateAll(props);
      throw err;
    }
  }

  async warning(msg: string, props?: PlainObj) {
    if (this.options.print) return console.warn(msg, props);

    await this.updateAll({ status: "warning", end_time: true, msg, props });
  }

  async error(err: any, props?: any) {
    if (this.options.print) return console.error(err, props);

    await this.updateAll({
      status: "error",
      end_time: true,
      msg: err?.message,
      props,
      error: err
    });
    this.logid = null;
  }

  async success(msg?: string | null, props?: PlainObj) {
    if (this.options.print) return console.info(msg, props);

    await this.updateAll({ status: "success", end_time: true, msg, props });
  }

  async update(msg: string, props?: PlainObj) {
    if (this.options.print) return console.log("update:|:", msg, props);

    await this.updateAll({ msg, props });
  }

  delete = {
    current: async () => {
      await this.db.exec("delete from dbo.log where logid = @_logid", { logid: this.logid });
      this.#clear();
    },
    previous: async () => {
      // await this.db.exec(`
      //   delete l1 
      //   from dbo.log l1
      //   inner join dbo.log l2 on l1.title = l2.title
      //   where l2.logid = @_logid
      //   and l1.logid <> l2.logid


      //   `, { logid: this.logid, title: this.title });

    },
  }

  get = {
    recent: async () => {
      return this.db.exec(`select top 100 * from dbo.log order by logid desc`)
    },
    warnings: async () => {
      return this.db.exec(`select * from dbo.log where status = @_status  order by logid desc`, { status: "warning" })
    },
    errors: async () => {
      return this.db.exec(`select * from dbo.log where status = @_status order by logid desc`, { status: "error" })
    },
    log: async (logid: number) => {
      return this.db.exec(`
        select *,
        (
          select msg 
          from dbo.logDetails 
          where logid = l.logid 
          and msg is not null 
          for json auto
        ) as messages
        from dbo.log l 
        where logid = @_logid`, { logid })
    }
  }

}
