import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { JSONStorageAdapter } from './json-storage.adapter';
import fs from 'fs';
import { Job } from '../shared/types/job.type';

describe('StorageAdapter', () => {

  let storageAdapter: JSONStorageAdapter<Job, string>;

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
    storageAdapter = new JSONStorageAdapter<Job, string>(`test-${Date.now()}`);
  });

  afterAll(() => {
    fs.rmSync(storageAdapter.path);
  });

  test('should be a db file', () => {
    const exists = fs.existsSync(storageAdapter.path);
    expect(exists).toBeTruthy();
  });

  test('Should create a first job entry', () => {
    storageAdapter.create(job);

    const data = fs.readFileSync(storageAdapter.path, 'utf-8');
    const record = JSON.parse(data).at(-1);
    expect({ ...record, createdAt: new Date(record.createdAt) }).toEqual(job);
  });

  test('Should throw an error when creating a job entry with the same ID', () => {
    expect(() => {
      storageAdapter.create(job);
    }).toThrow(`Record with ID ${job.id} already exists.`);
  });

  test('Should get a job entry by ID', () => {
    const record = storageAdapter.findById(job.id);
    expect(record).toEqual(job);
  });

  test('Should return null when job entry does not exist', () => {
    const record = storageAdapter.findById('non-existing-id');
    expect(record).toBeNull();
  });

  test('Should update a job entry', () => {
    job.title = 'Updated Job';
    storageAdapter.update(job.id, job);

    const record = storageAdapter.findById(job.id);
    expect(record).toEqual(job);
  });

  test('Should throw an error when updating a non-existing job entry', () => {
    expect(() => {
      storageAdapter.update('non-existing-id', job);
    }).toThrow(`Record with ID non-existing-id does not exist.`);
  });

  test('Should upsert a job entry', () => {
    job.title = 'Upserted Job';
    storageAdapter.upsert(job.id, job);

    const record = storageAdapter.findById(job.id);
    expect(record).toEqual(job);
  });

  test('Should create a job entry if it does not exist during upsert', () => {
    const newJob = { ...job, id: '3', title: 'New Job' };
    storageAdapter.upsert(newJob.id, newJob);

    const record = storageAdapter.findById(newJob.id);
    expect(record).toEqual(newJob);
  });

  test('Should delete a job entry', () => {
    const deletedJob = storageAdapter.delete(job.id);
    expect(deletedJob).toEqual(job);

    const record = storageAdapter.findById(job.id);
    expect(record).toBeNull();
  });

  test('Should throw an error when deleting a non-existing job entry', () => {
    expect(() => {
      storageAdapter.delete('non-existing-id');
    }).toThrow(`Record with ID non-existing-id does not exist.`);
  });

});
