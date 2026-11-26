import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Skeleton } from 'primeng/skeleton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertCircle } from '@ng-icons/tabler-icons';
import type { ClassicEditor, Editor, EditorConfig, FileLoader, UploadAdapter } from 'ckeditor5';
import { OpenprojectService } from '../../../core/services/openproject.service';
import { LanguageService } from '../../../core/services/language.service';
import { UploadedAttachment, WorkPackageOptionItem } from '../../../core/interfaces/openproject.interface';

const STYLESHEET_ATTRIBUTE = 'data-ckeditor5-styles';

/** Matches attachment URLs inside markdown image syntax `![alt](url)` and HTML `src="url"`. */
const MARKDOWN_IMAGE_URL = /(!\[[^\]]*\]\()([^)\s]+)/g;
const HTML_IMAGE_URL = /(\ssrc=["'])([^"']+)/gi;

/**
 * Rich text editor based on CKEditor 5 with the GFM Markdown data processor, the same
 * approach used by OpenProject (`opf/commonmark-ckeditor-build`): the user edits visually
 * and the value is kept as CommonMark/GFM. Pasted, dropped or picked images are uploaded as
 * attachments of `workPackageId` and referenced with their OpenProject URL.
 */
@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  imports: [Skeleton, NgIcon],
  viewProviders: [provideIcons({ tablerAlertCircle })],
  template: `
    @if (!isReady() && !loadError()) {
      <p-skeleton width="100%" [height]="compact() ? '6rem' : '12rem'" />
    }
    @if (loadError()) {
      <div class="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
        <ng-icon name="tablerAlertCircle" size="1rem" class="shrink-0" />
        <span>{{ loadError() }}</span>
      </div>
    }
    <div
      class="app-rich-text-editor"
      [class.app-rich-text-editor--compact]="compact()"
      [class.hidden]="!isReady()"
    >
      <div #editorHost></div>
    </div>
    @if (uploadError()) {
      <p role="alert" class="mt-1 flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400">
        <ng-icon name="tablerAlertCircle" size="0.85rem" class="shrink-0" />
        <span class="truncate">{{ uploadError() }}</span>
      </p>
    }
  `,
  host: { class: 'block min-w-0' },
})
export class RichTextEditorComponent {
  private readonly openprojectService = inject(OpenprojectService);
  private readonly languageService = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly editorHost = viewChild.required<ElementRef<HTMLElement>>('editorHost');

  /** Markdown value (CommonMark/GFM), same format as OpenProject `raw` fields. */
  readonly value = model<string>('');
  readonly workPackageId = input<string | number | null>(null);
  readonly placeholder = input<string>('');
  readonly compact = input<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly autofocus = input<boolean>(false);
  /** Users/groups offered when typing `@` (stored as OpenProject `<mention>` tags). */
  readonly mentionUsers = input<WorkPackageOptionItem[]>([]);

  /** Emitted on Ctrl/Cmd + Enter. */
  readonly submitShortcut = output<void>();
  /** Emitted on Escape. */
  readonly cancelShortcut = output<void>();
  /** Emitted after a file was uploaded as a work package attachment. */
  readonly attachmentUploaded = output<UploadedAttachment>();

  readonly isReady = signal<boolean>(false);
  readonly loadError = signal<string | null>(null);
  readonly uploadError = signal<string | null>(null);

  private editor: ClassicEditor | null = null;
  private lastEmittedValue: string | null = null;
  private isDestroyed = false;
  /** Local object URL -> original OpenProject href, used to restore URLs when reading markdown. */
  private readonly objectUrlToHref = new Map<string, string>();

