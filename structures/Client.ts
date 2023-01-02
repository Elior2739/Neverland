import { Partials, Client } from "discord.js";
import { Log, SaveLog } from "./Logger";

const client = new Client({
	partials: [
		Partials.GuildMember,
		Partials.Channel,
		Partials.Message,
		Partials.User,
	],

	intents: [
		"Guilds",
		"GuildMembers",
		"GuildInvites",
		"MessageContent",
		"GuildMessages",
		"GuildVoiceStates",
	]
});

// if(process.env.DEBUG_MODE == 1) {
// 	client
// 	.on("debug", (message) => console.log(message))
// 	.on("error", (error) => console.log(error));
// }

client.login(process.env.TOKEN).then(() => {
	if(client.user != null) {
		Log("info", "Login was successful, Logged in as " + client.user.tag, true);
	}
}).catch(err => {
	const id = SaveLog("Failed to login to client. " + err, true);
	Log("error", "Error occurred while bot login. (" + id + ")");
	process.exit();
});

export default client;