export function config(env=process.env){ return { port:Number(env.PORT??3000), databaseUrl:env.DATABASE_URL??'' }; }
