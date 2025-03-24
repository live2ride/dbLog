import debug, { Debugger } from "debug"
import { DBProps, LogProps, PlainObj } from "./types"
import { serializeError } from "./utils/serialize-error"
export { dbLogSetup } from "./utils/setup"
const debugNamespace = "dblog"

let log: Debugger | undefined = debug(debugNamespace)
if (!debug.enabled(debugNamespace)) {
  log = undefined
}

const sleep = (timeout: number = 100) => new Promise((resolve) => setTimeout(resolve, timeout))
export default class DBLog implements DBProps {
  db: any

  logid: number | null = null // must be undefined, null means id has been cleared due to error

  heartbeat: any

  startCounter = 0

  options: LogProps = {
    title: "",
    msg: "",
  }

  /**
   *
   * db: MSSQL Database connection
   * props
   * props.print - boolean - print instead of logging to database
   */
  constructor(db: any, options?: LogProps) {
    this.db = db

    if (options) {
      this.options = Object.assign(this.options, options)
    }
  }

  async isRunning(title: string): Promise<boolean> {
    const query = `
      SELECT TOP 1 logid,
        CASE 
          WHEN end_time IS NOT NULL THEN 'false'
          WHEN DATEDIFF(second, heartbeat, GETDATE()) < 20 and end_time IS NULL THEN 'true'
          ELSE 'false'
        END AS isRunning
      FROM dbo.log 
      WHERE title = @_title 
      ORDER BY logid DESC
    `
    const result = await this.db.exec(query, { title }, true)
    const { isRunning } = result || {}

    return String(isRunning) === "true"
  }

  /**
   * Continues a previous log entry if it was not ended yet.
   * If the log entry does not exist, it starts a new one.
   * @param {string} [title] - title of the log entry
   * @param {string} [msg] - message of the log entry
   * @param {PlainObj} [props] - properties of the log entry
   * @returns {Promise<any | null>} - the continued log entry or null if not found
   */
  async continue(
    title: string = this.options.title || "n/a",
    msg: string = this.options.msg || "n/a",
    props?: PlainObj
  ): Promise<any | null> {
    const lastLog = await this.#get.last(title, msg)

    if (lastLog && !lastLog.end_time) {
      this.logid = lastLog.logid
      this.#startHeartbeat()
      return lastLog
    }

    await this.start(title, msg, props)
    return this.logid
  }

  async start(
    title: string = this.options.title || "",
    msg: string = this.options.msg || "",
    props?: PlainObj
  ) {
    log && log(msg, props)

    const query = `insert into dbo.log (title, msg, props, heartbeat) 
                    select @_title, @_msg, @_props, sysdatetime()
                    select scope_identity() as logid`

    const params = {
      title,
      msg,
      props,
    }

    const { logid } = await this.db.exec(query, params, true)

    this.logid = logid
    this.#startHeartbeat()
  }

  #startHeartbeat() {
    this.heartbeat = setInterval(async () => {
      if (!this.logid) return
      const qry = `update dbo.log set heartbeat = sysdatetime() where logid = @_logid`
      try {
        await this.db.exec(qry, { logid: this.logid })
      } catch {
        /** */
      }
    }, 5000)
  }

  async isReady() {
    while (!this.logid) {
      await sleep()
    }
  }

  #clear() {
    this.logid = null
    clearInterval(this.heartbeat)
  }

  #get = {
    last: async (title: string, msg?: string) => {
      const qry = `select top 1 *,
                case 
                  when end_time is not null then 'true'
                  when datediff(second, heartbeat, getdate()) < 60 then 'true'
                else 'false'
                end as isRunning
        from dbo.log 
        where title = @_title 
        ${msg ? "and msg = @_msg" : ""}
        order by logid desc`
      const res = await this.db.exec(qry, { title, msg }, true)
      return res
    },
    fields: (props: any): string => {
      const fieldNames = ["title", "msg", "props", "error", "status"]
      const updatedFields = fieldNames
        .filter((fieldName) => props[fieldName])
        .map((fieldName) => `${fieldName} = @_${fieldName}`)

      return updatedFields.join(",")
    },
  }

  async updateAll(props: PlainObj) {
    if (!props) {
      return
    } // null id means id has been cleared due to error

    if (!this.logid) {
      for (let i = 0; i < 100; i += 1) {
        if (this.logid) break
        await sleep()
      }
      if (!this.logid) return
    }

    await this.isReady()
    // Build an array for the SET clause parts.
    const setClauses: string[] = []

    // If an end_time flag is provided, add the clause for it.
    if (props.end_time) {
      setClauses.push("end_time = sysdatetime()")
    }
    const additionalFields = this.#get.fields(props)
    if (additionalFields.trim()) {
      setClauses.push(additionalFields)
    }
    if (setClauses.length === 0) {
      return
    }

    const qry = `UPDATE dbo.log SET ${setClauses.join(", ")} WHERE logid = @_logId`

    try {
      await this.db.exec(qry, { ...props, logId: this.logid })
      if (props.end_time) {
        this.#clear()
      }
    } catch (error) {
      throw error
    }
  }

  async warning(msg: string, props?: PlainObj) {
    log && log("\x1b[33m", msg, props)

    await this.updateAll({ status: "warning", end_time: true, msg, props })
  }

  async error(err: any, props?: any) {
    const error = serializeError(err)

    log && log("\x1b[31m", error, props)

    const { message, stack, ...rest } = error || {}
    await this.updateAll({
      status: "error",
      end_time: true,
      msg: err?.message,
      props,
      error: error,
    })
    this.logid = null
  }

  async success(msg?: string | null, props?: PlainObj) {
    log && log(msg, props)

    await this.updateAll({ status: "success", end_time: true, msg, props })
  }

  async update(msg: string, props?: PlainObj) {
    log && log("update:|:", msg, props)

    await this.updateAll({ msg, props })
  }

  delete = {
    current: async () => {
      await this.db.exec("delete from dbo.log where logid = @_logid", { logid: this.logid })
      this.#clear()
    },
    previous: async (title: string = this.options.title || "") => {
      await this.db.exec(
        `
      delete
      from dbo.log 
      where title = @_title
      and logid not in (
        select max(logid) as lastLogid
        from dbo.log 
        where title = @_title
      )
        `,
        { title: title }
      )
    },
  }

  get = {
    recent: async () => {
      return this.db.exec(`select top 100 * from dbo.log order by logid desc`)
    },
    warnings: async () => {
      return this.db.exec(`select * from dbo.log where status = @_status  order by logid desc`, {
        status: "warning",
      })
    },
    errors: async () => {
      return this.db.exec(`select * from dbo.log where status = @_status order by logid desc`, {
        status: "error",
      })
    },
    log: async (logid: number) => {
      return this.db.exec(
        `
        select *,
        (
          select msg 
          from dbo.logDetails 
          where logid = l.logid 
          and msg is not null 
          for json auto
        ) as messages
        from dbo.log l 
        where logid = @_logid`,
        { logid }
      )
    },
  }
}
