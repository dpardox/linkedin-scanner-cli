import { StoragePort } from '@ports/storage.port';
import fs from 'fs';
import path from 'path';

export class JSONStorageAdapter<T extends { id: ID }, ID = string> implements StoragePort<T, ID> {

  private readonly dir = path.resolve(process.cwd(), 'db');
  private readonly entity: string;

  constructor(entity: string) {
    this.entity = entity;
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

}
