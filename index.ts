import { createHandlers } from "./Utils";
import { Log, SaveLog } from "./structures/Logger";
import client from "./structures/Client";
import WebServer from "./webserver/WebServer";

client.once("ready", () => {
	Log("info", "Starting bot components...");

	createHandlers();
	WebServer();

	Log("info", "Done loading bot components");
});

process.on("uncaughtException", (err) => {
	if(err.stack != undefined) {
		const id = SaveLog(err.stack, true)
		Log("error", "Something happened (" + id + ")");
	} else {
		Log("error", "Something happened");
		console.log(err)
	}
});