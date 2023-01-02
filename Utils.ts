require("dotenv").config();

import { ApplicationCommandData, ChatInputCommandInteraction, ContextMenuCommandInteraction, Guild, Interaction, PermissionFlagsBits, AutocompleteInteraction, User, Channel, ChannelType, TextChannel, CategoryChannel, NewsChannel, PrivateThreadChannel, PublicThreadChannel, StageChannel, VoiceChannel, ForumChannel, Role, Collection } from "discord.js";

import client from "./structures/Client";
import Settings from "./structures/Settings";

import commands from "./handlers/commands";
import buttons from "./handlers/buttons";
import menus from "./handlers/menus";
import events from "./handlers/events";

import { CommandExecutor, InteractionExecutor } from "./Types";
import TicketManager from "./structures/TicketManager";
import UserChannelsManager from "./structures/UserChannelsManager";
import { Debug } from "./structures/Logger";


export let finishedLoading = false;
export let mainGuild: Guild | undefined;

export const createHandlers = (): void => {
	client.on("interactionCreate", (interaction: Interaction): any => {
		const handler = getHandlerByInteraction(interaction);

		if(!handler)
			return;

		const identifier = getIdentifierByInteraction(interaction);

		if(!identifier)
			return;

		const executor = handler.get(identifier)

		if(!executor)
			return;
		
		Debug("Interaction incoming. " + identifier);
		
		// @ts-ignore
		executor.interact(interaction);
	});

	mainGuild = client.guilds.cache.get(process.env.MAIN_GUILD);

	if(mainGuild) {
		mainGuild.members.fetch({force: true});
		
		if(process.env.DEBUG_MODE == "1") {
			mainGuild.commands.set(prepareCommands());
		}
	}
	
	Settings.load();
	TicketManager.load();
	UserChannelsManager.load();

	events();

	finishedLoading = true;
};

const getHandlerByInteraction = (interaction: Interaction): Collection<string, CommandExecutor> | Collection<string, InteractionExecutor> | undefined => {
	if(interaction.isChatInputCommand()) {
		return commands;
	} else if(interaction.isButton()) {
		return buttons;
	} else if(interaction.isAnySelectMenu()) {
		return menus;
	} else if(interaction.isModalSubmit()) {
		return undefined;
	}
};

const getIdentifierByInteraction = (interaction: Interaction): string | undefined => {
	if(interaction instanceof ChatInputCommandInteraction) {
		return interaction.commandName;
	} else if(interaction instanceof ContextMenuCommandInteraction) {
		return undefined; // Not Supported
	} else if(interaction instanceof AutocompleteInteraction) {
		return undefined; // Not Supported
	} else {
		return interaction.customId;
	}
}

export const prepareCommands = (): Array<ApplicationCommandData> => {
	const result: Array<ApplicationCommandData> = [];

	const commandsRaw = commands.toJSON();

	for(let index = 0; index < commandsRaw.length; index++) {
		const command = commandsRaw[index];
		const commandValue = command

		result.push({
			name: command.identifier,
			description: commandValue.data.description,
			type: commandValue.data.type,
			options: commandValue.data.options,
			defaultMemberPermissions: commandValue.data.permission ? PermissionFlagsBits[commandValue.data.permission] : null,
			dmPermission: false
		});
	};

	return result;
}

const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ123456789";
export const generateString = (length: number) => {
	let result = "";

	for(let index = 0; index < length; index++) {
		const charIndex = Math.floor(Math.random() * chars.length);

		result += chars[charIndex];
	}

	return result;
};

export const resolveUser = async (userId: string): Promise<User | null> => {
	let cachedUser = client.users.cache.get(userId);
	if(cachedUser) return cachedUser;
	return client.users.fetch(userId).then(user => user).catch(() => null)
}

export const resolveRole = async (roleId: string): Promise<Role | null> => {
	if(mainGuild == null) return null;

	const cachedRole = mainGuild.roles.cache.get(roleId);

	if(cachedRole) return cachedRole;

	return mainGuild.roles.fetch(roleId).then(role => role).catch(err => null);
}

export const resolveChannel = async (channelId: string): Promise<CategoryChannel | NewsChannel | StageChannel | TextChannel | PrivateThreadChannel | PublicThreadChannel<boolean> | VoiceChannel | ForumChannel | null> => {
	let cachedChannel = client.channels.cache.get(channelId);
	if(cachedChannel && cachedChannel.type != ChannelType.AnnouncementThread  && cachedChannel.type != ChannelType.DM && cachedChannel.type != ChannelType.GroupDM) return cachedChannel;

	return client.channels.fetch(channelId).then(channel => {
		if(channel == null) return null;
		else if(channel.type != ChannelType.AnnouncementThread  && channel.type != ChannelType.DM && channel.type != ChannelType.GroupDM) {
			return channel;
		}

		return null;
	}).catch(() => null)
}

export const TicketPermission: {[key: number]: Array<string>} = {
	0: ["981263517367799828"],
	1: ["986698135638278324"],
	2: ["940289525375180850", "917441353863028736"]
}

export enum Teams {
	Moderator,
	Monitoring,
	Management
}

export const TeamsNames = [
	"Moderator",
	"Monitoring",
	"Management"
]

// const exchangeError = (error: any, errorSource: string): any => {
// 	const id = generateString(constants.ERROR_ID_LENGTH);
// 	const errorMessage = constants.ERRORS[errorSource][error.code ?? error].replaceAll("%error_id%");



// }

