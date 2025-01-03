const dotenv = require("dotenv");
dotenv.config();

// const DB = require("src/modules/db");
const DB = require("../../db");
const DBLog = require("../index");

const dbConfig = {
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
};

const db = new DB(dbConfig);

async function showLogData() {
  // let qry = "select top 1 * from dbo.log order by logid";
  // let res = await db.exec(qry);
  // console.log(res);

  // qry = "select top 10 * from dbo.logDetails order by ldid";
  // res = await db.exec(qry);
  // console.log(res);

  const log = await db.exec("select * from dbo.log order by logid desc", true);
  console.log(log);
  const ld = await db.exec(
    "select msg from dbo.logDetails where logid = @_logid",
    { logid: log.logid }
  );
  console.log(ld);
}

const TITLE = "dbLogger demo";
async function test() {
  const dbLog = new DBLog(db);
  try {
    await db.exec("select top 1 logid from dbo.log");
  } catch {
    await dbLog.setup();
  }

  dbLog.start(TITLE, "success demo", {
    obj: "some additional props",
  });
  dbLog.update("update 1");
  dbLog.update("update 2");
  dbLog.update("update 3");
  dbLog.success("finished");

  const dbLogWarning = new DBLog(db);
  dbLogWarning.start(TITLE, "warning demo");
  dbLogWarning.update("something happened with abc");
  dbLogWarning.update("something happened with xyz");
  dbLogWarning.warning();

  const dbLogError = new DBLog(db);
  dbLogError.start(TITLE, "error demo");
  dbLogError.error(new Error("some error"));

  setTimeout(() => {
    showLogData();
  }, 3000);
}

test();
