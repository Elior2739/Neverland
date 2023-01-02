import express, { NextFunction, RequestParamHandler } from "express";
import { Log } from "../structures/Logger";
import TicketManager from "../structures/TicketManager";
import Database from "../structures/Database";
import { User } from "discord.js";
import { resolveChannel, resolveRole, resolveUser } from "../Utils";
import moment from "moment";
import cookieSeesion from "cookie-session";

const app = express();

app.set("view engine", "ejs");
app.set("views", "./webserver/views/")
app.use(express.json());
app.use(express.static("./webserver/public/"))
app.use(cookieSeesion({
	name: "liamHomo",
	keys: [
		process.env.FUCK_THIS
	]
}))

interface SQLMessage {
	id: number;
	user: string;
	content: string;
	message: string;
	at: number;
};

interface Message {
	id: number;
	user: User | {username: string; displayAvatarURL: () => string};
	content: string;
	message: string;
	at: string;
}

interface AccessTokenResponse {
	"access_token": string,
	"token_type": "Bearer",
	"expires_in": number,
	"refresh_token": string,
	"scope": "identify"
}

app.get("/transcript/:id", (request, response, next) => {
	if(request.session?.user == null) {
		response.redirect("/api/auth/redirect");
	}

	next();
}, (request, response) => {
	
	const id = parseInt(request.params.id);
	const ticket = TicketManager.getTicket((ticket) => ticket.id == id);

	if(!ticket) {
		response.status(400).send("Invalid ticket Id");
		return;
	}

	Database.query("SELECT `id`, `user`, `content`, `message` FROM `messages` WHERE `ticket` = ?", [id]).then(async ([data]) => {
		const messages = data as Array<SQLMessage>;
		const messagesGood: Array<Message> = [];

		for(let index = 0; index < messages.length; index++) {
			const { id, user, content, message, at } = messages[index];
			const userObj = await resolveUser(user) || {username: "Unknown", displayAvatarURL: () => "/wolfy.webp"};

			if(content != "") {
				messagesGood.push({
					id,
					user: userObj,
					content: await contentGoBrrrrr(content),
					message,
					at: moment(at).format("D[/]M[/]YYYY[ ]HH[:]mm")	
				})
			}
		}


		response.render("transcript", {ticket, messages: messagesGood});
	});
});

app.get("/api/auth/redirect", (request, response) => {
	response.redirect("https://discord.com/api/oauth2/authorize?client_id=947110645181079632&redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fapi%2Fauth%2Fcallback&response_type=code&scope=identify");
});

app.get("/api/auth/callback", async (request, response) => {
	const { code } = request.query as {code: string};

	if(!code) response.send("What are you Liam what the fuck are you doing");

	console.log("https://discordapp.com/api/oauth2/token?client_id=" + process.env.CLIENT_ID + "&client_secret=" + process.env.CLIENT_SECRET + "&grant_type=authorization_code&code=" + code + "&redirect_uri" + process.env.REDIRECT_URI)
	const accessData = await fetch("https://discordapp.com/api/oauth2/token?client_id=" + process.env.CLIENT_ID + "&client_secret=" + process.env.CLIENT_SECRET + "&grant_type=authorization_code&code=" + code + "&redirect_uri=" + encodeURIComponent(process.env.REDIRECT_URI) , {
		method: "post",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded"
		}
	}).then(accessResponse => {
		if(accessResponse.status == 200) {
			return accessResponse.json().then((data: AccessTokenResponse) => data.token_type + " " + data.access_token).catch((err) => {
				console.log(err)
				return 400;
			})
		}

		return 500;
	}).catch((err) => {
		console.log(err);
		return 500;
	});

	console.log(accessData)

	if(typeof accessData == "number") {
		response.status(accessData).send("Client/Server Error");
		return;
	}

	console.log(accessData);

	response.status(200)

});

app.listen(8080, () => {
	Log("info", "Web server is running on port 8080")
});

const regex = /<(((@|#|@&)?\d+)|(:.+?:\d+))>/gm;
const contentGoBrrrrr = async (content: string): Promise<string> => {
	let newContent = content;
	let WOW = true

	while(WOW) {
		const matchThingi = newContent.match(regex)

		if(matchThingi == null || matchThingi.length == 0) {
			WOW = false;
			return newContent;
		}
		
		if(matchThingi[0].includes("<@") && !matchThingi[0].includes("<@&")) {
			const userId = matchThingi[0].replace("<@", "").replace(">", "");
			const userObj = await resolveUser(userId);
	
			newContent = newContent.replace(matchThingi[0], "@" + userObj?.tag ?? "Unknown");
		} else if(matchThingi[0].includes("<#")) {
			const channelId = matchThingi[0].replace("<#", "").replace(">", "");
			const channelObj = await resolveChannel(channelId);
	
			newContent = newContent.replace(matchThingi[0], "#" + channelObj?.name ?? "Unknown");
		} else if(matchThingi[0].includes("<@&")) {
			const roleId = matchThingi[0].replace("<@&", "").replace(">", "");

			console.log(roleId);
			const roleObj = await resolveRole(roleId);
	
			newContent = newContent.replace(matchThingi[0], "@" + roleObj?.name ?? "Unknown");
		} else {
			Log("info", "Something went wrong with regex search of ticket content tags");
			return newContent;
		}
	}

	return newContent;
}


export default () => {};