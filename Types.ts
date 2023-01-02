import { ButtonInteraction, TextChannel, ModalMessageModalSubmitInteraction, CategoryChannel, Message, Role, AnySelectMenuInteraction, PermissionFlags, ApplicationCommandOptionData, ChatInputCommandInteraction } from "discord.js"
import { Teams } from "./Utils"

interface CommandExecutor {
	identifier: string,

	data: {
		description: string,
		permission?: keyof PermissionFlags
		type: 1 | 2,
		options?: Array<ApplicationCommandOptionData>
	}

	interact: (interaction: ChatInputCommandInteraction) => void
}

interface InteractionExecutor {
	identifier: string,

	interact: (interaction: AnySelectMenuInteraction | ModalMessageModalSubmitInteraction | ButtonInteraction) => void
}

type SettingTypes = number | string | TextChannel | CategoryChannel | Message | Array<string> | Role | Boolean | undefined | null;

enum Types {
	Number,
	String,
	Channel,
	Category,
	Message,
	Array,
	Role,
	Boolean
}

interface Setting {
	id: number,
	category: number,
	categoryName: string,
	categoryLabel: string,
	type: Types,
	innerType: Types,
	name: string,
	label: string,
	description: string,
	value: SettingTypes | Array<SettingTypes> | null
};

interface ExecuteData {
	fieldCount: number;
	affectedRows: number;
	insertId: number;
	info: string;
	serverStatus: number;
	warningStatus: number;
}

interface RawTicket {
	id: number;
	team: Teams;
	locked: number;
	closed: number;
	message: number;
	author: string;
	channel: string;
}

export {
	// Handlers
	InteractionExecutor,
	CommandExecutor,

	// Settings
	Setting,
	Types,
	SettingTypes,

	ExecuteData,
	RawTicket
}