(function () {
  // ====== 常量 & 状态 ======
  const STORAGE_KEY = 'st_worldbooks_data';
  const APPLIED_KEY = 'st_applied_world_id';

  const state = {
    worldbooks: [],         // Worldbook[]
    appliedWorldId: localStorage.getItem(APPLIED_KEY) || null,
    currentWorldId: null,   // 当前下拉框选中的世界书（用于“查看”）
    currentSelection: null, // { type: 'world'|'category'|'entry', worldId, catName?, entryId? }
    isEditMode: false,
    keyword: '',
    importMode: null        // 'world' | 'category' | 'entry'
  };

  // ====== DOM 缓存 ======
  const els = {
    worldSelector: document.getElementById('world-selector'),
    appliedInfo: document.getElementById('applied-world-info'),
    treeRoot: document.getElementById('tree-root'),
    detailPanel: document.getElementById('detail-panel'),
    detailTitle: document.getElementById('detail-title'),

    btnApplyWorld: document.getElementById('btn-apply-world'),
    btnNewWorld: document.getElementById('btn-new-world'),
    btnImportWorld: document.getElementById('btn-import-world'),
    btnExportWorld: document.getElementById('btn-export-world'),
    btnDeleteWorld: document.getElementById('btn-delete-world'),
    fileInput: document.getElementById('file-input-hidden'),

    searchInput: document.getElementById('search-keyword'),
    btnSearch: document.getElementById('btn-search'),
    btnCreateCategory: document.getElementById('btn-create-category'),
    btnCreateEntry: document.getElementById('btn-create-entry'),
    btnImportCategory: document.getElementById('btn-import-category'),
    btnImportEntry: document.getElementById('btn-import-entry'),
    btnDeleteNode: document.getElementById('btn-delete-node'),

    modePreview: document.getElementById('mode-preview'),
    modeEdit: document.getElementById('mode-edit'),
    btnSave: document.getElementById('btn-save-detail'),
    btnExportCurrent: document.getElementById('btn-export-current')
  };

  // ====== 初始化入口 ======
  function init() {
    loadData();
    bindEvents();
    refreshUI();
  }

  // ====== 数据持久化 ======
  function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          state.worldbooks = parsed.map(normalizeLoadedWorld);
        }
      } catch (e) {
        console.warn('世界书数据解析失败，忽略:', e);
      }
    }

    // 初始化 currentWorldId
    if (state.worldbooks.length > 0) {
      const appliedExists = state.appliedWorldId && getWorldById(state.appliedWorldId);
      state.currentWorldId = appliedExists
        ? state.appliedWorldId
        : state.worldbooks[0].id;
    } else {
      state.currentWorldId = null;
    }
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.worldbooks));
    if (state.appliedWorldId) {
      localStorage.setItem(APPLIED_KEY, state.appliedWorldId);
    } else {
      localStorage.removeItem(APPLIED_KEY);
    }
  }

  // 兼容旧结构，确保 world 上有需要的字段
  function normalizeLoadedWorld(w) {
    return {
      id: w.id || generateId(),
      name: w.name || '未命名世界书',
      description: w.description || '',
      categories: w.categories || {},
      categoryMeta: w.categoryMeta || {},
      _expanded_cats: w._expanded_cats || {}
    };
  }

  // ====== 工具函数 ======
  function generateId() {
    return 'w_' + Math.random().toString(36).slice(2, 10);
  }

  function getWorldById(id) {
    if (!id) return null;
    return state.worldbooks.find(w => String(w.id) === String(id)) || null;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  // 简单模态框（单输入）
  function openInputModal(options) {
    const {
      title = '输入',
      label = '名称',
      placeholder = '',
      defaultValue = '',
      onConfirm
    } = options || {};

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
      <div class="modal-window">
        <div class="modal-header">
          <div>${escapeHtml(title)}</div>
          <button class="icon-button modal-close-btn">✕</button>
        </div>
        <div class="modal-body">
          <label class="form-label">${escapeHtml(label)}</label>
          <input id="modal-input" class="form-input" type="text"
                 placeholder="${escapeHtml(placeholder)}"
                 value="${escapeHtml(defaultValue)}">
        </div>
        <div class="modal-footer">
          <button class="btn-secondary btn-small modal-cancel-btn">取消</button>
          <button class="btn-primary btn-small modal-ok-btn">确定</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = overlay.querySelector('#modal-input');
    const btnOk = overlay.querySelector('.modal-ok-btn');
    const btnCancel = overlay.querySelector('.modal-cancel-btn');
    const btnClose = overlay.querySelector('.modal-close-btn');

    input.focus();
    input.select();

    function close() {
      overlay.remove();
    }

    btnCancel.onclick = close;
    btnClose.onclick = close;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    btnOk.onclick = () => {
      const value = input.value.trim();
      if (!value) {
        input.focus();
        return;
      }
      if (onConfirm) onConfirm(value, close);
    };
  }

  // 新建条目模态框：选择模块 + 条目名
  function openNewEntryModal(world, onConfirm) {
    const catNames = Object.keys(world.categories || {});
    if (catNames.length === 0) {
      alert('当前世界书没有任何模块，请先创建“新建模块”。');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
      <div class="modal-window">
        <div class="modal-header">
          <div>新建条目</div>
          <button class="icon-button modal-close-btn">✕</button>
        </div>
        <div class="modal-body">
          <div class="settings-section">
            <label class="form-label">所属模块</label>
            <select id="modal-cat-select" class="form-select">
              ${catNames.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('')}
            </select>
          </div>
          <div class="settings-section">
            <label class="form-label">条目名称</label>
            <input id="modal-entry-name" class="form-input" type="text" placeholder="请输入条目名称">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary btn-small modal-cancel-btn">取消</button>
          <button class="btn-primary btn-small modal-ok-btn">确定</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const catSelect = overlay.querySelector('#modal-cat-select');
    const entryInput = overlay.querySelector('#modal-entry-name');
    const btnOk = overlay.querySelector('.modal-ok-btn');
    const btnCancel = overlay.querySelector('.modal-cancel-btn');
    const btnClose = overlay.querySelector('.modal-close-btn');

    entryInput.focus();

    function close() {
      overlay.remove();
    }

    btnCancel.onclick = close;
    btnClose.onclick = close;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    btnOk.onclick = () => {
      const catName = catSelect.value;
      const entryName = entryInput.value.trim();
      if (!entryName) {
        entryInput.focus();
        return;
      }
      if (onConfirm) onConfirm({ catName, entryName }, close);
    };
  }

  // ====== UI 刷新 ======
  function refreshUI() {
    renderWorldSelector();
    renderTree();
    updateAppliedText();
    renderDetail(); // 根据 currentSelection 更新右侧
  }

  function renderWorldSelector() {
    // 没有世界书
    if (!state.worldbooks.length) {
      els.worldSelector.innerHTML = '<option value="">暂无世界书</option>';
      els.worldSelector.disabled = true;
      return;
    }

    els.worldSelector.disabled = false;

    const optionsHtml = state.worldbooks.map(w =>
      `<option value="${w.id}">${escapeHtml(w.name)}</option>`
    ).join('');

    els.worldSelector.innerHTML = optionsHtml;

    // 保持 currentWorldId 合法
    if (!state.currentWorldId || !getWorldById(state.currentWorldId)) {
      const appliedExists = state.appliedWorldId && getWorldById(state.appliedWorldId);
      state.currentWorldId = appliedExists
        ? state.appliedWorldId
        : state.worldbooks[0].id;
    }

    els.worldSelector.value = state.currentWorldId;
  }

  function updateAppliedText() {
    const applied = getWorldById(state.appliedWorldId);
    els.appliedInfo.textContent = applied
      ? `当前应用：${applied.name}`
      : '当前应用：尚未应用任何世界书';
  }

  function renderTree() {
    els.treeRoot.innerHTML = '';

    const world = getWorldById(state.currentWorldId);
    if (!world) {
      return;
    }

    const keyword = (state.keyword || '').toLowerCase();

    const catNames = Object.keys(world.categories || {});
    catNames.forEach(catName => {
      const entries = world.categories[catName] || [];

      // 过滤条目
      let filteredEntries = entries;
      if (keyword) {
        filteredEntries = entries.filter(e => {
          const title = (e.title || '').toLowerCase();
          const content = (e.content || '').toLowerCase();
          const tags = Array.isArray(e.tags) ? e.tags.join(' ').toLowerCase() : '';
          const catLower = catName.toLowerCase();
          return (
            title.includes(keyword) ||
            content.includes(keyword) ||
            tags.includes(keyword) ||
            catLower.includes(keyword)
          );
        });

        // 关键词存在但此模块没有任何命中且模块名也不匹配，则完全不显示该模块
        if (!filteredEntries.length && !catName.toLowerCase().includes(keyword)) {
          return;
        }
      }

      const container = document.createElement('div');
      container.className = 'tree-level-2-container' +
        (world._expanded_cats && world._expanded_cats[catName] ? ' expanded' : '');

      container.innerHTML = `
        <div class="tree-node tree-header-2" data-cat="${escapeHtml(catName)}">
          <span class="cat-click-area">📂 ${escapeHtml(catName)}</span>
          <span class="icon-arrow arrow-toggle">${world._expanded_cats && world._expanded_cats[catName] ? '▼' : '▶'}</span>
        </div>
        <div class="tree-children-2">
          ${filteredEntries.map(e => `
            <div class="tree-node tree-item-3" data-id="${escapeHtml(e.id)}">📄 ${escapeHtml(e.title || '未命名条目')}</div>
          `).join('')}
        </div>
      `;

      const header = container.querySelector('.tree-header-2');
      const clickArea = container.querySelector('.cat-click-area');
      const arrow = container.querySelector('.arrow-toggle');

      // 点击模块文字 -> 查看模块详情
      clickArea.onclick = (e) => {
        e.stopPropagation();
        selectNode('category', { worldId: world.id, catName });
      };

      // 点击箭头 -> 展开/收起条目
      arrow.onclick = (e) => {
        e.stopPropagation();
        if (!world._expanded_cats) world._expanded_cats = {};
        world._expanded_cats[catName] = !world._expanded_cats[catName];
        saveData();
        renderTree();
      };

      // 点击条目 -> 查看条目详情
      container.querySelectorAll('.tree-item-3').forEach(itemEl => {
        itemEl.onclick = () => {
          const entryId = itemEl.getAttribute('data-id');
          selectNode('entry', { worldId: world.id, catName, entryId });
        };
      });

      els.treeRoot.appendChild(container);
    });

    applySelectionHighlight();
  }

  function applySelectionHighlight() {
    const sel = state.currentSelection;
    const allNodes = els.treeRoot.querySelectorAll('.tree-node');
    allNodes.forEach(n => n.classList.remove('selected'));

    if (!sel) return;

    if (sel.type === 'category') {
      const selector = `.tree-header-2[data-cat="${sel.catName}"]`;
      const el = els.treeRoot.querySelector(selector);
      if (el) el.classList.add('selected');
    } else if (sel.type === 'entry') {
      const selector = `.tree-item-3[data-id="${sel.entryId}"]`;
      const el = els.treeRoot.querySelector(selector);
      if (el) el.classList.add('selected');
    }
  }

  // ====== 右侧详情渲染 ======
  function selectNode(type, params) {
    state.currentSelection = { type, ...params };
    state.isEditMode = false;
    renderDetail();
    applySelectionHighlight();
  }

  function renderDetail() {
    const sel = state.currentSelection;
    const world = sel ? getWorldById(sel.worldId) : null;

    if (!sel || !world) {
      els.detailTitle.textContent = '内容预览';
      els.detailPanel.innerHTML = `
        <div class="placeholder-text">
          请选择左侧的世界书、模块或条目。
        </div>
      `;
      updateModeButtons(false);
      return;
    }

    let html = '';
    let title = '';

    if (sel.type === 'world') {
      title = `世界书：${world.name}`;
      const desc = (world.description || '').trim();

      if (state.isEditMode) {
        html = `
          <label class="form-label">世界书简介</label>
          <textarea id="edit-world-desc" class="form-textarea" style="flex:1; min-height: 180px;">${escapeHtml(desc)}</textarea>
        `;
      } else {
        if (desc) {
          html = `<div class="render-box" style="white-space: pre-wrap; line-height:1.6;">${escapeHtml(desc)}</div>`;
        } else {
          html = `<div class="placeholder-text">无详情，可切换到“编辑”模式补充世界书简介。</div>`;
        }
      }
    } else if (sel.type === 'category') {
      const catName = sel.catName;
      const meta = (world.categoryMeta && world.categoryMeta[catName]) || { description: '' };
      const desc = (meta.description || '').trim();
      const count = (world.categories[catName] || []).length;

      title = `模块：${catName}`;

      if (state.isEditMode) {
        html = `
          <label class="form-label">模块简介</label>
          <textarea id="edit-category-desc" class="form-textarea" style="flex:1; min-height: 180px;">${escapeHtml(desc)}</textarea>
        `;
      } else {
        if (desc) {
          html = `<div class="render-box" style="white-space: pre-wrap; line-height:1.6;">${escapeHtml(desc)}</div>`;
        } else {
          html = `<div class="placeholder-text">无详情。该模块下共有 ${count} 个条目。</div>`;
        }
      }
    } else if (sel.type === 'entry') {
      const catName = sel.catName;
      const entries = world.categories[catName] || [];
      const entry = entries.find(e => String(e.id) === String(sel.entryId));

      if (!entry) {
        els.detailTitle.textContent = '内容预览';
        els.detailPanel.innerHTML = `<div class="placeholder-text">条目不存在或已被删除。</div>`;
        updateModeButtons(false);
        return;
      }

      title = entry.title || '未命名条目';

      if (state.isEditMode) {
        html = `
          <label class="form-label">条目标题</label>
          <input id="edit-title" class="form-input" value="${escapeHtml(entry.title || '')}" style="margin-bottom:10px;">
          <label class="form-label">条目内容</label>
          <textarea id="edit-content" class="form-textarea" style="flex:1; min-height: 260px;">${escapeHtml(entry.content || '')}</textarea>
        `;
      } else {
        const content = entry.content && entry.content.trim()
          ? entry.content
          : '（暂无内容）';

        html = `
          <div class="render-box" style="white-space: pre-wrap; line-height:1.6;">${escapeHtml(content)}</div>
        `;
      }
    }

    els.detailTitle.textContent = title;
    els.detailPanel.innerHTML = html;
    updateModeButtons(true);
  }

  function updateModeButtons(hasSelection) {
    els.modePreview.classList.toggle('active', !state.isEditMode);
    els.modeEdit.classList.toggle('active', state.isEditMode);

    // 只有在选中某个对象 + 编辑模式下才允许“保存修改”
    const canSave = hasSelection && state.isEditMode;
    els.btnSave.disabled = !canSave;
  }

  // ====== 导入 / 导出 ======

  // 通用：把各种 JSON 结构转成 worldbook 数组（不直接放入 state）
  function normalizeImportedJson(raw, fileName) {
    const result = [];
    const baseName = fileName.replace(/\.[^.]+$/, '');

    function createEmptyWorld(name, desc) {
      return {
        id: generateId(),
        name: name || baseName || '未命名世界书',
        description: desc || '',
        categories: {},
        categoryMeta: {},
        _expanded_cats: {}
      };
    }

    function ensureCategory(world, catName) {
      if (!world.categories[catName]) {
        world.categories[catName] = [];
      }
      if (!world.categoryMeta) world.categoryMeta = {};
      if (!world.categoryMeta[catName]) {
        world.categoryMeta[catName] = { description: '' };
      }
    }

    function pushEntry(world, catName, src) {
      ensureCategory(world, catName);
      world.categories[catName].push({
        id: String(src.id || src.uid || generateId()),
        title: src.title || src.comment || src.name || '未命名条目',
        content: src.content || src.text || '',
        tags: src.tags || src.key || [],
        raw: src
      });
    }

    // 1) Dreamer / entries map 格式
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.entries && typeof raw.entries === 'object') {
      const world = createEmptyWorld(raw.name || raw.title || baseName, raw.description || raw.comment || '');
      Object.values(raw.entries).forEach(item => {
        const keys = Array.isArray(item.key) ? item.key.filter(Boolean) : [];
        const cat = keys[0] || '未分类';
        pushEntry(world, cat, item);
      });
      result.push(world);
      return result;
    }

    // 2) 标准 categories/modules 格式
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && (raw.categories || raw.modules)) {
      const world = createEmptyWorld(raw.name || raw.title || baseName, raw.description || raw.summary || '');
      const container = raw.categories || raw.modules;

      if (Array.isArray(container)) {
        // 数组：[{ name, entries }, ...]
        container.forEach(catObj => {
          const catName = catObj.name || catObj.title || '未命名模块';
          ensureCategory(world, catName);
          if (catObj.description) {
            world.categoryMeta[catName].description = String(catObj.description);
          }
          const arr = catObj.entries || catObj.items || [];
          if (Array.isArray(arr)) {
            arr.forEach(item => pushEntry(world, catName, item));
          }
        });
      } else {
        // 对象：{ 模块名: { description, entries } | Entry[] }
        Object.entries(container).forEach(([catName, value]) => {
          ensureCategory(world, catName);
          if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.description === 'string') {
            world.categoryMeta[catName].description = value.description;
          }
          const arr = (value && typeof value === 'object' && !Array.isArray(value) && Array.isArray(value.entries))
            ? value.entries
            : Array.isArray(value)
              ? value
              : [];
          arr.forEach(item => pushEntry(world, catName, item));
        });
      }

      result.push(world);
      return result;
    }

    // 3) 顶层 worlds 数组
    if (raw && typeof raw === 'object' && Array.isArray(raw.worlds)) {
      raw.worlds.forEach((w, idx) => {
        const world = createEmptyWorld(w.name || `${baseName}-${idx + 1}`, w.description || w.summary || '');
        const container = w.categories || w.modules;

        if (container) {
          if (Array.isArray(container)) {
            container.forEach(catObj => {
              const catName = catObj.name || catObj.title || '未命名模块';
              ensureCategory(world, catName);
              if (catObj.description) {
                world.categoryMeta[catName].description = String(catObj.description);
              }
              const arr = catObj.entries || catObj.items || [];
              if (Array.isArray(arr)) {
                arr.forEach(item => pushEntry(world, catName, item));
              }
            });
          } else {
            Object.entries(container).forEach(([catName, value]) => {
              ensureCategory(world, catName);
              if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.description === 'string') {
                world.categoryMeta[catName].description = value.description;
              }
              const arr = (value && typeof value === 'object' && !Array.isArray(value) && Array.isArray(value.entries))
                ? value.entries
                : Array.isArray(value)
                  ? value
                  : [];
              arr.forEach(item => pushEntry(world, catName, item));
            });
          }
        }

        result.push(world);
      });
      return result;
    }

    // 4) 顶层平铺数组
    if (Array.isArray(raw)) {
      const world = createEmptyWorld(baseName, '');
      raw.forEach(item => {
        if (!item || typeof item !== 'object') return;
        const catName = item.category || item.module || '未分类';
        pushEntry(world, catName, item);
      });
      result.push(world);
      return result;
    }

    // 5) 兜底：整个 JSON 当成一个条目
    const world = createEmptyWorld(baseName, '');
    if (!world.categories['默认模块']) {
      world.categories['默认模块'] = [];
    }
    world.categories['默认模块'].push({
      id: generateId(),
      title: '原始数据',
      content: JSON.stringify(raw, null, 2),
      tags: [],
      raw: raw
    });
    result.push(world);
    return result;
  }

  // 导入整本世界书
  function handleImportWorld(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target.result);
        const worlds = normalizeImportedJson(raw, file.name);

        if (!worlds.length) {
          alert('未识别到可用的世界书结构。');
          return;
        }

        state.worldbooks.push(...worlds);
        saveData();

        // 默认选中新导入的第一个世界
        state.currentWorldId = worlds[0].id;
        state.currentSelection = { type: 'world', worldId: state.currentWorldId };
        state.isEditMode = false;

        refreshUI();
        alert(`导入成功：共导入 ${worlds.length} 个世界书。`);
      } catch (err) {
        console.error(err);
        alert('导入失败：请确认 JSON 格式是否正确。');
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  // 导入模块：把文件中的所有模块合并到当前世界书中
  // 约定：如果模块名已存在，则“附加条目”；如果不存在则新增模块
  function handleImportCategory(file) {
    const world = getWorldById(state.currentWorldId);
    if (!world) {
      alert('请先选择一个世界书，再导入模块。');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target.result);
        const importedWorlds = normalizeImportedJson(raw, file.name);

        if (!importedWorlds.length) {
          alert('未识别到可用的模块结构。');
          return;
        }

        importedWorlds.forEach(srcWorld => {
          Object.keys(srcWorld.categories || {}).forEach(catName => {
            const srcEntries = srcWorld.categories[catName] || [];
            if (!world.categories[catName]) {
              // 新模块：直接拷贝
              world.categories[catName] = [];
            }
            if (!world.categoryMeta) world.categoryMeta = {};
            if (!world.categoryMeta[catName]) {
              world.categoryMeta[catName] = {
                description:
                  srcWorld.categoryMeta &&
                  srcWorld.categoryMeta[catName] &&
                  srcWorld.categoryMeta[catName].description
                    ? String(srcWorld.categoryMeta[catName].description)
                    : ''
              };
            }
            // 已存在模块：附加条目
            srcEntries.forEach(eItem => {
              world.categories[catName].push({
                id: generateId(),
                title: eItem.title || '未命名条目',
                content: eItem.content || '',
                tags: eItem.tags || [],
                raw: eItem.raw || eItem
              });
            });
          });
        });

        if (!world._expanded_cats) world._expanded_cats = {};
        Object.keys(world.categories || {}).forEach(catName => {
          world._expanded_cats[catName] = true;
        });

        saveData();
        renderTree();
        alert('导入模块成功。');
      } catch (err) {
        console.error(err);
        alert('导入模块失败：请确认 JSON 格式是否正确。');
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  // 导入条目：把文件中的条目合并到当前世界书的对应模块中
  // 若条目带有 category/module 字段或 key[0]，按其归类，否则归类到“未分类”
  function handleImportEntry(file) {
    const world = getWorldById(state.currentWorldId);
    if (!world) {
      alert('请先选择一个世界书，再导入条目。');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target.result);
        const importedWorlds = normalizeImportedJson(raw, file.name);

        if (!importedWorlds.length) {
          alert('未识别到可用的条目结构。');
          return;
        }

        importedWorlds.forEach(srcWorld => {
          Object.keys(srcWorld.categories || {}).forEach(catName => {
            const srcEntries = srcWorld.categories[catName] || [];
            if (!world.categories[catName]) {
              world.categories[catName] = [];
            }
            if (!world.categoryMeta) world.categoryMeta = {};
            if (!world.categoryMeta[catName]) {
              world.categoryMeta[catName] = { description: '' };
            }

            srcEntries.forEach(eItem => {
              world.categories[catName].push({
                id: generateId(),
                title: eItem.title || '未命名条目',
                content: eItem.content || '',
                tags: eItem.tags || [],
                raw: eItem.raw || eItem
              });
            });
          });
        });

        if (!world._expanded_cats) world._expanded_cats = {};
        Object.keys(world.categories || {}).forEach(catName => {
          world._expanded_cats[catName] = true;
        });

        saveData();
        renderTree();
        alert('导入条目成功。');
      } catch (err) {
        console.error(err);
        alert('导入条目失败：请确认 JSON 格式是否正确。');
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  function normalizeEntryForExport(e) {
    return {
      id: e.id,
      title: e.title || '',
      content: e.content || '',
      tags: e.tags || []
    };
  }

  function buildWorldExportPayload(world) {
    const out = {
      name: world.name || '',
      description: world.description || '',
      categories: {}
    };

    Object.keys(world.categories || {}).forEach(catName => {
      const meta = (world.categoryMeta && world.categoryMeta[catName]) || { description: '' };
      out.categories[catName] = {
        description: meta.description || '',
        entries: (world.categories[catName] || []).map(normalizeEntryForExport)
      };
    });

    return out;
  }

  function downloadJson(obj, fileName) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace(/[\\\/:*?"<>|]/g, '_') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportCurrent() {
    const sel = state.currentSelection;
    if (!sel) {
      alert('请先在左侧选择要导出的世界书、模块或条目。');
      return;
    }

    const world = getWorldById(sel.worldId);
    if (!world) {
      alert('当前选择的世界书不存在。');
      return;
    }

    let exportData;
    let fileName;

    if (sel.type === 'world') {
      exportData = buildWorldExportPayload(world);
      fileName = world.name || 'worldbook';
    } else if (sel.type === 'category') {
      const catName = sel.catName;
      exportData = {
        worldName: world.name,
        categoryName: catName,
        description: (world.categoryMeta && world.categoryMeta[catName] && world.categoryMeta[catName].description) || '',
        entries: (world.categories[catName] || []).map(normalizeEntryForExport)
      };
      fileName = `${world.name || 'worldbook'}-${catName}`;
    } else {
      const catName = sel.catName;
      const entries = world.categories[catName] || [];
      const entry = entries.find(e => String(e.id) === String(sel.entryId));
      if (!entry) {
        alert('要导出的条目不存在。');
        return;
      }
      exportData = normalizeEntryForExport(entry);
      fileName = entry.title || 'entry';
    }

    downloadJson(exportData, fileName);
  }

  function handleExportWorldOnly() {
    const world = getWorldById(state.currentWorldId);
    if (!world) {
      alert('当前没有选中的世界书。');
      return;
    }
    const payload = buildWorldExportPayload(world);
    downloadJson(payload, world.name || 'worldbook');
  }

  // ====== 事件绑定 ======
  function bindEvents() {
    // 世界书下拉框改变：只改变“查看目标”
    els.worldSelector.onchange = () => {
      state.currentWorldId = els.worldSelector.value || null;
      if (state.currentWorldId) {
        state.currentSelection = { type: 'world', worldId: state.currentWorldId };
      } else {
        state.currentSelection = null;
      }
      state.isEditMode = false;
      state.keyword = '';
      if (els.searchInput) els.searchInput.value = '';
      renderTree();
      renderDetail();
      updateAppliedText();
    };

    // 应用世界书
    els.btnApplyWorld.onclick = () => {
      if (!state.currentWorldId) {
        alert('请先选择一个世界书。');
        return;
      }
      state.appliedWorldId = state.currentWorldId;
      saveData();
      updateAppliedText();
    };

    // 新建世界书
    els.btnNewWorld.onclick = () => {
      openInputModal({
        title: '新建世界书',
        label: '世界书名称',
        placeholder: '请输入世界书名称',
        onConfirm(name, close) {
          const world = {
            id: generateId(),
            name,
            description: '',
            categories: {},
            categoryMeta: {},
            _expanded_cats: {}
          };
          state.worldbooks.push(world);
          state.currentWorldId = world.id;
          state.currentSelection = { type: 'world', worldId: world.id };
          state.isEditMode = false;
          saveData();
          refreshUI();
          close();
        }
      });
    };

    // 导入世界书 JSON
    els.btnImportWorld.onclick = () => {
      state.importMode = 'world';
      els.fileInput.click();
    };

    // 导出当前下拉框选中的世界书（即当前查看的一级世界书）
    els.btnExportWorld.onclick = handleExportWorldOnly;

    // 删除当前世界书（顶栏删除）
    els.btnDeleteWorld.onclick = () => {
      const world = getWorldById(state.currentWorldId);
      if (!world) {
        alert('当前没有可删除的世界书。');
        return;
      }
      if (!confirm(`确认删除世界书「${world.name}」？该操作不可撤销。`)) return;

      const idx = state.worldbooks.findIndex(w => w.id === world.id);
      if (idx >= 0) {
        state.worldbooks.splice(idx, 1);
      }
      if (state.appliedWorldId === world.id) {
        state.appliedWorldId = null;
      }
      if (state.currentWorldId === world.id) {
        state.currentWorldId = state.worldbooks[0] ? state.worldbooks[0].id : null;
      }
      state.currentSelection = state.currentWorldId
        ? { type: 'world', worldId: state.currentWorldId }
        : null;
      state.isEditMode = false;

      saveData();
      refreshUI();
    };

    // 通用 file input，根据 importMode 分发
    els.fileInput.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const mode = state.importMode || 'world';
      state.importMode = null;

      if (mode === 'world') {
        handleImportWorld(file);
      } else if (mode === 'category') {
        handleImportCategory(file);
      } else if (mode === 'entry') {
        handleImportEntry(file);
      } else {
        // 兜底当世界书导入
        handleImportWorld(file);
      }

      e.target.value = '';
    };

    // 搜索内容
    function doSearch() {
      state.keyword = (els.searchInput.value || '').trim();
      renderTree();
    }

    els.btnSearch.onclick = () => {
      doSearch();
    };
    els.searchInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        doSearch();
      }
    };
    // 即时搜索
    els.searchInput.oninput = () => {
      state.keyword = (els.searchInput.value || '').trim();
      renderTree();
    };

    // 新建模块
    els.btnCreateCategory.onclick = () => {
      const world = getWorldById(state.currentWorldId);
      if (!world) {
        alert('请先选择一个世界书。');
        return;
      }
      openInputModal({
        title: '新建模块',
        label: '模块名称',
        placeholder: '请输入模块名称',
        onConfirm(name, close) {
          if (!world.categories[name]) {
            world.categories[name] = [];
          }
          if (!world.categoryMeta) world.categoryMeta = {};
          if (!world.categoryMeta[name]) {
            world.categoryMeta[name] = { description: '' };
          }
          if (!world._expanded_cats) world._expanded_cats = {};
          world._expanded_cats[name] = true;

          saveData();
          selectNode('category', { worldId: world.id, catName: name });
          renderTree();
          close();
        }
      });
    };

    // 新建条目
    els.btnCreateEntry.onclick = () => {
      const world = getWorldById(state.currentWorldId);
      if (!world) {
        alert('请先选择一个世界书。');
        return;
      }
      openNewEntryModal(world, ({ catName, entryName }, close) => {
        if (!world.categories[catName]) {
          world.categories[catName] = [];
        }
        const entry = {
          id: generateId(),
          title: entryName,
          content: '',
          tags: []
        };
        world.categories[catName].push(entry);
        if (!world._expanded_cats) world._expanded_cats = {};
        world._expanded_cats[catName] = true;

        saveData();
        selectNode('entry', { worldId: world.id, catName, entryId: entry.id });
        renderTree();
        close();
      });
    };

    // 导入模块按钮
    els.btnImportCategory.onclick = () => {
      const world = getWorldById(state.currentWorldId);
      if (!world) {
        alert('请先选择一个世界书。');
        return;
      }
      state.importMode = 'category';
      els.fileInput.click();
    };

    // 导入条目按钮
    els.btnImportEntry.onclick = () => {
      const world = getWorldById(state.currentWorldId);
      if (!world) {
        alert('请先选择一个世界书。');
        return;
      }
      state.importMode = 'entry';
      els.fileInput.click();
    };

    // 删除（模块 / 条目）
    els.btnDeleteNode.onclick = () => {
      const sel = state.currentSelection;
      const world = sel ? getWorldById(sel.worldId) : null;

      if (!sel || !world) {
        alert('请先在左侧选择要删除的模块或条目。');
        return;
      }

      if (sel.type === 'world') {
        alert('删除整本世界书请使用上方的“删除”按钮。');
        return;
      }

      if (sel.type === 'category') {
        const catName = sel.catName;
        if (!world.categories[catName]) {
          alert('该模块不存在或已被删除。');
          return;
        }
        const ok = confirm(`确认删除模块「${catName}」及其所有条目？该操作不可撤销。`);
        if (!ok) return;

        delete world.categories[catName];
        if (world.categoryMeta && world.categoryMeta[catName]) {
          delete world.categoryMeta[catName];
        }
        if (world._expanded_cats && world._expanded_cats[catName]) {
          delete world._expanded_cats[catName];
        }

        state.currentSelection = { type: 'world', worldId: world.id };
        state.isEditMode = false;

        saveData();
        renderTree();
        renderDetail();
      } else if (sel.type === 'entry') {
        const catName = sel.catName;
        const entries = world.categories[catName] || [];
        const idx = entries.findIndex(e => String(e.id) === String(sel.entryId));
        if (idx === -1) {
          alert('该条目不存在或已被删除。');
          return;
        }
        const entry = entries[idx];
        const ok = confirm(`确认删除条目「${entry.title || '未命名条目'}」？该操作不可撤销。`);
        if (!ok) return;

        entries.splice(idx, 1);

        state.currentSelection = { type: 'category', worldId: world.id, catName };
        state.isEditMode = false;

        saveData();
        renderTree();
        renderDetail();
      }
    };

    // 预览 / 编辑模式切换
    els.modePreview.onclick = () => {
      if (!state.currentSelection) return;
      state.isEditMode = false;
      renderDetail();
    };
    els.modeEdit.onclick = () => {
      if (!state.currentSelection) {
        alert('请先在左侧选择世界书、模块或条目。');
        return;
      }
      state.isEditMode = true;
      renderDetail();
    };

    // 保存修改
    els.btnSave.onclick = () => {
      if (!state.isEditMode || !state.currentSelection) return;

      const sel = state.currentSelection;
      const world = getWorldById(sel.worldId);
      if (!world) return;

      if (sel.type === 'world') {
        const textarea = document.getElementById('edit-world-desc');
        if (!textarea) return;
        world.description = textarea.value || '';
      } else if (sel.type === 'category') {
        const textarea = document.getElementById('edit-category-desc');
        if (!textarea) return;
        if (!world.categoryMeta) world.categoryMeta = {};
        if (!world.categoryMeta[sel.catName]) {
          world.categoryMeta[sel.catName] = { description: '' };
        }
        world.categoryMeta[sel.catName].description = textarea.value || '';
      } else if (sel.type === 'entry') {
        const titleInput = document.getElementById('edit-title');
        const contentTextarea = document.getElementById('edit-content');
        if (!titleInput || !contentTextarea) return;

        const entries = world.categories[sel.catName] || [];
        const entry = entries.find(e => String(e.id) === String(sel.entryId));
        if (!entry) return;

        entry.title = titleInput.value || '';
        entry.content = contentTextarea.value || '';
      }

      saveData();
      state.isEditMode = false;
      renderTree();
      renderDetail();
    };

    // 右上角“导出”按钮：导出当前选中的 world/category/entry
    els.btnExportCurrent.onclick = handleExportCurrent;
  }

  // ====== 启动 ======
  init();
})();
