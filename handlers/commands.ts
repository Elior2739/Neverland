import { ApplicationCommandOptionType, Collection, ComponentType, GuildMember, TextChannel } from "discord.js";
import Settings from "../structures/Settings";
import TicketManager from "../structures/TicketManager";
import UserChannelsManager from "../structures/UserChannelsManager";
import { CommandExecutor, Setting, Types } from "../Types";

const commands = new Collection<string, CommandExecutor>()

const settings = Settings.getSettings();
const categories = new Collection<string, Array<Setting>>()

const categoryMenu: {type: number, components: Array<any>} = {
	type: 1,
	components: [
		{
			placeholder: "Place select the category",
			custom_id: "category_selected",
			type: 3,
			max_values: 1,
			options: []
		}
	]
};

commands.set("settings", {
	identifier: "settings",

	data: {
		description: "Edit settings",
		type: 1,
		permission: "Administrator",
		options: [
			{
				name: "value",
				description: "The value",
				type: ApplicationCommandOptionType.String,
				required: true
			}
		]
	},

	interact: (interaction): void => { // https://embedg.netlify.app/dashboard
		let value = interaction.options.getString("value", true);

		if(categoryMenu.components[0].options.length == 0) {
			for(let index = 0; index < settings.length; index++) {
				const setting = settings[index];

				if(setting) {
					let category = categories.get(setting.categoryName);
			
					if(category == undefined) {
						categories.set(setting.categoryName, [])
						categoryMenu.components[0].options.push({
							label: setting.categoryLabel,
							value: setting.categoryName
						})
					}
				
					category = categories.get(setting.categoryName);
					
					// @ts-ignore
					category.push(setting);
				}
			};
		} else if(interaction.channel == null) {
			interaction.reply({content: "You can't use the command here.", ephemeral: true})
			return;
		};

		interaction.reply({components: [categoryMenu], ephemeral: true}).then(() => {
			interaction.channel?.awaitMessageComponent({componentType: ComponentType.StringSelect, time: 60000, filter: (_) => _.user.id == interaction.user.id}).then((menuInteraction) => {
				menuInteraction.deferUpdate()

				const categorySettings = categories.get(menuInteraction.values[0]);
				const settingMenu: {type: number, components: Array<any>} = {
					type: 1,
					components: [
						{
							placeholder: "Select which setting",
							custom_id: "setting_selected",
							type: 3,
							max_values: 1,
							options: []
						}
					]
				};

				if(categorySettings) {
					let description = "";

					for(let index = 0; index < categorySettings.length; index++) {
						const categorySetting = categorySettings[index];
	
						if(!(categorySetting instanceof Array)) {
							description += "**" + categorySetting.label + "**\n" + categorySetting.description + "\n" + ((categorySetting.value == null || categorySetting.value == undefined) ? "Not Defined\n\n" : categorySetting.value.toString() + "\n\n")
							settingMenu.components[0].options.push({
								label: categorySetting.label,
								value: categorySetting.name + "_" + categorySetting.type + "_" + categorySetting.innerType
							});
						 };
					};
	
					interaction.editReply({embeds: [
						{
							author: {
								name: "Settings System"
							},
	
							description
						}
					], components: [settingMenu]}).then(() => {
						interaction.channel?.awaitMessageComponent({componentType: ComponentType.StringSelect, time: 60000, filter: (_) => _.user.id == interaction.user.id}).then((menuInteraction) => {
							menuInteraction.deferUpdate();
	
							const values = menuInteraction.values[0].split("_");
							const name = values[0], type = parseInt(values[1]), innerType = parseInt(values[2])
	
							if(type == Types.Array) {
								value = "[" + value + "]";
							} else if(type == Types.Message) {
								
								let messageData: any;
	
								try {
									messageData = JSON.parse(value);
								} catch {}
	
								if(!messageData) return interaction.editReply({content: "Invalid JSON value in value"})
	
								interaction.channel?.send(messageData);
								return;
							}
	
							Settings.setSetting(name, type, innerType, value);
							interaction.editReply({content: "Done", embeds: [], components: []});
						}).catch((err) => {
							if(err.code == "InteractionCollectorError") return;
	
							interaction.reply({content: "You failed to answer in time", components: []})
						});
					});
				}

				

			}).catch((err) => {
				if(err.code == "InteractionCollectorError") {
					return;
				}

				interaction.editReply({content: "You failed to answer in time", components: []});
			})
		});
	}
});

