import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { JSONStorageAdapter } from './json-storage.adapter';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Job } from '../shared/types/job.type';
import { JobStatus } from '../shared/enums/job-status.enum';

describe('StorageAdapter', () => {

  let storageAdapter: JSONStorageAdapter<Job, string>;
  let tempDir: string;

  const job: Job = {
    id: '1',
    title: 'Test Job',
    location: 'Test Location',
    description: 'Test Description',
    highSkillsMatch: false,
    isClosed: false,
    status: JobStatus.pending,
    createdAt: new Date(),
  };

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'json-storage-'));
    storageAdapter = new JSONStorageAdapter<Job, string>(`test-${Date.now()}`, { baseDir: tempDir });
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
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

  test('Should clean records older than configured TTL during initialization', () => {
    const entity = `cleanup-${Date.now()}`;
    const filePath = path.join(tempDir, `${entity}.db.json`);
    const now = new Date('2024-02-01T00:00:00.000Z');
    const staleRecord: Job = {
      ...job,
      id: 'stale',
      createdAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
    };
    const recentRecord: Job = {
      ...job,
      id: 'fresh',
      createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
    };

    fs.writeFileSync(filePath, JSON.stringify([staleRecord, recentRecord], null, 2));

    const cleanupAdapter = new JSONStorageAdapter<Job, string>(entity, {
      baseDir: tempDir,
      ttlDays: 30,
      now: () => now,
    });

    const data = JSON.parse(fs.readFileSync(cleanupAdapter.path, 'utf-8')) as Job[];
    expect(data).toHaveLength(1);
    expect(data[0]?.id).toBe(recentRecord.id);
    expect(cleanupAdapter.findById(staleRecord.id)).toBeNull();
  });

  test('Should ignore TTL cleanup when record timestamp is missing', () => {
    type MinimalRecord = { id: string; value: string };

    const entity = `cleanup-missing-${Date.now()}`;
    const filePath = path.join(tempDir, `${entity}.db.json`);
    const record: MinimalRecord = { id: 'no-date', value: 'test' };

    fs.writeFileSync(filePath, JSON.stringify([record], null, 2));

    const cleanupAdapter = new JSONStorageAdapter<MinimalRecord, string>(entity, {
      baseDir: tempDir,
      ttlDays: 30,
    });

    const data = JSON.parse(fs.readFileSync(cleanupAdapter.path, 'utf-8')) as MinimalRecord[];
    expect(data).toHaveLength(1);
    expect(cleanupAdapter.findById(record.id)?.id).toBe(record.id);
  });

});
