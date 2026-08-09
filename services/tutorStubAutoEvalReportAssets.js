export function machineSpiritsReportCss() {
  return `
    @import url("https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600&family=JetBrains+Mono:wght@400;500;600&display=swap");

    :root {
      color-scheme: light;
      --paper:#FFFFFF;
      --paper-2:#F4F4F5;
      --paper-3:#FAFAFA;
      --paper-4:#FFFFFF;
      --ink:#0A0A0A;
      --ink-2:#262626;
      --ink-3:#525252;
      --ink-4:#8A8A8A;
      --linen:#D4D4D8;
      --moss:#171717;
      --moss-deep:#000000;
      --moss-soft:#ECECEC;
      --brick:#E63946;
      --brick-d:#C1121F;
      --brick-soft:#FBE3E5;
      --blue:#0057B8;
      --blue-soft:#DDEBFF;
      --yellow:#F2B705;
      --yellow-soft:#FFF1B8;
      --green:#009B72;
      --green-soft:#DDF7EE;
      --violet:#6B4EFF;
      --violet-soft:#E8E3FF;
      --magenta:#D72670;
      --magenta-soft:#FFE0EE;
      --ochre:#737373;
      --ochre-d:#525252;
      --ochre-soft:#EDEDED;
      --indigo:#404040;
      --indigo-soft:#EDEDED;
      --red-mark:#E63946;
      --rule:rgba(10,10,10,0.22);
      --rule-soft:rgba(10,10,10,0.09);
      --ease:cubic-bezier(.22,.61,.36,1);
      --bg:var(--paper);
      --panel:var(--paper-4);
      --panel-2:var(--paper-2);
      --muted:var(--ink-3);
      --line:var(--rule);
      --accent:var(--moss-deep);
      --accent-soft:var(--moss-soft);
      --text:var(--ink-2);
      --good:var(--moss-deep);
      --warn:var(--ochre-d);
      --bad:var(--brick-d);
      --red:var(--red-mark);
      --blue:var(--indigo);
    }
    * { box-sizing:border-box; }
    html, body { margin:0; padding:0; max-width:100%; overflow-x:clip; }
    html { background:var(--paper); -webkit-text-size-adjust:100%; }
    body {
      min-height:100vh;
      background:var(--paper);
      color:var(--ink-2);
      font-family:"Source Serif 4", "Source Serif Pro", Cambria, Georgia, serif;
      font-feature-settings:"ss01", "kern", "liga";
      font-optical-sizing:auto;
      font-size:15px;
      line-height:1.5;
      letter-spacing:0.003em;
      -webkit-font-smoothing:antialiased;
      -moz-osx-font-smoothing:grayscale;
      position:relative;
    }
    body::before {
      content:"";
      position:fixed;
      inset:0;
      z-index:-2;
      pointer-events:none;
      background:
        radial-gradient(130% 90% at 50% 0%, transparent 48%, rgba(10,10,10,0.06) 100%),
        radial-gradient(75% 55% at 8% 92%, rgba(230,57,70,0.04), transparent 70%),
        radial-gradient(70% 60% at 96% 14%, rgba(10,10,10,0.04), transparent 70%);
      mix-blend-mode:multiply;
    }
    body::after {
      content:"";
      position:fixed;
      inset:0;
      z-index:-1;
      pointer-events:none;
      opacity:0.14;
      background-image:radial-gradient(rgba(20,16,12,0.55) 0.5px, transparent 0.5px);
      background-size:3px 3px;
      mix-blend-mode:multiply;
    }
    h1, h2, h3, h4 {
      font-family:"Fraunces", "Source Serif 4", Georgia, serif;
      font-optical-sizing:auto;
      font-variation-settings:"SOFT" 50, "WONK" 1, "opsz" 96;
      color:var(--ink);
      font-weight:500;
      letter-spacing:-0.012em;
      line-height:1.12;
      margin:0 0 0.5em;
    }
    h1 { font-size:clamp(1.6rem, 1.1rem + 1.2vw, 2.35rem); }
    h2 { margin:34px 0 12px; font-size:1.2rem; }
    h3 { font-size:1rem; }
    a { color:var(--brick-d); text-underline-offset:2px; }
    a:hover { color:var(--brick); }
    code, kbd, samp, .sub, .muted, .metric-label, .metric-sub, .control span, th, button, input, select, textarea, .chip, .status, .scope-badge, .scope-note, .learner-eyebrow, .readout-label, .snippet-label, .event-chip, .live-count, .live-run-meta, .live-run-progress, .index-measure em, .index-measure span, .read-first-note {
      font-family:"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    header {
      max-width:1360px;
      margin:0 auto;
      padding:28px clamp(18px, 4vw, 44px) 18px;
      border-bottom:1px solid var(--rule);
    }
    main {
      max-width:1360px;
      margin:0 auto;
      padding:22px clamp(18px, 4vw, 44px) 44px;
    }
    main.report-main { max-width:1540px; }
    .report-shell {
      display:grid;
      grid-template-columns:190px minmax(0,1fr);
      gap:22px;
      align-items:start;
    }
    .report-content { min-width:0; }
    .report-section {
      min-width:0;
      scroll-margin-top:18px;
    }
    .report-nav {
      position:sticky;
      top:14px;
      max-height:calc(100vh - 28px);
      overflow:auto;
      border:1px solid var(--rule);
      background:rgba(247,239,221,0.88);
      box-shadow:0 12px 30px rgba(28,22,16,0.05);
      padding:12px;
    }
    .report-nav-title {
      color:var(--ink-3);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      letter-spacing:0.12em;
      text-transform:uppercase;
      margin-bottom:8px;
    }
    .report-nav-list { display:grid; gap:4px; }
    .report-nav a {
      display:block;
      border-left:3px solid var(--rule);
      color:var(--ink-2);
      padding:6px 8px 6px 9px;
      text-decoration:none;
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:12px;
      line-height:1.25;
    }
    .report-nav a:hover, .report-nav a:focus {
      border-left-color:var(--brick);
      background:var(--brick-soft);
      color:var(--brick-d);
      outline:0;
    }
    .visually-hidden {
      position:absolute;
      width:1px;
      height:1px;
      overflow:hidden;
      clip:rect(0 0 0 0);
      white-space:nowrap;
      clip-path:inset(50%);
    }
    .sub, .muted {
      color:var(--ink-3);
      font-size:12px;
      letter-spacing:0.04em;
    }
    .header-links { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
    .header-links a, .field-link, .live-actions a, .live-links a, .actions a {
      display:inline-flex;
      align-items:center;
      min-height:28px;
      border:1px solid var(--rule);
      background:var(--paper-4);
      color:var(--brick-d);
      padding:3px 9px;
      text-decoration:none;
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:12px;
      letter-spacing:0.02em;
    }
    .header-links a:hover, .field-link:hover, .live-actions a:hover, .live-links a:hover, .actions a:hover {
      background:var(--brick-soft);
      color:var(--brick-d);
    }
    .summary-panel { display:grid; grid-template-columns:minmax(0,1fr) 330px; gap:14px; align-items:start; margin:18px 0 4px; }
    .metrics { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin:16px 0; }
    .summary-panel .metrics { margin:0; }
    .big-picture {
      margin:18px 0 20px;
      border-top:2px solid var(--ink);
      padding-top:14px;
    }
    .big-picture-head {
      display:flex;
      justify-content:space-between;
      gap:16px;
      align-items:flex-start;
      margin:0 0 12px;
    }
    summary.big-picture-head { cursor:pointer; list-style:none; }
    summary.big-picture-head::-webkit-details-marker { display:none; }
    .big-picture:not([open]) .big-picture-head { margin-bottom:0; }
    .big-picture-body { padding-top:2px; }
    .big-picture-head h2 { margin:0; }
    .big-picture-head p {
      margin:4px 0 0;
      max-width:980px;
      color:var(--ink-3);
      font-size:12px;
      letter-spacing:0.02em;
    }
    .big-picture-grid {
      display:grid;
      grid-template-columns:minmax(0,1fr);
      gap:14px;
      align-items:start;
    }
    .big-picture-panel {
      min-width:0;
      grid-column:1 / -1;
      background:rgba(247,239,221,0.76);
      border:1px solid var(--rule);
      box-shadow:0 12px 30px rgba(28,22,16,0.05);
      padding:14px 15px;
      overflow:hidden;
    }
    .big-picture-panel-wide {
      grid-column:1 / -1;
    }
    .big-picture-panel h3 {
      margin:0 0 9px;
      font-size:1rem;
    }
    .learner-infographic {
      display:grid;
      gap:12px;
    }
    .learner-dashboard-grid {
      display:grid;
      grid-template-columns:minmax(0,1.34fr) minmax(280px,.66fr);
      gap:12px;
      align-items:stretch;
    }
    .learner-snapshot {
      display:grid;
      gap:10px;
      min-width:0;
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:5px 5px 0 var(--red-mark);
      padding:12px;
    }
    .learner-snapshot-head {
      display:flex;
      justify-content:space-between;
      gap:10px;
      align-items:flex-start;
      border-bottom:2px solid var(--ink);
      padding-bottom:8px;
    }
    .learner-snapshot-head strong {
      display:block;
      color:var(--ink);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:12px;
      letter-spacing:0.1em;
      text-transform:uppercase;
    }
    .learner-snapshot-head span {
      color:var(--ink-3);
      font-size:12px;
      line-height:1.25;
    }
    .learner-kpi-grid {
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:8px;
    }
    .learner-kpi {
      min-width:0;
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:3px 3px 0 var(--kpi-accent, var(--ink));
      padding:9px 10px;
    }
    .learner-kpi span {
      display:block;
      color:var(--ink-3);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:10px;
      letter-spacing:0.08em;
      text-transform:uppercase;
    }
    .learner-kpi strong {
      display:block;
      margin-top:2px;
      color:var(--ink);
      font-family:"Fraunces", Georgia, serif;
      font-size:24px;
      line-height:1;
      overflow-wrap:anywhere;
    }
    .learner-kpi em {
      display:block;
      margin-top:3px;
      color:var(--ink-3);
      font-size:11px;
      font-style:normal;
      line-height:1.25;
    }
    .learner-profile-bars {
      display:grid;
      gap:8px;
    }
    .learner-rowbar {
      display:grid;
      gap:7px;
      border:2px solid var(--ink);
      background:var(--paper);
      padding:8px;
      box-shadow:3px 3px 0 var(--row-accent, var(--ink));
    }
    .learner-rowbar-head {
      display:flex;
      justify-content:space-between;
      gap:8px;
      align-items:baseline;
    }
    .learner-rowbar strong {
      color:var(--ink);
      font-size:14px;
      line-height:1.1;
      overflow-wrap:anywhere;
    }
    .learner-rowbar-head span {
      color:var(--ink-3);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      white-space:nowrap;
    }
    .learner-mini-bars {
      display:grid;
      gap:4px;
    }
    .learner-mini-bar {
      display:grid;
      grid-template-columns:70px minmax(0,1fr) 42px;
      gap:7px;
      align-items:center;
      color:var(--ink-3);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:10px;
      text-transform:uppercase;
      letter-spacing:0.05em;
    }
    .learner-mini-track {
      height:9px;
      border:1px solid var(--ink);
      background:var(--paper-2);
      overflow:hidden;
    }
    .learner-mini-track span {
      display:block;
      width:var(--bar-width,0%);
      height:100%;
      background:var(--bar-color,var(--red-mark));
    }
    .big-picture-read {
      margin:0;
      padding-left:18px;
      color:var(--ink-2);
      font-size:13px;
      line-height:1.45;
    }
    .big-picture-read li { margin:6px 0; }
    .big-picture-table { min-width:760px; }
    .big-picture-table .numeric { text-align:right; white-space:nowrap; }
    .big-picture-viz-grid {
      display:grid;
      grid-template-columns:minmax(0,1fr);
      gap:12px;
      align-items:start;
      margin-top:12px;
    }
    .big-picture-viz-grid > * {
      min-width:0;
    }
    .viz-frame {
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:5px 5px 0 var(--ink);
      min-width:0;
      overflow:hidden;
    }
    .viz-frame svg {
      display:block;
      width:100%;
      height:auto;
      min-height:260px;
    }
    .viz-caption {
      display:grid;
      gap:5px;
      padding:8px 10px;
      border-top:2px solid var(--ink);
      background:var(--paper-3);
      color:var(--ink-3);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      line-height:1.35;
    }
    .learner-readout {
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
      gap:8px;
      margin:0;
      counter-reset:learner-note;
    }
    .learner-readout-card {
      position:relative;
      min-width:0;
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:3px 3px 0 var(--red-mark);
      padding:10px 11px 10px 46px;
    }
    .learner-readout-card::before {
      counter-increment:learner-note;
      content:counter(learner-note, decimal-leading-zero);
      position:absolute;
      left:10px;
      top:10px;
      width:25px;
      height:25px;
      border:2px solid var(--ink);
      background:var(--ink);
      color:var(--paper);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:10px;
      font-weight:800;
      line-height:21px;
      text-align:center;
    }
    .learner-readout-card strong {
      display:block;
      color:var(--ink);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      letter-spacing:0.08em;
      text-transform:uppercase;
    }
    .learner-readout-card p {
      margin:5px 0 0;
      color:var(--ink-2);
      font-size:12px;
      line-height:1.35;
    }
    .learner-card-grid {
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr));
      gap:9px;
      min-width:0;
    }
    .learner-card {
      min-width:0;
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:3px 3px 0 var(--card-accent, var(--ink));
      padding:10px;
    }
    .learner-card strong {
      display:block;
      color:var(--ink);
      font-family:"Fraunces", Georgia, serif;
      font-size:18px;
      line-height:1.1;
      overflow-wrap:anywhere;
    }
    .learner-card dl {
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:7px 9px;
      margin:9px 0 0;
    }
    .learner-card dt {
      color:var(--ink-3);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:10px;
      letter-spacing:0.08em;
      text-transform:uppercase;
    }
    .learner-card dd {
      margin:1px 0 0;
      color:var(--ink);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:13px;
      font-weight:700;
    }
    @media (min-width: 1180px) {
      .big-picture-viz-grid {
        grid-template-columns:minmax(420px,1.1fr) minmax(300px,.9fr);
      }
    }
    .policy-bars {
      display:grid;
      gap:8px;
    }
    .policy-bar-row {
      display:grid;
      grid-template-columns:minmax(120px,190px) minmax(160px,1fr) auto;
      gap:10px;
      align-items:center;
    }
    .policy-bar-row strong {
      overflow-wrap:anywhere;
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:12px;
    }
    .policy-bar {
      height:15px;
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:2px 2px 0 var(--ink);
      overflow:hidden;
    }
    .policy-bar span {
      display:block;
      height:100%;
      width:var(--bar-width,0%);
      background:var(--bar-color,var(--red));
    }
    .policy-bar-meta {
      color:var(--ink-3);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      white-space:nowrap;
    }
    .big-picture-cautions {
      display:grid;
      gap:8px;
      margin:12px 0 0;
    }
    .big-picture-cautions div {
      border-left:4px solid var(--red);
      background:rgba(255,255,255,0.34);
      padding:8px 10px;
      color:var(--ink-2);
      font-size:12px;
      line-height:1.4;
    }
    .metric, .metric-guide, .learner-profile-card, .learner-behavior-card, .field-card, .viz-player, .live-run-card, table {
      background:rgba(247,239,221,0.86);
      border:1px solid var(--rule);
      box-shadow:0 12px 30px rgba(28,22,16,0.05);
    }
    .metric { padding:13px 14px; }
    .metric-label { color:var(--ink-3); font-size:11px; text-transform:uppercase; letter-spacing:0.11em; }
    .metric-value { margin-top:3px; color:var(--ink); font-family:"Fraunces", Georgia, serif; font-size:28px; font-weight:600; line-height:1.05; }
    .metric-sub { color:var(--ink-3); font-size:12px; min-height:18px; }
    .metric-guide { padding:13px 15px; }
    .metric-guide h3 { margin:0 0 9px; }
    .metric-guide dl, .viz-sidebar dl { margin:0; display:grid; gap:8px; }
    .metric-guide dl div, .viz-sidebar dl div { border-top:1px solid var(--rule-soft); padding-top:8px; }
    .metric-guide dl div:first-child, .viz-sidebar dl div:first-child { border-top:0; padding-top:0; }
    .metric-guide dt, .viz-sidebar dt, .learner-chip-grid strong { font-weight:600; color:var(--ink); }
    .metric-guide dd, .viz-sidebar dd { margin:2px 0 0; color:var(--ink-3); font-size:12px; }
    .read-first-note {
      margin:0 0 10px;
      max-width:980px;
      color:var(--ink-3);
      font-size:12px;
      letter-spacing:0.02em;
    }
    .signal-guide {
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(210px,1fr));
      gap:10px;
      margin:12px 0 0;
    }
    .signal-guide div {
      border:1px solid var(--rule);
      background:rgba(247,239,221,0.62);
      padding:10px 11px;
    }
    .signal-guide strong {
      display:block;
      color:var(--ink);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      letter-spacing:0.08em;
      text-transform:uppercase;
    }
    .signal-guide p {
      margin:4px 0 0;
      color:var(--ink-3);
      font-size:12px;
      line-height:1.42;
    }
    .learner-panel { display:grid; grid-template-columns:minmax(260px,.85fr) minmax(360px,1.5fr); gap:14px; margin:18px 0 4px; }
    .learner-profile-card, .learner-behavior-card { padding:15px; }
    .learner-eyebrow { color:var(--ink-3); font-size:11px; text-transform:uppercase; letter-spacing:0.12em; }
    .learner-profile-card h3 { margin:4px 0 8px; font-size:1.35rem; }
    .learner-profile-card p, .viz-sidebar p, .field-card-summary, .learner-example, .live-job p { color:var(--ink-2); }
    .learner-profile-card dl { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin:0; }
    .learner-profile-card dt, .learner-stat span, .learner-example-label {
      color:var(--ink-3);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      text-transform:uppercase;
      letter-spacing:0.11em;
    }
    .learner-profile-card dd { margin:2px 0 0; font-weight:600; color:var(--ink); }
    .learner-score-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:8px; margin:8px 0 12px; }
    .learner-stat { border:1px solid var(--rule-soft); padding:9px; background:rgba(251,246,232,0.8); }
    .learner-stat strong { display:block; margin-top:2px; font-family:"Fraunces", Georgia, serif; font-size:20px; color:var(--ink); }
    .learner-stat em { display:block; color:var(--ink-3); font-style:normal; font-size:11px; }
    .learner-chip-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:10px; }
    .learner-chip, .chip, .event-chip, .status, .scope-badge, .field-badge {
      display:inline-block;
      border:1px solid var(--rule);
      background:var(--paper-3);
      color:var(--ink-2);
      padding:2px 7px;
      font-size:12px;
      white-space:nowrap;
    }
    .learner-chip { margin:0 5px 5px 0; }
    .chip { margin:0 4px 4px 0; }
    .scope-badge {
      margin:0 4px 4px 0;
      background:var(--paper-4);
      color:var(--ink);
      font-weight:700;
      letter-spacing:0.04em;
      text-transform:uppercase;
    }
    .scope-badge.matrix {
      background:var(--yellow-soft);
      border-color:var(--ink);
      color:var(--ink);
    }
    .scope-note {
      display:block;
      margin-top:4px;
      color:var(--ink-3);
      font-size:11px;
      line-height:1.35;
      letter-spacing:0.02em;
    }
    .scope-notice {
      margin:0 0 16px;
      border-left:8px solid var(--yellow);
      background:var(--yellow-soft);
      padding:12px 14px;
      color:var(--ink-2);
      box-shadow:4px 4px 0 var(--ink);
    }
    .scope-notice strong {
      display:block;
      color:var(--ink);
      margin-bottom:3px;
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:12px;
      letter-spacing:0.08em;
      text-transform:uppercase;
    }
    .scope-notice p { margin:0; font-size:13px; line-height:1.4; }
    .scope-notice a { font-family:"JetBrains Mono", ui-monospace, monospace; font-size:12px; }
    .learner-empty { color:var(--ink-3); font-size:12px; }
    .learner-examples { display:grid; gap:8px; margin-top:12px; }
    .learner-example { border-top:1px solid var(--rule-soft); padding-top:8px; font-size:12px; }
    .field-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(360px,1fr)); gap:14px; }
    .field-card { overflow:hidden; }
    .field-card-head {
      display:flex;
      justify-content:space-between;
      gap:12px;
      padding:12px 14px;
      border-bottom:1px solid var(--rule);
      background:rgba(233,223,199,0.72);
    }
    .field-card h3 { margin:0 0 3px; }
    .field-actions { display:flex; align-items:flex-start; gap:8px; }
    .field-badge { align-self:flex-start; background:var(--paper-4); }
    .field-card-summary { padding:9px 14px; font-size:12px; border-bottom:1px solid var(--rule-soft); }
    .field-svg { overflow-x:auto; background:var(--paper-4); }
    .field-svg svg { display:block; width:100%; min-width:640px; height:auto; }
    .viz-player { overflow:hidden; }
    .viz-layout { display:grid; grid-template-columns:minmax(0,1fr) 310px; }
    .viz-main { min-width:0; overflow:hidden; }
    .viz-sidebar { border-left:1px solid var(--rule); background:rgba(233,223,199,0.56); padding:14px; }
    .viz-sidebar h3 { margin:0 0 8px; }
    .viz-sidebar p { margin:0 0 12px; font-size:12px; }
    .viz-toolbar, .toolbar {
      border-bottom:1px solid var(--rule);
      background:rgba(233,223,199,0.72);
    }
    .viz-toolbar {
      display:grid;
      grid-template-columns:minmax(220px,1.1fr) minmax(280px,2.2fr) minmax(240px,1.2fr) minmax(160px,.8fr);
      gap:10px;
      align-items:end;
      padding:12px 14px;
    }
    .viz-toolbar label, .control { display:flex; flex-direction:column; gap:4px; color:var(--ink-3); font-size:12px; }
    .viz-control-group { min-width:0; }
    .viz-group-label {
      display:block;
      color:var(--ink-3);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      letter-spacing:0.11em;
      text-transform:uppercase;
      margin-bottom:4px;
    }
    .viz-toolbar select, .viz-toolbar button, .viz-toolbar input, input, select, button {
      width:100%;
      min-height:38px;
      border:1px solid var(--rule);
      background:var(--paper-4);
      color:var(--ink);
      padding:7px 9px;
      border-radius:0;
      font:inherit;
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:12px;
    }
    button {
      width:auto;
      cursor:pointer;
      color:var(--brick-d);
      font-weight:600;
      letter-spacing:0.04em;
      text-transform:uppercase;
    }
    button:hover { background:var(--brick-soft); }
    .viz-mode-buttons, .viz-step-buttons { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
    .viz-mode-buttons button, .viz-step-buttons button { width:auto; }
    .viz-mode-buttons button.active {
      border-color:var(--moss-deep);
      background:var(--moss-deep);
      color:var(--paper);
    }
    .viz-range-label input { min-width:150px; accent-color:var(--brick); }
    .viz-help-strip {
      border-bottom:1px solid var(--rule);
      padding:9px 14px;
      color:var(--ink-2);
      background:rgba(247,239,221,0.82);
      font-size:12px;
    }
    .viz-canvas-wrap { background:var(--paper-4); }
    .viz-canvas-wrap canvas { display:block; width:100%; height:420px; }
    .viz-readout {
      margin:0;
      min-height:118px;
      padding:12px 14px;
      border-top:1px solid var(--rule);
      background:rgba(241,233,216,0.88);
      color:var(--ink-2);
    }
    .viz-readout-head { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:10px; font-size:12px; }
    .viz-readout-head strong { color:var(--ink); font-size:13px; }
    .viz-readout-head span { border:1px solid var(--rule); padding:2px 7px; background:var(--paper-4); color:var(--ink-3); }
    .viz-readout-grid { display:grid; grid-template-columns:minmax(210px,.9fr) minmax(190px,.7fr) minmax(260px,1.4fr); gap:10px; }
    .readout-card { min-width:0; border:1px solid var(--rule); background:var(--paper-4); padding:9px 10px; }
    .readout-card strong { display:block; color:var(--ink); margin-top:3px; overflow-wrap:anywhere; }
    .readout-card em { display:block; margin-top:3px; color:var(--ink-3); font-style:normal; font-size:12px; overflow-wrap:anywhere; }
    .readout-style {
      border-left:6px solid var(--style-color, var(--moss-deep));
      background:linear-gradient(90deg, color-mix(in srgb, var(--style-color, var(--moss-deep)) 12%, var(--paper-4)), var(--paper-4) 70%);
    }
    .readout-label { display:block; color:var(--ink-3); font-size:11px; text-transform:uppercase; letter-spacing:0.11em; }
    .style-swatch { display:inline-block; width:10px; height:10px; margin-right:7px; background:var(--style-color, var(--moss-deep)); vertical-align:middle; }
    .event-list { display:flex; flex-wrap:wrap; gap:5px; margin-top:5px; }
    .event-chip { background:var(--moss-soft); color:var(--moss-deep); }
    .event-none { color:var(--ink-3); background:var(--paper-4); }
    .viz-readout-lines { display:grid; gap:7px; margin-top:10px; font-size:13px; line-height:1.35; }
    .viz-readout-lines p { display:grid; grid-template-columns:74px minmax(0,1fr); gap:8px; margin:0; }
    .snippet-label { align-self:start; padding:2px 7px; text-transform:uppercase; letter-spacing:0.08em; font-size:10px; font-weight:700; text-align:center; }
    .snippet-label.learner { background:var(--indigo-soft); color:var(--indigo); }
    .snippet-label.tutor { background:var(--moss-soft); color:var(--moss-deep); }
    .transcript-explorer {
      min-width:0;
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:6px 6px 0 var(--red-mark);
      overflow:hidden;
    }
    .transcript-toolbar {
      display:grid;
      grid-template-columns:minmax(220px,1.25fr) minmax(310px,1.7fr) minmax(150px,.7fr) minmax(220px,1fr);
      gap:14px;
      align-items:stretch;
      padding:14px;
      border-bottom:4px solid var(--ink);
      background:var(--paper);
    }
    .transcript-toolbar label, .transcript-control-group {
      position:relative;
      min-width:0;
      min-height:88px;
      display:flex;
      flex-direction:column;
      gap:6px;
      padding:14px 12px 12px;
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:4px 4px 0 var(--group-accent, var(--ink));
    }
    .transcript-toolbar label::before, .transcript-control-group::before {
      content:"";
      position:absolute;
      top:-2px;
      left:-2px;
      right:-2px;
      height:9px;
      background:var(--group-accent, var(--ink));
      border-bottom:2px solid var(--ink);
    }
    .transcript-run-control { --group-accent:var(--blue); --group-label-ink:var(--paper); }
    .transcript-view-control { --group-accent:var(--red-mark); --group-label-ink:var(--paper); }
    .transcript-turn-control { --group-accent:var(--yellow); --group-label-ink:var(--ink); }
    .transcript-search-control { --group-accent:var(--green); --group-label-ink:var(--paper); }
    .transcript-toolbar label > span:first-child, .transcript-group-label {
      align-self:flex-start;
      margin:2px 0;
      padding:4px 8px;
      border:2px solid var(--ink);
      background:var(--group-accent, var(--ink));
      color:var(--group-label-ink, var(--paper));
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      font-weight:800;
      letter-spacing:0.08em;
      line-height:1;
      text-transform:uppercase;
    }
    .transcript-toolbar select, .transcript-toolbar input {
      margin-top:auto;
      width:100%;
      min-width:0;
    }
    .transcript-mode-buttons { display:flex; flex-wrap:wrap; gap:8px; }
    .transcript-mode-buttons button {
      flex:1 1 88px;
      min-width:0;
      min-height:38px;
      border-left-width:6px;
      border-left-color:var(--red-mark);
      box-shadow:2px 2px 0 var(--ink);
    }
    .transcript-mode-buttons button.active {
      background:var(--red-mark);
      color:var(--paper);
      box-shadow:inset 0 -5px 0 var(--ink), 2px 2px 0 var(--ink);
    }
    .transcript-summary {
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      align-items:center;
      padding:10px 14px;
      border-bottom:2px solid var(--ink);
      background:var(--paper-2);
      color:var(--ink);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:12px;
    }
    .transcript-body {
      min-width:0;
      padding:18px;
      background:var(--paper);
    }
    .transcript-empty {
      border:2px dashed var(--ink);
      padding:18px;
      color:var(--ink-3);
      background:var(--paper-3);
    }
    .transcript-card, .transcript-plate, .transcript-note-card, .transcript-line, .transcript-lane {
      min-width:0;
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:3px 3px 0 var(--ink);
    }
    .transcript-card, .transcript-plate, .transcript-note-card { padding:14px; }
    .transcript-card + .transcript-card, .transcript-plate + .transcript-plate { margin-top:14px; }
    .transcript-card-head, .transcript-plate-head, .transcript-line-head, .transcript-note-head {
      display:flex;
      flex-wrap:wrap;
      justify-content:space-between;
      gap:8px;
      align-items:flex-start;
      margin-bottom:10px;
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:12px;
      font-weight:800;
      letter-spacing:0.04em;
      text-transform:uppercase;
    }
    .transcript-register-mark {
      display:inline-flex;
      align-items:center;
      gap:6px;
      border:2px solid var(--ink);
      background:var(--style-color, var(--red-mark));
      color:var(--style-ink, var(--paper));
      padding:2px 7px;
      line-height:1.1;
    }
    .transcript-dot {
      width:10px;
      height:10px;
      display:inline-block;
      background:currentColor;
      border:1px solid var(--ink);
    }
    .transcript-voice-grid, .transcript-plate-voices {
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:12px;
      align-items:start;
    }
    .transcript-speaker {
      display:inline-block;
      margin:0 0 5px;
      padding:2px 7px;
      border:2px solid var(--ink);
      color:var(--paper);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      font-weight:800;
      letter-spacing:0.1em;
      text-transform:uppercase;
    }
    .transcript-speaker.tutor { background:var(--green); }
    .transcript-speaker.learner { background:var(--blue); }
    .transcript-speech {
      white-space:pre-wrap;
      overflow-wrap:anywhere;
      color:var(--ink);
      font-size:14px;
      line-height:1.55;
    }
    .transcript-meta-strip {
      display:flex;
      flex-wrap:wrap;
      gap:6px;
      margin-top:11px;
    }
    .transcript-pill {
      display:inline-block;
      border:2px solid var(--ink);
      background:var(--paper);
      color:var(--ink);
      padding:2px 7px;
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      line-height:1.25;
    }
    .transcript-pill.hot {
      background:var(--red-mark);
      color:var(--paper);
    }
    .transcript-pill.good {
      background:var(--green);
      color:var(--paper);
    }
    .transcript-script { display:grid; gap:10px; }
    .transcript-line {
      padding:12px;
      border-left-width:8px;
    }
    .transcript-line.learner { border-left-color:var(--blue); }
    .transcript-line.tutor { border-left-color:var(--green); }
    .transcript-swimlane { display:grid; gap:10px; }
    .transcript-swim-head, .transcript-swim-row {
      display:grid;
      grid-template-columns:minmax(0,1fr) 54px minmax(0,1fr);
      gap:14px;
      align-items:start;
    }
    .transcript-swim-head {
      position:sticky;
      top:0;
      z-index:2;
      background:var(--paper);
      padding-bottom:6px;
    }
    .transcript-swim-label {
      border-bottom:4px solid var(--ink);
      padding:5px 8px;
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      font-weight:800;
      letter-spacing:0.14em;
      text-transform:uppercase;
    }
    .transcript-swim-label.learner { text-align:right; border-bottom-color:var(--blue); }
    .transcript-swim-label.tutor { border-bottom-color:var(--green); }
    .transcript-spine {
      position:relative;
      min-height:42px;
    }
    .transcript-spine::before {
      content:"";
      position:absolute;
      left:50%;
      top:-10px;
      bottom:-10px;
      width:3px;
      transform:translateX(-50%);
      background:var(--ink);
    }
    .transcript-bead {
      position:relative;
      z-index:1;
      display:block;
      width:32px;
      height:32px;
      margin:4px auto;
      border:2px solid var(--ink);
      background:var(--red-mark);
      color:var(--paper);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:12px;
      font-weight:800;
      line-height:28px;
      text-align:center;
    }
    .transcript-lane {
      padding:12px;
      box-shadow:none;
    }
    .transcript-lane.empty {
      visibility:hidden;
    }
    .transcript-plate {
      border-left-width:10px;
      border-left-color:var(--red-mark);
    }
    .transcript-plate-reason {
      margin-top:12px;
      padding-top:10px;
      border-top:2px solid var(--ink);
      color:var(--ink-3);
      font-size:13px;
      line-height:1.45;
    }
    .transcript-notes-grid {
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
      gap:12px;
    }
    .transcript-note-card p { margin:5px 0 0; color:var(--ink-3); font-size:13px; line-height:1.42; }
    .transcript-jump-active {
      outline:3px solid var(--red-mark);
      outline-offset:3px;
    }
    .table-scroll {
      max-width:100%;
      min-width:0;
      overflow-x:auto;
      overflow-y:hidden;
      padding:0 10px 10px 0;
      margin:0 0 10px;
    }
    table { width:100%; border-collapse:collapse; overflow:hidden; }
    .table-scroll table {
      margin:0;
    }
    .policy-comparison-table {
      min-width:1080px;
    }
    .read-first-table {
      min-width:1160px;
    }
    .run-details-table {
      min-width:1540px;
    }
    th, td { padding:9px 10px; border-bottom:1px solid var(--rule); text-align:left; vertical-align:top; }
    th {
      background:rgba(233,223,199,0.82);
      color:var(--ink-2);
      font-size:12px;
      text-transform:uppercase;
      letter-spacing:0.09em;
      white-space:nowrap;
    }
    tr:last-child td { border-bottom:0; }
    td strong { color:var(--ink); font-weight:600; }
    .run-details-table th, .run-details-table td {
      line-height:1.25;
      overflow-wrap:anywhere;
    }
    .run-details-table th:nth-child(1), .run-details-table td:nth-child(1),
    .run-details-table th:nth-child(3), .run-details-table td:nth-child(3),
    .run-details-table th:nth-child(4), .run-details-table td:nth-child(4),
    .run-details-table th:nth-child(6), .run-details-table td:nth-child(6),
    .run-details-table th:nth-child(7), .run-details-table td:nth-child(7),
    .run-details-table th:nth-child(8), .run-details-table td:nth-child(8),
    .run-details-table th:nth-child(13), .run-details-table td:nth-child(13),
    .run-details-table th:nth-child(14), .run-details-table td:nth-child(14),
    .run-details-table th:nth-child(15), .run-details-table td:nth-child(15),
    .run-details-table th:nth-child(16), .run-details-table td:nth-child(16) {
      white-space:nowrap;
    }
    .run-details-table th:nth-child(5), .run-details-table td:nth-child(5),
    .run-details-table th:nth-child(9), .run-details-table td:nth-child(9),
    .run-details-table th:nth-child(11), .run-details-table td:nth-child(11),
    .run-details-table th:nth-child(12), .run-details-table td:nth-child(12) {
      max-width:240px;
    }
    .index-measure strong {
      display:block;
      color:var(--ink);
      font-size:14px;
      line-height:1.2;
      white-space:nowrap;
    }
    .index-measure strong span {
      color:var(--ink-3);
      font-size:11px;
      font-weight:500;
      letter-spacing:0.05em;
    }
    .index-measure em {
      display:block;
      margin-top:2px;
      color:var(--ink-3);
      font-size:11px;
      font-style:normal;
      letter-spacing:0.02em;
      white-space:normal;
    }
    .index-measure a { color:var(--brick-d); text-decoration-thickness:1px; text-underline-offset:2px; }
    .mini-bar { display:inline-block; width:72px; height:7px; margin-left:6px; background:var(--paper-2); overflow:hidden; vertical-align:middle; }
    .mini-bar span { display:block; height:100%; background:var(--moss-deep); }
    .status { background:var(--moss-soft); color:var(--moss-deep); }
    .status.failed, .status.aborted { background:var(--brick-soft); color:var(--brick-d); }
    .status.dry_run, .status.stale { background:var(--ochre-soft); color:var(--ochre-d); }
    .actions { white-space:nowrap; }
    .actions a { margin-right:6px; }
    .info-term {
      position:relative;
      display:inline-block;
      color:var(--brick-d);
      cursor:help;
      text-decoration:underline dotted rgba(124,44,31,0.52);
      text-underline-offset:3px;
    }
    .info-term:focus { outline:2px solid rgba(230,57,70,0.30); outline-offset:2px; }
    .info-term::after {
      content:attr(data-tip);
      position:absolute;
      left:0;
      top:calc(100% + 7px);
      z-index:20;
      width:min(320px,80vw);
      padding:8px 10px;
      border:1px solid var(--rule);
      background:var(--ink);
      color:var(--paper);
      box-shadow:0 10px 28px rgba(28,22,16,0.22);
      text-transform:none;
      letter-spacing:0;
      font-family:"Source Serif 4", Georgia, serif;
      font-size:12px;
      line-height:1.35;
      font-weight:400;
      white-space:normal;
      opacity:0;
      transform:translateY(-3px);
      pointer-events:none;
      transition:opacity .12s var(--ease), transform .12s var(--ease);
    }
    .info-term:hover::after, .info-term:focus::after { opacity:1; transform:translateY(0); }
    .toolbar {
      display:grid;
      grid-template-columns:minmax(220px,2fr) repeat(5,minmax(108px,1fr));
      align-items:end;
      gap:10px;
      margin:18px 0 10px;
      padding:12px;
      border:1px solid var(--rule);
    }
    .toolbar .control:first-child { grid-column:span 2; }
    .report-list {
      margin:18px 0 0;
      border-top:2px solid var(--ink);
      padding-top:14px;
    }
    .report-list-head {
      display:flex;
      justify-content:space-between;
      gap:16px;
      align-items:flex-start;
      margin:0 0 10px;
    }
    .report-list h2 {
      margin:0;
    }
    .report-list p {
      margin:3px 0 0;
      color:var(--ink-3);
      font-size:12px;
      letter-spacing:0.02em;
    }
    .report-index-scroll {
      max-height:min(72vh, 820px);
      overflow:auto;
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:5px 5px 0 var(--ink);
      padding:0;
      margin:10px 0 0;
    }
    .report-index-scroll table {
      min-width:1820px;
      margin:0;
      border:0;
      box-shadow:none;
      background:var(--paper);
      table-layout:fixed;
    }
    .report-index-table th, .report-index-table td {
      box-sizing:border-box;
      padding:8px 10px;
      overflow-wrap:anywhere;
    }
    .report-index-table th:nth-child(1), .report-index-table td:nth-child(1) { width:410px; }
    .report-index-table th:nth-child(2), .report-index-table td:nth-child(2) { width:126px; }
    .report-index-table th:nth-child(3), .report-index-table td:nth-child(3) { width:104px; }
    .report-index-table th:nth-child(4), .report-index-table td:nth-child(4) { width:170px; }
    .report-index-table th:nth-child(5), .report-index-table td:nth-child(5) { width:220px; }
    .report-index-table th:nth-child(6), .report-index-table td:nth-child(6) { width:120px; }
    .report-index-table th:nth-child(7), .report-index-table td:nth-child(7) { width:130px; }
    .report-index-table th:nth-child(8), .report-index-table td:nth-child(8) { width:95px; }
    .report-index-table th:nth-child(9), .report-index-table td:nth-child(9) { width:230px; }
    .report-index-table th:nth-child(10), .report-index-table td:nth-child(10) { width:215px; }
    .report-index-table td:nth-child(2),
    .report-index-table td:nth-child(3),
    .report-index-table td:nth-child(6),
    .report-index-table td:nth-child(7),
    .report-index-table td:nth-child(8) {
      overflow-wrap:normal;
    }
    .report-index-table thead th {
      position:sticky;
      top:0;
      z-index:3;
      border-bottom:2px solid var(--ink);
      background:var(--paper-2);
    }
    .report-index-table tbody tr {
      background:var(--paper);
    }
    .report-index-table tbody tr:nth-child(even) {
      background:var(--paper-3);
    }
    .report-index-table tbody tr[hidden] {
      display:none;
    }
    .report-index-table tbody tr:first-child td {
      border-top:2px solid var(--ink);
    }
    .report-index-table td {
      background:inherit;
    }
    .report-index-table .links-cell {
      width:126px;
      min-width:126px;
      max-width:126px;
      background:inherit;
    }
    .report-index-table .actions a,
    .report-index-table .actions .muted {
      display:inline-block;
      margin:0 6px 6px 0;
    }
    .report-index-table .links-cell.actions {
      white-space:normal;
    }
    .report-index-table .links-cell a,
    .report-index-table .links-cell .muted {
      display:block;
      width:max-content;
      max-width:100%;
      margin:0 0 8px;
      box-sizing:border-box;
    }
    .report-index-table .links-cell a:last-child,
    .report-index-table .links-cell .muted:last-child {
      margin-bottom:0;
    }
    .control span { color:var(--ink-3); font-size:11px; text-transform:uppercase; letter-spacing:0.11em; }
    input { box-sizing:border-box; }
    select { box-sizing:border-box; }
    .live-runs { margin:0 0 18px; }
    .operations-drawer { border:2px solid var(--ink); background:var(--paper-2); }
    .operations-drawer > summary { display:flex; justify-content:space-between; gap:12px; align-items:center; cursor:pointer; list-style:none; padding:10px 12px; }
    .operations-drawer > summary::-webkit-details-marker { display:none; }
    .operations-drawer > summary > span:first-child strong, .operations-drawer > summary > span:first-child em { display:block; }
    .operations-drawer > summary > span:first-child em { margin-top:2px; color:var(--ink-3); font-size:10px; font-style:normal; }
    .operations-drawer-body { border-top:2px solid var(--ink); padding:10px; }
    .live-runs-head { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; margin:0 0 10px; }
    .live-runs h2 { margin:0; }
    .live-runs p { margin:3px 0 0; color:var(--ink-3); font-size:12px; }
    .live-dot {
      display:inline-block;
      width:9px;
      height:9px;
      margin-right:7px;
      background:var(--brick);
      box-shadow:0 0 0 rgba(230,57,70,0.45);
      animation:livePulse 1.4s infinite;
    }
    .live-count { border:1px solid var(--rule); padding:3px 8px; background:var(--paper-4); color:var(--brick-d); font-size:12px; font-weight:700; white-space:nowrap; }
    .live-run-card { border-left:5px solid var(--brick); padding:13px; margin-bottom:10px; }
    .live-run-card.stale { border-left-color:var(--ochre); }
    .live-run-card.aborted { border-left-color:var(--brick-d); }
    .live-run-top { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
    .live-run-top h3 { margin:0 0 3px; }
    .live-run-top p { margin:3px 0 0; color:var(--ink-3); font-size:12px; }
    .live-run-progress { display:grid; grid-template-columns:minmax(180px,1fr) auto; gap:10px; align-items:center; margin:10px 0; color:var(--ink-3); font-size:12px; }
    .live-progress { display:block; height:10px; overflow:hidden; background:var(--paper-2); border:1px solid var(--rule-soft); }
    .live-progress span {
      display:block;
      height:100%;
      min-width:8px;
      background:repeating-linear-gradient(45deg, var(--brick) 0 8px, var(--ochre) 8px 16px);
      animation:liveStripe 1s linear infinite;
    }
    .live-run-meta { display:flex; flex-wrap:wrap; gap:8px; align-items:center; color:var(--ink-3); font-size:12px; margin-bottom:9px; }
    .live-jobs { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:8px; }
    .live-job { border:1px solid var(--rule); padding:9px; background:rgba(251,246,232,0.84); }
    .live-job.running { border-color:var(--moss); background:var(--moss-soft); }
    .live-job.failed { border-color:var(--brick); background:var(--brick-soft); }
    .live-job div:first-child { display:flex; justify-content:space-between; gap:8px; }
    .live-job div:first-child span { color:var(--ink-3); font-size:12px; }
    .live-job p { margin:4px 0 5px; font-size:12px; }
    .live-actions { margin-top:10px; font-size:12px; }
    .live-actions a, .live-links a { margin-right:6px; }
    body::before {
      background:
        linear-gradient(to right, rgba(10,10,10,0.06) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(10,10,10,0.05) 1px, transparent 1px);
      background-size:56px 56px, 56px 56px;
      mix-blend-mode:multiply;
    }
    body::after {
      opacity:0.22;
      background:
        radial-gradient(circle at 12% 18%, rgba(230,57,70,0.22) 0 2px, transparent 2px),
        radial-gradient(circle at 82% 22%, rgba(10,10,10,0.16) 0 1.2px, transparent 1.2px),
        radial-gradient(circle at 28% 78%, rgba(230,57,70,0.18) 0 1.5px, transparent 1.5px),
        repeating-linear-gradient(135deg, transparent 0 17px, rgba(10,10,10,0.055) 17px 18px);
      background-size:34px 34px, 27px 27px, 42px 42px, 100% 100%;
      mix-blend-mode:multiply;
    }
    header {
      position:relative;
      max-width:none;
      border-bottom:4px solid var(--ink);
      background:var(--paper);
    }
    header::after {
      content:"";
      position:absolute;
      right:clamp(18px, 4vw, 44px);
      bottom:-4px;
      width:min(28vw, 360px);
      height:12px;
      background:var(--red-mark);
    }
    h1 {
      max-width:980px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:0;
    }
    h2 {
      border-top:4px solid var(--ink);
      padding-top:10px;
      text-transform:uppercase;
      letter-spacing:0;
    }
    h2::before {
      content:"";
      display:inline-block;
      width:0.65em;
      height:0.65em;
      margin-right:0.42em;
      background:var(--red-mark);
      vertical-align:0.02em;
    }
    .header-links a, .field-link, .live-actions a, .live-links a, .actions a {
      border:2px solid var(--ink);
      background:var(--paper);
      color:var(--ink);
      box-shadow:3px 3px 0 var(--red-mark);
      text-transform:uppercase;
      font-weight:700;
    }
    .header-links a:hover, .field-link:hover, .live-actions a:hover, .live-links a:hover, .actions a:hover {
      background:var(--ink);
      color:var(--paper);
    }
    .metric, .metric-guide, .learner-profile-card, .learner-behavior-card, .field-card, .viz-player, .live-run-card, table, .report-nav {
      background:var(--paper);
      border:2px solid var(--ink);
      box-shadow:6px 6px 0 var(--ink);
    }
    table {
      box-shadow:4px 4px 0 var(--ink);
    }
    .metric:nth-child(2n), .field-card:nth-child(3n), .learner-behavior-card, .viz-player {
      box-shadow:6px 6px 0 var(--red-mark);
    }
    .metric { min-height:126px; }
    .metric-label, .report-nav-title, .control span, th, .learner-eyebrow, .readout-label, .viz-group-label {
      color:var(--ink);
      font-weight:800;
      letter-spacing:0.08em;
    }
    .metric-value {
      color:var(--ink);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:34px;
      font-weight:800;
    }
    .metric-sub, .sub, .muted { color:var(--ink-3); }
    .report-nav {
      background:
        linear-gradient(90deg, var(--red-mark) 0 9px, transparent 9px),
        var(--paper);
    }
    .report-nav a {
      border-left:4px solid var(--ink);
      color:var(--ink);
      font-weight:700;
      text-transform:uppercase;
    }
    .report-nav a:hover, .report-nav a:focus {
      border-left-color:var(--red-mark);
      background:var(--ink);
      color:var(--paper);
    }
    .metric-guide, .viz-sidebar {
      background:
        linear-gradient(90deg, var(--red-mark) 0 8px, transparent 8px),
        var(--paper);
    }
    .metric-guide dl div, .viz-sidebar dl div, .learner-example {
      border-top:2px solid var(--ink);
    }
    .learner-stat, .learner-chip, .chip, .event-chip, .status, .field-badge, .readout-card {
      border:2px solid var(--ink);
      background:var(--paper);
      color:var(--ink);
    }
    .status {
      background:var(--ink);
      color:var(--paper);
      font-weight:800;
      text-transform:uppercase;
    }
    .status.failed, .status.aborted, .status.dry_run, .status.stale {
      background:var(--red-mark);
      color:var(--paper);
    }
    .field-card-head, .viz-toolbar, .toolbar {
      background:
        linear-gradient(90deg, var(--ink) 0 14px, transparent 14px),
        var(--paper-2);
      border-bottom:2px solid var(--ink);
    }
    th {
      background:var(--paper-2);
      border-bottom:3px solid var(--ink);
      box-shadow:inset 0 6px 0 var(--ink);
      padding-top:18px;
    }
    th, td { border-bottom:2px solid var(--ink); }
    tr:nth-child(even) td { background:var(--paper-3); }
    .viz-sidebar { border-left:2px solid var(--ink); }
    .viz-help-strip, .viz-readout {
      background:var(--paper);
      border-top:2px solid var(--ink);
      border-bottom:2px solid var(--ink);
    }
    .viz-canvas-wrap, .field-svg { background:var(--paper); }
    .viz-toolbar select, .viz-toolbar button, .viz-toolbar input, input, select, button {
      border:2px solid var(--ink);
      background:var(--paper);
      color:var(--ink);
      font-weight:700;
    }
    .viz-toolbar {
      grid-template-columns:repeat(auto-fit, minmax(min(100%, 230px), 1fr));
      gap:14px;
      align-items:stretch;
      background:var(--paper);
      border-bottom:4px solid var(--ink);
      padding:14px;
    }
    .viz-toolbar label, .viz-control-group {
      position:relative;
      min-width:0;
      min-height:92px;
      padding:14px 12px 12px;
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:4px 4px 0 var(--group-accent, var(--ink));
    }
    .viz-toolbar label::before, .viz-control-group::before {
      content:"";
      position:absolute;
      top:-2px;
      left:-2px;
      right:-2px;
      height:9px;
      background:var(--group-accent, var(--ink));
      border-bottom:2px solid var(--ink);
    }
    .viz-run-control { --group-accent:var(--blue); --group-label-ink:var(--paper); }
    .viz-view-control { --group-accent:var(--red-mark); --group-label-ink:var(--paper); }
    .viz-variable-control { --group-accent:var(--violet); --group-label-ink:var(--paper); }
    .viz-playback-control { --group-accent:var(--yellow); --group-label-ink:var(--ink); }
    .viz-turn-control { --group-accent:var(--green); --group-label-ink:var(--paper); }
    .viz-control-disabled {
      opacity:0.62;
    }
    .viz-toolbar label > span:first-child, .viz-group-label {
      align-self:flex-start;
      margin:2px 0 2px;
      padding:4px 8px;
      border:2px solid var(--ink);
      background:var(--group-accent, var(--ink));
      color:var(--group-label-ink, var(--paper));
      line-height:1;
    }
    .viz-toolbar select, .viz-toolbar input {
      margin-top:auto;
    }
    .viz-mode-buttons, .viz-step-buttons {
      gap:8px;
    }
    .viz-mode-buttons button {
      flex:1 1 118px;
      min-width:0;
      min-height:42px;
      border-left-width:6px;
      border-left-color:var(--red-mark);
      background:var(--paper);
      box-shadow:2px 2px 0 var(--ink);
    }
    .viz-mode-buttons button.active {
      background:var(--red-mark);
      color:var(--paper);
      box-shadow:inset 0 -5px 0 var(--ink), 2px 2px 0 var(--ink);
    }
    .viz-step-buttons button {
      flex:1 1 74px;
      min-height:42px;
      box-shadow:2px 2px 0 var(--yellow);
    }
    .viz-step-buttons button[data-viz-play] {
      background:var(--blue);
      color:var(--paper);
    }
    .viz-step-buttons button[data-viz-reset] {
      background:var(--yellow-soft);
      color:var(--ink);
    }
    .viz-range-label input[type="range"] {
      accent-color:var(--green);
    }
    .viz-readout-head span {
      border:2px solid var(--ink);
      background:var(--paper);
      color:var(--ink);
      box-shadow:2px 2px 0 var(--red-mark);
    }
    .readout-card {
      box-shadow:none;
      border:2px solid var(--ink);
    }
    .readout-style {
      border-left:10px solid var(--style-color, var(--ink));
    }
    .snippet-label.learner {
      background:var(--blue);
      color:var(--paper);
    }
    .snippet-label.tutor {
      background:var(--green);
      color:var(--paper);
    }
    button:hover, .viz-mode-buttons button.active {
      background:var(--red-mark);
      border-color:var(--ink);
      color:var(--paper);
    }
    .mini-bar {
      background:var(--paper-2);
      border:1px solid var(--ink);
    }
    .mini-bar span { background:var(--red-mark); }
    .info-term {
      color:var(--ink);
      font-weight:800;
      text-decoration:underline solid var(--red-mark);
    }
    .info-term::after {
      border:2px solid var(--ink);
      background:var(--paper);
      color:var(--ink);
      box-shadow:5px 5px 0 var(--red-mark);
    }
    .live-dot, .live-progress span {
      background:var(--red-mark);
    }
    .live-progress {
      background:var(--paper);
      border:2px solid var(--ink);
    }
    .live-job { background:var(--paper); border:2px solid var(--ink); }
    .live-job.running { background:var(--paper-2); border-color:var(--ink); }
    .live-job.failed { background:var(--brick-soft); border-color:var(--red-mark); }
    .metric-value { overflow-wrap:anywhere; font-size:clamp(24px, 2.5vw, 34px); }
    .cohort-workspace {
      margin:0 0 22px;
      border-top:4px solid var(--ink);
      padding-top:10px;
    }
    .cohort-workspace-head, .report-list-head {
      display:flex;
      justify-content:space-between;
      gap:16px;
      align-items:flex-start;
      margin-bottom:10px;
    }
    .cohort-workspace-head h2, .report-list-head h2 { margin:0; }
    .cohort-workspace-head p, .report-list-head p {
      max-width:900px;
      margin:4px 0 0;
      color:var(--ink-3);
      font-size:12px;
    }
    .cohort-card {
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:6px 6px 0 var(--ink);
      padding:14px;
    }
    .cohort-card.primary { box-shadow:8px 8px 0 var(--red-mark); }
    .evaluation-routebar {
      display:flex;
      justify-content:space-between;
      gap:12px;
      align-items:end;
      margin:0 0 12px;
      border:2px solid var(--ink);
      background:var(--paper-2);
      padding:9px;
    }
    .evaluation-routebar label { min-width:min(100%, 360px); }
    .evaluation-routebar label span { display:block; margin-bottom:4px; color:var(--ink-3); font-family:"JetBrains Mono", ui-monospace, monospace; font-size:9px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
    .evaluation-routebar select { width:100%; }
    .evaluation-routebar nav { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:5px; }
    .evaluation-routebar button, .cohort-head-actions button, .comparison-tray button, .lineage-node, .lab-gate button { border:2px solid var(--ink); background:var(--paper); color:var(--ink); box-shadow:2px 2px 0 var(--ink); padding:6px 8px; font-family:"JetBrains Mono", ui-monospace, monospace; font-size:9px; font-weight:800; text-transform:uppercase; cursor:pointer; }
    .evaluation-routebar button.active { background:var(--ink); color:var(--paper); box-shadow:2px 2px 0 var(--red-mark); }
    .cohort-card-head {
      display:flex;
      justify-content:space-between;
      gap:14px;
      align-items:flex-start;
    }
    .cohort-card-head h3 { margin:2px 0 3px; overflow-wrap:anywhere; }
    .cohort-card-head p { margin:0; color:var(--ink-3); font-size:12px; }
    .evaluation-timestamp { font-family:"JetBrains Mono", ui-monospace, monospace; font-size:10px; font-weight:700; letter-spacing:.02em; }
    .cohort-head-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:6px; }
    .cohort-eyebrow, .cohort-metric span {
      display:block;
      color:var(--ink-3);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:10px;
      letter-spacing:.1em;
      text-transform:uppercase;
    }
    .cohort-decision {
      margin:12px 0;
      border-left:8px solid var(--yellow);
      background:var(--yellow-soft);
      padding:10px 12px;
    }
    .cohort-decision.attention { border-left-color:var(--red-mark); background:var(--brick-soft); }
    .cohort-decision.pass { border-left-color:var(--green); background:var(--moss-soft); }
    .cohort-decision.adaptation-supported { border-left-color:var(--green); background:var(--green-soft); }
    .cohort-decision.adaptation-contradicted { border-left-color:var(--red-mark); background:var(--brick-soft); }
    .decision-caveat { display:block; margin-top:4px; color:var(--ink-3); font-size:11px; font-weight:400; }
    .evaluation-progress { margin:12px 0 0; border:2px solid var(--ink); background:var(--paper-3); padding:10px 12px; display:grid; gap:6px; }
    .evaluation-progress-track { display:flex; align-items:center; gap:10px; }
    .evaluation-progress-track .live-progress { flex:1 1 160px; }
    .evaluation-progress-track strong { font-family:"JetBrains Mono", ui-monospace, monospace; font-size:11px; white-space:nowrap; }
    .evaluation-progress-meta { display:flex; flex-wrap:wrap; gap:5px 12px; align-items:baseline; font-size:11px; }
    .live-slice { border:1px solid var(--ink); background:var(--paper); padding:1px 7px; font-family:"JetBrains Mono", ui-monospace, monospace; font-size:10px; }
    .live-slice.stale { background:var(--brick-soft); }
    .evaluation-progress-note { margin:0; color:var(--ink-3); font-size:11px; max-width:920px; }
    .reading-guide { margin:10px 0; border:2px dashed var(--ink); background:var(--paper); }
    .reading-guide summary { padding:8px 12px; cursor:pointer; font-family:"JetBrains Mono", ui-monospace, monospace; font-size:10px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
    .reading-guide-body { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:10px; padding:2px 12px 12px; }
    .reading-guide-body div { border-top:2px solid var(--ink); padding-top:6px; }
    .reading-guide-body strong { display:block; font-family:"JetBrains Mono", ui-monospace, monospace; font-size:10px; letter-spacing:.05em; text-transform:uppercase; }
    .reading-guide-body p { margin:3px 0 0; font-size:11px; }
    .lab-2d-legend { margin:0 0 8px; color:var(--ink-3); font-size:11px; max-width:920px; }
    .cohort-metrics {
      display:grid;
      grid-template-columns:repeat(5,minmax(0,1fr));
      gap:8px;
    }
    .research-verdict-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; }
    .study-panel { margin:10px 0; border:2px solid var(--ink); background:var(--paper-3); padding:12px; }
    .study-panel h4 { margin:7px 0 3px; font-size:18px; }
    .study-panel p { margin:0; max-width:920px; }
    .study-panel dl { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:8px; margin:10px 0 0; }
    .study-panel dl div { border-top:2px solid var(--ink); padding-top:6px; }
    .study-panel dt { color:var(--ink-3); font-family:"JetBrains Mono", ui-monospace, monospace; font-size:9px; font-weight:800; text-transform:uppercase; }
    .study-panel dd { margin:2px 0 0; font-size:11px; }
    .adaptation-matrix { min-width:max(760px, 100%); }
    .adaptation-matrix th span { display:block; color:var(--red-mark); font-size:8px; }
    .matrix-cell { min-width:155px; border-left:7px solid var(--yellow); }
    .matrix-cell.adaptation-supported { border-left-color:var(--green); background:var(--green-soft); }
    .matrix-cell.adaptation-contradicted { border-left-color:var(--red-mark); background:var(--brick-soft); }
    .matrix-cell.adaptation-baseline { border-left-color:var(--ink); }
    .matrix-cell strong, .matrix-cell span, .matrix-cell em { display:block; }
    .matrix-cell strong { text-transform:uppercase; }
    .matrix-cell span, .matrix-cell em { margin-top:3px; color:var(--ink-3); font-size:9px; font-style:normal; }
    .lineage { display:grid; gap:10px; }
    .lineage-summary { display:flex; justify-content:space-between; gap:12px; }
    .lineage-track { display:flex; gap:8px; overflow-x:auto; padding:3px 3px 9px; }
    .lineage-node { flex:0 0 210px; display:grid; grid-template-columns:26px minmax(0,1fr); gap:4px 8px; text-align:left; text-transform:none; }
    .lineage-node.active { background:var(--ink); color:var(--paper); box-shadow:3px 3px 0 var(--red-mark); }
    .lineage-node span { grid-row:1 / 3; display:grid; place-items:center; border:1px solid currentColor; }
    .lineage-node strong, .lineage-node em { overflow-wrap:anywhere; }
    .lineage-node em { font-size:9px; font-style:normal; }
    .lab-view { display:grid; gap:10px; }
    .lab-warning, .lab-gate { border:2px solid var(--ink); border-left:9px solid var(--yellow); background:var(--yellow-soft); padding:11px; }
    .lab-warning strong, .lab-warning span { display:block; }
    .lab-warning span { margin-top:3px; font-size:11px; }
    .lab-2d { border:2px solid var(--ink); background:var(--paper-3); padding:10px; }
    .lab-2d h4 { margin:0 0 8px; }
    .lab-2d > div { display:grid; grid-template-columns:minmax(150px,1fr) repeat(3,auto); gap:9px; padding:6px 0; border-top:1px solid var(--ink); font-size:10px; }
    .lab-2d > div span { color:var(--ink-3); font-family:"JetBrains Mono", ui-monospace, monospace; }
    .lab-gate.pass { border-left-color:var(--green); background:var(--green-soft); }
    .lab-gate p { margin:4px 0; }
    .lab-gate ul { margin:7px 0 0; }
    .lab-3d { border:3px solid var(--ink); background:var(--paper); box-shadow:6px 6px 0 var(--violet); padding:11px; overflow:hidden; }
    .lab-3d-head { display:flex; justify-content:space-between; gap:10px; align-items:baseline; }
    .lab-3d-head h4 { margin:0; }
    .lab-3d-head span { color:var(--ink-3); font-family:"JetBrains Mono", ui-monospace, monospace; font-size:9px; text-transform:uppercase; }
    .lab-3d-scene { min-height:430px; display:grid; place-items:center; perspective:900px; overflow:hidden; }
    .lab-3d-stage { position:relative; width:min(68vw, 560px); aspect-ratio:1; border:3px solid var(--ink); transform-style:preserve-3d; transform:rotateX(58deg) rotateZ(-31deg); background:repeating-linear-gradient(0deg, transparent 0 54px, rgba(10,10,10,.12) 54px 56px), repeating-linear-gradient(90deg, transparent 0 54px, rgba(10,10,10,.12) 54px 56px), var(--paper-2); box-shadow:16px 18px 0 rgba(10,10,10,.12); }
    .lab-3d-point { position:absolute; left:var(--point-x); top:var(--point-y); display:grid; justify-items:center; transform:translate(-50%,-50%) translateZ(var(--point-z)); transform-style:preserve-3d; }
    .lab-3d-point i { width:14px; height:14px; border:2px solid var(--ink); border-radius:50%; background:var(--yellow); box-shadow:0 0 0 4px rgba(242,183,5,.25); }
    .lab-3d-point.adaptation-supported i { background:var(--green); box-shadow:0 0 0 4px rgba(0,155,114,.22); }
    .lab-3d-point.adaptation-contradicted i { background:var(--red-mark); box-shadow:0 0 0 4px rgba(230,57,70,.22); }
    .lab-3d-point b { max-width:100px; margin-top:2px; overflow:hidden; color:var(--ink); font-family:"JetBrains Mono", ui-monospace, monospace; font-size:8px; text-overflow:ellipsis; white-space:nowrap; }
    .lab-axis { position:absolute; color:var(--ink); font-family:"JetBrains Mono", ui-monospace, monospace; font-size:9px; font-weight:800; text-transform:uppercase; }
    .lab-axis.x { left:8px; bottom:5px; }
    .lab-axis.y { right:5px; top:8px; writing-mode:vertical-rl; }
    .lab-axis.z { left:8px; top:8px; }
    .lab-3d > p { margin:8px 0 0; color:var(--ink-3); font-size:10px; }
    .comparison-tray { position:sticky; bottom:10px; z-index:20; margin-top:14px; border:3px solid var(--ink); background:var(--paper); box-shadow:7px 7px 0 var(--red-mark); padding:10px; }
    .comparison-tray-head { display:flex; justify-content:space-between; gap:10px; align-items:center; margin-bottom:8px; }
    .comparison-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:8px; }
    .comparison-grid article { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:5px; border:2px solid var(--ink); padding:6px; }
    .comparison-grid article > button:first-child { display:grid; gap:2px; border:0; box-shadow:none; padding:3px; text-align:left; text-transform:none; }
    .comparison-grid strong, .comparison-grid span, .comparison-grid em { display:block; overflow-wrap:anywhere; }
    .comparison-grid span { color:var(--red-mark); font-size:9px; text-transform:uppercase; }
    .comparison-grid em { color:var(--ink-3); font-size:9px; font-style:normal; }
    .cohort-metric {
      min-width:0;
      border:2px solid var(--ink);
      background:var(--paper-3);
      padding:9px;
    }
    .cohort-metric strong { display:block; margin-top:3px; font-size:22px; overflow-wrap:anywhere; }
    .cohort-metric em { display:block; margin-top:3px; color:var(--ink-3); font-size:10px; font-style:normal; overflow-wrap:anywhere; }
    .cohort-read {
      display:flex;
      gap:10px;
      align-items:baseline;
      margin-top:10px;
      border-top:2px solid var(--ink);
      padding-top:9px;
      font-size:12px;
    }
    .cohort-read span { color:var(--ink-2); }
    .flat-signal {
      min-height:260px;
      display:flex;
      flex-direction:column;
      justify-content:center;
      border:2px solid var(--ink);
      background:var(--yellow-soft);
      box-shadow:5px 5px 0 var(--yellow);
      padding:24px;
    }
    .flat-signal strong { font-size:clamp(20px, 3vw, 32px); line-height:1.05; }
    .flat-signal p { max-width:620px; margin:10px 0 0; color:var(--ink-2); }
    .cohort-actions { margin-top:10px; font-size:12px; }
    .cohort-actions a {
      display:inline-block;
      margin:0 7px 6px 0;
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:2px 2px 0 var(--red-mark);
      padding:5px 7px;
      color:var(--ink);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:10px;
      font-weight:700;
      text-transform:uppercase;
    }
    .evaluation-profiles {
      margin-top:12px;
      border:2px solid var(--ink);
      background:var(--paper-2);
    }
    .evaluation-profiles > summary {
      cursor:pointer;
      padding:10px 12px;
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      font-weight:800;
      letter-spacing:.06em;
      text-transform:uppercase;
    }
    .profile-list { border-top:2px solid var(--ink); }
    .profile-row {
      display:grid;
      grid-template-columns:minmax(140px,1.2fr) 90px 100px 105px 105px minmax(110px,.8fr);
      gap:10px;
      align-items:center;
      padding:9px 11px;
      border-top:1px solid var(--ink);
      font-size:11px;
    }
    .profile-row:first-child { border-top:0; }
    .profile-row.profile-head {
      background:var(--paper-3);
      color:var(--ink-3);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:9px;
      font-weight:800;
      letter-spacing:.08em;
      text-transform:uppercase;
    }
    .profile-name strong, .profile-name span { display:block; overflow-wrap:anywhere; }
    .profile-name span { margin-top:2px; color:var(--ink-3); font-size:9px; }
    .profile-value strong, .profile-value span { display:block; }
    .profile-value span { margin-top:2px; color:var(--ink-3); font-size:9px; }
    .profile-actions a {
      display:inline-block;
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:2px 2px 0 var(--yellow);
      padding:4px 6px;
      color:var(--ink);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:9px;
      font-weight:800;
      text-transform:uppercase;
    }
    .experiment-arms { display:grid; gap:9px; margin-top:12px; }
    .experiment-arm {
      display:grid;
      grid-template-columns:minmax(180px,1.2fr) minmax(130px,.7fr) minmax(210px,1fr) minmax(120px,.6fr);
      gap:12px;
      align-items:center;
      border:2px solid var(--ink);
      background:var(--paper-2);
      padding:11px 12px;
    }
    .experiment-arm h4 { margin:2px 0 3px; font-size:17px; }
    .experiment-arm p { margin:0; color:var(--ink-3); font-size:10px; }
    .experiment-arm-status, .experiment-arm-result { display:grid; gap:3px; }
    .experiment-arm-status strong, .experiment-arm-result strong { font-size:12px; }
    .experiment-arm-status > span:not(.status) { color:var(--ink-3); font-size:9px; }
    .experiment-arm-result .chip { margin:2px 3px 0 0; }
    .cohort-history, .stale-run-group, .filter-panel, .artifact-history {
      margin-top:14px;
      border:2px solid var(--ink);
      background:var(--paper-2);
    }
    .cohort-history > summary, .stale-run-group > summary, .filter-panel > summary {
      cursor:pointer;
      padding:10px 12px;
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      font-weight:800;
      letter-spacing:.06em;
      text-transform:uppercase;
    }
    .cohort-history-grid { display:grid; gap:12px; padding:0 12px 14px; }
    .artifact-history { margin-top:20px; }
    .artifact-history > summary {
      display:flex;
      justify-content:space-between;
      gap:16px;
      align-items:flex-start;
      cursor:pointer;
      padding:12px 14px;
      list-style:none;
    }
    .artifact-history > summary::-webkit-details-marker { display:none; }
    .artifact-history > summary h2 { margin:0; }
    .artifact-history > summary p { max-width:820px; margin:4px 0 0; color:var(--ink-3); font-size:12px; }
    .artifact-history-body { border-top:2px solid var(--ink); padding:12px; }
    .live-run-list { display:grid; gap:8px; }
    details.live-run-card { padding:0; margin:0; }
    .live-run-card > summary {
      display:grid;
      grid-template-columns:minmax(0,1fr) auto auto;
      gap:12px;
      align-items:center;
      cursor:pointer;
      list-style:none;
      padding:10px 12px;
    }
    .live-run-card > summary::-webkit-details-marker { display:none; }
    .live-run-summary-main { min-width:0; }
    .live-run-summary-main strong, .live-run-summary-main em { display:block; overflow-wrap:anywhere; }
    .live-run-summary-main em { margin-top:2px; color:var(--ink-3); font-size:11px; font-style:normal; }
    .live-run-summary-progress { color:var(--ink-3); font-family:"JetBrains Mono", ui-monospace, monospace; font-size:11px; }
    .live-run-body { border-top:2px solid var(--ink); padding:0 12px 12px; }
    .stale-run-group > .live-run-list { padding:0 10px 10px; }
    .filter-panel { margin:0 0 12px; }
    .filter-panel > summary { display:flex; justify-content:space-between; gap:12px; }
    .filter-panel .toolbar { border-top:2px solid var(--ink); }
    .report-card-list { display:none; gap:10px; }
    .report-index-card {
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:4px 4px 0 var(--ink);
      padding:11px;
    }
    .report-index-card[hidden] { display:none; }
    .report-index-card-head { display:flex; justify-content:space-between; gap:10px; align-items:flex-start; }
    .report-index-card-head strong, .report-index-card-head span { display:block; overflow-wrap:anywhere; }
    .report-index-card-head div > span { margin-top:3px; color:var(--ink-3); font-size:11px; }
    .report-index-card > p { margin:9px 0; color:var(--ink-3); font-size:11px; overflow-wrap:anywhere; }
    .report-card-stats { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; }
    .report-card-stats span { border:1px solid var(--ink); padding:6px; color:var(--ink-3); font-size:10px; }
    .report-card-stats b { display:block; color:var(--ink); font-size:15px; }
    .report-card-policies, .report-card-actions { margin-top:9px; }
    .read-first-cards {
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:10px;
      margin:12px 0;
    }
    .read-first-card {
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:4px 4px 0 var(--red-mark);
      padding:11px;
    }
    .read-first-card-head { display:flex; gap:8px; align-items:baseline; }
    .read-first-card-head span { font-family:"JetBrains Mono", ui-monospace, monospace; color:var(--red-mark); font-weight:800; }
    .read-first-card p { margin:6px 0 9px; color:var(--ink-2); }
    .read-first-card-stats { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; }
    .read-first-card-stats span { border-top:1px solid var(--ink); padding-top:5px; color:var(--ink-3); font-size:10px; }
    .read-first-card-stats b { display:block; color:var(--ink); font-size:14px; overflow-wrap:anywhere; }
    .adaptation-headline {
      display:grid;
      gap:4px;
      margin:10px 0;
      border:2px solid var(--ink);
      border-left:9px solid var(--yellow);
      background:var(--yellow-soft);
      box-shadow:4px 4px 0 var(--ink);
      padding:12px 14px;
    }
    .adaptation-headline.supported { border-left-color:var(--green); background:var(--green-soft); }
    .adaptation-headline.contradicted { border-left-color:var(--red-mark); background:var(--brick-soft); }
    .adaptation-headline span { color:var(--ink-3); font-size:12px; }
    .read-first-card.adaptation-supported { box-shadow:4px 4px 0 var(--green); }
    .read-first-card.adaptation-contradicted { box-shadow:4px 4px 0 var(--red-mark); }
    .read-first-card.adaptation-baseline { box-shadow:4px 4px 0 var(--ink); }
    .status.adaptation-supported { background:var(--green-soft); border-color:var(--green); }
    .status.adaptation-contradicted { background:var(--brick-soft); border-color:var(--red-mark); }
    .status.adaptation-mixed, .status.adaptation-not_established, .status.adaptation-pending { background:var(--yellow-soft); }
    .read-first-details { margin:12px 0; border:2px solid var(--ink); background:var(--paper-2); }
    .read-first-details > summary { cursor:pointer; padding:10px 12px; font-family:"JetBrains Mono", ui-monospace, monospace; font-size:11px; font-weight:800; text-transform:uppercase; }
    .read-first-details .table-scroll { border-top:2px solid var(--ink); }
    .adaptation-timeline { display:grid; gap:8px; }
    .adaptation-timeline-key { display:flex; flex-wrap:wrap; gap:8px; color:var(--ink-3); font-family:"JetBrains Mono", ui-monospace, monospace; font-size:10px; }
    .adaptation-timeline-key span { border:1px solid var(--ink); background:var(--paper); padding:4px 6px; }
    .adaptation-timeline-key .positive { border-left:6px solid var(--green); }
    .adaptation-timeline-key .neutral { border-left:6px solid var(--yellow); }
    .adaptation-timeline-key .negative { border-left:6px solid var(--red-mark); }
    .adaptation-trial { border:2px solid var(--ink); background:var(--paper-2); }
    .adaptation-trial > summary { display:flex; justify-content:space-between; gap:12px; cursor:pointer; padding:9px 11px; font-size:11px; }
    .adaptation-trial > summary span { color:var(--ink-3); font-family:"JetBrains Mono", ui-monospace, monospace; font-size:10px; }
    .adaptation-trial-body { border-top:2px solid var(--ink); padding:10px; }
    .adaptation-strip { display:flex; gap:6px; overflow-x:auto; padding:2px 2px 8px; }
    .adaptation-moment { flex:0 0 96px; min-height:70px; display:grid; align-content:start; gap:2px; border:2px solid var(--ink); border-top:8px solid var(--yellow); background:var(--paper); color:var(--ink); padding:6px; text-align:left; cursor:pointer; }
    .adaptation-moment.positive { border-top-color:var(--green); }
    .adaptation-moment.negative { border-top-color:var(--red-mark); }
    .adaptation-moment span, .adaptation-moment em { color:var(--ink-3); font-size:9px; font-style:normal; }
    .adaptation-moment strong { overflow:hidden; text-overflow:ellipsis; font-size:10px; white-space:nowrap; }
    .adaptation-links { display:flex; flex-wrap:wrap; gap:7px; margin-top:8px; }
    .adaptation-links a { border:2px solid var(--ink); background:var(--paper); box-shadow:2px 2px 0 var(--red-mark); padding:4px 7px; color:var(--ink); font-family:"JetBrains Mono", ui-monospace, monospace; font-size:9px; font-weight:800; text-transform:uppercase; }
    .viz-jump-active, .transcript-jump-active { outline:6px solid var(--yellow); outline-offset:4px; }
    .viz-layout { grid-template-columns:minmax(0,1fr); }
    .viz-sidebar { border-left:0; border-top:2px solid var(--ink); padding:0; }
    .viz-sidebar > summary { cursor:pointer; padding:11px 14px; font-family:"JetBrains Mono", ui-monospace, monospace; font-size:11px; font-weight:800; text-transform:uppercase; }
    .viz-sidebar-body { border-top:2px solid var(--ink); padding:14px; }
    .viz-toolbar { position:sticky; top:0; z-index:8; grid-template-columns:repeat(5,minmax(0,1fr)); }
    .viz-toolbar label, .viz-control-group { min-height:76px; padding:12px 10px 10px; }
    .viz-mode-buttons button { flex:1 1 104px; }
    @keyframes livePulse {
      0% { box-shadow:0 0 0 0 rgba(230,57,70,0.42); }
      70% { box-shadow:0 0 0 9px rgba(230,57,70,0); }
      100% { box-shadow:0 0 0 0 rgba(230,57,70,0); }
    }
    @keyframes liveStripe { from { background-position:0 0; } to { background-position:23px 0; } }
    @media (max-width: 1220px) {
      .viz-toolbar {
        grid-template-columns:repeat(3,minmax(0,1fr));
      }
    }
    @media (max-width: 1100px) {
      .report-shell { display:block; }
      .report-content { margin-top:14px; }
      .report-section { scroll-margin-top:92px; }
      .report-nav {
        position:sticky;
        top:0;
        z-index:12;
        max-height:none;
        overflow-x:auto;
      }
      .report-nav-list {
        display:flex;
        gap:6px;
        min-width:max-content;
      }
      .report-nav a {
        border-left:0;
        border-bottom:3px solid var(--rule);
        padding:6px 8px;
        white-space:nowrap;
      }
      .report-nav a:hover, .report-nav a:focus { border-bottom-color:var(--brick); }
    }
    @media (max-width: 900px) {
      .summary-panel, .learner-panel, .viz-layout, .big-picture-grid, .big-picture-viz-grid, .learner-dashboard-grid { grid-template-columns:1fr; }
      .big-picture-head { display:block; }
      .viz-sidebar { border-left:0; border-top:1px solid var(--rule); }
      .viz-toolbar, .toolbar, .transcript-toolbar { grid-template-columns:1fr; }
      .toolbar .control:first-child { grid-column:1 / -1; }
      .viz-canvas-wrap canvas { height:360px; }
      .viz-readout-grid { grid-template-columns:1fr; }
      .viz-readout-lines p { grid-template-columns:1fr; }
      .transcript-voice-grid, .transcript-plate-voices, .transcript-swim-head, .transcript-swim-row { grid-template-columns:1fr; }
      .transcript-swim-label.spine, .transcript-spine { display:none; }
      .transcript-swim-label.learner { text-align:left; }
      .transcript-lane.empty { display:none; }
      .table-scroll { padding-right:6px; }
      .live-run-progress { grid-template-columns:1fr; }
      .cohort-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .research-verdict-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .evaluation-routebar { display:block; }
      .evaluation-routebar nav { justify-content:flex-start; margin-top:8px; }
      .cohort-metric:last-child { grid-column:1 / -1; }
      .profile-row { grid-template-columns:minmax(130px,1.2fr) 80px 90px 90px minmax(100px,.8fr); }
      .profile-row > :nth-child(5) { display:none; }
      .experiment-arm { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .report-index-scroll { display:none; }
      .report-card-list { display:grid; }
      .filter-panel .toolbar { grid-template-columns:1fr; }
      .live-run-card > summary { grid-template-columns:minmax(0,1fr) auto; }
      .live-run-summary-progress { grid-column:1 / -1; }
      .read-first-cards { grid-template-columns:1fr; }
      .viz-toolbar { position:static; grid-template-columns:repeat(2,minmax(0,1fr)); }
      .viz-run-control { grid-column:1; grid-row:1; }
      .viz-turn-control { grid-column:2; grid-row:1; }
      .viz-view-control { grid-column:1 / -1; grid-row:2; }
      .viz-variable-control { grid-column:1; grid-row:3; }
      .viz-playback-control { grid-column:2; grid-row:3; }
      .viz-mode-buttons button { flex:1 1 92px; }
      .viz-step-buttons button { flex:1 1 52px; }
    }
    @media (max-width: 560px) {
      header, main { padding-left:16px; padding-right:16px; }
      .metrics { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .metric { min-height:106px; }
      .cohort-workspace-head, .cohort-card-head, .report-list-head { display:block; }
      .cohort-head-actions { justify-content:flex-start; margin-top:8px; }
      .cohort-workspace-head .live-count, .cohort-card-head .status { display:inline-block; margin-top:8px; }
      .cohort-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .cohort-read { display:block; }
      .cohort-read span { display:block; margin-top:4px; }
      .artifact-history > summary { display:block; }
      .artifact-history > summary .live-count { display:inline-block; margin-top:8px; }
      .profile-row { grid-template-columns:minmax(0,1fr) auto; gap:7px; }
      .profile-row.profile-head { display:none; }
      .profile-row > * { display:block !important; }
      .profile-row > .profile-value { text-align:right; }
      .profile-row > .profile-actions { grid-column:1 / -1; text-align:left; }
      .experiment-arm { grid-template-columns:1fr; }
      .policy-bar-row { grid-template-columns:1fr; gap:5px; }
      .policy-bar-meta { white-space:normal; }
      .research-verdict-grid { grid-template-columns:1fr; }
      .lab-2d > div { grid-template-columns:1fr; }
      .lab-3d-scene { min-height:330px; }
      .lab-3d-stage { width:260px; }
      .comparison-tray { position:static; }
    }
    @media (max-width: 350px) {
      .metrics, .cohort-metrics { grid-template-columns:1fr; }
      .cohort-metric:last-child { grid-column:auto; }
      .viz-toolbar { grid-template-columns:1fr; }
      .viz-run-control, .viz-turn-control, .viz-view-control, .viz-variable-control, .viz-playback-control { grid-column:auto; grid-row:auto; }
    }
  `;
}

