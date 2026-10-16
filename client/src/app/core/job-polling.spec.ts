import { fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { Observable, Subject, of } from 'rxjs';
import { isActive, isTerminal, jobProgress, pollJob } from './job-polling';
import { makeJob } from '../../testing/fixtures';
import { Job, JobStatus } from './models';

describe('pollJob', () => {
  function scripted(statuses: JobStatus[]) {
    let call = 0;
    const fetch = jasmine.createSpy('fetch').and.callFake((id: number): Observable<Job> => {
      const status = statuses[Math.min(call, statuses.length - 1)];
      call++;
      return of(makeJob({ id, status, processed: call }));
    });
    return fetch;
  }

  it('polls immediately, then every 1s, and stops after completed', fakeAsync(() => {
    const fetch = scripted(['queued', 'running', 'running', 'completed', 'running']);
    const seen: JobStatus[] = [];
    let done = false;
    pollJob(fetch, 5).subscribe({ next: (j) => seen.push(j.status), complete: () => (done = true) });

    tick(0); // timer(0, …) fires on the next macrotask
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(5);
    tick(1000);
    expect(fetch).toHaveBeenCalledTimes(2);
    tick(2000);
    expect(seen).toEqual(['queued', 'running', 'running', 'completed']);
    expect(done).toBeTrue();
    tick(5000);
    expect(fetch).toHaveBeenCalledTimes(4); // no polling after terminal state
  }));

  it('stops after failed', fakeAsync(() => {
    const fetch = scripted(['running', 'failed']);
    let done = false;
    let last: Job | undefined;
    pollJob(fetch, 1).subscribe({ next: (j) => (last = j), complete: () => (done = true) });
    tick(1000);
    expect(last?.status).toBe('failed');
    expect(done).toBeTrue();
    tick(3000);
    expect(fetch).toHaveBeenCalledTimes(2);
  }));

  it('stops polling when unsubscribed (component destroyed)', fakeAsync(() => {
    const fetch = scripted(['running']);
    const sub = pollJob(fetch, 1).subscribe();
    tick(2000);
    expect(fetch).toHaveBeenCalledTimes(3);
    sub.unsubscribe();
    tick(5000);
    expect(fetch).toHaveBeenCalledTimes(3);
  }));

  it('does not stack requests while one is in flight (exhaustMap)', fakeAsync(() => {
    const pending = new Subject<Job>();
    const fetch = jasmine.createSpy('fetch').and.returnValue(pending);
    const sub = pollJob(fetch, 1).subscribe();
    tick(5000);
    expect(fetch).toHaveBeenCalledTimes(1);
    sub.unsubscribe();
    discardPeriodicTasks();
  }));
});

describe('job helpers', () => {
  it('classifies statuses', () => {
    expect(isTerminal('completed')).toBeTrue();
    expect(isTerminal('failed')).toBeTrue();
    expect(isTerminal('running')).toBeFalse();
    expect(isActive('queued')).toBeTrue();
    expect(isActive('completed')).toBeFalse();
  });

  it('computes progress', () => {
    expect(jobProgress({ status: 'running', total: 0, processed: 0 })).toBeNull();
    expect(jobProgress({ status: 'running', total: 4, processed: 1 })).toBe(25);
    expect(jobProgress({ status: 'completed', total: 0, processed: 0 })).toBe(100);
  });

  it('is indeterminate while queued or when a running job has reached/exceeded its total', () => {
    expect(jobProgress({ status: 'queued', total: 10, processed: 0 })).toBeNull();
    expect(jobProgress({ status: 'running', total: 4, processed: 4 })).toBeNull();
    expect(jobProgress({ status: 'running', total: 4, processed: 9 })).toBeNull();
    expect(jobProgress({ status: 'running', total: 4, processed: 3 })).toBe(75);
  });
});
