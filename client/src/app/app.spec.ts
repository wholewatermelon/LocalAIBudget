import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { monthServiceStub } from '../testing/month-service.stub';
import { App } from './app';
import { HealthApi } from './core/api/health.api';

describe('App shell', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        monthServiceStub('2024-01'),
        { provide: HealthApi, useValue: { get: () => of({ db: 'ok', ollama: 'ok', model: 'gemma4', modelAvailable: true }) } },
      ],
    });
  });

  it('renders title, nav, month picker and health indicator', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('LocalAI Budget');
    const nav = Array.from(el.querySelectorAll('mat-nav-list a')).map((a) => a.textContent?.trim());
    expect(nav.join('|')).toContain('Dashboard');
    expect(nav.join('|')).toContain('Process');
    expect(nav.join('|')).toContain('Transactions');
    expect(nav.join('|')).toContain('Categories');
    expect(el.querySelector('app-month-picker')).not.toBeNull();
    expect(el.querySelector('app-health-indicator')).not.toBeNull();
    fixture.destroy();
  });
});
