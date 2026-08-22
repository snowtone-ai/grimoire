/**
 * gui.js — the tuning panel, generated entirely from SCHEMA.
 *
 * Hand-written rather than pulled from lil-gui because the prototype must stay
 * dependency-free and CSP-safe (it ships as one self-contained HTML file). Everything
 * here is presentation: the panel never owns state, it only writes into `params` and
 * tells the scene what kind of refresh the change needs.
 */

import { SCHEMA, PRESETS, createParams, applyDiff, diffFromDefaults, colorHex } from './params.js';

const CSS = `
.gp-root{position:fixed;top:0;right:0;height:100%;width:340px;max-width:92vw;z-index:20;
  display:flex;flex-direction:column;font:12px/1.45 ui-sans-serif,system-ui,"Segoe UI","Hiragino Sans","Noto Sans JP",sans-serif;
  color:#dbe7f2;background:rgba(9,16,28,.86);backdrop-filter:blur(14px);
  border-left:1px solid rgba(120,170,215,.22);box-shadow:-18px 0 48px rgba(0,0,0,.42);
  transition:transform .28s cubic-bezier(.2,.8,.3,1)}
.gp-root[hidden]{display:flex}
.gp-root.gp-collapsed{transform:translateX(100%)}
.gp-toggle{position:fixed;top:12px;right:12px;z-index:21;appearance:none;cursor:pointer;
  background:rgba(9,16,28,.82);color:#cfe2f2;border:1px solid rgba(120,170,215,.3);
  border-radius:9px;padding:7px 11px;font:12px/1 ui-sans-serif,system-ui,sans-serif;
  backdrop-filter:blur(10px)}
.gp-toggle:hover{background:rgba(22,38,60,.92)}
.gp-head{padding:12px 14px 10px;border-bottom:1px solid rgba(120,170,215,.16);flex:0 0 auto}
.gp-title{font-size:13px;font-weight:600;letter-spacing:.02em;margin:0 0 2px}
.gp-sub{font-size:10.5px;opacity:.62;margin:0 0 9px}
.gp-hud{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:9px}
.gp-stat{background:rgba(255,255,255,.045);border-radius:6px;padding:5px 6px;text-align:center}
.gp-stat b{display:block;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums}
.gp-stat span{font-size:9px;opacity:.55;letter-spacing:.03em}
.gp-stat.warn b{color:#ffc46b}
.gp-row{display:flex;gap:6px;margin-bottom:7px}
.gp-row:last-child{margin-bottom:0}
.gp-btn{flex:1;appearance:none;cursor:pointer;background:rgba(93,158,214,.16);color:#cfe6fb;
  border:1px solid rgba(120,180,225,.28);border-radius:7px;padding:6px 4px;font:11px/1.2 inherit;white-space:nowrap}
.gp-btn:hover{background:rgba(93,158,214,.3)}
.gp-btn.gp-primary{background:rgba(93,190,214,.26)}
select.gp-select,input.gp-search{width:100%;background:rgba(255,255,255,.06);color:#dbe7f2;
  border:1px solid rgba(120,170,215,.24);border-radius:7px;padding:6px 8px;font:11.5px/1.3 inherit}
.gp-body{flex:1 1 auto;overflow-y:auto;overscroll-behavior:contain;padding:8px 10px 40px}
.gp-body::-webkit-scrollbar{width:9px}
.gp-body::-webkit-scrollbar-thumb{background:rgba(130,180,220,.26);border-radius:9px}
.gp-group{margin-bottom:6px;border:1px solid rgba(120,170,215,.14);border-radius:9px;overflow:hidden;background:rgba(255,255,255,.02)}
.gp-group>summary{cursor:pointer;list-style:none;padding:7px 10px;font-weight:600;font-size:11.5px;
  display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,.035)}
.gp-group>summary::-webkit-details-marker{display:none}
.gp-group>summary em{font-style:normal;font-size:9.5px;opacity:.45;font-weight:400}
.gp-note{margin:0;padding:6px 10px;font-size:10px;line-height:1.55;opacity:.58;border-bottom:1px solid rgba(120,170,215,.1)}
.gp-fields{padding:6px 9px 8px}
.gp-field{margin-bottom:8px}
.gp-field:last-child{margin-bottom:2px}
.gp-label{display:flex;align-items:baseline;justify-content:space-between;gap:6px;margin-bottom:3px}
.gp-label span{font-size:10.5px;opacity:.82}
.gp-label input[type=number]{width:74px;background:rgba(255,255,255,.06);color:#e6f0f8;
  border:1px solid rgba(120,170,215,.2);border-radius:5px;padding:2px 5px;font:10.5px/1.3 ui-monospace,monospace;
  text-align:right;font-variant-numeric:tabular-nums}
.gp-field input[type=range]{width:100%;appearance:none;height:18px;background:transparent;cursor:pointer}
.gp-field input[type=range]::-webkit-slider-runnable-track{height:3px;border-radius:3px;background:rgba(140,190,230,.26)}
.gp-field input[type=range]::-webkit-slider-thumb{appearance:none;width:12px;height:12px;margin-top:-4.5px;
  border-radius:50%;background:#8fd0f5;border:none;box-shadow:0 0 0 3px rgba(143,208,245,.16)}
.gp-field input[type=range]::-moz-range-track{height:3px;border-radius:3px;background:rgba(140,190,230,.26)}
.gp-field input[type=range]::-moz-range-thumb{width:12px;height:12px;border:none;border-radius:50%;background:#8fd0f5}
.gp-inline{display:flex;align-items:center;gap:8px}
.gp-inline input[type=color]{width:38px;height:24px;padding:0;border:1px solid rgba(120,170,215,.28);
  border-radius:5px;background:transparent;cursor:pointer}
.gp-inline code{font:10.5px/1 ui-monospace,monospace;opacity:.6}
.gp-check{display:flex;align-items:center;gap:8px;cursor:pointer}
.gp-check input{width:15px;height:15px;accent-color:#6fc0ea;cursor:pointer}
.gp-help{font-size:9.5px;opacity:.45;margin-top:2px;line-height:1.5}
.gp-rebuild{font-size:9px;opacity:.5;border:1px solid rgba(255,196,107,.4);color:#ffc46b;
  border-radius:4px;padding:0 3px;margin-left:5px}
.gp-empty{opacity:.5;text-align:center;padding:18px 0;font-size:11px}
.gp-toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%) translateY(14px);z-index:30;
  background:rgba(9,16,28,.92);color:#dbe7f2;border:1px solid rgba(120,170,215,.3);border-radius:9px;
  padding:8px 16px;font:12px/1.3 ui-sans-serif,system-ui,sans-serif;opacity:0;pointer-events:none;
  transition:opacity .2s,transform .2s;backdrop-filter:blur(10px)}
.gp-toast.gp-show{opacity:1;transform:translateX(-50%) translateY(0)}
@media (max-width:720px){.gp-root{width:100%;max-width:100%}}
`;

