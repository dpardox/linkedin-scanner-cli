export interface Storage<T = unknown, ID = string> {
  exists: (id: ID) => boolean;
  findById: (id: ID) => T | null;
  create(data: T) : T;
  update: (id: ID, data: Partial<T>) => T | null;
  upsert: (id: ID, data: Partial<T>) => T;
  delete: (id: ID) => T | null;
}
