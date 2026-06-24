const MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';

let mermaidModulePromise = null;
let renderCounter = 0;

function escapeText(value) {
  return String(value ?? '');
}

function renderTemplate() {
  return `
    <style>
      :host {
        display: block;
        color: #14100c;
        font-family: ui-serif, Georgia, Cambria, "Times New Roman", serif;
      }

      .viewer {
        display: grid;
        gap: 1rem;
      }

      .header {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem 1rem;
        align-items: end;
        justify-content: space-between;
        border-bottom: 1px solid rgba(20, 16, 12, 0.18);
        padding-bottom: 0.85rem;
      }

      h2 {
        margin: 0;
        font-size: clamp(1.5rem, 1rem + 2vw, 2.7rem);
        line-height: 1.05;
        letter-spacing: 0;
      }

      .caption {
        max-width: 54rem;
        margin: 0.35rem 0 0;
        color: #5c5040;
        font-size: 0.98rem;
        line-height: 1.5;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      button,
      a.button {
        appearance: none;
        border: 1px solid rgba(20, 16, 12, 0.22);
        background: #f8f2e2;
        color: #14100c;
        border-radius: 6px;
        padding: 0.55rem 0.7rem;
        font: 600 0.78rem/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing: 0;
        text-decoration: none;
        cursor: pointer;
      }

      button:hover,
      a.button:hover {
        border-color: rgba(124, 44, 31, 0.65);
        color: #7c2c1f;
      }

      .status {
        min-height: 1.2rem;
        color: #5c5040;
        font: 0.78rem/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }

      .canvas {
        overflow: auto;
        border: 1px solid rgba(20, 16, 12, 0.16);
        border-radius: 8px;
        background: #fffdf7;
        padding: clamp(0.75rem, 2vw, 1.4rem);
      }

      .canvas svg {
        display: block;
        max-width: 100%;
        height: auto;
        margin: 0 auto;
      }

      details {
        border: 1px solid rgba(20, 16, 12, 0.16);
        border-radius: 8px;
        background: #f8f2e2;
      }

      summary {
        cursor: pointer;
        padding: 0.75rem 0.9rem;
        font: 600 0.82rem/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }

      pre {
        margin: 0;
        overflow: auto;
        border-top: 1px solid rgba(20, 16, 12, 0.14);
        padding: 1rem;
        color: #2c241b;
        background: #fbf6e8;
        font: 0.82rem/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        white-space: pre;
      }

      .error {
        border-color: rgba(220, 38, 38, 0.45);
        color: #7f1d1d;
        background: #fee2e2;
      }
    </style>
    <section class="viewer">
      <header class="header">
        <div>
          <h2></h2>
          <p class="caption"></p>
        </div>
        <div class="actions">
          <a class="button source-link" hidden>Open .mmd</a>
          <button class="copy" type="button">Copy source</button>
          <button class="download" type="button">Download SVG</button>
        </div>
      </header>
      <div class="status" role="status">Loading Mermaid source...</div>
      <div class="canvas" aria-label="Rendered Mermaid diagram"></div>
      <details>
        <summary>Mermaid source</summary>
        <pre></pre>
      </details>
    </section>
  `;
}

async function loadMermaid() {
  if (window.mermaid) return window.mermaid;
  if (!mermaidModulePromise) mermaidModulePromise = import(MERMAID_CDN);
  const module = await mermaidModulePromise;
  return module.default || module.mermaid || module;
}

function embeddedSourceFor(element) {
  const node = element.querySelector('script[type="text/plain"][data-mermaid-source]');
  if (node) return node.textContent.trim();
  const text = element.textContent.trim();
  return text || '';
}

async function sourceFor(element) {
  const src = element.getAttribute('src');
  const embedded = embeddedSourceFor(element);

  if (!src) return embedded;

  try {
    const response = await fetch(src, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    return text.trim();
  } catch (error) {
    if (embedded) return embedded;
    throw new Error(`Could not load ${src}: ${error.message}`);
  }
}

function downloadText(filename, mimeType, text) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

if (typeof HTMLElement !== 'undefined' && typeof customElements !== 'undefined') {
  class MermaidFileViewer extends HTMLElement {
    static get observedAttributes() {
      return ['caption', 'src', 'title'];
    }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.shadowRoot.innerHTML = renderTemplate();
    }

    connectedCallback() {
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected) this.render();
    }

    async render() {
      const title = this.getAttribute('title') || 'Mermaid diagram';
      const caption = this.getAttribute('caption') || '';
      const src = this.getAttribute('src') || '';
      const heading = this.shadowRoot.querySelector('h2');
      const captionEl = this.shadowRoot.querySelector('.caption');
      const status = this.shadowRoot.querySelector('.status');
      const canvas = this.shadowRoot.querySelector('.canvas');
      const pre = this.shadowRoot.querySelector('pre');
      const sourceLink = this.shadowRoot.querySelector('.source-link');
      const copy = this.shadowRoot.querySelector('.copy');
      const download = this.shadowRoot.querySelector('.download');

      heading.textContent = title;
      captionEl.textContent = caption;
      captionEl.hidden = !caption;
      sourceLink.hidden = !src;
      if (src) sourceLink.href = src;

      try {
        status.textContent = 'Loading Mermaid source...';
        canvas.classList.remove('error');
        canvas.innerHTML = '';

        const source = await sourceFor(this);
        if (!source) throw new Error('No Mermaid source was provided.');
        pre.textContent = source;

        const mermaid = await loadMermaid();
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          themeVariables: {
            background: '#fffdf7',
            primaryColor: '#dbeafe',
            primaryBorderColor: '#2563eb',
            primaryTextColor: '#0f172a',
            lineColor: '#5c5040',
            fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
          },
        });

        const id = `mermaid-file-viewer-${++renderCounter}`;
        const result = await mermaid.render(id, source);
        canvas.innerHTML = result.svg;
        if (typeof result.bindFunctions === 'function') result.bindFunctions(canvas);
        status.textContent = `Rendered ${src || 'embedded Mermaid source'}.`;

        copy.onclick = async () => {
          await navigator.clipboard.writeText(source);
          status.textContent = 'Copied Mermaid source.';
        };

        download.onclick = () => {
          const svg = canvas.querySelector('svg')?.outerHTML || '';
          const slug =
            title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '') || 'diagram';
          downloadText(`${slug}.svg`, 'image/svg+xml', svg);
          status.textContent = 'Downloaded rendered SVG.';
        };
      } catch (error) {
        status.textContent = error.message;
        canvas.classList.add('error');
        canvas.textContent = 'Mermaid render failed. The source remains available below.';
        pre.textContent = escapeText(embeddedSourceFor(this));
      }
    }
  }

  if (!customElements.get('mermaid-file-viewer')) {
    customElements.define('mermaid-file-viewer', MermaidFileViewer);
  }
}
