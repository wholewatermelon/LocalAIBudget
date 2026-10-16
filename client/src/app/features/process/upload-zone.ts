import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

export const ACCEPTED_EXTENSIONS = ['.pdf', '.csv', '.ofx', '.qfx', '.txt'];
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export interface FileSelection {
  accepted: File[];
  rejected: { name: string; reason: string }[];
}

/** Client-side pre-check mirroring the server (extension + 20MB). The server remains the authority. */
export function partitionFiles(files: File[], accepted = ACCEPTED_EXTENSIONS): FileSelection {
  const result: FileSelection = { accepted: [], rejected: [] };
  for (const f of files) {
    const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
    if (!accepted.includes(ext)) result.rejected.push({ name: f.name, reason: 'unsupported type' });
    else if (f.size > MAX_FILE_BYTES) result.rejected.push({ name: f.name, reason: 'larger than 20MB' });
    else result.accepted.push(f);
  }
  return result;
}

@Component({
  selector: 'app-upload-zone',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <div
      class="zone"
      [class.over]="dragOver()"
      (dragover)="onDragOver($event)"
      (dragleave)="dragOver.set(false)"
      (drop)="onDrop($event)"
      data-testid="drop-zone"
    >
      <mat-icon class="big">cloud_upload</mat-icon>
      <p>Drag &amp; drop statements here ({{ acceptLabel }}), or</p>
      <button mat-stroked-button type="button" (click)="picker.click()" [disabled]="uploading()">
        Choose files
      </button>
      <input
        #picker
        type="file"
        hidden
        multiple
        [accept]="acceptAttr"
        (change)="onPick(picker)"
      />
      <p class="hint">Files are stored under data/statements/{{ month() ?? 'YYYY-MM' }}/ · max 20MB each</p>
      @if (uploading()) {
        <mat-progress-bar mode="indeterminate" />
      }
    </div>
  `,
  styles: `
    .zone {
      border: 2px dashed var(--mat-sys-outline-variant);
      border-radius: 16px;
      padding: 24px 16px;
      text-align: center;
      transition: background 150ms, border-color 150ms;
    }
    .zone.over {
      border-color: var(--mat-sys-primary);
      background: var(--mat-sys-primary-container);
    }
    .big {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: var(--mat-sys-primary);
    }
    .hint {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class UploadZone {
  readonly month = input<string | null>(null);
  readonly uploading = input(false);
  readonly accept = input<string[]>(ACCEPTED_EXTENSIONS);
  readonly filesSelected = output<File[]>();

  protected readonly dragOver = signal(false);

  protected get acceptAttr(): string {
    return this.accept().join(',');
  }
  protected get acceptLabel(): string {
    return this.accept().map((e) => e.slice(1).toUpperCase()).join(', ');
  }

  protected onDragOver(e: DragEvent): void {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    this.dragOver.set(true);
  }

  protected onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragOver.set(false);
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length && !this.uploading()) this.filesSelected.emit(files);
  }

  protected onPick(el: HTMLInputElement): void {
    const files = Array.from(el.files ?? []);
    el.value = ''; // allow re-selecting the same file
    if (files.length) this.filesSelected.emit(files);
  }
}
