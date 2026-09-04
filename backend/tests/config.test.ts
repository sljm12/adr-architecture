import { describe, expect, it } from 'vitest';
import { config } from '../src/config';
import { createServer } from '../src/server';

describe('API configuration', () => {
  it('requires DATABASE_URL', () => {
    expect(() => config({ PORT: '3000' })).toThrow('DATABASE_URL is required');
  });

  it('trims and returns the configured database URL', () => {
    expect(config({ PORT: '4000', DATABASE_URL: ' postgres://localhost/adr ' })).toEqual({
      port: 4000,
      databaseUrl: 'postgres://localhost/adr',
    });
  });

  it('rejects server creation without a database URL before creating a repository', () => {
    expect(() => createServer({ PORT: '3000' })).toThrow('DATABASE_URL is required');
  });
});
