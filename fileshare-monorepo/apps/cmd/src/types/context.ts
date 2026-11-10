import type { Context, Env } from 'hono';

/** Hono 应用环境变量。FileShare 无登录态，保留该类型便于后续扩展。 */
export type AppEnv = Env;

export type AppContext = Context<AppEnv>;
