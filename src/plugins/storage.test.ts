import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { StoragePlugin } from './storage.plugin';
import fs from 'fs';
import { Job } from '../shared/types/job.type';

describe('StoragePlugin', () => {

  let storagePlugin: StoragePlugin<Job, string>;

  const job: Job = {
    id: '1',
    title: 'Test Job',
    location: 'Test Location',
    description: 'Test Description',
    url: 'http://test.com/job/1',
    date: new Date(),
    status: 'new',
  };

  beforeAll(() => {
    storagePlugin = new StoragePlugin<Job, string>(`test-${Date.now()}`);
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
    expect({ ...record, date: new Date(record.date) }).toEqual(job);
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
