/**
 * Storyteller - 世界书管理逻辑
 * 核心功能：导入 JSON、条件搜索、分页列表、结构化详情展示
 */
(function () {
  // --- DOM 元素获取 ---
  const fileInput = document.getElementById("worldbook-file-input");
  const importBtn = document.getElementById("worldbook-import-btn");
  const importStatusEl = document.getElementById("worldbook-import-status");

  const searchKeywordEl = document.getElementById("worldbook-search-keyword");
  const searchCategoryEl = document.getElementById("worldbook-search-category");
  const searchBtn = document.getElementById("worldbook-search-btn");

  const tableBodyEl = document.getElementById("worldbook-table-body");
  const pageInfoEl = document.getElementById("worldbook-page-info");
  const prevPageBtn = document.getElementById("worldbook-prev-page");
  const nextPageBtn = document.getElementById("worldbook-next-page");

  const detailEl = document.getElementById("worldbook-detail");

  // --- 状态变量 ---
  let currentPage = 1;

  /**
   * 导入世界书 JSON 文件
   */
  async function importWorldbook() {
    const file = fileInput.files[0];
    if (!file) {
      showStatus("请选择 JSON 文件。", "danger");
      return;
    }

    showStatus("正在读取文件...", "muted");
    try {
      const text = await file.text();
      let jsonData;
      try {
        jsonData = JSON.parse(text);
      } catch (e) {
        showStatus("文件格式错误：非标准 JSON。", "danger");
        return;
      }

      showStatus("正在同步至后端知识库...", "muted");
      const resp = await fetch("/api/worldbook/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jsonData)
      });

      if (!resp.ok) {
        const msg = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${msg}`);
      }

      showStatus("导入成功，数据已就绪。", "accent");
      currentPage = 1;
      loadWorldbookList();
    } catch (err) {
      console.error(err);
      showStatus("导入失败：" + err.message, "danger");
    }
  }

  /**
   * 加载世界书列表（含搜索与分页）
   */
  async function loadWorldbookList() {
    const keyword = searchKeywordEl.value.trim();
    const category = searchCategoryEl.value;

    const params = new URLSearchParams();
    params.set("page", String(currentPage));
    if (keyword) params.set("keyword", keyword);
    if (category) params.set("category", category);

    try {
      const resp = await fetch("/api/worldbook/list?" + params.toString());
      if (!resp.ok) throw new Error("无法获取列表数据");
      
      const data = await resp.json();
      renderTable(data.items || []);
      renderPagination(data.page, data.total_pages);
    } catch (err) {
      console.error(err);
      tableBodyEl.innerHTML = `<tr><td colspan="4" class="muted">加载失败: ${err.message}</td></tr>`;
    }
  }

  /**
   * 渲染表格行
   */
  function renderTable(entries) {
    tableBodyEl.innerHTML = "";
    if (entries.length === 0) {
      tableBodyEl.innerHTML = '<tr><td colspan="4" class="muted" style="text-align:center;">无匹配条目</td></tr>';
      return;
    }

    entries.forEach(entry => {
      const tr = document.createElement("tr");
      tr.className = "fade-in";
      tr.innerHTML = `
        <td><span class="small-text muted">${entry.entry_id}</span></td>
        <td><span class="tag-item" style="font-size:10px">${entry.category}</span></td>
        <td style="font-weight:500">${entry.title}</td>
        <td><span style="color:var(--accent)">${(entry.importance || 0).toFixed(2)}</span></td>
      `;
      tr.addEventListener("click", () => {
        // 视觉反馈：高亮选中行
        document.querySelectorAll('#worldbook-table-body tr').forEach(r => r.classList.remove('active'));
        tr.classList.add('active');
        loadWorldbookDetail(entry.entry_id);
      });
      tableBodyEl.appendChild(tr);
    });
  }

  /**
   * 加载并渲染条目详情（分块展示核心逻辑）
   */
  async function loadWorldbookDetail(entryId) {
    detailEl.innerHTML = `<div class="muted small-text">正在调取档案 [${entryId}]...</div>`;
    
    try {
      const resp = await fetch("/api/worldbook/" + encodeURIComponent(entryId));
      if (!resp.ok) throw new Error("详情调取失败");
      const data = await resp.json();

      // 1. 构建头部信息 (ID, 标题, 标签)
      const tagsHtml = (data.tags || []).map(t => `<span class="tag-item">${escapeHtml(t)}</span>`).join("");
      
      // 2. 解析 Meta 字段为属性块 (Blocks)
      let metaHtml = "";
      if (data.meta && Object.keys(data.meta).length > 0) {
        metaHtml = `
          <div class="sidebar-subtitle">扩展属性 (Meta Information)</div>
          <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px;">
            ${Object.entries(data.meta).map(([key, val]) => `
              <div class="stat-box" style="text-align: left;">
                <div class="small-text muted" style="text-transform: uppercase;">${key}</div>
                <div class="stat-val" style="font-size: 13px;">${escapeHtml(val)}</div>
              </div>
            `).join("")}
          </div>`;
      }

      // 3. 组合最终 HTML
      detailEl.innerHTML = `
        <div class="fade-in">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
            <div>
              <h3 style="margin: 0; color: var(--text-primary);">${escapeHtml(data.title)}</h3>
              <div class="small-text muted" style="margin-top: 4px;">ID: ${data.entry_id} | 类别: ${data.category}</div>
            </div>
            <div class="stat-box" style="padding: 4px 12px;">
              <div class="small-text muted">重要度</div>
              <div style="color: var(--accent); font-weight: bold;">${(data.importance || 0).toFixed(2)}</div>
            </div>
          </div>

          <div class="tag-cloud" style="margin-bottom: 20px;">
            ${tagsHtml}
          </div>

          <div class="sidebar-subtitle">条目描述 (Content)</div>
          <div class="story-log" style="background: var(--bg-elevated-alt); font-size: 14px; line-height: 1.6; margin-bottom: 20px; white-space: pre-wrap;">${escapeHtml(data.content)}</div>

          ${metaHtml}
        </div>
      `;
    } catch (err) {
      detailEl.innerHTML = `<div class="danger small-text">详情加载失败：${err.message}</div>`;
    }
  }

  /**
   * 辅助：状态提示
   */
  function showStatus(text, type) {
    importStatusEl.textContent = text;
    importStatusEl.className = `small-text ${type}`;
  }

  /**
   * 辅助：分页渲染
   */
  function renderPagination(current, total) {
    currentPage = current;
    pageInfoEl.textContent = `第 ${current} 页 / 共 ${total || 1} 页`;
    prevPageBtn.disabled = current <= 1;
    nextPageBtn.disabled = current >= (total || 1);
  }

  /**
   * 辅助：转义 HTML 防止注入
   */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
  }

  /**
   * 事件绑定
   */
  function bindEvents() {
    importBtn.addEventListener("click", importWorldbook);
    searchBtn.addEventListener("click", () => {
      currentPage = 1;
      loadWorldbookList();
    });
    prevPageBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        loadWorldbookList();
      }
    });
    nextPageBtn.addEventListener("click", () => {
      currentPage++;
      loadWorldbookList();
    });

    // 监听回车搜索
    searchKeywordEl.addEventListener("keypress", (e) => {
      if (e.key === "Enter") searchBtn.click();
    });
  }

  // --- 初始化 ---
  function init() {
    bindEvents();
    loadWorldbookList();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();