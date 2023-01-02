import { APIActionRowComponent, CategoryChannel, APIMessageActionRowComponent, TextChannel, GuildMember, APIButtonComponent, APIStringSelectComponent, Collection, DiscordjsError } from "discord.js";

import { ExecuteData, InteractionExecutor } from "../Types";
import { Teams, TeamsNames } from "../Utils";
import TicketManager from "../structures/TicketManager";
import Settings from "../structures/Settings";
import Database from "../structures/Database";
import { SaveLog, Webhook } from "../structures/Logger";

const buttons = new Collection<string, InteractionExecutor>();

const ticketMessage = {
	title: "Ticket System",
	description: "Support will be with you shortly. \nTo close this ticket, please press the button below with the emoji ❌.",
	color: 1236207
};

const openTicketButtons: Array<APIActionRowComponent<APIButtonComponent>> = [
	{
		type: 1,
		components: [
			{
				type: 2,
				style: 4,
				custom_id: "close_ticket",
				label: "❌ Close Ticket",
			},

			{
				type: 2,
				style: 2,
				custom_id: "lock_ticket",
				label: "🔒 Lock Ticket",
			},
			{
				type: 2,
				style: 1,
				custom_id: "change_ticket",
				label: "👨‍👦 Change Team",
			},
		]
	}
]

const teamMenu: APIActionRowComponent<APIStringSelectComponent> = {
	type: 1,
	components: [
		{
			type: 3,
			custom_id: "select_team",
			options: [],
			placeholder: "Select which team",
			max_values: 1
		}
	]
};


setTimeout(() => {
	for(let index = 0; index < TeamsNames.length; index++) {
		teamMenu.components[0].options.push({
			label: TeamsNames[index],
			value: index.toString()
		});
	};
}, 500);


const lockedTicketButtons: Array<APIActionRowComponent<APIButtonComponent>> = [
	{
		type: 1,
		components: [
			{
				type: 2,
				style: 4,
				custom_id: "close_ticket",
				label: "❌ Close Ticket",
			},

			{
				type: 2,
				style: 2,
				custom_id: "unlock_ticket",
				label: "🔓 Unlock Ticket",
			},
			{
				type: 2,
				style: 1,
				custom_id: "change_ticket",
				label: "👨‍👦 Change Team",
			},
		]
	}
]

buttons.set("open_ticket", {
	identifier: "open_ticket",

	interact: async (interaction): Promise<void> => {
		await interaction.deferReply({ephemeral: true});

		const userTickets = TicketManager.getTickets((ticket) => ticket.author?.id == interaction.user.id && !ticket.closed);
		const maxTicketsSetting = Settings.getSetting("allowed-tickets", 0)?.value;
		const maxTickets = maxTicketsSetting == undefined ? 1 : maxTicketsSetting;
		const ticketCategory = Settings.getSetting("ticket-category", 3);

		if(userTickets.length + 1 > maxTickets) {
			interaction.editReply({content: "You reached to your max tickets that are open."})
			return;
		} else if(ticketCategory == undefined || !(ticketCategory.value instanceof CategoryChannel)) {
			interaction.editReply({content: "Can't find ticket category, Please try again later."})
			return;
		} else if(interaction.guild == null) {
			interaction.editReply({content: "Can't find the guild"})
			return;
		}


		const channel = await ticketCategory.value.children.create({
			name: "ticket-0000",
			type: 0,
			permissionOverwrites: [
				{
					id: interaction.guild.roles.everyone.id,
					deny: ["ViewChannel", "SendMessages"]
				}
			]
		}).catch((err: DiscordjsError) => {
			SaveLog(err.stack + "", true);
			return null;
		});

		if(!channel) {
			interaction.editReply({content: "Something went wrong while creating your ticket, We are on it. Please try again later."});
			return;
		}

		const data = await Database.execute("INSERT INTO `tickets`(`team`, `locked`, `closed`, `author`, `channel`) VALUES(?, ?, ?, ?, ?)", [
			0,
			0,
			0,
			interaction.user.id,
			channel.id
		]).then(([data]) => data).catch(err => {
			SaveLog(err, true);
			return null
		}) as (ExecuteData | null);

		if(!data) {
			interaction.editReply({content: "Something went wrong while creating your ticket, We are on it. Please try again later."});
			return;
		}

		const ticket = TicketManager.addTicket({ // TODO: Change the database execution to this method
			id: data.insertId,
			author: interaction.user.id,
			channel: channel.id,
			closed: 0,
			locked: 0,
			team: 0,
			message: 0,
			user: undefined,
			content: undefined,
			messageId: undefined
		});

		channel.setName("ticket-" + ticket.id.toString().padStart(4, "0"));
		const message = await channel.send({content: "<@" + interaction.user.id + ">", embeds: [ticketMessage], components: openTicketButtons}).catch((err: DiscordjsError) => {
			SaveLog(err.stack + "", true);
			return null;
		});

		if(!message) {
			interaction.editReply({content: "Something went wrong while creating your ticket, We are on it. Please try again later."});
			return;
		}

		ticket.addTeam(Teams.Moderator);
		channel.permissionOverwrites.create(interaction.user.id, {
			SendMessages: true,
			ViewChannel: true
		});

		interaction.editReply({content: "Your ticket is ready! <#" + channel.id + ">"});
		Webhook("tickets", "<@" + interaction.user.id + "> created ticket " + ticket.id);

		const messageSent = await channel.awaitMessages({max: 1, time: (1000 * 60) * 5, errors: ["time"]}).then(() => true).catch(() => false);

		if(!messageSent) {
			ticket.setClosed(interaction.client.user, "Inactive ticket");
		}
	}
});

