import { CategoryChannel, User, ChannelType, VoiceChannel, Guild, Collection, Channel } from "discord.js";
import Database from "./Database";
import client from "./Client";
import Settings from "./Settings";
import { Debug, Log } from "./Logger";

interface ChannelRow {
	id: number,
	author: string,
	channel: string
}

class UserChannel {
	id: number;
	author: User | undefined;
	channel: VoiceChannel | undefined;

	constructor(data: ChannelRow) {
		this.id = data.id;
		const tempUser = client.users.cache.get(data.author);

		if(!tempUser) {
			client.users.fetch(data.author).then(user => {
				this.author = user;
			}).catch(() => {
				this.author = undefined;
				Log("error", "Can't find author of channel " + this.id + " removing channel")
			})
		} else {
			this.author = tempUser;
		}

		const tempChannel = client.channels.cache.get(data.channel);

		if(tempChannel instanceof VoiceChannel) {
			this.channel = tempChannel;
		}
	}
};

export default new class {

	#channels = new Collection<string, UserChannel>();
	#users: {[key: string]: number} = {};

	load = () => {
		Database.query("SELECT * FROM `channels`").then(([rows]) => {
			const data = rows as Array<ChannelRow>;

			for(let index = 0; index < data.length; index++) {
				this.#users[data[index].author] = data[index].id;
				this.#channels.set(
					data[index].id.toString(),
					new UserChannel(data[index])
				);
			};
			
			Debug("Found " + this.#channels.values.length + " private channels");
		});


		setInterval(async () => {
			const channels = this.#channels.toJSON();

			for(let index = 0; index < channels.length; index++) {
				const userChannel = channels[index];
				if(userChannel.channel == undefined) continue;

				const channel = await client.channels.fetch(userChannel.channel.id, {force: true});
				if(!(channel instanceof VoiceChannel)) continue;

				if(channel.members.size == 0) {
					channel.delete("Inactive");
					if(userChannel.author != undefined) {
						delete this.#users[userChannel.author.id]
					}
					this.#channels.delete(userChannel.id.toString());
					Database.execute("DELETE FROM `channels` WHERE `id` = ?", [
						userChannel.id
					])

					Debug("Delete private channel " + userChannel.id)
				}
			}
		}, 15_000)
	};

	createChannel = async (user: User, guild: Guild) => {
		const category = Settings.getSetting("voice-category", 3);

		if(!category || !(category.value instanceof CategoryChannel)) {
			return "Something went wrong";
		} else if(this.#users[user.id] != null) {
			return "You already have a channel"
		} else if(category.value.children.cache.size + 1 > 15) {
			return "There are too many channels, Try again later."
		};

		this.#users[user.id] = 0;

		return await category.value.children.create({
			name: user.username,
			type: ChannelType.GuildVoice,
			userLimit: 10,
			permissionOverwrites: [
				{
					id: guild.roles.everyone.id,
					deny: ["ViewChannel", "Connect"]
				},
				{
					id: user.id,
					allow: ["ViewChannel", "Connect", "MoveMembers"]
				}
			]
		}).then(async (channel: Channel) => {
			let deleted = false;
			await Database.execute("INSERT INTO `channels`(`author`, `channel`) VALUES(?, ?)", [
				user.id,
				channel.id
			]).then(([info]) => {
				const insertData = info as {insertId: number};
				this.#users[user.id] = insertData.insertId;
				this.#channels.set(insertData.insertId.toString(), new UserChannel({id: insertData.insertId, author: user.id, channel: channel.id}));
			}).catch(() => {
				channel.delete();
				deleted = true;
			})

			return (deleted) ? "Something went wrong" : channel;
		})
	}

	getUserChannel = (userId: string): UserChannel | undefined => this.#channels.get(this.#users[userId]?.toString());
}