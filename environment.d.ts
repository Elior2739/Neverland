declare global {
	namespace NodeJS {
		interface ProcessEnv {
			DEBUG_MODE: string;

			MAIN_GUILD: string;
			TOKEN: string;

			SQL_HOST: string;
			SQL_DB: string;
			SQL_USR: string;
			SQL_PASS: string;
			SQL_PORT: string;

			CLIENT_ID: string;
			CLIENT_SECRET: string;
			REDIRECT_URI: string;

			FUCK_THIS: string;
		}
	}
}

export { }