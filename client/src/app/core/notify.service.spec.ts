import { OverlayContainer } from '@angular/cdk/overlay';
import { TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { NotifyService } from './notify.service';

describe('NotifyService.prompt', () => {
  let notify: NotifyService;
  let overlay: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    notify = TestBed.inject(NotifyService);
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
  });

  const q = (id: string) => overlay.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`);

  it('stays open (no auto-dismiss) and emits when the action is clicked', fakeAsync(() => {
    let acted = 0;
    notify.prompt('Always categorize COFFEE as Food? (3 matching)', 'Create rule').subscribe(() => acted++);
    tick(60_000); // far beyond the old 10s timeout
    expect(q('prompt-message')?.textContent).toContain('Always categorize COFFEE');
    expect(q('prompt-dismiss')?.textContent).toContain('Not now');
    q('prompt-action')!.click();
    flush();
    expect(acted).toBe(1);
  }));

  it('"Not now" and × close it without emitting', fakeAsync(() => {
    let acted = 0;
    let completed = 0;
    notify.prompt('Q?', 'Yes').subscribe({ next: () => acted++, complete: () => completed++ });
    tick(1);
    q('prompt-dismiss')!.click();
    flush();
    expect(acted).toBe(0);
    expect(completed).toBe(1);

    notify.prompt('Q2?', 'Yes').subscribe({ next: () => acted++ });
    tick(1);
    q('prompt-close')!.click();
    flush();
    expect(acted).toBe(0);
  }));
});
