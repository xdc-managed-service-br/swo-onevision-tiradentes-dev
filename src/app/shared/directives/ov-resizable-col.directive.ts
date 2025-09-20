import { Directive, ElementRef, HostListener, Input, OnInit, Renderer2 } from '@angular/core';

@Directive({
  selector: '[ovResizableCol]',
  standalone: true,
})
export class OvResizableColDirective implements OnInit {
  @Input() tableId!: string;           // ex.: 'ec2Table'
  @Input() columnKey!: string;         // ex.: 'instanceId'
  @Input() min = 90;                   // px
  @Input() max = 700;                  // px

  private startX = 0;
  private startWidth = 0;
  private resizing = false;
  private handle!: HTMLElement;

  constructor(private el: ElementRef<HTMLElement>, private r: Renderer2) {}

  ngOnInit() {
    const th = this.el.nativeElement;
    th.style.position = th.style.position || 'relative';
    const restored = this.restoreWidth();
    th.style.width = restored ?? (th.offsetWidth ? `${th.offsetWidth}px` : '');

    this.handle = this.r.createElement('span');
    this.r.addClass(this.handle, 'ov-col-resizer');
    this.r.setStyle(this.handle, 'position', 'absolute');
    this.r.setStyle(this.handle, 'top', '0');
    this.r.setStyle(this.handle, 'right', '-4px');
    this.r.setStyle(this.handle, 'height', '100%');
    this.r.setStyle(this.handle, 'width', '8px');
    this.r.setStyle(this.handle, 'cursor', 'col-resize');
    this.r.setStyle(this.handle, 'user-select', 'none');
    this.r.setStyle(this.handle, 'touch-action', 'none');
    this.r.setStyle(this.handle, 'background', 'transparent');
    this.r.appendChild(th, this.handle);
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(e: MouseEvent) {
    if (e.target !== this.handle) return;
    e.preventDefault();
    this.beginResize(e.clientX);
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (!this.resizing) return;
    this.updateWidth(e.clientX);
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    if (!this.resizing) return;
    this.resizing = false;
    this.persistWidth();
  }

  // Touch
  @HostListener('touchstart', ['$event'])
  onTouchStart(ev: TouchEvent) {
    if (ev.target !== this.handle) return;
    this.beginResize(ev.touches[0].clientX);
  }
  @HostListener('document:touchmove', ['$event'])
  onTouchMove(ev: TouchEvent) {
    if (!this.resizing) return;
    this.updateWidth(ev.touches[0].clientX);
  }
  @HostListener('document:touchend') onTouchEnd() { this.onMouseUp(); }

  private beginResize(clientX: number) {
    const th = this.el.nativeElement;
    this.resizing = true;
    this.startX = clientX;
    this.startWidth = th.getBoundingClientRect().width;
    document.body.style.userSelect = 'none';
  }

  private updateWidth(clientX: number) {
    const delta = clientX - this.startX;
    let newW = Math.max(this.min, Math.min(this.max, Math.round(this.startWidth + delta)));
    const th = this.el.nativeElement;
    th.style.width = newW + 'px';

    const table = th.closest('table');
    if (!table) return;
    const colIndex = Array.from(th.parentElement!.children).indexOf(th) + 1;
    table.querySelectorAll(`tbody tr > :nth-child(${colIndex}), tfoot tr > :nth-child(${colIndex})`)
      .forEach((cell: Element) => (cell as HTMLElement).style.width = newW + 'px');
  }

  private persistWidth() {
    document.body.style.userSelect = '';
    const th = this.el.nativeElement;
    try { localStorage.setItem(this.storageKey(), th.style.width || ''); } catch {}
  }

  private restoreWidth(): string | null {
    try { return localStorage.getItem(this.storageKey()); } catch { return null; }
  }

  private storageKey() {
    return `ov-colw:${this.tableId}:${this.columnKey}`;
  }
}
