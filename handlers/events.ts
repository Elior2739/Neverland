import { AuditLogEvent } from "discord.js";
import client from "../structures/Client";
import { Webhook } from "../structures/Logger";
import TicketManager from "../structures/TicketManager";
import { mainGuild } from "../Utils";

const linkRegexps = [
	/(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/,
	/((?:(?:http?|ftp)[s]*:\/\/)?[a-z0-9-%\/\&=?\.]+\.[a-z]{2,4}\/?([^\s<>\#%"\,\{\}\\|\\\^\[\]`]+)?)/gi,
	/((?:(http|https|Http|Https|rtsp|Rtsp):\/\/(?:(?:[a-zA-Z0-9\$\-\_\.\+\!\*\'\(\)\,\;\?\&\=]|(?:\%[a-fA-F0-9]{2})){1,64}(?:\:(?:[a-zA-Z0-9\$\-\_\.\+\!\*\'\(\)\,\;\?\&\=]|(?:\%[a-fA-F0-9]{2})){1,25})?\@)?)?((?:(?:[a-zA-Z0-9][a-zA-Z0-9\-]{0,64}\.)+(?:(?:aero|arpa|asia|a[cdefgilmnoqrstuwxz])|(?:biz|b[abdefghijmnorstvwyz])|(?:cat|com|coop|c[acdfghiklmnoruvxyz])|d[ejkmoz]|(?:edu|e[cegrstu])|f[ijkmor]|(?:gov|g[abdefghilmnpqrstuwy])|h[kmnrtu]|(?:info|int|i[delmnoqrst])|(?:jobs|j[emop])|k[eghimnrwyz]|l[abcikrstuvy]|(?:mil|mobi|museum|m[acdghklmnopqrstuvwxyz])|(?:name|net|n[acefgilopruz])|(?:org|om)|(?:pro|p[aefghklmnrstwy])|qa|r[eouw]|s[abcdeghijklmnortuvyz]|(?:tel|travel|t[cdfghjklmnoprtvwz])|u[agkmsyz]|v[aceginu]|w[fs]|y[etu]|z[amw]))|(?:(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9])\.(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9]|0)\.(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9]|0)\.(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[0-9])))(?:\:\d{1,5})?)(\/(?:(?:[a-zA-Z0-9\;\/\?\:\@\&\=\#\~\-\.\+\!\*\'\(\)\,\_])|(?:\%[a-fA-F0-9]{2}))*)?(?:\b|$)/gi,
	/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig,
	/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g,
	/(https?:\/\/)?(www\.)?((discordapp\.(com|invite|gg))|(discord\.gg))\/(\w+)/gm,
	/(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/.+[a-z]/g
];

interface FiveMQuery {
	error?: string;
	EndPoint: string;
	Data: {
		clients: number;
		gametype: string;
		hostname: string;
		mapname: string;
		sv_maxclients: number;
		enhancedHostSupport: boolean;
		requestSteamTicket: "on" | "off";
		resources: Array<string>;
		server: string;
		vars: {[n: string]: string};
		selfReportedClients: number;
		players: Array<{endpoint: string, id: number, identifiers: Array<string>, name: string, ping: number}>,
		ownerID: number;
		private: boolean;
		fallback: boolean;
		connectEndPoints: Array<string>;
		upvotePower: number;
		burstPower: number;
		support_status: string;
		svMaxclients: number;
		ownerName: string;
		ownerProfile: string;
		ownerAvatar: string;
		lastSeen: string;
		iconVersion: string;
	}
};

const onlyAttachments = ["1006229165453873303", "1055738750090608731"]
const attachmentEmojis: {[n: string]: string} = {"1006229165453873303": "👍", "1055738750090608731": "🥵"};

client.once("ready", () => {

	let lastPlayerCount = 0;

	const updateCount = () => {
		fetch("https://servers-frontend.fivem.net/api/servers/single/b66vgp", {
			method: "get",
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
			}
		}).then((response) => response.json()).then((data: FiveMQuery) => {
			if(client.user == null) return;

			if(data.error) {
				lastPlayerCount = 0;
				
				client.user.setActivity({
					name: "0/0 (0)",
				})
			} else if(lastPlayerCount != data.Data.players.length) {
				lastPlayerCount = data.Data.players.length;
				client.user.setActivity({
					name: lastPlayerCount + "/" + data.Data.svMaxclients + " (0)",
				})
			}
		});
	};

	updateCount()
	setInterval(updateCount, 5000);

});

client.on("messageCreate", (message) => {
	if(message.member == null) return;
	
	const ticket = TicketManager.getTicketByChannel(message.channelId);
	
	if(ticket) {
		ticket.addMessage(message.author.id, message.id, message.content, message.attachments.toJSON())
		return;
	}

	message.content = message.content.trim().toLowerCase();

	if(message.member.permissions.has("Administrator")) return;

	for(let index = 0; index < linkRegexps.length; index++) {
		if(linkRegexps[index].test(message.content)) {
			message.delete();
			return;
		}
	}

	if(onlyAttachments.includes(message.channelId)) {
		if(message.attachments.size == 0) {
			message.delete();
		} else {
			message.react(attachmentEmojis[message.channelId]);
		}
	}
});

client.on("messageDelete", (message) => {
	if(message.mentions.users.size > 0) {
		Webhook("tags", "<@" + message.author + "> tagged " + message.mentions.users.map((tag) => tag.tag + " ") + " in " + (message.channel.toString()))
	}
})

client.on("guildBanAdd", async (ban) => {
	const auditLog = await mainGuild?.fetchAuditLogs({type: AuditLogEvent.MemberBanAdd, limit: 1});
	
	if(auditLog == undefined) return;
	else if(auditLog.entries.size == 0) return;
	
	const banLog = auditLog.entries.first();

	if(banLog == undefined) return;
	else if(banLog.executor == undefined) return;


	Webhook("bans", "<@" + banLog.executor.id + "> banned <@" + ban.user.id + ">")
});

client.on("guildMemberRemove", async (member) => {
	const auditLog = await mainGuild?.fetchAuditLogs({type: AuditLogEvent.MemberKick, limit: 1});
	
	if(auditLog == undefined) return;
	else if(auditLog.entries.size == 0) return;
	
	const kickLog = auditLog.entries.first();

	if(kickLog == undefined) return;
	else if(kickLog.executor == undefined) return;
	else if(kickLog.target == undefined) return;
	else if(kickLog.target.id != member.id) return;

	const { executor, target } = kickLog;

	Webhook("kicks", "<@" + executor.id + "> kicked <@" + target.id + ">")
});

client.on("guildMemberUpdate", async (oldIdan, newIdan) => {
	const changedRoles: Array<{name: string, type: "added" | "removed"}> = []

	const oldRoles = oldIdan.roles.cache
	const newRoles = newIdan.roles.cache

	oldRoles.forEach((role) => {
		if(!newRoles.has(role.id)) {
			changedRoles.push({
				name: role.name,
				type: "removed"
			})
		}
	})

	newRoles.forEach((role) => {
		if(!oldRoles.has(role.id)) {
			changedRoles.push({
				name: role.name,
				type: "added"
			})
		}
	})

	if(changedRoles.length == 0) return;

	const auditLog = await newIdan.guild.fetchAuditLogs({type: AuditLogEvent.MemberRoleUpdate, limit: 1}).catch(err => null);
	const changeLog = auditLog?.entries.first()
	
	if(!changeLog) return;
	else if(changeLog.target == null || changeLog.executor == null) return;
	else if(changeLog.target.id != newIdan.id) return;

	let res = "<@" + changeLog.executor.id + "> changed to <@" + newIdan.id + "> roles\n";

	for(let index = 0; index < changedRoles.length; index++) {
		res += changedRoles[index].name + " - " + changedRoles[index].type + "\n";
	}

	Webhook("roles", res)
});

export default () => {}