import Redis from 'ioredis';

declare global {
  var redisClient: Redis | undefined;
}

const redis =
  global.redisClient ??
  new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    // tls: {},
  });

global.redisClient = redis;

export default redis;

