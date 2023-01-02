import { createPool } from "mysql2/promise";
import { Log, SaveLog } from "./Logger";

const pool = createPool({
	host: process.env.SQL_HOST,
	database: process.env.SQL_DB,
	user: process.env.SQL_USR,
	password: process.env.SQL_PASS,
	port: Number(process.env.SQL_PORT) // Fuck this
});


pool.query("SELECT 1 + 1").then(() => {
	Log("info", "Database connection established");
}).catch((err: string) => {
	Log("error", "Database connection failed, " + err);
	SaveLog("Can't connect to the database " + err, true);
	process.exit(1);
});

export default pool