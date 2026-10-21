import { describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { createServer, startServer } from '../src/server';

const databaseUrl = 'postgresql://unused:unused@127.0.0.1:1/unused';

describe('API lifecycle', () => {
  it('closes the database pool exactly once when the application closes', async () => {
    const { app, database } = createServer({ DATABASE_URL: databaseUrl });
    const end = vi.spyOn(database.pool, 'end');
    try {
      // Process health must not require a database connection or run migrations.
      expect((await app.inject({ url: '/health' })).json()).toEqual({ ok: true });
      await app.close();
      await app.close();
      expect(end).toHaveBeenCalledTimes(1);
    } finally {
      await app.close();
      if (end.mock.calls.length === 0) await database.pool.end();
      end.mockRestore();
    }
  });

  it('releases the pool if the server cannot listen', async () => {
    const end = vi.spyOn(Pool.prototype, 'end');
    try {
      await expect(startServer({ DATABASE_URL: databaseUrl, PORT: '-1' })).rejects.toThrow();
      expect(end).toHaveBeenCalledTimes(1);
    } finally {
      end.mockRestore();
    }
  });
});