  constructor() {
    afterNextRender(() => {
      void this.createEditor();
    });

    effect(() => {
      const value = this.value();
      if (!this.editor || value === this.lastEmittedValue) return;
      untracked(() => void this.applyExternalValue(value));
    });

    effect(() => {
      const disabled = this.disabled();
      const editor = this.editor;
      if (!editor || !this.isReady()) return;
      if (disabled) {
        editor.enableReadOnlyMode('app-rich-text-editor');
      } else {
        editor.disableReadOnlyMode('app-rich-text-editor');
      }
    });

    this.destroyRef.onDestroy(() => {
      this.isDestroyed = true;
      void this.editor?.destroy();
      this.editor = null;
    });
  }

  /** Reads the current markdown straight from the editor (useful right before saving). */
  getMarkdown(): string {
    if (!this.editor) return this.value();
    return this.toOpenProjectMarkdown(this.editor.getData());
  }

  private async createEditor(): Promise<void> {
    ensureStylesheet();
    try {
      const ckeditor = await import('ckeditor5');
      const language = this.languageService.currentLang() === 'es' ? 'es' : 'en';
      const translations = language === 'es' ? [(await import('ckeditor5/translations/es.js')).default] : [];
      const initialData = await this.toEditorMarkdown(this.value());
      if (this.isDestroyed) return;

      const {
        ClassicEditor,
        Essentials,
        Autoformat,
        Paragraph,
        Heading,
        Bold,
        Italic,
        Strikethrough,
        Code,
        BlockQuote,
        List,
        TodoList,
        Link,
        AutoLink,
        Image,
        ImageToolbar,
        ImageTextAlternative,
        ImageUpload,
        Table,
        TableToolbar,
        CodeBlock,
        HorizontalLine,
        Markdown,
        PasteFromMarkdownExperimental,
        SourceEditing,
        Mention,
      } = ckeditor;

      const canUpload = !!this.workPackageId();
      const component = this;
      const fullToolbar = [
        'heading',
        '|',
        'bold',
        'italic',
        'strikethrough',
        'code',
        '|',
        'bulletedList',
        'numberedList',
        'todoList',
        '|',
        'blockQuote',
        'codeBlock',
        'insertTable',
        'horizontalLine',
        '|',
        'link',
        ...(canUpload ? ['uploadImage'] : []),
        '|',
        'sourceEditing',
        '|',
        'undo',
        'redo',
      ];
      const compactToolbar = [
        'bold',
        'italic',
        'code',
        '|',
        'bulletedList',
        'numberedList',
        '|',
        'link',
        ...(canUpload ? ['uploadImage'] : []),
        'codeBlock',
      ];

      const config: EditorConfig = {
        licenseKey: 'GPL',
        language,
        translations,
        placeholder: this.placeholder(),
        plugins: [
          Essentials,
          Autoformat,
          Paragraph,
          Heading,
          Bold,
          Italic,
          Strikethrough,
          Code,
          BlockQuote,
          List,
          TodoList,
          Link,
          AutoLink,
          Image,
          ImageToolbar,
          ImageTextAlternative,
          Table,
          TableToolbar,
          CodeBlock,
          HorizontalLine,
          Markdown,
          PasteFromMarkdownExperimental,
          SourceEditing,
          Mention,
          ...(canUpload ? [ImageUpload] : []),
        ],
        extraPlugins: [
          OpenProjectMentionPlugin,
          ...(canUpload
            ? [
                function OpenProjectUploadAdapterPlugin(editor: Editor): void {
                  editor.plugins.get('FileRepository').createUploadAdapter = (loader: FileLoader) =>
                    new OpenProjectUploadAdapter(loader, component);
                },
              ]
            : []),
        ],
        mention: {
          dropdownLimit: 8,
          feeds: [
            {
              marker: '@',
              minimumCharacters: 0,
              feed: (query: string) => this.findMentionUsers(query),
            },
          ],
        },
        toolbar: {
          items: this.compact() ? compactToolbar : fullToolbar,
          shouldNotGroupWhenFull: false,
        },
        heading: {
          options: [
            { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
            { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
            { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
            { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' },
            { model: 'heading4', view: 'h4', title: 'Heading 4', class: 'ck-heading_heading4' },
          ],
        },
        image: {
          toolbar: ['imageTextAlternative'],
        },
        table: {
          contentToolbar: ['tableColumn', 'tableRow'],
        },
        link: {
          defaultProtocol: 'https://',
          addTargetToExternalLinks: true,
        },
        codeBlock: {
          languages: [
            { language: 'plaintext', label: 'Plain text' },
            { language: 'typescript', label: 'TypeScript' },
            { language: 'javascript', label: 'JavaScript' },
            { language: 'java', label: 'Java' },
            { language: 'sql', label: 'SQL' },
            { language: 'json', label: 'JSON' },
            { language: 'xml', label: 'XML' },
            { language: 'html', label: 'HTML' },
            { language: 'css', label: 'CSS' },
            { language: 'bash', label: 'Bash' },
            { language: 'rust', label: 'Rust' },
            { language: 'python', label: 'Python' },
          ],
        },
        initialData,
      };

      const editor = await ClassicEditor.create(this.editorHost().nativeElement, config);
      if (this.isDestroyed) {
        await editor.destroy();
        return;
      }
      this.editor = editor;
      this.lastEmittedValue = this.value();

      editor.model.document.on('change:data', () => {
        const markdown = this.toOpenProjectMarkdown(editor.getData());
        this.lastEmittedValue = markdown;
        this.value.set(markdown);
      });

      editor.keystrokes.set('Ctrl+Enter', (_data, cancel) => {
        this.submitShortcut.emit();
        cancel();
      });
      editor.editing.view.document.on('keydown', (_evt, data) => {
        if (data.domEvent.key === 'Escape') this.cancelShortcut.emit();
      });

      if (this.disabled()) editor.enableReadOnlyMode('app-rich-text-editor');
      this.isReady.set(true);
      if (this.autofocus()) editor.editing.view.focus();
    } catch (err) {
      console.error('CKEditor initialization failed:', err);
      this.loadError.set(err instanceof Error ? err.message : String(err));
    }
  }

  private findMentionUsers(query: string): OpenProjectMentionItem[] {
    const normalizedQuery = normalizeSearch(query);
    return this.mentionUsers()
      .filter((user) => !normalizedQuery || normalizeSearch(user.name).includes(normalizedQuery))
      .slice(0, 8)
      .map((user) => ({
        id: `@${user.name}`,
        text: `@${user.name}`,
        principalId: user.id,
        principalType: 'user',
      }));
  }

  /** Called by the upload adapter. Returns the local object URL used to display the image. */
  async uploadFile(file: File): Promise<string> {
    const ticket = this.workPackageId();
    if (!ticket) throw new Error('No work package');
    this.uploadError.set(null);

    const fileName = normalizeFileName(file);
    const namedFile = file.name === fileName ? file : new File([file], fileName, { type: file.type });
    const result = await this.openprojectService.uploadWorkPackageAttachment(String(ticket), namedFile);
    if (!result.ok || !result.attachment?.downloadUrl) {
      const message = result.error || this.languageService.t('richTextEditor.uploadFailed');
      this.uploadError.set(message);
      throw new Error(message);
    }

    const objectUrl = URL.createObjectURL(namedFile);
    this.objectUrlToHref.set(objectUrl, result.attachment.downloadUrl);
    this.openprojectService.cacheAttachmentImageUrl(result.attachment.downloadUrl, objectUrl);
    this.attachmentUploaded.emit(result.attachment);
    return objectUrl;
  }

  private async applyExternalValue(value: string): Promise<void> {
    const editor = this.editor;
    if (!editor) return;
    const data = await this.toEditorMarkdown(value);
    if (this.editor !== editor || this.value() !== value) return;
    this.lastEmittedValue = value;
    editor.setData(data);
  }

  /** Replaces authenticated OpenProject image URLs with local object URLs the webview can display. */
  private async toEditorMarkdown(markdown: string): Promise<string> {
    if (!markdown) return '';
    const hrefs = new Set<string>();
    for (const pattern of [MARKDOWN_IMAGE_URL, HTML_IMAGE_URL]) {
      for (const match of markdown.matchAll(pattern)) {
        if (this.openprojectService.isOpenProjectImageSource(match[2])) hrefs.add(match[2]);
      }
    }
    if (hrefs.size === 0) return markdown;

    const resolved = new Map<string, string>();
    await Promise.all(
      Array.from(hrefs).map(async (href) => {
        try {
          const objectUrl = await this.openprojectService.getAttachmentImageUrl(href);
          this.objectUrlToHref.set(objectUrl, href);
          resolved.set(href, objectUrl);
        } catch (err) {
          console.warn('Could not load editor image:', href, err);
        }
      })
    );

    const replaceUrl = (_full: string, prefix: string, url: string) => `${prefix}${resolved.get(url) ?? url}`;
    return markdown.replace(MARKDOWN_IMAGE_URL, replaceUrl).replace(HTML_IMAGE_URL, replaceUrl);
  }

  /** Restores the original OpenProject URLs so the saved markdown is valid on the server. */
  private toOpenProjectMarkdown(markdown: string): string {
    let result = markdown;
    for (const [objectUrl, href] of this.objectUrlToHref) {
      if (result.includes(objectUrl)) result = result.split(objectUrl).join(href);
    }
    return result;
  }
}

interface OpenProjectMentionItem {
  id: string;
  text: string;
  principalId: string;
  principalType: string;
}

/**
 * Converts CKEditor mentions to the markup OpenProject's own editor stores in markdown:
 * `<mention class="mention" data-id="5" data-type="user" data-text="@Name">@Name</mention>`.
 * The server turns it into a user link and sends the mention notification.
 */
function OpenProjectMentionPlugin(editor: Editor): void {
  const processor = editor.data.processor as { keepHtml?: (element: string) => void };
  processor.keepHtml?.('mention');

  editor.conversion.for('upcast').elementToAttribute({
    view: { name: 'mention', attributes: { 'data-id': true } },
    model: {
      key: 'mention',
      value: (viewElement: any) => {
        const text = String(viewElement.getAttribute('data-text') || '');
        return editor.plugins.get('Mention').toMentionAttribute(viewElement, {
          id: text || `@${viewElement.getAttribute('data-id')}`,
          principalId: String(viewElement.getAttribute('data-id')),
          principalType: String(viewElement.getAttribute('data-type') || 'user'),
        });
      },
    },
    converterPriority: 'high',
  });

  editor.conversion.for('downcast').attributeToElement({
    model: 'mention',
    view: (value: any, { writer }: any) => {
      if (!value?.principalId) return;
      return writer.createAttributeElement(
        'mention',
        {
          class: 'mention',
          'data-id': value.principalId,
          'data-type': value.principalType || 'user',
          'data-text': value.id,
        },
        { priority: 20, id: value.uid }
      );
    },
    converterPriority: 'high',
  });
}

function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

class OpenProjectUploadAdapter implements UploadAdapter {
  constructor(
    private readonly loader: FileLoader,
    private readonly host: RichTextEditorComponent
  ) {}

  async upload(): Promise<{ default: string }> {
    const file = await this.loader.file;
    if (!file) throw new Error('No file');
    return { default: await this.host.uploadFile(file) };
  }

  abort(): void {
    // Uploads are short-lived single requests; nothing to cancel.
  }
}

function normalizeFileName(file: File): string {
  if (file.name && file.name !== 'image.png' && file.name !== 'blob') return file.name;
  const extension = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace(/\+.*$/, '');
  return `image-${Date.now()}.${extension}`;
}

/** CKEditor styles are emitted as a non-injected bundle (see angular.json) and loaded on demand. */
function ensureStylesheet(): void {
  if (typeof document === 'undefined' || document.querySelector(`link[${STYLESHEET_ATTRIBUTE}]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'ckeditor5.css';
  link.setAttribute(STYLESHEET_ATTRIBUTE, '');
  document.head.appendChild(link);
}