const hexToCss = (v) => `#${(v >>> 0).toString(16).padStart(6, '0')}`;
const cssToHex = (s) => parseInt(s.slice(1), 16) >>> 0;

export class ParamPanel {
  /**
   * @param {object} params        live state, mutated in place
   * @param {object} handlers      { onLive, onGeometry, onPasses, onPreset, onAction }
   */
  constructor(params, handlers = {}) {
    this.params = params;
    this.handlers = handlers;
    this.controls = [];
    this._geometryTimer = 0;
    this._pendingGeometry = false;

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    this.root = document.createElement('aside');
    this.root.className = 'gp-root';
    this.root.setAttribute('aria-label', '背景世界パラメータ');

    this.toggle = document.createElement('button');
    this.toggle.className = 'gp-toggle';
    this.toggle.type = 'button';
    this.toggle.textContent = '調整パネル ⌄';
    this.toggle.addEventListener('click', () => this.setCollapsed(!this.collapsed));

    this.toast = document.createElement('div');
    this.toast.className = 'gp-toast';
    this.toast.setAttribute('role', 'status');

    this._buildHead();
    this._buildBody();

    document.body.appendChild(this.root);
    document.body.appendChild(this.toggle);
    document.body.appendChild(this.toast);

    this.collapsed = false;
    window.addEventListener('keydown', (e) => {
      if (e.key === 'h' || e.key === 'H') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
        this.setCollapsed(!this.collapsed);
      }
    });
  }

  setCollapsed(value) {
    this.collapsed = value;
    this.root.classList.toggle('gp-collapsed', value);
    this.toggle.textContent = value ? '調整パネル ⌃' : '調整パネル ⌄';
    this.toggle.setAttribute('aria-expanded', String(!value));
  }

  _buildHead() {
    const head = document.createElement('div');
    head.className = 'gp-head';

    const title = document.createElement('h1');
    title.className = 'gp-title';
    title.textContent = 'Area 1 — 陸珊瑚の台地';
    head.appendChild(title);

    const sub = document.createElement('p');
    sub.className = 'gp-sub';
    sub.textContent = 'Grimoire v2 背景世界プロトタイプ / H キーで開閉';
    head.appendChild(sub);

    this.hud = document.createElement('div');
    this.hud.className = 'gp-hud';
    this.hudCells = {};
    for (const [key, label] of [['fps', 'P20 FPS'], ['draws', 'DRAW'], ['tris', 'TRI'], ['tier', 'TIER']]) {
      const cell = document.createElement('div');
      cell.className = 'gp-stat';
      const b = document.createElement('b');
      b.textContent = '—';
      const s = document.createElement('span');
      s.textContent = label;
      cell.append(b, s);
      this.hud.appendChild(cell);
      this.hudCells[key] = { cell, value: b };
    }
    head.appendChild(this.hud);

    const presetRow = document.createElement('div');
    presetRow.className = 'gp-row';
    this.presetSelect = document.createElement('select');
    this.presetSelect.className = 'gp-select';
    for (const [key, preset] of Object.entries(PRESETS)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = preset.label;
      this.presetSelect.appendChild(opt);
    }
    this.presetSelect.addEventListener('change', () => {
      this.applyPreset(this.presetSelect.value);
    });
    presetRow.appendChild(this.presetSelect);
    head.appendChild(presetRow);

    const btnRow = document.createElement('div');
    btnRow.className = 'gp-row';
    btnRow.append(
      this._button('JSONをコピー', () => this._copyJson()),
      this._button('既定に戻す', () => this.applyPreset('reference', true)),
      this._button('PNG保存', () => this.handlers.onAction?.('screenshot'))
    );
    head.appendChild(btnRow);

    const searchRow = document.createElement('div');
    searchRow.className = 'gp-row';
    this.search = document.createElement('input');
    this.search.className = 'gp-search';
    this.search.type = 'search';
    this.search.placeholder = '項目を検索（例: 光芒, fog, 珊瑚）';
    this.search.addEventListener('input', () => this._applyFilter(this.search.value.trim()));
    searchRow.appendChild(this.search);
    head.appendChild(searchRow);

    this.root.appendChild(head);
  }

  _button(label, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gp-btn';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  _buildBody() {
    this.body = document.createElement('div');
    this.body.className = 'gp-body';

    this.groupEls = {};
    let first = true;
    for (const [groupKey, group] of Object.entries(SCHEMA)) {
      const details = document.createElement('details');
      details.className = 'gp-group';
      if (first) { details.open = true; first = false; }

      const summary = document.createElement('summary');
      const name = document.createElement('span');
      name.textContent = group.label;
      const count = document.createElement('em');
      count.textContent = `${Object.keys(group.params).length} 項目`;
      summary.append(name, count);
      details.appendChild(summary);

      if (group.note) {
        const note = document.createElement('p');
        note.className = 'gp-note';
        note.textContent = group.note;
        details.appendChild(note);
      }

      const fields = document.createElement('div');
      fields.className = 'gp-fields';
      for (const [key, def] of Object.entries(group.params)) {
        fields.appendChild(this._field(groupKey, key, def));
      }
      details.appendChild(fields);

      this.body.appendChild(details);
      this.groupEls[groupKey] = details;
    }

    this.emptyMsg = document.createElement('p');
    this.emptyMsg.className = 'gp-empty';
    this.emptyMsg.textContent = '該当する項目がありません';
    this.emptyMsg.style.display = 'none';
    this.body.appendChild(this.emptyMsg);

    this.root.appendChild(this.body);
  }

  _field(groupKey, key, def) {
    const wrap = document.createElement('div');
    wrap.className = 'gp-field';
    wrap.dataset.search = `${def.label} ${key} ${groupKey} ${SCHEMA[groupKey].label}`.toLowerCase();

    const commit = (value) => {
      this.params[groupKey][key] = value;
      if (def.rebuild === 'geometry') this._scheduleGeometry();
      else if (def.rebuild === 'passes') this.handlers.onPasses?.(groupKey, key);
      else this.handlers.onLive?.(groupKey, key);
    };

    if (def.type === 'bool') {
      const label = document.createElement('label');
      label.className = 'gp-check';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!this.params[groupKey][key];
      input.addEventListener('change', () => commit(input.checked));
      const span = document.createElement('span');
      span.textContent = def.label;
      if (def.rebuild) span.appendChild(this._rebuildBadge(def.rebuild));
      label.append(input, span);
      wrap.appendChild(label);
      this.controls.push({ groupKey, key, def, set: (v) => { input.checked = !!v; } });
    } else if (def.type === 'color') {
      const head = document.createElement('div');
      head.className = 'gp-label';
      const span = document.createElement('span');
      span.textContent = def.label;
      head.appendChild(span);
      wrap.appendChild(head);

      const line = document.createElement('div');
      line.className = 'gp-inline';
      const input = document.createElement('input');
      input.type = 'color';
      input.value = hexToCss(this.params[groupKey][key]);
      const code = document.createElement('code');
      code.textContent = colorHex(this.params[groupKey][key]);
      input.addEventListener('input', () => {
        const v = cssToHex(input.value);
        code.textContent = colorHex(v);
        commit(v);
      });
      line.append(input, code);
      wrap.appendChild(line);
      this.controls.push({
        groupKey, key, def,
        set: (v) => { input.value = hexToCss(v); code.textContent = colorHex(v); },
      });
    } else if (def.type === 'select') {
      const head = document.createElement('div');
      head.className = 'gp-label';
      const span = document.createElement('span');
      span.textContent = def.label;
      head.appendChild(span);
      wrap.appendChild(head);

      const select = document.createElement('select');
      select.className = 'gp-select';
      for (const opt of def.options) {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        select.appendChild(o);
      }
      select.value = this.params[groupKey][key];
      select.addEventListener('change', () => commit(select.value));
      wrap.appendChild(select);
      this.controls.push({ groupKey, key, def, set: (v) => { select.value = v; } });
    } else {
      const head = document.createElement('div');
      head.className = 'gp-label';
      const span = document.createElement('span');
      span.textContent = def.label;
      if (def.rebuild) span.appendChild(this._rebuildBadge(def.rebuild));
      const num = document.createElement('input');
      num.type = 'number';
      num.min = def.min;
      num.max = def.max;
      num.step = def.step;
      num.value = this.params[groupKey][key];
      head.append(span, num);
      wrap.appendChild(head);

      const range = document.createElement('input');
      range.type = 'range';
      range.min = def.min;
      range.max = def.max;
      range.step = def.step;
      range.value = this.params[groupKey][key];
      wrap.appendChild(range);

      const sync = (raw, from) => {
        const v = Number.isFinite(raw) ? Math.min(def.max, Math.max(def.min, raw)) : def.value;
        if (from !== 'range') range.value = v;
        if (from !== 'num') num.value = v;
        commit(v);
      };
      range.addEventListener('input', () => sync(parseFloat(range.value), 'range'));
      num.addEventListener('change', () => sync(parseFloat(num.value), 'num'));

      this.controls.push({
        groupKey, key, def,
        set: (v) => { range.value = v; num.value = v; },
      });
    }

    if (def.help) {
      const help = document.createElement('p');
      help.className = 'gp-help';
      help.textContent = def.help;
      wrap.appendChild(help);
      wrap.dataset.search += ` ${def.help.toLowerCase()}`;
    }
    return wrap;
  }

  _rebuildBadge(kind) {
    const badge = document.createElement('i');
    badge.className = 'gp-rebuild';
    badge.textContent = kind === 'geometry' ? '再生成' : '再確保';
    badge.title = kind === 'geometry'
      ? 'ジオメトリを作り直します（少し時間がかかります）'
      : 'レンダーターゲットを確保し直します';
    return badge;
  }

  /** Geometry rebuilds are expensive; coalesce a burst of slider moves into one. */
  _scheduleGeometry() {
    this._pendingGeometry = true;
    clearTimeout(this._geometryTimer);
    this._geometryTimer = setTimeout(() => {
      this._pendingGeometry = false;
      this.handlers.onGeometry?.();
    }, 260);
  }

  _applyFilter(query) {
    const q = query.toLowerCase();
    let anyVisible = false;
    for (const [groupKey, details] of Object.entries(this.groupEls)) {
      let visibleInGroup = 0;
      for (const field of details.querySelectorAll('.gp-field')) {
        const match = q === '' || field.dataset.search.includes(q);
        field.style.display = match ? '' : 'none';
        if (match) visibleInGroup++;
      }
      const groupMatch = q === '' || SCHEMA[groupKey].label.toLowerCase().includes(q);
      const show = visibleInGroup > 0 || groupMatch;
      details.style.display = show ? '' : 'none';
      if (show) anyVisible = true;
      if (q !== '' && show) details.open = true;
    }
    this.emptyMsg.style.display = anyVisible ? 'none' : '';
  }

  /** Applies a named preset over pristine defaults, then refreshes every control. */
  applyPreset(name, silent = false) {
    const preset = PRESETS[name];
    if (!preset) return;
    const fresh = createParams();
    applyDiff(fresh, preset.diff);
    for (const [groupKey, group] of Object.entries(fresh)) {
      for (const [key, value] of Object.entries(group)) {
        this.params[groupKey][key] = value;
      }
    }
    this.syncFromParams();
    this.presetSelect.value = name;
    this.handlers.onPreset?.(name);
    if (!silent) this.showToast(`プリセット「${preset.label}」を適用しました`);
  }

  /** Pushes `params` back into every widget — used after presets and JSON import. */
  syncFromParams() {
    for (const c of this.controls) c.set(this.params[c.groupKey][c.key]);
  }

  async _copyJson() {
    const diff = diffFromDefaults(this.params);
    const text = JSON.stringify(diff, null, 2).replace(/"(0x[0-9a-f]{6})"/g, '$1');
    const payload = Object.keys(diff).length === 0
      ? '// 既定値からの変更はありません\n{}'
      : text;
    try {
      await navigator.clipboard.writeText(payload);
      this.showToast('変更点のJSONをコピーしました');
    } catch {
      // Clipboard is blocked on file:// in some browsers — fall back to a selectable prompt.
      window.prompt('コピーしてください', payload);
    }
  }

  updateStats(stats, tier) {
    const fpsCell = this.hudCells.fps;
    fpsCell.value.textContent = stats.fpsP20 > 0 ? String(stats.fpsP20) : '—';
    fpsCell.cell.classList.toggle(
      'warn', stats.fpsP20 > 0 && stats.fpsP20 < this.params.quality.degradeFps
    );

    this.hudCells.draws.value.textContent = String(stats.drawCalls);
    this.hudCells.draws.cell.classList.toggle(
      'warn', stats.drawCalls > this.params.quality.drawCallBudgetFull
    );

    const k = stats.primarySceneTriangles / 1000;
    this.hudCells.tris.value.textContent = k >= 1
      ? `${k.toFixed(0)}k`
      : String(stats.primarySceneTriangles);
    this.hudCells.tris.cell.classList.toggle(
      'warn', stats.primarySceneTriangles > this.params.quality.triangleBudgetFull
        * (1 + this.params.quality.triangleTolerance)
    );

    this.hudCells.tier.value.textContent = tier === 'reduced'
      ? (stats.qualityLocked ? 'RED!' : 'RED')
      : 'FULL';
    this.hudCells.tier.cell.classList.toggle('warn', tier === 'reduced');
  }

  showToast(message) {
    this.toast.textContent = message;
    this.toast.classList.add('gp-show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toast.classList.remove('gp-show'), 2200);
  }
}
