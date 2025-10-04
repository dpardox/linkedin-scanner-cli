import { StoragePort } from '@ports/storage.port';
import fs from 'fs';
import path from 'path';

type JSONStorageAdapterOptions<T> = {
  baseDir?: string;
  ttlDays?: number;
  resolveTimestamp?: (record: Partial<T>) => Date | string | null | undefined;
  now?: () => Date;
};

export class JSONStorageAdapter<T extends { id: ID }, ID = string> implements StoragePort<T, ID> {

  private readonly dir: string;
  private readonly entity: string;
  private readonly ttlMs?: number;
  private readonly resolveTimestamp: (record: Partial<T>) => Date | string | null | undefined;
  private readonly now: () => Date;

  constructor(entity: string, options: JSONStorageAdapterOptions<T> = {}) {
    this.entity = entity;
    this.dir = this.resolveDirectory(options.baseDir);
    this.ttlMs = this.resolveTtl(options.ttlDays);
    this.resolveTimestamp = options.resolveTimestamp ?? this.defaultTimestampResolver;
    this.now = options.now ?? (() => new Date());
    this.connect();
  }

  public get path(): string {
    return path.join(this.dir, `${this.entity}.db.json`);
  }

  private connect(): void {
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }

    if (!fs.existsSync(this.path)) {
      fs.writeFileSync(this.path, JSON.stringify([]), 'utf-8');
    }

    this.cleanExpiredRecords();
  }

  private read(): T[] {
    const data = fs.readFileSync(this.path, 'utf-8');
    return JSON.parse(data);
  }

  private write(data: T[]): void {
    fs.writeFileSync(this.path, JSON.stringify(data, null, 2), 'utf-8');
  }

  public exists(id: ID): boolean {
    const db = this.read();
    return db.some((item: any) => item.id === id);
  }

  public findById(id: ID): T | null {
    const db = this.read();
    const record = db.find((item: any) => item.id === id) as any;

    if (record) {
      Object.keys(record).forEach((key) => {
        if (['date', 'createdAt'].includes(key) && typeof record[key] === 'string') {
          record[key] = new Date(record[key]);
        }
      });
    }

    return record ?? null;
  }

  public create(data: T): T {
    if (this.exists(data.id)) {
      throw new Error(`Record with ID ${data.id} already exists.`);
    }

    const db = this.read();
    this.write([data, ...db]);
    return this.findById(data.id) as T;
  }

  public update(id: ID, data: Partial<T>): T | null {
    if (!this.exists(id)) throw new Error(`Record with ID ${id} does not exist.`);

    const db = this.read();
    const index = db.findIndex((item: any) => item.id === id);

    const record = { ...db[index], ...data };
    db[index] = record;
    this.write(db);
    return this.findById(id) as T;
  }

  public upsert(id: ID, data: Partial<T>): T {
    if (this.exists(id)) {
      return this.update(id, data)!;
    } else {
      return this.create({ ...data, id } as T);
    }
  }

  public delete(id: ID): T | null {
    if (!this.exists(id)) throw new Error(`Record with ID ${id} does not exist.`);

    const db = this.read();
    const index = db.findIndex((item: any) => item.id === id);
    const record = this.findById(id);
    db.splice(index, 1);
    this.write(db);
    return record;
  }

  private cleanExpiredRecords(): void {
    const ttlMs = this.ttlMs;
    if (!ttlMs) return;

    const db = this.read();
    const now = this.currentTime();
    const filtered = db.filter((record) => {
      const timestamp = this.resolveRecordTimestamp(record);
      if (timestamp === null) return true;
      return now - timestamp <= ttlMs;
    });

    if (filtered.length !== db.length) {
      this.write(filtered);
    }
  }

  private resolveRecordTimestamp(record: Partial<T>): number | null {
    const value = this.resolveTimestamp(record);
    if (!value) return null;

    const date = value instanceof Date ? value : new Date(value);
    const time = date.getTime();
    return Number.isNaN(time) ? null : time;
  }

  private resolveDirectory(baseDir?: string): string {
    return baseDir ? path.resolve(baseDir) : path.resolve(process.cwd(), 'db');
  }

  private resolveTtl(ttlDays?: number): number | undefined {
    if (!ttlDays) return undefined;
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return ttlDays * millisecondsPerDay;
  }

  private defaultTimestampResolver(record: Partial<T>): Date | string | null | undefined {
    const candidate = (record as Record<string, unknown>)?.createdAt ?? (record as Record<string, unknown>)?.date;
    return candidate as Date | string | null | undefined;
  }

  private currentTime(): number {
    return this.now().getTime();
  }

}
