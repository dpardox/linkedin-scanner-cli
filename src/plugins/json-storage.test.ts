import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { JSONStoragePlugin } from './json-storage.plugin';
import fs from 'fs';
import { Job } from '../shared/types/job.type';

describe('StoragePlugin', () => {

  let storagePlugin: JSONStoragePlugin<Job, string>;

  const job: Job = {
    id: '1',
    title: 'Test Job',
    location: 'Test Location',
    description: 'Test Description',
    highSkillsMatch: false,
    isClosed: false,
    status: 'new',
    createdAt: new Date(),
  };

  beforeAll(() => {
    storagePlugin = new JSONStoragePlugin<Job, string>(`test-${Date.now()}`);
  });

  afterAll(() => {
    fs.rmSync(storagePlugin.path);
  });

  test('should be a db file', () => {
    const exists = fs.existsSync(storagePlugin.path);
    expect(exists).toBeTruthy();
  });

  test('Should create a first job entry', () => {
    storagePlugin.create(job);

    const data = fs.readFileSync(storagePlugin.path, 'utf-8');
    const record = JSON.parse(data).at(-1);
    expect({ ...record, createdAt: new Date(record.createdAt) }).toEqual(job);
  });

  test('Should throw an error when creating a job entry with the same ID', () => {
    expect(() => {
      storagePlugin.create(job);
    }).toThrow(`Record with ID ${job.id} already exists.`);
  });

  test('Should get a job entry by ID', () => {
    const record = storagePlugin.findById(job.id);
    expect(record).toEqual(job);
  });

  test('Should return null when job entry does not exist', () => {
    const record = storagePlugin.findById('non-existing-id');
    expect(record).toBeNull();
  });

  test('Should update a job entry', () => {
    job.title = 'Updated Job';
    storagePlugin.update(job.id, job);

    const record = storagePlugin.findById(job.id);
    expect(record).toEqual(job);
  });

  test('Should throw an error when updating a non-existing job entry', () => {
    expect(() => {
      storagePlugin.update('non-existing-id', job);
    }).toThrow(`Record with ID non-existing-id does not exist.`);
  });

  test('Should upsert a job entry', () => {
    job.title = 'Upserted Job';
    storagePlugin.upsert(job.id, job);

    const record = storagePlugin.findById(job.id);
    expect(record).toEqual(job);
  });

  test('Should create a job entry if it does not exist during upsert', () => {
    const newJob = { ...job, id: '3', title: 'New Job' };
    storagePlugin.upsert(newJob.id, newJob);

    const record = storagePlugin.findById(newJob.id);
    expect(record).toEqual(newJob);
  });

  test('Should delete a job entry', () => {
    const deletedJob = storagePlugin.delete(job.id);
    expect(deletedJob).toEqual(job);

    const record = storagePlugin.findById(job.id);
    expect(record).toBeNull();
  });

  test('Should throw an error when deleting a non-existing job entry', () => {
    expect(() => {
      storagePlugin.delete('non-existing-id');
    }).toThrow(`Record with ID non-existing-id does not exist.`);
  });

});
