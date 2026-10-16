import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HealthApi } from '../core/api/health.api';
import { Health } from '../core/models';
import { HEALTH_POLL_MS, HealthIndicator, healthLevel } from './health-indicator';

describe('healthLevel', () => {
  const h = (over: Partial<Health>): Health => ({ db: 'ok', ollama: 'ok', model: 'gemma4', modelAvailable: true, ...over });
  it('classifies', () => {
    expect(healthLevel(undefined)).toBe('unknown');
    expect(healthLevel(null)).toBe('down');
    expect(healthLevel(h({ db: 'error' }))).toBe('down');
    expect(healthLevel(h({ ollama: 'error' }))).toBe('degraded');
    expect(healthLevel(h({ modelAvailable: false }))).toBe('degraded');
    expect(healthLevel(h({}))).toBe('ok');
  });
});

describe('HealthIndicator', () => {
  let fixture: ComponentFixture<HealthIndicator>;
  let api: jasmine.SpyObj<HealthApi>;

  beforeEach(() => {
    api = jasmine.createSpyObj<HealthApi>('HealthApi', ['get']);
    TestBed.configureTestingModule({ imports: [HealthIndicator], providers: [{ provide: HealthApi, useValue: api }] });
  });

  it('polls every 30s and survives errors', fakeAsync(() => {
    api.get.and.returnValues(
      of({ db: 'ok', ollama: 'ok', model: 'gemma4', modelAvailable: true } as Health),
      throwError(() => new Error('down')),
    );
    fixture = TestBed.createComponent(HealthIndicator);
    fixture.detectChanges();
    tick(0);
    fixture.detectChanges();
    const dot = () => fixture.nativeElement.querySelector('.dot') as HTMLElement;
    expect(dot().classList).toContain('ok');
    tick(HEALTH_POLL_MS);
    fixture.detectChanges();
    expect(dot().classList).toContain('down');
    expect(api.get).toHaveBeenCalledTimes(2);
    fixture.destroy();
    discardPeriodicTasks();
  }));
});
