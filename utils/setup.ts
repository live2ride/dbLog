export const dbLogSetup = async (db: any) => {
    const commands = [
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

    console.debug("**************** db Log setup start ****************");
    for (const obj of commands) {
        try {
            await db.exec(obj.cmd);
            console.debug("dbLog setup: created", obj.msg);
        } catch (err: any) {
            if (err?.msg?.includes("is already")) {
                // log.error("dbLog setup: ", obj.msg, " already exist");
            } else {
                console.error("unable to execute following query due to error:", err.msg, "\n");
                console.error(obj.cmd);

                throw err;
            }
        }
    }

    console.debug("**************** db Log setup complete ****************");
};