commands.set("add", {
	identifier: "add",

	data: {
		type: 1,
		description: "Add somebody to the ticket",
		permission: "ManageMessages",
		options: [
			{
				name: "user",
				description: "The user that you want to add",
				type: ApplicationCommandOptionType.User,
				required: true
			}
		]
	},

	interact: (interaction) => {
		if(interaction.member == null || !((interaction.member as any) instanceof GuildMember) || interaction.channel == null || !(interaction.channel instanceof TextChannel)) {
			interaction.reply({content: "Invalid channel", ephemeral: true});
			return;
		} else if(!TicketManager.isAllowed((interaction.member as GuildMember))) {
			interaction.reply({content: "You don't have permission to use this.", ephemeral: true})
			return;
		}

		const user = interaction.options.getUser("user", true);

		interaction.channel.permissionOverwrites.create(user.id, {
			ViewChannel: true,
			SendMessages: true
		});
		interaction.reply({content: "Added <@" + user.id + "> to this ticket successfully"});

	}
})

commands.set("remove", {
	identifier: "remove",

	data: {
		type: 1,
		description: "Remove somebody to the ticket",
		permission: "ManageMessages",
		options: [
			{
				name: "user",
				description: "The user that you want to remove",
				type: ApplicationCommandOptionType.User,
				required: true
			}
		]
	},

	interact: (interaction) => {
		if(interaction.member == null || !((interaction.member as any) instanceof GuildMember) || interaction.channel == null || !(interaction.channel instanceof TextChannel)) {
			interaction.reply({content: "Invalid channel", ephemeral: true});
			return;
		} else if(!TicketManager.isAllowed((interaction.member as GuildMember))) {
			interaction.reply({content: "You don't have permission to use this.", ephemeral: true})
			return;
		}

		const user = interaction.options.getUser("user", true);

		interaction.channel.permissionOverwrites.delete(user.id);
		interaction.reply({content: "Removed <@" + user.id + "> from this ticket successfully"});
	}
})

commands.set("createchannel", {
	identifier: "createchannel",

	data: {
		description: "Create a channel",
		type: 1
	},

	interact: async (interaction) => {
		if(interaction.guild == null) {
			interaction.reply({content: "Invalid channel", ephemeral: true});
			return;
		}

		await interaction.deferReply({ephemeral: true})

		const result = await UserChannelsManager.createChannel(interaction.user, interaction.guild);

		if(typeof result == "string") {
			interaction.editReply({content: result});
			return;
		}

		interaction.editReply({content: "Your channel is ready <#" + result.id + ">"})
	}
});

commands.set("makepublic", {
	identifier: "makepublic",

	data: {
		description: "Makes your channel public",
		type: 1
	},

	interact: async (interaction) => {
		if(interaction.guild == null) {
			interaction.reply({content: "Invalid channel", ephemeral: true});
			return;
		}

		const hisVoice = UserChannelsManager.getUserChannel(interaction.user.id);

		if(hisVoice == undefined) {
			interaction.reply({content: "You don't have a channel", ephemeral: true});
			return;
		} else if(hisVoice.channel == undefined) {
			interaction.reply({content: "Your channel is deleted", ephemeral: true});
			return;
		}

		hisVoice.channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, {
			Connect: true,
			ViewChannel: true
		});

		interaction.reply({content: "Done" + ((interaction.user.id == "297135039953764364") ? " 😉" : ""), ephemeral: true});
	}
})

