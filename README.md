# MS SQL Server Logging Library

Easily log events to a Microsoft SQL Server (MSSQL) database using JavaScript.

## Table of Contents

- [Configuration](#configuration)
  - [Direct Configuration](#direct-configuration)
- [Usage](#usage)
  - [Setup](#setup)
  - [Logging Events](#logging-events)
- [Examples](#examples)
  - [Fetching Logs](#fetching-logs)
- [Database Schema](#database-schema)
  - [Log Table Fields](#log-table-fields)
- [Troubleshooting](#troubleshooting)

## Installation

```javascript
import { dbLogSetup } from "@live2ride/dbLog";

dbLogSetup();
/*
Creates tables `log` and `logDetails`.
*/
```

## Configuration

### Direct Configuration

Configure the database connection using environment variables and initialize the logging library.

```javascript
import DB from "@live2ride/db";
import DBLog from "@live2ride/dbLog";

// Database configuration
const dbConfig = {
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
};

// Initialize database and logger
const db = new DB(dbConfig);
const dbLog = new DBLog(db);
```

## Usage

### Setup

Create all necessary tables and functions in the database.

```javascript
import {dbLogSetup} from "@live2ride/dbLog";
dbLogSetup();
```

### Logging Events

Start a log, update it with messages, and finalize with a status.

```javascript
// Start log
dbLog.start({
  title: "Some Cleanup Process",
  message: "Cleanup started",
  props: {
    dir: "/xyz",
    options: {
      more: "Additional options",
    },
  },
});

// Update log with progress
dbLog.update("Cleaning directory xyz");
dbLog.update("Finished cleaning xyz/abc");
dbLog.update("Finished cleaning xyz/def");

// Finalize log with status
dbLog.success("Cleanup finished");
// or
dbLog.warning("Missed a few files");
// or
dbLog.error(new Error("Some error occurred"));
```

## Examples

### Fetching Logs

Retrieve all logs from the database.

```javascript
const logs = await db.exec('SELECT * FROM dbo.log');
console.log(logs);

/*
Example Output:
[
  {
    logid: ********,
    status: 'success',
    title: 'dbLogger',
    msg: 'Finished',
    start_time: ********,
    end_time: ********,
    props: { obj: 'Some additional props' },
    error: undefined,
    heartbeat: ********,
    run_time: 1
  }
]
*/
```

Retrieve log details for a specific log ID.

```javascript
const ld = await db.exec(
  'SELECT msg FROM dbo.logDetails WHERE logid = @_logid',
  { logid: logs[0].logid }
);
console.log(ld);

/*
Example Output:
[
  { msg: 'Update 1' },
  { msg: 'Update 2' },
  { msg: 'Update 3' },
  { msg: 'Finished' }
]
*/
```

## Database Schema

### Log Table Fields

- **logid**: Identity column.
- **status**: `success`, `warning`, `error`.
- **title**: Title identifying your process.
- **msg**: Additional messages (all messages are saved in `logDetails`).
- **start_time**: Time the process started.
- **end_time**: Time the process ended.
- **props**: Any object you want to save for troubleshooting, such as parameters.
- **error**: Field to hold your error object for easier troubleshooting.
- **heartbeat**: Indicates that `dbLog` is alive by checking in every few seconds.
- **run_time**: Duration the process has been running in seconds.

 