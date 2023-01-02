// @ts-ignore
import cliColor from "cli-color";
import { WebhookClient } from "discord.js";
import { appendFileSync, existsSync, writeFileSync } from "fs";
import moment from "moment";
import constants from "../constants.json";
import { generateString } from "../Utils";

const webhooks = {
	"tickets": new WebhookClient({url: "https://canary.discord.com/api/webhooks/1049621691724201984/m5FaYbB4hz2wf1LWi5lefgfZ1Z5velZXVYNzW-ytRgLQ2um-B59mx4KUfoW4_26iVOFF"}),
	"bans": new WebhookClient({url: "https://canary.discord.com/api/webhooks/1054732255735590914/az63VgwvWWUe-bwuDRROVocApMYLqXb-BlqzF2Ohp-QM7PopC0lrm2dDe9cSZuF63wpi"}),
	"kicks": new WebhookClient({url: "https://canary.discord.com/api/webhooks/1054732443921416262/xakFOUrjWZYl9_GdkFJeMTRgWs71dTOLC7tmxV4_rpsTgnvrnB9m73JHmhinYFiUBZNv"}),
	"roles": new WebhookClient({url: "https://canary.discord.com/api/webhooks/1054732517644718090/1rKF6_rFov9c9hi9_hXvHMl856g3EltP70PL5smHaU98lXvjTKpTtKNxoyDgvqh2gDAl"}),
	"tags": new WebhookClient({url: "https://canary.discord.com/api/webhooks/1055247475008602132/LUdOzTfElm-XrdFgn7PmWQOw4L0a3ZEqc8vd7RjM241AJ4b5gSCyVylDfKFSPD0eR8Zs"}),
	"errors": new WebhookClient({url: "https://canary.discord.com/api/webhooks/1049621402799591455/XRktJ9qy4kBXPpwqHka069nJemUjh9PHfbgXg6pJRj5JwfMvou2DgNMH83i7gfjwhmZI"})
}

type WebhookTypes = keyof typeof webhooks;
type LogTypes = "info" | "error";

const types = {
	info: "Info",
	error: "Error",
};

const colors = {
	"info": "cyanBright",
	"error": "redBright",
	"debug": "blueBright"
};


/**
 * @param {string} logType 
 * @param {string} message 
 * @returns 
 */
const Log = (logType: LogTypes, message: string, isLogin: boolean = false): void => {
	console.log(
		cliColor[colors[logType]]("[" + types[logType] + "]: ") + cliColor.white(message)
	);

	if(process.env.DEBUG_MODE == "1") {
		SaveLog(((isLogin) ? "\n\n" : "") + message);
	}
};

/**
 * @param {string} message 
 */
const Debug = (message: string): void => {
	if(process.env.DEBUG_MODE == "1") {
		console.log(
			cliColor[colors["debug"]]("[Debug]: ") + cliColor.white(message)
		)

		SaveLog("[DEBUG_MODE]: " + message);
	}
};

/**
 * @param {string} message 
 */
 const SaveLog = (message: string, isError: boolean = false, idGiven?: number): any | string => {
	const fileName = moment().format("DD[-]MM[-]YYYY");

	if(!existsSync("./logs/" + fileName + ".txt")) {
		writeFileSync("./logs/" + fileName + ".txt", "");
	}

	if(isError) {
		const id = idGiven ?? generateString(constants.ERROR_ID_LENGTH);
		const formatMessage = id + ": " + message;
		
		Webhook("errors", "```" + message + "```");
		appendFileSync("./logs/" + fileName + ".txt", formatMessage + "\n");
		return id;
	} else {
		appendFileSync("./logs/" + fileName + ".txt", message + "\n");
	}
}

const Webhook = (name: WebhookTypes, text: string) => {
	const webhook = webhooks[name];

	if(!webhook) Log("error", "Invalid webhook name " + name);

	webhook.send({content: text}).catch((err) => {
		const id = SaveLog(err, true)
		Log("error", "Failed to send webhook " + name + ". Error (" + id + ") has been saved");
	});
}

export {
	Log,
	Debug,
	SaveLog,
	Webhook
}