export function tutorStubIndexClientJs() {
  return String.raw`(function () {
  var app = document.querySelector('[data-index-root]');
  if (!app) return;
  var state = { data: null, rendered: false };
  var uiStorageKey = 'machinespirits.tutorStub.reportIndex.v1';
  var allowedViews = ['verdict', 'matrix', 'profiles', 'lineage', 'lab'];
  function routeState(cohorts) {
    var params = new URLSearchParams(window.location.search);
    var available = (cohorts || []).map(function (cohort) { return cohort.id; });
    var requestedEvaluation = params.get('evaluation') || '';
    var evaluation = available.indexOf(requestedEvaluation) >= 0 ? requestedEvaluation : (available[0] || '');
    var requestedView = params.get('view') || 'verdict';
    var view = allowedViews.indexOf(requestedView) >= 0 ? requestedView : 'verdict';
    var compare = (params.get('compare') || '').split(',').filter(function (id, index, values) {
      return id && available.indexOf(id) >= 0 && values.indexOf(id) === index;
    }).slice(0, 3);
    if (evaluation && params.get('evaluation') !== evaluation) {
      params.set('evaluation', evaluation);
      window.history.replaceState({}, '', window.location.pathname + '?' + params.toString() + window.location.hash);
    }
    return { evaluation: evaluation, view: view, compare: compare };
  }
  function updateRoute(patch, replace) {
    var params = new URLSearchParams(window.location.search);
    Object.keys(patch || {}).forEach(function (key) {
      var value = patch[key];
      if (Array.isArray(value)) value = value.join(',');
      if (value === '' || value == null) params.delete(key);
      else params.set(key, value);
    });
    var url = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
    window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
    if (state.data) render(state.data);
  }
  function mergeResearchData(liveData, researchData) {
    if (!researchData || !researchData.cohorts) return liveData;
    var researchCohorts = {};
    (researchData.cohorts || []).forEach(function (cohort) { researchCohorts[cohort.id] = cohort; });
    var cohorts = (liveData.cohorts || []).map(function (live) {
      var research = researchCohorts[live.id];
      if (!research) return live;
      var researchProfiles = {};
      (research.childReports || []).forEach(function (profile) { researchProfiles[profile.learnerProfile] = profile; });
      var childReports = (live.childReports || []).map(function (profile) {
        return Object.assign({}, researchProfiles[profile.learnerProfile] || {}, profile, {
          adaptationEvidence: (researchProfiles[profile.learnerProfile] || {}).adaptationEvidence || profile.adaptationEvidence || null
        });
      });
      return Object.assign({}, research, live, {
        adaptation: research.adaptation || live.adaptation,
        study: research.study || live.study,
        lineage: research.lineage || live.lineage,
        lab3d: research.lab3d || live.lab3d,
        childReports: childReports
      });
    });
    var researchRows = {};
    (researchData.rows || []).forEach(function (row) { researchRows[row.reportName] = row; });
    var rows = (liveData.rows || []).map(function (row) {
      var research = researchRows[row.reportName];
      return research ? Object.assign({}, research, row, { adaptationEvidence: research.adaptationEvidence || row.adaptationEvidence || null }) : row;
    });
    return Object.assign({}, liveData, { cohorts: cohorts, rows: rows });
  }
  function mergeExperimentData(liveData, experimentData) {
    if (!experimentData || !Array.isArray(experimentData.cohorts)) return liveData;
    var experiments = {};
    experimentData.cohorts.forEach(function (cohort) { experiments[cohort.id] = cohort; });
    var cohorts = (liveData.cohorts || []).filter(function (cohort) { return !experiments[cohort.id]; });
    cohorts = cohorts.concat(experimentData.cohorts || []).sort(function (left, right) {
      var rank = { running:4, pending:3, completed:2, stale:1 };
      return (rank[right.status] || 0) - (rank[left.status] || 0) || Date.parse(right.completedAt || '') - Date.parse(left.completedAt || '');
    });
    return Object.assign({}, liveData, { cohorts:cohorts });
  }
  async function refreshExperimentProgress(data) {
    var experiments = (data.cohorts || []).filter(function (cohort) { return cohort.kind === 'experiment_placeholder'; });
    await Promise.all(experiments.map(async function (cohort) {
      var arms = cohort.childReports || [];
      await Promise.all(arms.map(async function (arm) {
        if (!arm.stateHref) return;
        try {
          var response = await fetch(arm.stateHref + (arm.stateHref.indexOf('?') >= 0 ? '&' : '?') + 'ts=' + Date.now(), { cache:'no-store' });
          if (!response.ok) return;
          var state = await response.json();
          var updatedMs = Date.parse(state.updatedAt || '');
          arm.status = state.status === 'running' && Number.isFinite(updatedMs) && Date.now() - updatedMs > 900000 ? 'stale' : (state.status || arm.status);
          arm.completedTrials = Number(state.totals && state.totals.completed || 0);
          arm.expectedTrials = Number(state.totals && state.totals.jobs || arm.expectedTrials || 0);
          arm.ok = Number(state.totals && state.totals.ok || 0);
          arm.failed = Number(state.totals && state.totals.failed || 0);
          arm.totals = state.totals || arm.totals;
          arm.completedAt = state.updatedAt || arm.completedAt;
          if (state.config && state.config.policies) arm.policies = state.config.policies;
        } catch (error) { /* arm state can legitimately be absent before launch */ }
      }));
      var completed = arms.reduce(function (sum, arm) { return sum + Number(arm.completedTrials || 0); }, 0);
      var expected = arms.reduce(function (sum, arm) { return sum + Number(arm.expectedTrials || 0); }, 0);
      var completedArms = arms.filter(function (arm) { return arm.status === 'completed'; }).length;
      var runningArms = arms.filter(function (arm) { return arm.status === 'running'; }).length;
      var staleArms = arms.filter(function (arm) { return arm.status === 'stale'; }).length;
      var failed = arms.reduce(function (sum, arm) { return sum + Number(arm.failed || 0); }, 0);
      cohort.status = runningArms ? 'running' : staleArms ? 'stale' : completedArms === arms.length ? 'completed' : 'pending';
      cohort.completedProfiles = completedArms;
      cohort.runningCount = runningArms;
      cohort.staleCount = staleArms;
      cohort.failed = failed;
      cohort.completedAt = arms.reduce(function (latest, arm) {
        return Date.parse(arm.completedAt || '') > Date.parse(latest || '') ? arm.completedAt : latest;
      }, cohort.completedAt || '');
      cohort.progress = {
        trialsCompleted:completed,
        trialsExpected:expected,
        trialRate:expected ? completed/expected : null,
        liveProfiles:arms.filter(function (arm) { return arm.status === 'running' || arm.status === 'stale'; }).map(function (arm) { return { profile:arm.learnerProfile, status:arm.status, completedTrials:arm.completedTrials, expectedTrials:arm.expectedTrials, repairPass:false, retriedStatuses:[] }; }),
        lastActivityAt:cohort.completedAt || ''
      };
      var headline = cohort.status === 'completed'
        ? 'Data collection is complete; the declared paired analysis is ready to run.'
        : cohort.status === 'stale'
          ? 'Work in progress is stale; inspect the affected arm before interpreting partial data.'
          : 'Work in progress: ' + completed + '/' + (expected || '?') + ' planned trials have finished across ' + arms.length + ' arms.';
      cohort.decision = headline;
      if (cohort.adaptation) cohort.adaptation.headline = headline;
      if (cohort.experiment) cohort.experiment.analysisStatus = cohort.status === 'completed' ? 'ready' : 'waiting_for_all_arms';
    }));
    return data;
  }
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function shortDate(value) {
    if (!value) return '';
    var date = new Date(value);
    if (!Number.isFinite(date.getTime())) return String(value).replace(/\.\d{3}Z$/g, 'Z').replace('T', ' ');
    try {
      var parts = new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
        timeZoneName: 'short'
      }).formatToParts(date);
      var values = {};
      parts.forEach(function (part) { if (part.type !== 'literal') values[part.type] = part.value; });
      return [values.year, values.month, values.day].join('-') + ' ' + [values.hour, values.minute, values.second].join(':') + ' ' + (values.timeZoneName || Intl.DateTimeFormat().resolvedOptions().timeZone || 'local');
    } catch (error) {
      return String(value).replace(/\.\d{3}Z$/g, 'Z').replace('T', ' ');
    }
  }
  function evaluationTimestamp(cohort) {
    var value = shortDate(cohort && cohort.completedAt);
    if (!value) return 'timestamp pending';
    var live = cohort && (cohort.status === 'running' || cohort.status === 'stale');
    return (live ? 'updated ' : 'completed ') + value;
  }
  function relativeTime(value) {
    var ms = Date.parse(value || '');
    if (!Number.isFinite(ms)) return '';
    var minutes = Math.floor(Math.max(0, Date.now() - ms) / 60000);
    if (minutes < 1) return 'under a minute ago';
    if (minutes < 60) return minutes + 'm ago';
    var hours = Math.floor(minutes / 60);
    if (hours < 48) return hours + 'h ' + (minutes % 60) + 'm ago';
    return Math.floor(hours / 24) + 'd ago';
  }
  function statusExplainer(status) {
    if (status === 'running') return 'A runner reported progress within the last 15 minutes. All numbers on this card cover finished trials only and will keep changing.';
    if (status === 'stale') return 'A runner stopped reporting for more than 15 minutes without finishing its plan. Check its log under Run Operations before trusting these partial numbers.';
    if (status === 'pending') return 'The experiment is declared, but one or more arms have not started or have not written a report yet.';
    return 'No runner is active for this evaluation. Every number reads from the latest saved report of each reported unit.';
  }
  function evaluationProgressModel(cohort) {
    if (cohort.progress && Number(cohort.progress.trialsExpected || 0) > 0) return cohort.progress;
    var reports = cohort.childReports || [];
    if (!reports.length) return null;
    var completed = 0;
    var expected = 0;
    var liveProfiles = [];
    reports.forEach(function (report) {
      completed += Number(report.completedTrials || 0);
      expected += Number(report.expectedTrials || 0);
      if (report.status === 'running' || report.status === 'stale') {
        liveProfiles.push({
          profile: report.learnerProfile,
          status: report.status,
          completedTrials: Number(report.completedTrials || 0),
          expectedTrials: Number(report.expectedTrials || 0),
          repairPass: Boolean(report.resume),
          retriedStatuses: (report.resume && report.resume.statuses) || []
        });
      }
    });
    if (!expected) return null;
    return { trialsCompleted: completed, trialsExpected: expected, trialRate: completed / expected, liveProfiles: liveProfiles, lastActivityAt: cohort.completedAt || '' };
  }
  function renderEvaluationProgress(cohort) {
    var progress = evaluationProgressModel(cohort);
    if (!progress) return '';
    var expected = Number(progress.trialsExpected || 0);
    var completed = Number(progress.trialsCompleted || 0);
    var rate = progress.trialRate == null ? completed / expected : Number(progress.trialRate);
    var live = progress.liveProfiles || [];
    var unitLabel = cohort.unitLabel || 'profile';
    var hasRepairPass = live.some(function (slice) { return slice.repairPass; });
    var chips = live.map(function (slice) {
      var label = slice.profile + ' ' + slice.completedTrials + '/' + slice.expectedTrials + (slice.repairPass ? ' repair pass' : '');
      var tip = slice.repairPass
        ? 'This pass re-runs only trials that previously failed; earlier finished trials are kept on disk and stay in the report.'
        : 'First pass over the planned trials for this ' + unitLabel + '.';
      return '<span class="live-slice ' + esc(slice.status) + '" title="' + esc(tip) + '">' + esc(label) + '</span>';
    }).join('');
    var profileCount = cohort.expectedProfiles ? (cohort.completedProfiles || 0) + '/' + cohort.expectedProfiles + ' ' + unitLabel + (Number(cohort.expectedProfiles) === 1 ? '' : 's') + ' reported' : '';
    var activity = progress.lastActivityAt ? 'last activity ' + relativeTime(progress.lastActivityAt) : '';
    var note = statusExplainer(cohort.status);
    if (hasRepairPass) note += ' Live profiles count their current pass, so trial totals can be smaller than the original plan.';
    if (cohort.status === 'completed' && cohort.expectedProfiles && Number(cohort.completedProfiles || 0) < Number(cohort.expectedProfiles)) {
      note += ' Some planned ' + unitLabel + 's never produced a report; resume them or the verdict stays partial.';
    }
    return '<div class="evaluation-progress" aria-label="Evaluation progress"><div class="evaluation-progress-track">' + progressBar(rate) + '<strong>' + esc(completed) + '/' + esc(expected) + ' trials finished (' + Math.round(Math.max(0, Math.min(1, rate)) * 100) + '%)</strong></div><div class="evaluation-progress-meta">' + (profileCount ? '<span>' + esc(profileCount) + '</span>' : '') + chips + (activity ? '<span class="muted">' + esc(activity) + '</span>' : '') + '</div><p class="evaluation-progress-note">' + esc(note) + '</p></div>';
  }
  function renderReadingGuide() {
    var entries = [
      ['Outcome vs adaptation', 'Two separate questions. Outcome: did learners reach grounded closure at all (achieved when an arm reaches 95% closure and 95% coverage). Adaptation: did any state-aware policy beat the baseline arm. A run routinely achieves the outcome while establishing no adaptation advantage.'],
      ['contingency', 'Normalized mutual information (0 to 1) between the learner state before a turn and the strategy the tutor picked. 0.000 means strategy choice did not track learner state, or there were too few observations to tell. Counts as present at 0.05 or higher with at least 6 state-action observations.'],
      ['benefit', 'Weighted outcome difference against the baseline policy inside the same learner profile: closure 35%, coverage 25%, mastery gain 15%, risk reduction 15%, turn efficiency 10%. Above +0.02 supports adaptation; below -0.05 with 6 or more transitions contradicts it.'],
      ['positive x% / n', 'Of the n strategy-shift moments that received a scored next-turn effect, the share that moved the learner forward. n0 means no scored transitions exist yet: that is missing evidence, not evidence of a zero effect.'],
      ['verdict ladder', 'pending: trials failed or data still missing. not established: evidence present but below every threshold. mixed: some evidence dimensions present. supported or contradicted: the benefit threshold was crossed with enough transitions. baseline: the comparison arm itself, never scored against itself.']
    ];
    return '<details class="reading-guide" data-persist-details="reading-guide"><summary>How to read these numbers</summary><div class="reading-guide-body">' + entries.map(function (entry) {
      return '<div><strong>' + esc(entry[0]) + '</strong><p>' + esc(entry[1]) + '</p></div>';
    }).join('') + '</div></details>';
  }
  function indexRunKindLabel(kind) {
    if (kind === 'dry') return 'dry run';
    if (kind === 'smoke') return 'smoke run';
    return 'real run';
  }
  function scopeBadge(scope) {
    if (scope && scope.kind === 'qa_matrix_child') {
      return '<span class="scope-badge matrix">' + esc(scope.label || 'Profile artifact') + '</span>';
    }
    return '';
  }
  function scopeNote(scope) {
    if (scope && scope.kind === 'qa_matrix_child') {
      var links = [
        ['QA summary', scope.qaMatrixMarkdownHref],
        ['profile gate', scope.discriminationMarkdownHref],
        ['QA plan', scope.planHref]
      ].filter(function (item) { return item[1]; }).map(function (item) {
        return '<a href="' + esc(item[1]) + '">' + esc(item[0]) + '</a>';
      }).join(' ');
      return '<span class="scope-note">Evaluation: ' + esc(scope.matrixId || 'unknown') + (links ? ' · ' + links : '') + '</span>';
    }
    return '';
  }
  function infoTerm(label, tooltip) {
    return '<span class="info-term" tabindex="0" data-tip="' + esc(tooltip || label) + '">' + esc(label) + '</span>';
  }
  function htmlMetric(label, value, sub) {
    return '<div class="metric"><div class="metric-label">' + label + '</div><div class="metric-value">' + esc(value) + '</div><div class="metric-sub">' + esc(sub || '') + '</div></div>';
  }
  function policyChips(policies) {
    if (!policies || !policies.length) return '<span class="muted">none</span>';
    return policies.map(function (policy) { return '<span class="chip">' + esc(policy) + '</span>'; }).join('');
  }
  function pct(value) {
    var numeric = Number(value);
    return Number.isFinite(numeric) ? Math.round(numeric * 100) + '%' : 'n/a';
  }
  function field(value) {
    var numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(3) : 'n/a';
  }
  function signed(value) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return 'n/a';
    return (numeric >= 0 ? '+' : '') + numeric.toFixed(3);
  }
  function positive(value) {
    var numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(3) : 'n/a';
  }
  function measure(value) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return '';
    return String(Number(numeric.toFixed(3)));
  }
  function clamp01(value) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(1, numeric));
  }
  function vizColor(index) {
    var colors = ['#E63946', '#0057B8', '#009B72', '#F2B705', '#6B4EFF', '#D72670', '#0A0A0A', '#737373'];
    return colors[Math.abs(Number(index || 0)) % colors.length];
  }
  function turnLabel(value) {
    var numeric = Number(value);
    return Number.isFinite(numeric) ? String(Number(numeric.toFixed(1))) : 'n/a';
  }
  function coverageCell(value) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return '<span class="muted">not scored</span>';
    var bounded = Math.max(0, Math.min(1, numeric));
    return '<div class="index-measure"><strong>' + Math.round(bounded * 100) + '% <span>evidence path</span></strong><em>mean learner-DAG coverage ' + esc(measure(numeric)) + '</em></div>';
  }
  function fieldSnapshotCell(row) {
    var count = Number(row.svgCount || 0);
    var label = count + ' field ' + (count === 1 ? 'snapshot' : 'snapshots');
    var body = row.svgHref ? '<a href="' + esc(row.svgHref) + '">' + esc(label) + '</a>' : esc(label);
    return '<div class="index-measure"><strong>' + body + '</strong><em>' + (count ? 'static SVG exports for inspection' : 'no exported field artifacts') + '</em></div>';
  }
  function reportActionLinks(row) {
    return (row.htmlHref ? '<a href="' + esc(row.htmlHref) + '">report</a>' : '<span class="muted">report</span>') + ' <a href="' + esc(row.jsonHref) + '">json</a>';
  }
  function optionHtml(values) {
    return (values || []).map(function (value) { return '<option value="' + esc(value) + '">' + esc(value) + '</option>'; }).join('');
  }
  function progressBar(rate) {
    var bounded = Math.max(0, Math.min(1, Number(rate || 0)));
    return '<span class="live-progress" aria-label="' + Math.round(bounded * 100) + '% complete"><span style="width:' + Math.round(bounded * 100) + '%"></span></span>';
  }
  function renderLiveJob(job) {
    var coverage = job.coverage == null ? '' : ' · c' + esc(job.coverage);
    var bottleneck = job.bottleneck ? ' · ' + esc(job.bottleneck === 'grounded_asserted_secret' ? 'closed' : job.bottleneck) : '';
    var lastType = job.lastType ? ' · ' + esc(job.lastType) : '';
    var links = [job.logHref ? '<a href="' + esc(job.logHref) + '">log</a>' : '', job.traceHref ? '<a href="' + esc(job.traceHref) + '">trace</a>' : ''].filter(Boolean).join(' ');
    return '<article class="live-job ' + esc(job.status || 'queued') + '"><div><strong>' + esc(job.policy) + ' r' + esc(job.runIndex) + '</strong> <span>' + esc(job.status || 'queued') + '</span></div><p>' + esc(job.turns || 0) + ' turns' + coverage + bottleneck + lastType + '</p><div class="live-links">' + (links || '<span class="muted">waiting for trace</span>') + '</div></article>';
  }
  function renderLiveRunCard(run) {
    var totals = run.totals || {};
    var rate = totals.progressRate != null ? totals.progressRate : (totals.jobs ? Number(totals.completed || 0) / Number(totals.jobs || 1) : 0);
    var activeJobs = run.activeJobs && run.activeJobs.length ? run.activeJobs : (run.jobs || []).filter(function (job) { return job.status !== 'queued'; }).slice(-6);
    return '<details class="live-run-card ' + esc(run.status) + '" data-persist-details="run:' + esc(run.runName) + '"><summary><span class="live-run-summary-main"><strong>' + esc(run.runName) + '</strong><em>' + esc(run.learnerProfile || 'unknown learner') + ' · ' + esc(run.dagMode || 'strict_dag') + '</em></span><span class="live-run-summary-progress">' + esc(totals.completed || 0) + '/' + esc(totals.jobs || 0) + ' jobs</span><span class="status ' + esc(run.status) + '">' + esc(run.status) + '</span></summary><div class="live-run-body"><div class="live-run-progress">' + progressBar(rate) + '<span>' + esc(totals.active || 0) + ' active · ' + esc(totals.queued || 0) + ' queued · ' + esc(totals.failed || 0) + ' failed</span></div><div class="live-run-meta"><span>started ' + esc(shortDate(run.startedAt)) + '</span><span>updated ' + esc(shortDate(run.updatedAt)) + '</span><span>' + policyChips(run.policies) + '</span></div>' + scopeNote(run.reportScope) + '<div class="live-jobs">' + (activeJobs.map(renderLiveJob).join('\n') || '<span class="muted">No active jobs.</span>') + '</div><div class="live-actions"><a href="' + esc(run.stateHref) + '">state json</a> ' + (run.traceDirHref ? '<a href="' + esc(run.traceDirHref) + '">trace dir</a>' : '') + '</div></div></details>';
  }
  function renderLiveRuns(activeRuns) {
    if (!activeRuns || !activeRuns.length) return '';
    var running = activeRuns.filter(function (run) { return run.status === 'running'; });
    var stale = activeRuns.filter(function (run) { return run.status === 'stale'; });
    var other = activeRuns.filter(function (run) { return run.status !== 'running' && run.status !== 'stale'; });
    var current = running.concat(other);
    return '<details class="live-runs operations-drawer" aria-label="Run operations" data-persist-details="operations-drawer"><summary><span><span class="live-dot"></span><strong>Run Operations</strong><em>Jobs, logs, traces, and stale-worker attention</em></span><span class="live-count">' + esc(running.length) + ' running · ' + esc(stale.length) + ' stale</span></summary><div class="operations-drawer-body"><div class="live-run-list">' + (current.map(renderLiveRunCard).join('') || '<p class="muted">No runs are currently executing.</p>') + '</div>' + (stale.length ? '<details class="stale-run-group" data-persist-details="stale-runs"><summary>Needs attention: ' + esc(stale.length) + ' stale run' + (stale.length === 1 ? '' : 's') + '</summary><div class="live-run-list">' + stale.map(renderLiveRunCard).join('') + '</div></details>' : '') + '</div></details>';
  }
  function projectionFor(row, index) {
    var turnEfficiency = Number.isFinite(Number(row.meanTurns)) ? clamp01(1 - Number(row.meanTurns) / 120) : 0;
    return {
      key: row.key,
      x: clamp01(row.closureRate),
      y: turnEfficiency,
      z: clamp01(row.signalScore),
      radius: Math.max(5, Math.min(18, 5 + Math.sqrt(Number(row.ok || 0)) * 2)),
      colorIndex: index
    };
  }
  function learnerProjection(model) {
    var projected = model && model.projections && model.projections.learners;
    if (projected && projected.length) return projected;
    return (model.learnerStats || []).map(projectionFor);
  }
  function renderLearnerMap(model) {
    var rows = model.learnerStats || [];
    if (!rows.length) return '<div class="viz-frame"><div class="viz-caption">No learner profile rows yet.</div></div>';
    var points = learnerProjection(model);
    var byKey = {};
    rows.forEach(function (row) { byKey[row.key] = row; });
    var width = 760;
    var height = 330;
    var left = 76;
    var right = 28;
    var top = 28;
    var bottom = 62;
    var chartW = width - left - right;
    var chartH = height - top - bottom;
    var grid = [0, 0.25, 0.5, 0.75, 1].map(function (tick) {
      var x = left + tick * chartW;
      var y = top + (1 - tick) * chartH;
      return '<line x1="' + x + '" y1="' + top + '" x2="' + x + '" y2="' + (top + chartH) + '" stroke="#D4D4D8" stroke-width="1"/><text x="' + x + '" y="' + (top + chartH + 25) + '" text-anchor="middle" font-size="11" fill="#525252">' + Math.round(tick * 100) + '%</text><line x1="' + left + '" y1="' + y + '" x2="' + (left + chartW) + '" y2="' + y + '" stroke="#E5E5E5" stroke-width="1"/><text x="' + (left - 12) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="#525252">' + Math.round(tick * 100) + '%</text>';
    }).join('');
    var labeledPoints = points.map(function (point, index) {
      var row = byKey[point.key] || rows[index] || {};
      var x = left + clamp01(point.x) * chartW;
      var y = top + (1 - clamp01(point.y)) * chartH;
      var radius = Number(point.radius || 9);
      var color = vizColor(point.colorIndex == null ? index : point.colorIndex);
      return { point: point, row: row, x: x, y: y, radius: radius, color: color, index: index, labelY: y + 4 };
    });
    var sortedLabels = labeledPoints.slice().sort(function (a, b) { return a.labelY - b.labelY; });
    var minLabelGap = 21;
    var minLabelY = top + 16;
    var maxLabelY = top + chartH - 8;
    sortedLabels.forEach(function (item, index) {
      item.labelY = Math.max(minLabelY, Math.min(maxLabelY, item.labelY));
      if (index > 0) item.labelY = Math.max(item.labelY, sortedLabels[index - 1].labelY + minLabelGap);
    });
    var overflow = sortedLabels.length ? sortedLabels[sortedLabels.length - 1].labelY - maxLabelY : 0;
    if (overflow > 0) {
      sortedLabels.forEach(function (item) { item.labelY -= overflow; });
      for (var i = sortedLabels.length - 2; i >= 0; i -= 1) {
        sortedLabels[i].labelY = Math.min(sortedLabels[i].labelY, sortedLabels[i + 1].labelY - minLabelGap);
      }
      sortedLabels.forEach(function (item) {
        item.labelY = Math.max(minLabelY, Math.min(maxLabelY, item.labelY));
      });
    }
    var pointSvg = labeledPoints.map(function (item) {
      var row = item.row;
      var x = item.x;
      var y = item.y;
      var radius = item.radius;
      var color = item.color;
      var labelSideLeft = x > width - right - 160;
      var labelX = labelSideLeft ? Math.max(left + 108, x - radius - 12) : Math.min(width - right - 108, x + radius + 12);
      var labelAnchor = labelSideLeft ? 'end' : 'start';
      var lineX = labelSideLeft ? labelX + 6 : labelX - 6;
      var labelY = item.labelY;
      var title = row.key + ': closure ' + pct(row.closureRate) + ', turns ' + turnLabel(row.meanTurns) + ', leaks ' + (row.leakCount || 0);
      return '<g><title>' + esc(title) + '</title><line x1="' + x.toFixed(1) + '" y1="' + y.toFixed(1) + '" x2="' + lineX.toFixed(1) + '" y2="' + labelY.toFixed(1) + '" stroke="#0A0A0A" stroke-width="1"/><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + radius.toFixed(1) + '" fill="' + color + '" fill-opacity="0.86" stroke="#0A0A0A" stroke-width="2"/><rect x="' + (labelSideLeft ? (labelX + 8) : (labelX - 16)).toFixed(1) + '" y="' + (labelY - 10).toFixed(1) + '" width="10" height="10" fill="' + color + '" stroke="#0A0A0A" stroke-width="1"/><text x="' + labelX.toFixed(1) + '" y="' + labelY.toFixed(1) + '" text-anchor="' + labelAnchor + '" font-size="13" font-weight="700" fill="#0A0A0A">' + esc(row.key || item.point.key) + '</text></g>';
    }).join('');
    return '<div class="viz-frame"><svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Learner robustness map"><rect x="0" y="0" width="' + width + '" height="' + height + '" fill="#FFFFFF"/><rect x="' + left + '" y="' + top + '" width="' + chartW + '" height="' + chartH + '" fill="#FAFAFA" stroke="#0A0A0A" stroke-width="2"/>' + grid + '<text x="' + (left + chartW / 2) + '" y="' + (height - 16) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#0A0A0A">closure rate</text><text transform="translate(22 ' + (top + chartH / 2) + ') rotate(-90)" text-anchor="middle" font-size="12" font-weight="700" fill="#0A0A0A">turn efficiency</text>' + pointSvg + '</svg><div class="viz-caption"><span>x = closure; y = faster completion; bubble = completed rows; color separates learner profiles.</span><span>Projection data also includes z = composite signal for later 3D/WebGL views.</span></div></div>';
  }
  function meanValue(values) {
    var finite = values.map(Number).filter(Number.isFinite);
    if (!finite.length) return null;
    return finite.reduce(function (sum, value) { return sum + value; }, 0) / finite.length;
  }
  function rangeLabel(values, formatter) {
    var finite = values.map(Number).filter(Number.isFinite);
    if (!finite.length) return 'n/a';
    var min = Math.min.apply(Math, finite);
    var max = Math.max.apply(Math, finite);
    if (Math.abs(max - min) < 0.0001) return formatter(min);
    return formatter(min) + '-' + formatter(max);
  }
  function renderLearnerKpis(model) {
    var rows = model.learnerStats || [];
    var lens = model.learnerLens || {};
    var ok = rows.reduce(function (sum, row) { return sum + Number(row.ok || 0); }, 0);
    var failed = rows.reduce(function (sum, row) { return sum + Number(row.failed || 0); }, 0);
    var closure = meanValue(rows.map(function (row) { return row.closureRate; }));
    var coverage = meanValue(rows.map(function (row) { return row.meanCoverage; }));
    var turnRange = rangeLabel(rows.map(function (row) { return row.meanTurns; }), function (value) { return Number(value.toFixed(1)); });
    var activeProfiles = lens.activeProfiles && lens.activeProfiles.length ? lens.activeProfiles : [];
    var cards = [
      ['Profiles', rows.length || (lens.profileCount || 0), esc(lens.label || 'learner lens'), '#0057B8'],
      ['Closure', closure == null ? 'n/a' : pct(closure), 'mean across shown profiles', '#009B72'],
      ['Coverage', coverage == null ? 'n/a' : pct(coverage), 'mean evidence path', '#E63946'],
      ['Turn Spread', turnRange, 'lower is faster closure', '#F2B705'],
      ['Rows', ok + '/' + failed, 'OK/failed in matched lens', '#6B4EFF'],
      ['Live', activeProfiles.length ? activeProfiles.join(', ') : 'none', activeProfiles.length ? 'slice still running' : 'no active learner slice', '#0A0A0A']
    ];
    return '<div class="learner-snapshot"><div class="learner-snapshot-head"><div><strong>Learner Snapshot</strong><span>' + esc(lens.note || 'Matched learner-profile lens.') + '</span></div></div><div class="learner-kpi-grid">' + cards.map(function (card) {
      return '<div class="learner-kpi" style="--kpi-accent:' + esc(card[3]) + '"><span>' + esc(card[0]) + '</span><strong>' + esc(card[1]) + '</strong><em>' + esc(card[2]) + '</em></div>';
    }).join('') + '</div></div>';
  }
  function learnerMiniBar(label, value, color) {
    var bounded = clamp01(value);
    return '<div class="learner-mini-bar"><span>' + esc(label) + '</span><span class="learner-mini-track"><span style="--bar-width:' + Math.round(bounded * 100) + '%;--bar-color:' + esc(color) + '"></span></span><b>' + Math.round(bounded * 100) + '%</b></div>';
  }
  function renderLearnerBars(rows) {
    if (!rows || !rows.length) return '<div class="muted">No learner profile rows yet.</div>';
    return '<div class="learner-profile-bars">' + rows.map(function (row, index) {
      var color = vizColor(index);
      var turnEfficiency = Number.isFinite(Number(row.meanTurns)) ? clamp01(1 - Number(row.meanTurns) / 120) : 0;
      return '<article class="learner-rowbar" style="--row-accent:' + esc(color) + '"><div class="learner-rowbar-head"><strong>' + esc(row.key) + '</strong><span>' + esc(row.ok) + '/' + esc(row.failed) + ' rows</span></div><div class="learner-mini-bars">' + learnerMiniBar('Closure', row.closureRate, color) + learnerMiniBar('Coverage', row.meanCoverage, '#0A0A0A') + learnerMiniBar('Speed', turnEfficiency, '#E63946') + '</div></article>';
    }).join('') + '</div>';
  }
  function renderLearnerReadout(model) {
    var rows = model.learnerReadout || [];
    if (!rows.length) return '';
    return '<div class="learner-readout">' + rows.map(function (row) {
      return '<article class="learner-readout-card"><strong>' + esc(row.label || 'Read') + '</strong><p>' + esc(row.text || '') + '</p></article>';
    }).join('') + '</div>';
  }
  function renderLearnerRobustness(model) {
    var rows = model.learnerStats || [];
    var spread = function (values) {
      var finite = values.map(Number).filter(Number.isFinite);
      return finite.length ? Math.max.apply(Math, finite) - Math.min.apply(Math, finite) : null;
    };
    var closureSpread = spread(rows.map(function (row) { return row.closureRate; }));
    var coverageSpread = spread(rows.map(function (row) { return row.meanCoverage; }));
    var turnSpread = spread(rows.map(function (row) { return row.meanTurns; }));
    var flat = rows.length > 1 && closureSpread != null && coverageSpread != null && turnSpread != null && closureSpread <= 0.02 && coverageSpread <= 0.02 && turnSpread <= 2;
    var primaryViz = flat
      ? '<div class="flat-signal"><strong>Weak learner separation on outcome metrics</strong><p>Closure, coverage, and turn count are effectively flat in this matched lens. Inspect the profile-discrimination gate and behavioral traces before scaling the sweep.</p></div>'
      : renderLearnerMap(model);
    return '<div class="learner-infographic"><div class="learner-dashboard-grid"><div>' + primaryViz + '</div><div>' + renderLearnerKpis(model) + '</div></div><div class="big-picture-viz-grid"><div>' + renderLearnerBars(rows) + '</div><div>' + renderLearnerReadout(model) + '</div></div></div>';
  }
  function renderPolicySignal(model) {
    var rows = model.policyStats || [];
    if (!rows.length) return '<div class="muted">No policy rows yet.</div>';
    var maxSignal = rows.reduce(function (max, row) { return Math.max(max, Number(row.signalScore || 0)); }, 0) || 1;
    return '<div class="policy-bars">' + rows.map(function (row, index) {
      var color = vizColor(index);
      var width = Math.round((Number(row.signalScore || 0) / maxSignal) * 100);
      var meta = pct(row.closureRate) + ' closure · ' + turnLabel(row.meanTurns) + ' turns · ' + (row.leakCount || 0) + ' leaks';
      return '<div class="policy-bar-row"><strong>' + esc(row.key) + '</strong><div class="policy-bar" title="' + esc(meta) + '"><span style="--bar-width:' + width + '%;--bar-color:' + esc(color) + '"></span></div><span class="policy-bar-meta">' + esc(measure(row.signalScore)) + '</span></div>';
    }).join('') + '</div>';
  }
  function cohortMetric(label, value, note) {
    return '<div class="cohort-metric"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong><em>' + esc(note || '') + '</em></div>';
  }
  function renderCohortLinks(links) {
    if (!links || !links.length) return '<span class="muted">Consolidated artifacts pending.</span>';
    return links.map(function (link) { return '<a href="' + esc(link.href) + '">' + esc(link.label) + '</a>'; }).join(' ');
  }
  function verdictLabel(value) {
    return String(value || 'pending').replace(/_/g, ' ');
  }
  function renderEvaluationProfiles(cohort, primary) {
    var reports = cohort.childReports || [];
    if (!reports.length) return '<div class="muted">Profile slices have not started.</div>';
    var completed = cohort.completedProfiles != null ? cohort.completedProfiles : reports.filter(function (report) { return report.htmlHref || report.jsonHref; }).length;
    var expected = cohort.expectedProfiles != null ? cohort.expectedProfiles : reports.length;
    var rows = reports.map(function (report) {
      var completedTrials = Number(report.completedTrials || 0);
      var expectedTrials = Number(report.expectedTrials || 0);
      var trialValue = expectedTrials ? completedTrials + '/' + expectedTrials : String(completedTrials);
      var trialNote = Number(report.ok || 0) + ' OK · ' + Number(report.failed || 0) + ' failed' + ((report.status === 'running' || report.status === 'stale') && report.resume ? ' · repair pass' : '');
      var closure = report.groundedRate == null ? 'pending' : pct(report.groundedRate);
      var coverage = report.meanCoverage == null ? 'pending' : pct(report.meanCoverage);
      var adaptation = report.adaptationEvidence ? verdictLabel(report.adaptationEvidence.verdict) : 'pending';
      var action = report.htmlHref
        ? '<a href="' + esc(report.htmlHref) + '">Open profile</a>'
        : report.stateHref
          ? '<a href="' + esc(report.stateHref) + '">View state</a>'
          : report.jsonHref
            ? '<a href="' + esc(report.jsonHref) + '">Profile data</a>'
            : '<span class="muted">pending</span>';
      return '<div class="profile-row"><div class="profile-name"><strong>' + esc(report.learnerProfile) + '</strong><span>' + esc(report.model || '') + '</span></div><div><span class="status ' + esc(report.status || 'pending') + '">' + esc(report.status || 'pending') + '</span></div><div class="profile-value"><strong>' + esc(trialValue) + '</strong><span>' + esc(trialNote) + '</span></div><div class="profile-value"><strong>' + esc(closure) + '</strong><span>closure</span></div><div class="profile-value"><strong>' + esc(adaptation) + '</strong><span>adaptation</span></div><div class="profile-actions">' + action + '</div></div>';
    }).join('');
    return '<div class="evaluation-profiles"><div class="profile-list"><div class="profile-row profile-head"><span>Profile</span><span>Status</span><span>Trials</span><span>Outcome</span><span>Adaptation</span><span>Open</span></div>' + rows + '</div></div>';
  }
  function renderExperimentArms(cohort) {
    var arms = cohort.childReports || [];
    var rows = arms.map(function (arm) {
      var expected = Number(arm.expectedTrials || 0);
      var completed = Number(arm.completedTrials || 0);
      var progress = expected ? completed + '/' + expected : String(completed);
      var result = arm.groundedRate == null
        ? 'not scored'
        : pct(arm.groundedRate) + ' closure · ' + pct(arm.meanCoverage) + ' coverage';
      var action = arm.htmlHref
        ? '<a href="' + esc(arm.htmlHref) + '">Open report</a>'
        : arm.stateHref
          ? '<a href="' + esc(arm.stateHref) + '">View state</a>'
          : '<a href="' + esc(arm.artifactHref || '') + '">Artifacts</a>';
      var config = Object.entries(arm.configuration || {}).map(function (entry) {
        return entry[0] + ' ' + String(entry[1]);
      }).join(' · ');
      return '<div class="experiment-arm"><div><span class="cohort-eyebrow">' + esc(arm.armId) + '</span><h4>' + esc(arm.learnerProfile) + '</h4><p>' + esc(arm.description || config || 'Declared experiment arm') + '</p></div><div class="experiment-arm-status"><span class="status ' + esc(arm.status || 'pending') + '">' + esc(arm.status || 'pending') + '</span><strong>' + esc(progress) + ' trials</strong><span>' + esc(Number(arm.ok || 0)) + ' OK · ' + esc(Number(arm.failed || 0)) + ' failed</span></div><div class="experiment-arm-result"><strong>' + esc(result) + '</strong><span>' + policyChips(arm.policies || []) + '</span></div><div class="profile-actions">' + action + (arm.artifactHref ? ' <a href="' + esc(arm.artifactHref) + '">Artifacts</a>' : '') + '</div></div>';
    }).join('');
    return '<div class="experiment-arms">' + (rows || '<div class="muted">No arms have been declared.</div>') + '</div>';
  }
  function renderExperimentPlaceholder(cohort, view) {
    var experiment = cohort.experiment || {};
    var factor = experiment.factor || {};
    var completed = Number((cohort.progress || {}).trialsCompleted || 0);
    var expected = Number((cohort.progress || {}).trialsExpected || 0);
    var measures = (experiment.measures || []).map(function (measure) { return '<li>' + esc(measure) + '</li>'; }).join('');
    var design = '<section class="study-panel"><span class="cohort-eyebrow">Declared paired design</span><h4>' + esc(factor.name || 'Experiment factor') + '</h4><p>' + esc(experiment.statusNote || 'The report shows collection state only. Comparative interpretation remains withheld until every arm has completed.') + '</p><dl>' + Object.entries(factor).filter(function (entry) { return entry[0] !== 'name'; }).map(function (entry) { return '<div><dt>' + esc(entry[0]) + '</dt><dd>' + esc(entry[1]) + '</dd></div>'; }).join('') + '</dl></section>';
    var metrics = '<div class="research-verdict-grid">' + cohortMetric('Collection', expected ? Math.round((completed / expected) * 100) + '%' : 'pending', completed + '/' + (expected || '?') + ' planned trials') + cohortMetric('Arms', (cohort.completedProfiles || 0) + '/' + (cohort.expectedProfiles || 0), 'complete reports') + cohortMetric('Failures', cohort.failed || 0, 'technical failures only') + cohortMetric('Analysis', experiment.analysisStatus === 'ready' ? 'ready' : 'waiting', experiment.analysisStatus === 'ready' ? 'all arms collected' : 'no interim verdict') + '</div>';
    var measurePanel = measures ? '<details class="reading-guide" open><summary>Planned readout</summary><div class="reading-guide-body"><div><strong>Measures</strong><ul>' + measures + '</ul></div><div><strong>Interpretation rule</strong><p>Compare matched arms only after collection completes. Until then, progress and technical failures are descriptive operational signals, not evidence for or against the hypothesis.</p></div></div></details>' : '';
    return renderStudyPanel(cohort) + design + metrics + (view === 'profiles' ? '' : measurePanel) + renderExperimentArms(cohort);
  }
  function renderAdaptationMatrix(cohort) {
    var matrix = cohort.adaptation || { cells: [], profiles: [], policies: [] };
    var cells = matrix.cells || [];
    var body = (matrix.profiles || []).map(function (profile) {
      return '<tr><th>' + esc(profile) + '</th>' + (matrix.policies || []).map(function (policy) {
        var cell = cells.find(function (candidate) { return candidate.profile === profile && candidate.policy === policy; }) || {};
        var delta = cell.benefit == null ? 'pending' : signed(cell.benefit);
        var consequence = cell.transitionCount ? pct(cell.positiveRate) + ' positive / n' + cell.transitionCount : 'no transitions';
        return '<td class="matrix-cell adaptation-' + esc(cell.verdict || 'pending') + '"><strong>' + esc(verdictLabel(cell.verdict)) + '</strong><span>Δ ' + esc(delta) + ' vs ' + esc(matrix.baselinePolicy || 'baseline') + '</span><em>' + esc(consequence) + '</em></td>';
      }).join('') + '</tr>';
    }).join('');
    return '<div class="adaptation-matrix-wrap"><div class="table-scroll"><table class="adaptation-matrix"><thead><tr><th>Profile × policy</th>' + (matrix.policies || []).map(function (policy) { return '<th>' + esc(policy) + (policy === matrix.baselinePolicy ? '<span>baseline</span>' : '') + '</th>'; }).join('') + '</tr></thead><tbody>' + (body || '<tr><td>No matched profile evidence yet.</td></tr>') + '</tbody></table></div><p class="muted">' + esc(matrix.note || '') + '</p>' + renderReadingGuide() + '</div>';
  }
  function renderStudyPanel(cohort) {
    var study = cohort.study || {};
    return '<section class="study-panel"><span class="cohort-eyebrow">Study ' + esc(study.id || 'unassigned') + ' · ' + esc(study.source || 'inferred') + ' metadata</span><h4>Research question</h4><p>' + esc(study.researchQuestion || '') + '</p><dl>' + (study.hypothesis ? '<div><dt>Hypothesis</dt><dd>' + esc(study.hypothesis) + '</dd></div>' : '') + (study.primaryContrast ? '<div><dt>Primary contrast</dt><dd>' + esc(study.primaryContrast) + '</dd></div>' : '') + (study.decisionRule ? '<div><dt>Decision rule</dt><dd>' + esc(study.decisionRule) + '</dd></div>' : '') + (study.supersedes ? '<div><dt>Supersedes</dt><dd>' + esc(study.supersedes) + '</dd></div>' : '') + '</dl></section>';
  }
  function renderVerdictView(cohort) {
    var gate = cohort.discriminationGate;
    var gateValue = gate ? (gate.pass ? 'pass' : 'fail') : 'not run';
    var gateNote = gate
      ? (gate.mode || 'pooled') + ' · avg cosine ' + measure(gate.averagePairwiseCosine) + ' · max to control ' + measure(gate.maxSimilarityToControl) + ((gate.failedProfiles || []).length ? ' · failing ' + gate.failedProfiles.join(', ') : '')
      : 'profile separation has not been scored';
    var partialNote = cohort.status === 'running' ? 'completed slices only' : 'matched cohort';
    var completedProfiles = cohort.completedProfiles != null ? cohort.completedProfiles : (cohort.childReports || []).length;
    var expectedProfiles = cohort.expectedProfiles != null ? cohort.expectedProfiles : (cohort.profiles || []).length;
    var adaptation = cohort.adaptation || {};
    return renderStudyPanel(cohort) + '<div class="research-verdict-grid">' + cohortMetric('Outcome', adaptation.outcomeAchieved ? 'achieved' : 'not robust', pct(cohort.closureRate) + ' closure · ' + pct(cohort.meanCoverage) + ' coverage · ' + partialNote) + cohortMetric('Adaptation', verdictLabel(adaptation.verdict), adaptation.headline || 'transition evidence pending') + cohortMetric('Robustness', completedProfiles + '/' + expectedProfiles + ' profiles', (cohort.profiles || []).join(', ')) + cohortMetric('Validity', gateValue, gateNote) + '</div>' + renderReadingGuide() + '<div class="cohort-actions">' + renderCohortLinks(cohort.links || []) + '</div>';
  }
  function renderLineageView(cohort) {
    var lineage = cohort.lineage || { position: 1, total: 1, evaluations: [] };
    var evaluations = lineage.evaluations || [];
    return renderStudyPanel(cohort) + '<div class="lineage"><div class="lineage-summary"><strong>Evaluation ' + esc(lineage.position) + ' of ' + esc(lineage.total) + '</strong><span>within study ' + esc((cohort.study || {}).id || '') + '</span></div><div class="lineage-track">' + evaluations.map(function (item, index) { return '<button type="button" data-evaluation-select="' + esc(item.id) + '" class="lineage-node' + (item.id === cohort.id ? ' active' : '') + '"><span>' + esc(index + 1) + '</span><strong>' + esc(item.id) + '</strong><em>' + esc(evaluationTimestamp(item)) + ' · ' + esc(verdictLabel(item.verdict)) + '</em></button>'; }).join('') + '</div></div>';
  }
  function renderLabView(cohort) {
    var lab = cohort.lab3d || { eligible: false, reasons: ['evidence gate not evaluated'] };
    var evidenceRows = (cohort.adaptation && cohort.adaptation.cells || []).filter(function (cell) { return cell.policy !== cohort.baselinePolicy; });
    var linked = '<div class="lab-2d"><h4>Linked 2D evidence</h4><p class="lab-2d-legend">Each row is one profile × policy cell: contingency = did strategy choice track learner state (0 = no); benefit = outcome delta vs ' + esc(cohort.baselinePolicy || 'baseline') + ' (negative = worse); positive x% / n = scored strategy shifts that helped, out of n observed. n0 = no evidence yet, not a zero effect.</p>' + evidenceRows.slice(0, 12).map(function (cell) { return '<div><strong>' + esc(cell.profile + ' × ' + cell.policy) + '</strong><span>contingency ' + esc(field(cell.contingency)) + '</span><span>benefit ' + esc(signed(cell.benefit)) + '</span><span>positive ' + esc(pct(cell.positiveRate)) + ' / n' + esc(cell.transitionCount) + '</span></div>'; }).join('') + '</div>';
    var projection = lab.eligible ? '<div class="lab-3d" aria-label="Exploratory three-dimensional adaptation projection"><div class="lab-3d-head"><h4>Contingency × consequence × benefit</h4><span>exploratory projection · never scored</span></div><div class="lab-3d-scene"><div class="lab-3d-stage">' + evidenceRows.slice(0, 36).map(function (cell) { var x = 8 + clamp01(cell.contingency) * 84; var y = 92 - clamp01(cell.positiveRate) * 84; var z = Math.round(Math.max(-0.15, Math.min(0.15, Number(cell.benefit || 0))) * 300); var label = cell.profile + ' × ' + cell.policy + ': contingency ' + field(cell.contingency) + ', positive transitions ' + pct(cell.positiveRate) + ', benefit ' + signed(cell.benefit); return '<span class="lab-3d-point adaptation-' + esc(cell.verdict || 'pending') + '" style="--point-x:' + esc(x) + '%;--point-y:' + esc(y) + '%;--point-z:' + esc(z) + 'px" title="' + esc(label) + '" aria-label="' + esc(label) + '"><i></i><b>' + esc(cell.policy) + '</b></span>'; }).join('') + '<span class="lab-axis x">state contingency →</span><span class="lab-axis y">positive consequence →</span><span class="lab-axis z">benefit ↑</span></div></div><p>Depth encodes within-profile benefit versus ' + esc(cohort.baselinePolicy || 'baseline') + '. Position encodes state-action contingency and positive next-turn proxy rate. Inspect the 2D rows above for exact values.</p></div>' : '';
    var gate = lab.eligible
      ? '<div class="lab-gate pass"><strong>Exploratory 3D lab unlocked</strong><p>The 2D matrix, baseline contrast, transition links, and validity gate are complete. The projection may expose clusters and outliers; it cannot drive the adaptation verdict.</p></div>'
      : '<div class="lab-gate"><strong>3D lab gated</strong><p>Complete the linked 2D evidence first. This prevents perspective and depth effects from becoming pseudo-evidence.</p><ul>' + (lab.reasons || []).map(function (reason) { return '<li>' + esc(reason) + '</li>'; }).join('') + '</ul></div>';
    return '<div class="lab-view"><div class="lab-warning"><strong>Research safeguard</strong><span>3D never drives verdicts. Every verdict on this page is computed from the flat numbers alone (the Profile × Policy matrix and per-turn transition counts); the 3D projection only re-plots those same numbers. It stays locked until each plotted point can be checked as a plain 2D row, because depth and perspective can make weak separation look strong. Use it to spot clusters worth checking in 2D, never to conclude.</span></div>' + linked + gate + projection + renderReadingGuide() + '</div>';
  }
  function renderCohortCard(cohort, primary, view, compared) {
    var isExperiment = cohort.kind === 'experiment_placeholder';
    var viewBody = isExperiment ? renderExperimentPlaceholder(cohort, view) : view === 'matrix' ? renderAdaptationMatrix(cohort) : view === 'profiles' ? renderEvaluationProfiles(cohort, primary) : view === 'lineage' ? renderLineageView(cohort) : view === 'lab' ? renderLabView(cohort) : renderVerdictView(cohort);
    var interim = cohort.status === 'running'
      ? isExperiment
        ? '<span class="decision-caveat">Collection is still running. This placeholder deliberately withholds the treatment verdict.</span>'
        : '<span class="decision-caveat">Interim read: trials are still running, so this verdict can change as more evidence lands.</span>'
      : cohort.status === 'stale'
        ? '<span class="decision-caveat">Interim read: the last pass stalled before finishing, so treat this verdict as incomplete.</span>'
        : '';
    var contextLabel = isExperiment ? 'paired experiment · analysis pending' : 'baseline ' + esc(cohort.baselinePolicy || 'not declared');
    return '<article class="cohort-card ' + esc(cohort.adaptation && cohort.adaptation.verdict || 'pending') + (primary ? ' primary' : '') + '"><div class="cohort-card-head"><div><span class="cohort-eyebrow">Selected evaluation</span><h3>' + esc(cohort.title || cohort.id) + '</h3><p><span class="evaluation-timestamp">' + esc(evaluationTimestamp(cohort)) + '</span> · ' + contextLabel + '</p></div><div class="cohort-head-actions"><span class="status ' + esc(cohort.status) + '" title="' + esc(statusExplainer(cohort.status)) + '">' + esc(cohort.status) + '</span><button type="button" data-compare-toggle="' + esc(cohort.id) + '">' + (compared ? 'Unpin comparison' : 'Pin comparison') + '</button></div></div>' + renderEvaluationProgress(cohort) + '<div class="cohort-decision adaptation-' + esc(cohort.adaptation && cohort.adaptation.verdict || 'pending') + '"><strong>' + esc(cohort.adaptation && cohort.adaptation.headline || cohort.decision) + '</strong>' + interim + '</div>' + viewBody + '</article>';
  }
  function renderComparisonTray(cohorts, route) {
    if (!route.compare.length) return '';
    var selected = route.compare.map(function (id) { return cohorts.find(function (cohort) { return cohort.id === id; }); }).filter(Boolean);
    return '<aside class="comparison-tray"><div class="comparison-tray-head"><strong>Comparison tray</strong><button type="button" data-compare-clear>Clear</button></div><div class="comparison-grid">' + selected.map(function (cohort) { return '<article><button type="button" data-evaluation-select="' + esc(cohort.id) + '"><strong>' + esc(cohort.id) + '</strong><span class="evaluation-timestamp">' + esc(evaluationTimestamp(cohort)) + '</span><em>' + esc(verdictLabel(cohort.adaptation && cohort.adaptation.verdict)) + ' · ' + esc(cohort.adaptation && cohort.adaptation.headline || '') + '</em></button><button type="button" data-compare-toggle="' + esc(cohort.id) + '">remove</button></article>'; }).join('') + '</div></aside>';
  }
  function renderEvaluationWorkspace(cohorts, route) {
    cohorts = cohorts || [];
    if (!cohorts.length) return '<section class="cohort-workspace" id="evaluations"><div class="cohort-workspace-head"><div><h2>Evaluations</h2><p>No matched evaluation has been detected yet. Standalone artifacts remain available below.</p></div></div></section>';
    var current = cohorts.find(function (cohort) { return cohort.id === route.evaluation; }) || cohorts[0];
    var options = cohorts.map(function (cohort) { return '<option value="' + esc(cohort.id) + '"' + (cohort.id === current.id ? ' selected' : '') + '>' + esc(cohort.id) + ' · ' + esc(evaluationTimestamp(cohort)) + '</option>'; }).join('');
    var tabSpec = current.kind === 'experiment_placeholder' ? [['verdict', 'Progress'], ['profiles', 'Arms']] : [['verdict', 'Verdict'], ['matrix', 'Profile × Policy'], ['profiles', 'Profiles'], ['lineage', 'Study Lineage'], ['lab', '3D Lab']];
    var tabs = tabSpec.map(function (item) { return '<button type="button" data-view-select="' + item[0] + '" class="' + (route.view === item[0] ? 'active' : '') + '">' + item[1] + '</button>'; }).join('');
    return '<section class="cohort-workspace" id="evaluations" aria-label="Evaluations"><div class="cohort-workspace-head"><div><h2>Adaptation Research Console</h2><p>Evaluation → Profile → Trial. Every pathway answers the same question: are strategy changes contingent on learner state, and do they improve grounded adaptation?</p></div><span class="live-count">' + esc(cohorts.length) + ' evaluation' + (cohorts.length === 1 ? '' : 's') + '</span></div><div class="evaluation-routebar"><label><span>Evaluation</span><select data-evaluation-select>' + options + '</select></label><nav aria-label="Evaluation views">' + tabs + '</nav></div>' + renderCohortCard(current, true, route.view, route.compare.indexOf(current.id) >= 0) + renderComparisonTray(cohorts, route) + '</section>';
  }
  function renderCohortWorkspace(cohorts, route) {
    return renderEvaluationWorkspace(cohorts, route);
  }
  function renderBigPicture(model) {
    model = model || { bullets: [], cautions: [], policyStats: [], learnerStats: [], reportCount: 0 };
    return '<details class="big-picture" id="big-picture" aria-label="Cross-run context" data-persist-details="cross-run-context"><summary class="big-picture-head"><div><h2>Cross-run Context</h2><p>Exploratory context over recent real artifacts. It may mix evaluations; use the selected evaluation above for matched decisions.</p></div><span class="live-count">' + esc(model.reportCount) + ' profile artifact' + (model.reportCount === 1 ? '' : 's') + '</span></summary><div class="big-picture-body"><div class="big-picture-grid"><div class="big-picture-panel big-picture-panel-wide"><h3>Overall Read</h3><ul class="big-picture-read">' + (model.bullets || []).map(function (bullet) { return '<li>' + esc(bullet) + '</li>'; }).join('\n') + '</ul>' + ((model.cautions || []).length ? '<div class="big-picture-cautions">' + model.cautions.map(function (caution) { return '<div>' + esc(caution) + '</div>'; }).join('\n') + '</div>' : '') + '</div><div class="big-picture-panel big-picture-panel-wide"><h3>Learner Robustness</h3>' + renderLearnerRobustness(model) + '</div></div><div class="big-picture-panel"><h3>Exploratory Composite Policy Signal</h3><p class="muted">Weighted composite of closure, coverage, mastery, risk, leak discipline, turn efficiency, and progress. Compare only inside a coherent evaluation.</p>' + renderPolicySignal(model) + '</div></div></details>';
  }
  function reportDataAttrs(row) {
    var scope = row.reportScope || {};
    return 'data-search="' + esc(row.searchText) + '" data-evaluation="' + esc(scope.matrixId || '__standalone__') + '" data-status="' + esc(row.status) + '" data-learner="' + esc(row.learnerProfile || '') + '" data-policies="' + esc((row.policies || []).join('|')) + '" data-policy-text="' + esc(row.policyText || '') + '" data-world="' + esc(row.world || '') + '" data-dag-mode="' + esc(row.dagMode || 'strict_dag') + '" data-completed-ms="' + esc(row.completedMs || 0) + '" data-report-name="' + esc(row.reportName || '') + '" data-report-scope="' + esc(scope.kind || 'standalone') + '" data-run-kind="' + esc(row.runKind || 'real') + '" data-grounded-rate="' + esc(row.groundedRate == null ? '' : row.groundedRate) + '" data-turns="' + esc(row.meanTurns == null ? '' : row.meanTurns) + '" data-coverage="' + esc(row.meanCoverage == null ? '' : row.meanCoverage) + '" data-rows="' + esc(row.rows || 0) + '" data-ok="' + esc(row.ok || 0) + '" data-failed="' + esc(row.failed || 0) + '" data-svgs="' + esc(row.svgCount || 0) + '"';
  }
  function reportRow(row) {
    var scope = row.reportScope || {};
    var links = reportActionLinks(row);
    return '<tr ' + reportDataAttrs(row) + '><td><div><strong>' + esc(shortDate(row.completedAt) || row.reportName) + '</strong> ' + scopeBadge(scope) + '</div><div class="muted">' + esc(row.reportName) + '</div><div class="muted">' + esc(row.world || '') + ' · ' + esc(row.dagMode || 'strict_dag') + ' · ' + esc(indexRunKindLabel(row.runKind || 'real')) + '</div>' + scopeNote(scope) + '</td><td class="actions links-cell">' + links + '</td><td><span class="status ' + esc(row.status) + '">' + esc(row.status) + '</span></td><td>' + policyChips(row.policies) + '</td><td><div>' + esc(row.learnerProfile || '') + '</div><div class="muted">' + esc(row.autoLearnerModel || '') + '</div></td><td>' + esc(row.ok) + '/' + esc(row.failed) + (row.dryRun ? ' · ' + esc(row.dryRun) + ' dry' : '') + '</td><td>' + esc(row.grounded) + '/' + esc(row.ok) + ' · ' + Math.round(Number(row.groundedRate || 0) * 100) + '%</td><td>' + esc(row.meanTurns) + '</td><td>' + coverageCell(row.meanCoverage) + '</td><td>' + fieldSnapshotCell(row) + '</td></tr>';
  }
  function reportCard(row) {
    var scope = row.reportScope || {};
    var closure = Math.round(Number(row.groundedRate || 0) * 100) + '%';
    var coverage = Number.isFinite(Number(row.meanCoverage)) ? Math.round(Number(row.meanCoverage) * 100) + '%' : 'n/a';
    return '<article class="report-index-card" ' + reportDataAttrs(row) + '><div class="report-index-card-head"><div><strong>' + esc(scope.kind === 'qa_matrix_child' ? (row.learnerProfile || scope.profile) : (shortDate(row.completedAt) || row.reportName)) + '</strong><span>' + esc(shortDate(row.completedAt)) + '</span></div><span class="status ' + esc(row.status) + '">' + esc(row.status) + '</span></div><p>' + esc(row.reportName) + '</p><div class="report-card-stats"><span><b>' + esc(row.ok) + '/' + esc(row.failed) + '</b> OK/failed</span><span><b>' + esc(closure) + '</b> closure</span><span><b>' + esc(coverage) + '</b> coverage</span><span><b>' + esc(row.meanTurns) + '</b> turns</span></div><div class="report-card-policies">' + policyChips((row.policies || []).slice(0, 4)) + '</div><div class="report-card-actions actions">' + reportActionLinks(row) + '</div></article>';
  }
  function upgradeArtifactHistory(data) {
    var section = app.querySelector('.report-list');
    if (!section || !section.parentNode) return;
    var head = section.querySelector('.report-list-head');
    if (head) {
      var title = head.querySelector('h2');
      var note = head.querySelector('p');
      if (title) title.textContent = 'Artifact history';
      if (note) note.textContent = 'Raw profile and standalone report files. This is a diagnostic archive, not the primary evaluation view.';
    }
    var details = document.createElement('details');
    details.className = 'artifact-history';
    details.id = 'artifact-history';
    details.setAttribute('data-persist-details', 'artifact-history');
    var summary = document.createElement('summary');
    if (head) summary.appendChild(head);
    details.appendChild(summary);
    section.parentNode.replaceChild(details, section);
    var body = document.createElement('div');
    body.className = 'artifact-history-body';
    body.appendChild(section);
    details.appendChild(body);

    var toolbar = section.querySelector('.toolbar');
    if (!toolbar) return;
    var label = document.createElement('label');
    label.className = 'control';
    var labelText = document.createElement('span');
    labelText.textContent = 'Evaluation';
    var select = document.createElement('select');
    select.setAttribute('data-evaluation-filter', '');
    select.setAttribute('aria-label', 'Choose evaluation artifacts');
    var selectedId = routeState(data.cohorts || []).evaluation || '__all__';
    var options = [{ value: selectedId, label: selectedId ? 'Selected evaluation' : 'All artifacts' }, { value: '__all__', label: 'All evaluations and standalone' }, { value: '__standalone__', label: 'Standalone only' }];
    (data.cohorts || []).forEach(function (cohort) {
      if (cohort.id !== selectedId) options.push({ value: cohort.id, label: cohort.id });
    });
    select.innerHTML = options.map(function (option) { return '<option value="' + esc(option.value) + '">' + esc(option.label) + '</option>'; }).join('');
    label.appendChild(labelText);
    label.appendChild(select);
    toolbar.insertBefore(label, toolbar.children[1] || null);
  }
  function readStoredUiState() {
    try { return JSON.parse(window.sessionStorage.getItem(uiStorageKey) || 'null'); } catch (error) { return null; }
  }
  function captureUiState() {
    var value = function (selector) { var node = app.querySelector(selector); return node ? node.value : ''; };
    var openDetails = {};
    Array.from(app.querySelectorAll('[data-persist-details]')).forEach(function (node) {
      openDetails[node.getAttribute('data-persist-details')] = Boolean(node.open);
    });
    var filterPanel = app.querySelector('[data-filter-panel]');
    return {
      controls: {
        search: value('[data-filter]'), evaluation: value('[data-evaluation-filter]'), scope: value('[data-scope-filter]'), from: value('[data-date-from]'), to: value('[data-date-to]'),
        status: value('[data-status-filter]'), learner: value('[data-learner-filter]'), policy: value('[data-policy-filter]'), world: value('[data-world-filter]'),
        sort: value('[data-sort-key]'), direction: value('[data-sort-dir]')
      },
      filtersOpen: filterPanel ? Boolean(filterPanel.open) : true,
      openDetails: openDetails,
      scrollY: window.scrollY || 0
    };
  }
  function persistUiState() {
    try { window.sessionStorage.setItem(uiStorageKey, JSON.stringify(captureUiState())); } catch (error) { /* local storage may be unavailable */ }
  }
  function render(data) {
    var saved = state.rendered ? captureUiState() : readStoredUiState();
    var previousScroll = saved && Number.isFinite(Number(saved.scrollY)) ? Number(saved.scrollY) : window.scrollY || 0;
    state.data = data;
    var route = routeState(data.cohorts || []);
    var totals = data.totals || {};
    var groundedRate = totals.ok ? Number((Number(totals.grounded || 0) / Number(totals.ok || 1)).toFixed(3)) : 0;
    var options = data.options || {};
    var runningCount = (data.activeRuns || []).filter(function (run) { return run.status === 'running'; }).length;
    var staleCount = (data.activeRuns || []).filter(function (run) { return run.status === 'stale'; }).length;
    var rowsHtml = (data.rows || []).map(reportRow).join('\n') || '<tr><td colspan="10">No reports found.</td></tr>';
    var cardsHtml = (data.rows || []).map(reportCard).join('\n') || '<p>No reports found.</p>';
    app.innerHTML = '<header><h1>Tutor Stub Reports</h1><div class="muted">Updated ' + esc(shortDate(data.generatedAt)) + ' · root ' + esc(data.rootLabel || '.') + ' · <a href="' + esc(data.guideHref || 'docs/tutor-stub-arc-guide.html') + '">arc guide</a></div></header><main>' + renderCohortWorkspace(data.cohorts || [], route) + renderLiveRuns(data.activeRuns || []) + renderBigPicture(data.bigPicture) + '<section class="metrics">' + htmlMetric('Reports', totals.reports || 0, (totals.htmlReports || 0) + ' with HTML · ' + (totals.totalReports || 0) + ' total') + htmlMetric('Rows', Number(totals.ok || 0) + Number(totals.failed || 0) + Number(totals.dryRun || 0), (totals.failed || 0) + ' failed · ' + (totals.hiddenByDefault || 0) + ' hidden by default') + htmlMetric('Grounded', (totals.grounded || 0) + '/' + (totals.ok || 0), Math.round(groundedRate * 100) + '% closure') + htmlMetric(infoTerm('Field Snapshots', "Static SVG exports written beside reports for inspecting each row's interaction-field visualization. They are report artifacts, not scored rows."), totals.svgs || 0, 'static visualization exports') + htmlMetric('Operations', runningCount, staleCount + ' stale need attention') + '</section><section class="report-list" id="report-list"><div class="report-list-head"><div><h2>All Reports</h2><p>Search individual report artifacts after reading the cohort decision above.</p></div><span class="muted" data-count>0 shown</span></div><details class="filter-panel" data-filter-panel open><summary>Filters and sorting <span data-active-filter-count>default view</span></summary><div class="toolbar"><label class="control"><span>Search</span><input data-filter placeholder="Search reports, policies, learner, model" aria-label="Search reports"></label><label class="control"><span>Run Set</span><select data-scope-filter aria-label="Choose which reports to include"><option value="real" selected>Real runs</option><option value="all">Everything</option></select></label><label class="control"><span>From</span><input type="date" data-date-from aria-label="Filter from completed date"></label><label class="control"><span>To</span><input type="date" data-date-to aria-label="Filter to completed date"></label><label class="control"><span>Status</span><select data-status-filter aria-label="Filter by status"><option value="">All</option>' + optionHtml(options.status) + '</select></label><label class="control"><span>Learner</span><select data-learner-filter aria-label="Filter by learner"><option value="">All</option>' + optionHtml(options.learner) + '</select></label><label class="control"><span>Policy</span><select data-policy-filter aria-label="Filter by policy"><option value="">All</option>' + optionHtml(options.policy) + '</select></label><label class="control"><span>World</span><select data-world-filter aria-label="Filter by world"><option value="">All</option>' + optionHtml(options.world) + '</select></label><label class="control"><span>Sort</span><select data-sort-key aria-label="Sort reports"><option value="date">Date</option><option value="status">Status</option><option value="learner">Learner</option><option value="policy">Policy</option><option value="grounded">Grounded</option><option value="coverage">Evidence Path</option><option value="turns">Turns</option><option value="rows">Rows</option><option value="failed">Failed</option><option value="svgs">Field Snapshots</option><option value="report">Report</option></select></label><label class="control"><span>Direction</span><select data-sort-dir aria-label="Sort direction"><option value="desc">Desc</option><option value="asc">Asc</option></select></label><button type="button" data-reset>Reset</button></div></details><div class="report-card-list" data-report-card-list>' + cardsHtml + '</div><div class="table-scroll report-index-scroll" role="region" aria-label="Report table" tabindex="0"><table class="report-index-table"><thead><tr><th>Completed</th><th class="links-cell">Links</th><th>' + infoTerm('Status', 'Run-level technical status: ok has no failed rows, failed has one or more failed rows, dry_run is configuration-only output.') + '</th><th>Policies</th><th>Learner</th><th>' + infoTerm('OK/Failed', 'OK rows completed without a technical failure. Failed rows are generation, resume, or evaluation failures.') + '</th><th>' + infoTerm('Grounded', 'Rows where the learner reached grounded asserted-secret closure, shown as grounded over OK rows plus percentage.') + '</th><th>' + infoTerm('Turns', 'Mean learner turns used by completed rows before grounded closure or another stop condition.') + '</th><th>' + infoTerm('Evidence Path', 'Mean learner-DAG best-path coverage: how much of the target evidence path is grounded, shown as a percentage with the raw 0 to 1 coverage score underneath.') + '</th><th>' + infoTerm('Field Snapshots', 'Count of static SVG exports emitted beside the report for inspecting per-row interaction-field visualizations. This is an artifact count, not an evaluation score.') + '</th></tr></thead><tbody>' + rowsHtml + '</tbody></table></div></section></main>';
    upgradeArtifactHistory(data);
    bindControls(saved, route);
    state.rendered = true;
    if (window.location.hash) {
      var anchor = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (anchor) window.requestAnimationFrame(function () { anchor.scrollIntoView({ block: 'start' }); });
    } else if (previousScroll) {
      window.requestAnimationFrame(function () { window.scrollTo(0, previousScroll); });
    }
  }
  function bindControls(saved, route) {
    var input = app.querySelector('[data-filter]');
    var evaluationFilter = app.querySelector('[data-evaluation-filter]');
    var scopeFilter = app.querySelector('[data-scope-filter]');
    var dateFrom = app.querySelector('[data-date-from]');
    var dateTo = app.querySelector('[data-date-to]');
    var statusFilter = app.querySelector('[data-status-filter]');
    var learnerFilter = app.querySelector('[data-learner-filter]');
    var policyFilter = app.querySelector('[data-policy-filter]');
    var worldFilter = app.querySelector('[data-world-filter]');
    var sortKey = app.querySelector('[data-sort-key]');
    var sortDir = app.querySelector('[data-sort-dir]');
    var reset = app.querySelector('[data-reset]');
    var filterPanel = app.querySelector('[data-filter-panel]');
    var tbody = app.querySelector('tbody');
    var rows = Array.from(app.querySelectorAll('tbody tr[data-search]'));
    var cardList = app.querySelector('[data-report-card-list]');
    var cards = Array.from(app.querySelectorAll('.report-index-card[data-search]'));
    var count = app.querySelector('[data-count]');
    var activeFilterCount = app.querySelector('[data-active-filter-count]');
    var defaultEvaluation = route && route.evaluation || (state.data && state.data.cohorts && state.data.cohorts[0] ? state.data.cohorts[0].id : '__all__');
    var numericSortKeys = new Set(['date', 'grounded', 'coverage', 'turns', 'rows', 'failed', 'svgs']);
    var sortMap = { date: 'completedMs', status: 'status', learner: 'learner', policy: 'policyText', grounded: 'groundedRate', coverage: 'coverage', turns: 'turns', rows: 'rows', failed: 'failed', svgs: 'svgs', report: 'reportName' };
    function numberValue(row, key) {
      var value = Number(row.dataset[key] || '');
      return Number.isFinite(value) ? value : null;
    }
    function stringValue(row, key) {
      return String(row.dataset[key] || '').toLowerCase();
    }
    function dayStartMs(value) {
      if (!value) return null;
      var parsed = Date.parse(value + 'T00:00:00');
      return Number.isFinite(parsed) ? parsed : null;
    }
    function dayEndMs(value) {
      if (!value) return null;
      var parsed = Date.parse(value + 'T23:59:59.999');
      return Number.isFinite(parsed) ? parsed : null;
    }
    function compareValues(a, b, direction) {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      if (typeof a === 'number' && typeof b === 'number') return direction === 'asc' ? a - b : b - a;
      var base = String(a).localeCompare(String(b));
      return direction === 'asc' ? base : -base;
    }
    function rowMatches(row) {
      var q = (input && input.value || '').trim().toLowerCase();
      var evaluation = evaluationFilter && evaluationFilter.value || defaultEvaluation;
      var scope = scopeFilter && scopeFilter.value || 'real';
      var status = statusFilter && statusFilter.value || '';
      var learner = learnerFilter && learnerFilter.value || '';
      var policy = policyFilter && policyFilter.value || '';
      var world = worldFilter && worldFilter.value || '';
      var fromMs = dayStartMs(dateFrom && dateFrom.value || '');
      var toMs = dayEndMs(dateTo && dateTo.value || '');
      var completedMs = numberValue(row, 'completedMs');
      if (evaluation !== '__all__' && row.dataset.evaluation !== evaluation) return false;
      if (scope === 'real' && row.dataset.runKind !== 'real') return false;
      if (q && !row.dataset.search.includes(q)) return false;
      if (fromMs !== null && (completedMs === null || completedMs < fromMs)) return false;
      if (toMs !== null && (completedMs === null || completedMs > toMs)) return false;
      if (status && row.dataset.status !== status) return false;
      if (learner && row.dataset.learner !== learner) return false;
      if (world && row.dataset.world !== world) return false;
      if (policy && !String(row.dataset.policies || '').split('|').includes(policy)) return false;
      return true;
    }
    function applyIndexControls() {
      var key = sortKey && sortKey.value || 'date';
      var direction = sortDir && sortDir.value || 'desc';
      var datasetKey = sortMap[key] || 'completedMs';
      var sortedRows = rows.slice().sort(function (a, b) {
        var aValue = numericSortKeys.has(key) ? numberValue(a, datasetKey) : stringValue(a, datasetKey);
        var bValue = numericSortKeys.has(key) ? numberValue(b, datasetKey) : stringValue(b, datasetKey);
        return compareValues(aValue, bValue, direction) || stringValue(a, 'reportName').localeCompare(stringValue(b, 'reportName'));
      });
      var sortedCards = cards.slice().sort(function (a, b) {
        var aValue = numericSortKeys.has(key) ? numberValue(a, datasetKey) : stringValue(a, datasetKey);
        var bValue = numericSortKeys.has(key) ? numberValue(b, datasetKey) : stringValue(b, datasetKey);
        return compareValues(aValue, bValue, direction) || stringValue(a, 'reportName').localeCompare(stringValue(b, 'reportName'));
      });
      var shown = 0;
      sortedRows.forEach(function (row) {
        var visible = rowMatches(row);
        row.hidden = !visible;
        if (visible) shown += 1;
        if (tbody) tbody.appendChild(row);
      });
      sortedCards.forEach(function (card) {
        card.hidden = !rowMatches(card);
        if (cardList) cardList.appendChild(card);
      });
      if (count) count.textContent = shown + ' shown';
      var active = [input && input.value, evaluationFilter && evaluationFilter.value !== defaultEvaluation ? evaluationFilter.value : '', scopeFilter && scopeFilter.value !== 'real' ? scopeFilter.value : '', dateFrom && dateFrom.value, dateTo && dateTo.value, statusFilter && statusFilter.value, learnerFilter && learnerFilter.value, policyFilter && policyFilter.value, worldFilter && worldFilter.value, sortKey && sortKey.value !== 'date' ? sortKey.value : '', sortDir && sortDir.value !== 'desc' ? sortDir.value : ''].filter(Boolean).length;
      if (activeFilterCount) activeFilterCount.textContent = active ? active + ' active' : 'default view';
    }
    var controls = saved && saved.controls || {};
    if (input) input.value = controls.search || '';
    if (evaluationFilter) evaluationFilter.value = defaultEvaluation;
    if (scopeFilter) scopeFilter.value = controls.scope || 'real';
    if (dateFrom) dateFrom.value = controls.from || '';
    if (dateTo) dateTo.value = controls.to || '';
    if (statusFilter) statusFilter.value = controls.status || '';
    if (learnerFilter) learnerFilter.value = controls.learner || '';
    if (policyFilter) policyFilter.value = controls.policy || '';
    if (worldFilter) worldFilter.value = controls.world || '';
    if (sortKey) sortKey.value = controls.sort || 'date';
    if (sortDir) sortDir.value = controls.direction || 'desc';
    if (filterPanel) filterPanel.open = saved && typeof saved.filtersOpen === 'boolean' ? saved.filtersOpen : !window.matchMedia('(max-width: 900px)').matches;
    Array.from(app.querySelectorAll('[data-persist-details]')).forEach(function (node) {
      var key = node.getAttribute('data-persist-details');
      if (saved && saved.openDetails && Object.prototype.hasOwnProperty.call(saved.openDetails, key)) node.open = Boolean(saved.openDetails[key]);
      node.addEventListener('toggle', persistUiState);
    });
    if (filterPanel) filterPanel.addEventListener('toggle', persistUiState);
    Array.from(app.querySelectorAll('[data-evaluation-select]')).forEach(function (control) {
      if (control.tagName === 'SELECT') control.addEventListener('change', function () { updateRoute({ evaluation: control.value }, false); });
      else control.addEventListener('click', function () { updateRoute({ evaluation: control.getAttribute('data-evaluation-select') }, false); });
    });
    Array.from(app.querySelectorAll('[data-view-select]')).forEach(function (control) {
      control.addEventListener('click', function () { updateRoute({ view: control.getAttribute('data-view-select') }, false); });
    });
    Array.from(app.querySelectorAll('[data-compare-toggle]')).forEach(function (control) {
      control.addEventListener('click', function () {
        var id = control.getAttribute('data-compare-toggle');
        var compare = (route && route.compare || []).slice();
        var index = compare.indexOf(id);
        if (index >= 0) compare.splice(index, 1);
        else if (compare.length < 3) compare.push(id);
        updateRoute({ compare: compare }, false);
      });
    });
    var compareClear = app.querySelector('[data-compare-clear]');
    if (compareClear) compareClear.addEventListener('click', function () { updateRoute({ compare: '' }, false); });
    [input, evaluationFilter, scopeFilter, dateFrom, dateTo, statusFilter, learnerFilter, policyFilter, worldFilter, sortKey, sortDir].forEach(function (control) {
      if (control) control.addEventListener(control === input ? 'input' : 'change', function () { applyIndexControls(); persistUiState(); });
    });
    if (reset) reset.addEventListener('click', function () {
      if (input) input.value = '';
      if (evaluationFilter) evaluationFilter.value = defaultEvaluation;
      if (scopeFilter) scopeFilter.value = 'real';
      if (dateFrom) dateFrom.value = '';
      if (dateTo) dateTo.value = '';
      if (statusFilter) statusFilter.value = '';
      if (learnerFilter) learnerFilter.value = '';
      if (policyFilter) policyFilter.value = '';
      if (worldFilter) worldFilter.value = '';
      if (sortKey) sortKey.value = 'date';
      if (sortDir) sortDir.value = 'desc';
      applyIndexControls();
      persistUiState();
    });
    applyIndexControls();
    persistUiState();
  }
  async function load() {
    var dataPath = app.getAttribute('data-index-data') || 'index-data.json';
    try {
      var response = await fetch(dataPath, { cache: 'no-store' });
      if (!response.ok) throw new Error(response.status + ' ' + response.statusText);
      var data = await response.json();
      try {
        var researchResponse = await fetch('index-research-data.json', { cache: 'no-store' });
        if (researchResponse.ok) data = mergeResearchData(data, await researchResponse.json());
      } catch (researchError) { /* compatibility sidecar is optional */ }
      try {
        var experimentResponse = await fetch('index-experiment-data.json', { cache: 'no-store' });
        if (experimentResponse.ok) data = mergeExperimentData(data, await experimentResponse.json());
      } catch (experimentError) { /* experiment sidecar is optional */ }
      data = await refreshExperimentProgress(data);
      render(data);
      if ((data.activeRuns || []).length) {
        window.setTimeout(load, Number(data.refreshMs || 30000));
      }
    } catch (error) {
      app.innerHTML = '<header><h1>Tutor Stub Reports</h1><div class="muted">Could not load index data: ' + esc(error.message || error) + '</div></header>';
    }
  }
  window.addEventListener('popstate', function () { if (state.data) render(state.data); });
  load();
})();`;
}