commands.set("makeprivate", {
	identifier: "makeprivate",

	data: {
		description: "Makes your channel private",
		type: 1
	},

	interact: async (interaction) => {
		if(interaction.guild == null) {
			interaction.reply({content: "Invalid channel", ephemeral: true});
			return;
		}

		await interaction.deferReply({ephemeral: true});

		const hisVoice = UserChannelsManager.getUserChannel(interaction.user.id);

		if(hisVoice == undefined) {
			interaction.editReply({content: "You don't have a channel"});
			return;
		} else if(hisVoice.channel == undefined) {
			interaction.editReply({content: "Your channel is deleted"});
			return;
		}

		hisVoice.channel.permissionOverwrites.edit(interaction.guild.roles.everyone.id, {
			Connect: false,
			ViewChannel: false
		});

		interaction.editReply({content: "Done" + ((interaction.user.id == "297135039953764364") ? " 😉" : "")});
	}
})

commands.set("adduser", {
	identifier: "adduser",

	data: {
		description: "Add user to your channel",
		type: 1,
		options: [
			{
				name: "user",
				description: "Da user",
				type: ApplicationCommandOptionType.User,
				required: true
			}
		]
	},

	interact: async (interaction) => {
		if(interaction.guild == null) {
			interaction.reply({content: "Invalid channel"});
			return;
		}

		const hisVoice = UserChannelsManager.getUserChannel(interaction.user.id);

		if(hisVoice == undefined) {
			interaction.reply({content: "You don't have a channel", ephemeral: true});
			return;
		} else if(hisVoice.channel == undefined) {
			interaction.reply({content: "Your channel is deleted", ephemeral: true});
			return;
		}

		const user = interaction.options.getUser("user", true);

		hisVoice.channel?.permissionOverwrites.create(user.id, {
			Connect: true,
			ViewChannel: true
		});

		interaction.reply({content: "Done" + ((interaction.user.id == "297135039953764364") ? " 😉" : ""), ephemeral: true});
	}
})

commands.set("removeuser", {
	identifier: "removeuser",

	data: {
		description: "Remove user to your channel",
		type: 1,
		options: [
			{
				name: "user",
				description: "Da user",
				type: ApplicationCommandOptionType.User,
				required: true
			}
		]
	},

	interact: async (interaction) => {
		if(interaction.guild == null) {
			interaction.reply({content: "Invalid channel", ephemeral: true});
			return;
		}

		const hisVoice = UserChannelsManager.getUserChannel(interaction.user.id);

		if(hisVoice == undefined) {
			interaction.reply({content: "You don't have a channel", ephemeral: true});
			return;
		} else if(hisVoice.channel == undefined) {
			interaction.reply({content: "Your channel is deleted", ephemeral: true});
			return;
		}

		const user = interaction.options.getUser("user", true);

		hisVoice.channel?.members.get(user.id)?.voice.setChannel(null);
		hisVoice.channel?.permissionOverwrites.delete(user.id);

		interaction.reply({content: "Done" + ((interaction.user.id == "297135039953764364") ? " 😉" : ""), ephemeral: true});
	}
})

commands.set("setusers", {
	identifier: "setusers",

	data: {
		description: "Set users amount in your channel",
		type: 1,
		options: [
			{
				name: "amount",
				description: "Da amount",
				type: ApplicationCommandOptionType.Number,
				required: true
			}
		]
	},

	interact: async (interaction) => {
		if(interaction.guild == null) {
			interaction.reply({content: "Invalid channel", ephemeral: true});
			return;
		}

		const hisVoice = UserChannelsManager.getUserChannel(interaction.user.id);

		if(hisVoice == undefined) {
			interaction.reply({content: "You don't have a channel", ephemeral: true});
			return;
		} else if(hisVoice.channel == undefined) {
			interaction.reply({content: "Your channel is deleted", ephemeral: true});
			return;
		}

		const number = interaction.options.getNumber("amount", true);

		hisVoice.channel.setUserLimit(number, "Author changed");

		if(number > 99) {
			interaction.reply({content: "No can do baby doll", ephemeral: true});
			return;
		}


		interaction.reply({content: "Done" + ((interaction.user.id == "297135039953764364") ? " 😉" : ""), ephemeral: true});
	}
})

export default commands;