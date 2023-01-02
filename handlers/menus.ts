import { InteractionExecutor } from "../Types";
import { Collection, StringSelectMenuInteraction } from "discord.js";
import TicketManager from "../structures/TicketManager";
import { TextChannel } from "discord.js";
import { Teams, TeamsNames } from "../Utils";
import { Webhook } from "../structures/Logger";

const menus = new Collection<string, InteractionExecutor>();

menus.set("select_team", {
	identifier: "select_team",

	interact: async (interaction) => {
		if(!(interaction instanceof StringSelectMenuInteraction)) return;

		const ticket = TicketManager.getTicketByChannel(interaction.channelId);
		const teamId = parseInt(interaction.values[0]);
		
		if(!ticket) {
			interaction.reply({content: "This ticket doesn't exists", ephemeral: true});
			return;
		} else if(isNaN(teamId)) {
			interaction.reply({content: "Invalid team id request, Log already sent.", ephemeral: true});
			return;
		} else if(ticket.closed) {
			interaction.reply({content: "This ticket is already closed", ephemeral: true});
			return;
		} else if(ticket.team == teamId && !ticket.locked) {
			interaction.reply({content: "Let's have a talk, If you want to change ticket's team it's probably to another team, Do you agree with me?. Good so why the fuck you want to change the team to the current team that handling this ticket", ephemeral: true});
			return;
		} else if(!(interaction.channel instanceof TextChannel)) {
			interaction.reply({content: "Invalid channel", ephemeral: true});
			return;
		}

		await interaction.deferReply({ ephemeral: true });

		if(ticket.locked) {
			ticket.removeTeam(Teams.Management);
			ticket.setLocked(false);
		} else {
			ticket.removeTeam(ticket.team);
		}

		ticket.addTeam(teamId);
		
		interaction.channel.send({content: "This ticket is now handled by " + TeamsNames[teamId]});
		interaction.editReply({content: "Done!"});
		Webhook("tickets", "<@" + interaction.user.id + "> changed ticket's (" + ticket.id + ") team to " + TeamsNames[teamId]);
	}
})

export default menus;