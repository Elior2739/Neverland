import { Attachment, Collection } from "discord.js";
import { GuildMember, TextChannel, User } from "discord.js";
import { createWriteStream } from "fs";
import { TicketPermission, Teams, TeamsNames, resolveUser } from "../Utils";
import client from "./Client";
import Database from "./Database";
import { Debug, Webhook } from "./Logger";

interface RawSqlTicket {
	id: number;
	team: Teams;
	locked: number;
	closed: number;
	message: number;
	author: string;
	channel: string;
	user: string | undefined;
	content: string | undefined;
	messageId: string | undefined;
}

interface Message {
	avatar: string;
	username: string;
	content: string;
}

class Ticket {
	id: number;
	team: Teams;
	locked: boolean;
	closed: boolean;
	message: boolean;
	author: User | {id: string} | null = null;
	channel: TextChannel | {id: string} | undefined;

	constructor(ticketData: RawSqlTicket) {
		this.id = ticketData.id;
		this.team = ticketData.team;
		this.locked = ticketData.locked == 1;
		this.closed = ticketData.closed == 1;
		this.message = ticketData.message == 1;

		if(ticketData.closed) {
			this.author = {id: ticketData.author};
			this.channel = {id: ticketData.channel};
		} else {

			resolveUser(ticketData.author).then((user) => {
				this.author = user;
			})

			const channel = client.channels.cache.get(ticketData.channel)

			if(!channel) {
				client.channels.fetch(ticketData.channel).then((channel) => {
					if(channel instanceof TextChannel) {
						this.channel = channel;
					}
				}).catch(() => {
					this.channel = {id: ticketData.channel};
				})
			} else {
				if(channel instanceof TextChannel) {
					this.channel = channel;
				}
			}

		}
	}

	setClosed = (by: User, reason?: string) => {
		if(this.closed) return;
		this.closed = true;
		
		Database.execute("UPDATE `tickets` SET `closed` = ? WHERE `id` = ?", [
			1,
			this.id
		]);
		
		if(this.channel && this.channel instanceof TextChannel) {
			this.channel.send({content: "This ticket will be deleted in a few seconds"});

			setTimeout(async () => {
				if(this.channel instanceof TextChannel) {
					await this.channel.delete(reason);
					this.channel = {id: this.channel.id};
				} else {
					console.log("the fuck");
				}
			}, 2500);

		}
		
		if(this.author instanceof User) {
			this.author = {id: this.author.id};
		}
		
		Webhook("tickets", "<@" + by.id + "> closed ticket " + this.id);
	}

	setLocked = (value: boolean) => {
		this.locked = value;

		Database.execute("UPDATE `tickets` SET `locked` = ? WHERE `id` = ?", [
			this.locked ? 1 : 0,
			this.id
		]);
	}

	setMessage = (value: boolean) => {
		this.message = value;

		Database.execute("UPDATE `tickets` SET `message` = ? WHERE `id` = ?", [
			this.message ? 1 : 0,
			this.id
		]);
	}

	addMessage = (userId: string, messageId: string, content: string, attachments: Array<Attachment>): void => {
		const messagePromise = Database.execute("INSERT INTO `messages`(`ticket`, `user`, `content`, `message`, `at`) VALUES(?, ?, ?, ?, ?)", [
			this.id,
			userId,
			content,
			messageId,
			Date.now()
		])

		if(attachments.length > 0) {
			messagePromise.then(([data]) => {
				const executeData = data as {insertId: number};
	
				for(let index = 0; index < attachments.length; index++) {
					const attachment = attachments[index];
					
					fetch(attachment.url).then(response => response.arrayBuffer()).then(arrBuffer => {
						const buffer = Buffer.from(arrBuffer);

						createWriteStream("./webserver/public/assets/" + executeData.insertId + "_" + attachment.name).write(buffer);
					});
				}
			})
		}
	}

	addTeam = (teamId: Teams, updateDb: boolean = true) => {
		if(!this.channel || !(this.channel instanceof TextChannel)) return false;
		const teamPerms = TicketPermission[teamId];

		for(let index = 0; index < teamPerms.length; index++) {
			const roleId = teamPerms[index];

			if(this.channel.guild.roles.cache.has(roleId)) {
				this.channel.permissionOverwrites.create(roleId, {
					ViewChannel: true,
					SendMessages: true
				})
			}
		}

		if(updateDb) {
			Database.execute("UPDATE `tickets` SET `team` = ? WHERE `id` = ?", [teamId, this.id]);
		}
	}

	removeTeam = (teamId: Teams) => {
		if(!this.channel || !(this.channel instanceof TextChannel)) return false;
		const teamPerms = TicketPermission[teamId];


		for(let index = 0; index < teamPerms.length; index++) {
			const roleId = teamPerms[index];

			if(this.channel.guild.roles.cache.has(roleId)) {
				this.channel.permissionOverwrites.delete(roleId);
			}
		}
	}
}

export default new class {

	#tickets = new Collection<string, Ticket>();

	load = () => {
		Database.query("SELECT `id`, `team`, `locked`, `closed`, `message`, `author`, `channel` FROM `tickets`").then(async (data) => {
			const tickets = data[0] as Array<RawSqlTicket>;

			for(let index = 0; index < tickets.length; index++) {
				this.#tickets.set(tickets[index].channel, new Ticket(tickets[index]))
			};

			Debug("Found " + this.#tickets.values.length + " tickets");
		});
	};

	getTicketByChannel = (channelId: string): Ticket | undefined => this.#tickets.get(channelId);

	getTicket = (filter: (ticket: Ticket) => boolean) => {
		const tickets = this.#tickets.toJSON();

		for(let index = 0; index < tickets.length; index++) {
			const ticket = tickets[index];
			
			if(filter(ticket)) {
				return ticket;
			}
		};

		return null;
	}

	getTickets = (filter: (ticket: Ticket) => boolean) => {
		const result: Array<Ticket> = [];
		const tickets = this.#tickets.toJSON();

		for(let index = 0; index < tickets.length; index++) {
			const ticket = tickets[index];

			if(filter(ticket)) {
				result.push(ticket);
			}
		};

		return result;
		
	};

	addTicket = (ticketData: RawSqlTicket) => {
		const ticket = new Ticket(ticketData)
		this.#tickets.set(ticketData.channel, ticket);

		return ticket;
	};

	isAllowed = (member: GuildMember): boolean => {
		if(member.permissions.has("Administrator")) return true;
		
		for(let index = 0; index < TeamsNames.length; index++) {
			const rolesIds = TicketPermission[index];

			for(let jail = 0; jail < rolesIds.length; jail++) {
				if(member.roles.cache.has(rolesIds[jail])) {
					return true;
				};
			};
		};

		return false;
	};
};