const closeTicketButtons: APIActionRowComponent<APIMessageActionRowComponent> = {
	type: 1,
	components: [
		{
			type: 2,
			style: 1,
			custom_id: "close_ticket",
			label: "Yes"
		},
		{
			type: 2,
			style: 4,
			custom_id: "stay_ticket",
			label: "No"
		}
	]
}

buttons.set("close_sequence", {
	identifier: "close_sequence",

	interact: async (interaction) => {
		const ticket = TicketManager.getTicketByChannel(interaction.channelId);
		
		if(!ticket) {
			interaction.reply({content: "This ticket doesn't exists", ephemeral: true})
			return;
		} else if(ticket.message) {
			interaction.reply({content: "Close message already sent.", ephemeral: true})
			return;
		} else if(interaction.channel == null) {
			interaction.reply({content: "You are doing this in invalid channel.", ephemeral: true})
			return;
		}

		ticket.setMessage(true);
		interaction.deferUpdate();

		const message = await interaction.channel.send({content: "Are you sure you would like to close this ticket?", components: [closeTicketButtons]}).catch(err => {
			SaveLog(err, true);
			return null;
		});

		if(!message) {
			interaction.reply({content: "Something went wrong while creating your ticket, We are on it. Please try again later.", ephemeral: true});
			ticket.setMessage(false);
			return;
		}
	}
});

buttons.set("close_ticket", {
	identifier: "close_ticket",

	interact: (interaction) => {
		const ticket = TicketManager.getTicketByChannel(interaction.channelId);

		if(!ticket) {
			interaction.reply({content: "This ticket doesn't exists", ephemeral: true});
			return;
		} else if(ticket.closed) {
			interaction.reply({content: "This ticket is already closed", ephemeral: true});
			interaction.message.delete();
			return;
		}

		ticket.setClosed(interaction.user, "Close sequence");
		interaction.deferUpdate();
	}
});

buttons.set("stay_ticket", {
	identifier: "stay_ticket",

	interact: (interaction) => {
		const ticket = TicketManager.getTicketByChannel(interaction.channelId);

		if(!ticket) {
			interaction.reply({content: "This ticket doesn't exists", ephemeral: true});
			return;
		} else if(ticket.closed) {
			interaction.reply({content: "This ticket is already closed", ephemeral: true});
			interaction.message.delete();
			return;
		}
		
		interaction.deferUpdate();
		interaction.message.delete();
		ticket.setMessage(false);
	}
})

buttons.set("change_ticket", {
	identifier: "change_ticket",

	interact: async (interaction) => {
		const ticket = TicketManager.getTicketByChannel(interaction.channelId);

		if(interaction.member == null || !(interaction.member instanceof GuildMember) || interaction.channel == null) {
			interaction.reply({content: "Invalid channel", ephemeral: true})
			return;
		} else if(!TicketManager.isAllowed((interaction.member))) {
			interaction.reply({content: "You don't have permission to use this.", ephemeral: true})
			return;
		} else if(!ticket) {
			interaction.reply({content: "his ticket doesn't exists", ephemeral: true})
			return;
		} else if(ticket.closed) {
			interaction.reply({content: "This ticket is closed", ephemeral: true});
			return;
		}

		interaction.reply({components: [teamMenu], ephemeral: true});
	}
});

buttons.set("lock_ticket", {
	identifier: "lock_ticket",

	interact: async (interaction) => {
		const ticket = TicketManager.getTicketByChannel(interaction.channelId);

		if(interaction.guild == null) {
			interaction.reply({content: "Invalid guild", ephemeral: true})
			return;
		} else if(interaction.channel == null || !(interaction.channel instanceof TextChannel) || interaction.member == null || !(interaction.member instanceof GuildMember)) {
			interaction.reply({content: "Invalid channel", ephemeral: true})
			return;
		} else if(!TicketManager.isAllowed((interaction.member))) {
			interaction.reply({content: "You don't have permission to use this.", ephemeral: true})
			return;
		} else if(!ticket) {
			interaction.reply({content: "his ticket doesn't exists", ephemeral: true})
			return;
		} else if(ticket.closed) {
			interaction.reply({content: "This ticket is closed", ephemeral: true});
			return;
		}

		interaction.deferUpdate();
		interaction.channel.send({content: "Locking ticket for administrator access only.", components: []})
		interaction.message.edit({components: lockedTicketButtons});

		ticket.removeTeam(ticket.team);
		ticket.addTeam(Teams.Management, false);
		ticket.setLocked(true);

		Webhook("tickets", "Ticket (" + ticket.id + ") got locked by <@" + interaction.user.id + ">");
	}
});

buttons.set("unlock_ticket", {
	identifier: "unlock_ticket",

	interact: async (interaction) => {
		const ticket = TicketManager.getTickets((ticket) => ticket.channel?.id == interaction.channelId)[0];

		if(!ticket) {
			interaction.reply({content: "his ticket doesn't exists", ephemeral: true})
			return;
		} else if(!(interaction.channel instanceof TextChannel)) {
			interaction.reply({content: "Invalid channel", ephemeral: true})
			return;
		} else if(ticket.author == null) {
			interaction.reply({content: "Can't find the author of this ticket", ephemeral: true})
			return;
		}

		interaction.deferUpdate();
		interaction.message.edit({components: openTicketButtons});
		interaction.channel.permissionOverwrites.edit(ticket.author.id, {
			SendMessages: true
		})

		Webhook("tickets", "Ticket (" + ticket.id + ") got unlocked by <@" + interaction.user.id + ">")
	}
})

export default buttons;