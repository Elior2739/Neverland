import { CategoryChannel, Collection, Message , Role, TextChannel } from "discord.js";
import { mainGuild } from "../Utils";
import client from "./Client";
import Database from "./Database";

import { Setting, Types, SettingTypes } from "../Types";
import { Debug } from "./Logger";

interface RawSetting {
	id: number,
	category: number,
	category_name: string,
	category_label: string,
	type: Types,
	inner_type: Types,
	name: string,
	label: string,
	description: string,
	value: string | null
};

export default new class {

	#settings = new Collection<string, Setting>();

	load = (): void => {
		Database.query("SELECT `settings`.`id`, `settings`.`category`, `settings`.`type`, `settings`.`inner_type`, `settings`.`name`, `settings`.`label`, `settings`.`description`, `settings`.`value`, `categories`.`name` as category_name, `categories`.`label` as category_label FROM `settings` RIGHT JOIN `categories` ON `settings`.`category` = `categories`.`id`").then((result) => {
			const data = result[0] as Array<RawSetting>;

			for(let index = 0; index < data.length; index++) {
				const settingRaw = data[index];
				
				this.#settings.set(settingRaw.name + settingRaw.type, {
					id: settingRaw.id,
					category: settingRaw.category,
					categoryName: settingRaw.category_name,
					categoryLabel: settingRaw.category_label,
					type: settingRaw.type,
					innerType: settingRaw.inner_type,
					name: settingRaw.name,
					label: settingRaw.label,
					description: settingRaw.description,
					value: this.#getSettingValueFormatted(settingRaw.type, settingRaw.value, settingRaw.inner_type)
				});
			};

			Debug("Found " + this.#settings.values.length + " settings");
		});
	};

	#getSettingValueFormatted = (type: Types, value: string | null, innerType?: Types): SettingTypes | Array<SettingTypes> | null => {
		if(value == null) {
			return null
		} else if(type == Types.Channel || type == Types.Category || type == Types.Message) {
			const channel = client.channels.cache.get(value);
			
			if(!(channel instanceof TextChannel || channel instanceof CategoryChannel)) {
				return null;
			}

			return channel;
		} else if(type == Types.Role && mainGuild != undefined) {
			return mainGuild.roles.cache.get(value);
		} else if(type == Types.Number) {
			const num = parseInt(value);

			return isNaN(num) ? undefined : num;
		} else if(type == Types.Array && innerType != undefined) {
			const array = JSON.parse(value) as Array<string>;
			const result: Array<SettingTypes> = [];

			for(let index = 0; index < array.length; index++) {
				const elementResult = this.#getSettingValueFormatted(innerType, array[index]);

				if(elementResult instanceof Array) {
					result.push(...elementResult);
				} else {
					result.push(elementResult)
				}
			};

			return result;
		} else if(type == Types.Boolean) {
			return value == "1";
		}

		return value;
	};

	getSetting = (name: string, type: number) => this.#settings.get(name + type);
	getSettings = () => this.#settings.toJSON();

	setSetting = (name: string, type: number, innerType: number, value: string) => {
		const setting = this.#settings.get(name + type);

		if(!setting)
			return;

		setting.value = this.#getSettingValueFormatted(type, value, innerType);

		Database.execute("UPDATE `settings` SET `value` = ? WHERE `id` = ?", [
			value,
			setting.id
		])
	}
};

