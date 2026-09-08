declare module 'sharedb-postgres' {
  import type { DB } from 'sharedb';

  interface PostgresDBOptions {
    connectionString?: string;
    ssl?: boolean | { rejectUnauthorized: boolean };
  }

  class PostgresDB extends DB {
    constructor(options: PostgresDBOptions | string);
    close(callback?: (err?: Error) => void): void;
  }

  export = PostgresDB;
}
