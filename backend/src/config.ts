export type AppConfig = { port: number; databaseUrl: string };

export function config(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to start the API');
  }

  return { port: Number(env.PORT ?? 3000), databaseUrl };
}
