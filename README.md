# Description

Easily logging events to Microsoft SQL database (MSSQL);

### Config

```javascript
const dbConfig = {
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
};

const DB = require("@live2ride/db");
const db = new DB(dbConfig);

const DBLog = require("@live2ride/dbLog");
const dbLog = new DBLog(db);


dbLog.setup() // create all the tables and functions


//start log
dbLog.start(
  title: "some cleanup process",
  message: "cleanup started",
  props: {
    dir: "/xyz",
    options: {
      more: "additiona loptions"
    }
  }
)
dbLog.update("cleaning dir xyz");
dbLog.update("finished cleaning xyz/abc");
dbLog.update("finished cleaning xyz/def");


dbLog.success("cleanup finished");
    or
dbLog.warning("missed few files");
    or
dbLog.error(new Error("some error"))


const logs = await db.exec('select * from dbo.log');
console.log(logs);
example:
[
  {
    logid: ********,
    status: 'success',
    title: 'dbLogger',
    msg: 'finished',
    start_time: ********,
    end_time: ********,
    props: { obj: 'some additional props' },
    error: undefined,
    heartbeat: ********,
    run_time: 1
  }
]


const ld = await db.exec('select msg from dbo.logDetails where logid = @_logid', {logid: logs[0].logid});
console.log(ld);
example:
[
  { msg: 'update 1' },
  { msg: 'update 2' },
  { msg: 'update 3' },
  { msg: 'finished' }
]
```

#

##### All table fields

- **logid**: identity column
- **status**: success, warning, error
- **title**: title identifies your process
- **msg**: additional messages (all messages are saved in logDetails)
- **start_time**: time process started
- **end-time**: time processes ended
- **props**: any object you want to save for troubleshooting like parameters
- **error**: field to hold your error object for easier troubleshooting
- **heartbeat**: dbLog checks in every few second to show its alive
- **run_time**: length the process has been alive in seconds
