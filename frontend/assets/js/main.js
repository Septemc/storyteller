// assets/js/main.js
(function () {
  // =========================================
  // 1. DOM 元素获取
  // =========================================
  const storyLogEl = document.getElementById("story-log");
  const generateBtn = document.getElementById("generate-btn");
  const userInputEl = document.getElementById("user-input");
  const inputStatusEl = document.getElementById("input-status");
  const sessionLabelEl = document.getElementById("session-label");
  const sessionLabelInlineEl = document.getElementById("session-label-inline");
  const newSessionBtn = document.getElementById("new-session-btn");

  const actionHistoryEl = document.getElementById("action-history");

  // 输入栏相关元素
  const inputBarEl = document.getElementById("input-bar");
  const inputCollapseToggleEl = document.getElementById("input-collapse-toggle"); // 左上角收起按钮
  const inputSizeToggleEl = document.getElementById("input-size-toggle");         // 右下角半屏按钮
  const actionSuggestionsEl = document.getElementById("action-suggestions");
  const actionSuggestionsToggleEl = document.getElementById("action-suggestions-toggle");

  // 统计面板元素
  const statWordsEl = document.getElementById("stat-words");
  const statDurationEl = document.getElementById("stat-duration");
  const statDurationFrontEl = document.getElementById("stat-duration-front");
  const statTotalWordsEl = document.getElementById("stat-total-words");

  // 右侧面板元素
  const dungeonNameEl = document.getElementById("dungeon-name");
  const dungeonNodeNameEl = document.getElementById("dungeon-node-name");
  const dungeonProgressEl = document.getElementById("dungeon-progress");

  const characterSummaryEl = document.getElementById("character-summary");
  const variableSummaryEconomyEl = document.getElementById("var-economy");
  const variableSummaryAbilityEl = document.getElementById("var-ability");
  const variableSummaryFactionEl = document.getElementById("var-faction");

  // =========================================
  // 2. SVG 图标定义 (用于 JS 动态切换)
  // =========================================

  // 半屏模式图标：四角向外 (展开)
  const iconExpandFull = `
    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
    </svg>`;

  // 半屏模式图标：四角向里 (收起/还原)
  const iconCollapseFull = `
    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14L3 21"/>
    </svg>`;

  // 底部栏折叠按钮：向下箭头 (收起)
  const iconChevronDown = `
    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>`;

  // 底部栏折叠按钮：向上箭头 (展开)
  const iconChevronUp = `
    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="18 15 12 9 6 15"></polyline>
    </svg>`;

  // =========================================
  // 3. 状态变量
  // =========================================
  let currentSessionId = null;
  let totalWordCount = 0;

  // =========================================
  // 4. 会话管理逻辑
  // =========================================
  function generateSessionId() {
    const now = Date.now();
    const randomPart = Math.floor(Math.random() * 1e6)
      .toString()
      .padStart(6, "0");
    return "S_" + now + "_" + randomPart;
  }

  function ensureSession() {
    let savedId = window.localStorage.getItem("novel_session_id");
    if (!savedId) {
      savedId = generateSessionId();
      window.localStorage.setItem("novel_session_id", savedId);
    }
    currentSessionId = savedId;
    updateSessionLabel();
  }

  function resetSession() {
    currentSessionId = generateSessionId();
    window.localStorage.setItem("novel_session_id", currentSessionId);
    totalWordCount = 0;

    if (statTotalWordsEl) statTotalWordsEl.textContent = "0";
    if (storyLogEl) storyLogEl.innerHTML = "";

    updateSessionLabel();

    if (inputStatusEl) inputStatusEl.textContent = "已创建新会话。";

    if (actionHistoryEl) {
      actionHistoryEl.innerHTML = "";
      const placeholder = document.createElement("div");
      placeholder.className = "muted";
      placeholder.textContent = "暂无历史行动，等待你的第一次指令。";
      actionHistoryEl.appendChild(placeholder);
    }
  }

  function updateSessionLabel() {
    if (sessionLabelEl) {
      sessionLabelEl.textContent = "当前会话 ID：" + currentSessionId;
    }
    if (sessionLabelInlineEl) {
      sessionLabelInlineEl.textContent = currentSessionId || "初始化中...";
    }
  }

  // =========================================
  // 5. UI 更新辅助函数
  // =========================================
  function appendStoryBlock(text, meta, type) {
    if (!storyLogEl) return;

    const block = document.createElement("div");
    block.className = "story-block" + (type === "user" ? " story-block-user" : "");

    const metaEl = document.createElement("div");
    metaEl.className = "story-meta";
    if (type === "user") {
      metaEl.textContent = "玩家输入";
    } else {
      const tags =
        meta && meta.tags && meta.tags.length ? " · " + meta.tags.join(", ") : "";
      const tone = meta && meta.tone ? "基调：" + meta.tone : "";
      const pacing = meta && meta.pacing ? "节奏：" + meta.pacing : "";
      const infoParts = [];
      if (tone) infoParts.push(tone);
      if (pacing) infoParts.push(pacing);
      metaEl.textContent = infoParts.join(" · ") + tags;
    }

    const textEl = document.createElement("div");
    textEl.className = "story-text";
    textEl.textContent = text;

    block.appendChild(metaEl);
    block.appendChild(textEl);
    storyLogEl.appendChild(block);

    // 自动滚动到底部
    storyLogEl.scrollTop = storyLogEl.scrollHeight;
  }

  function appendActionHistory(text) {
    if (!actionHistoryEl) return;

    const clean = text.trim();
    if (!clean) return;

    const firstChild = actionHistoryEl.firstElementChild;
    if (firstChild && firstChild.classList && firstChild.classList.contains("muted")) {
      actionHistoryEl.innerHTML = "";
    }

    const item = document.createElement("div");
    item.className = "action-history-item";
    item.textContent = clean;
    actionHistoryEl.appendChild(item);

    actionHistoryEl.scrollTop = actionHistoryEl.scrollHeight;
  }

  // =========================================
  // 6. 核心生成逻辑 (Fetch API)
  // =========================================
  async function generateStory() {
    if (!userInputEl) return;

    const userText = userInputEl.value.trim();
    if (!userText) {
      if (inputStatusEl) inputStatusEl.textContent = "请输入内容。";
      return;
    }
    if (!currentSessionId) {
      ensureSession();
    }

    appendStoryBlock(userText, null, "user");
    appendActionHistory(userText);
    userInputEl.value = "";
    if (inputStatusEl) {
      inputStatusEl.textContent = "正在向后端请求剧情...";
    }

    if (generateBtn) {
      generateBtn.disabled = true;
    }

    const frontStart = performance.now();

    try {
      const resp = await fetch("/api/story/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: currentSessionId,
          user_input: userText
        })
      });

      const frontEnd = performance.now();
      const durationFrontMs = Math.round(frontEnd - frontStart);

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error("请求失败：" + text);
      }

      const data = await resp.json();

      appendStoryBlock(data.story || "", data.meta || {}, "story");

      const meta = data.meta || {};
      const wordCount = meta.word_count || (data.story ? data.story.length : 0);
      const durationMs = meta.duration_ms || 0;
      totalWordCount += wordCount;

      if (statWordsEl) statWordsEl.textContent = String(wordCount);
      if (statDurationEl) statDurationEl.textContent = durationMs + " ms";
      if (statDurationFrontEl) statDurationFrontEl.textContent = durationFrontMs + " ms";
      if (statTotalWordsEl) statTotalWordsEl.textContent = String(totalWordCount);

      if (inputStatusEl) inputStatusEl.textContent = "已生成新剧情。";

      updateSidebarFromMeta(meta);
      refreshSessionSummary();
    } catch (err) {
      console.error(err);
      if (inputStatusEl) inputStatusEl.textContent = "请求出错：" + err.message;
    } finally {
      if (generateBtn) {
        generateBtn.disabled = false;
        userInputEl.focus(); // 聚焦回输入框
      }
    }
  }

  function updateSidebarFromMeta(meta) {
    if (!meta) return;

    if (meta.dungeon_name && dungeonNameEl) {
      dungeonNameEl.textContent = meta.dungeon_name;
    }
    if (meta.dungeon_node_name && dungeonNodeNameEl) {
      dungeonNodeNameEl.textContent = meta.dungeon_node_name;
    }
    if (meta.dungeon_progress_hint && dungeonProgressEl) {
      dungeonProgressEl.textContent = meta.dungeon_progress_hint;
    }

    if (meta.main_character) {
      if (meta.main_character.ability_tier && variableSummaryAbilityEl) {
        variableSummaryAbilityEl.textContent = meta.main_character.ability_tier;
      }
      if (meta.main_character.economy_summary && variableSummaryEconomyEl) {
        variableSummaryEconomyEl.textContent = meta.main_character.economy_summary;
      }
    }
  }

  async function refreshSessionSummary() {
    if (!currentSessionId) return;
    try {
      const resp = await fetch(
        "/api/session/summary?session_id=" + encodeURIComponent(currentSessionId)
      );
      if (!resp.ok) return;
      const data = await resp.json();

      if (data.dungeon) {
        if (dungeonNameEl) dungeonNameEl.textContent = data.dungeon.name || "未命名";
        if (dungeonNodeNameEl)
          dungeonNodeNameEl.textContent = data.dungeon.current_node_name || "未知";
        if (dungeonProgressEl)
          dungeonProgressEl.textContent = data.dungeon.progress_hint || "未知";
      }

      if (data.characters && Array.isArray(data.characters) && data.characters.length) {
        if (characterSummaryEl) {
          characterSummaryEl.innerHTML = "";
          data.characters.forEach(function (ch) {
            const line = document.createElement("div");
            line.textContent =
              ch.character_id + " · " + (ch.name || "") + " · " + (ch.ability_tier || "");
            characterSummaryEl.appendChild(line);
          });
        }
      }

      if (data.variables && data.variables.main_character) {
        const v = data.variables.main_character;
        if (v.economy_summary && variableSummaryEconomyEl) {
          variableSummaryEconomyEl.textContent = v.economy_summary;
        }
        if (v.ability_summary && variableSummaryAbilityEl) {
          variableSummaryAbilityEl.textContent = v.ability_summary;
        }
      }

      if (data.variables && data.variables.faction_summary && variableSummaryFactionEl) {
        variableSummaryFactionEl.textContent = data.variables.faction_summary;
      }
    } catch (err) {
      console.warn("刷新会话摘要失败：", err);
    }
  }

  // =========================================
  // 7. 交互事件绑定 (重点优化部分)
  // =========================================

  // (A) 绑定“下次行动建议”的展开/收起
  function bindActionSuggestionsToggle() {
    if (!actionSuggestionsEl || !actionSuggestionsToggleEl) return;

    actionSuggestionsToggleEl.addEventListener("click", function () {
      const isOpen = actionSuggestionsEl.classList.toggle("action-suggestions--open");

      // 更新文字提示，保持 "✨" 前缀
      if (isOpen) {
        actionSuggestionsToggleEl.textContent = "✨ 下次行动建议 (点击收起)";
      } else {
        actionSuggestionsToggleEl.textContent = "✨ 下次行动建议 (点击展开)";
      }
    });
  }

  // (B) 绑定点击建议 Chip 填入输入框
  function bindSuggestionChips() {
    if (!userInputEl) return;

    // 使用事件委托，或者重新获取DOM（如果Chips是动态生成的，这里假设是静态的）
    const chips = document.querySelectorAll(".suggestion-chip[data-suggest]");
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        // 获取完整句子
        const suggest = this.getAttribute("data-suggest") || this.textContent.trim();
        if (!suggest) return;

        // 简单的填入逻辑，如果输入框已有内容则换行追加
        if (!userInputEl.value) {
          userInputEl.value = suggest;
        } else {
          // 避免多次重复换行
          const prefix = userInputEl.value.trim();
          userInputEl.value = prefix + "\n" + suggest;
        }

        // 自动调整输入框高度并聚焦
        userInputEl.scrollTop = userInputEl.scrollHeight;
        userInputEl.focus();
      });
    });
  }

  // (C) 绑定底部输入栏的 折叠 与 半屏 逻辑
  function bindInputPanelEvents() {
    // 1. 左上角：折叠/展开 整个输入栏
    if (inputCollapseToggleEl && inputBarEl) {
      inputCollapseToggleEl.addEventListener("click", function () {
        const collapsed = inputBarEl.classList.toggle("input-bar--collapsed");

        // 【关键修复】：使用 innerHTML 替换 SVG，而不是 textContent
        inputCollapseToggleEl.innerHTML = collapsed ? iconChevronUp : iconChevronDown;
        inputCollapseToggleEl.setAttribute(
          "aria-label",
          collapsed ? "展开输入栏" : "收起输入栏"
        );

        // 如果在半屏模式下折叠，强制退出半屏，避免界面错乱
        if (collapsed && document.body.classList.contains("input-half-screen")) {
          document.body.classList.remove("input-half-screen");
          inputBarEl.classList.remove("input-bar--half-screen");

          if (inputSizeToggleEl) {
            // 重置半屏按钮图标为“展开”
            inputSizeToggleEl.innerHTML = iconExpandFull;
            inputSizeToggleEl.setAttribute("aria-label", "切换半屏模式");
            inputSizeToggleEl.setAttribute("title", "切换半屏专注模式");
          }
        }
      });
    }

    // 2. 右下角：切换 半屏/专注 模式
    if (inputSizeToggleEl && inputBarEl) {
      inputSizeToggleEl.addEventListener("click", function () {
        // 如果当前是折叠状态，先自动展开
        if (inputBarEl.classList.contains("input-bar--collapsed")) {
          inputBarEl.classList.remove("input-bar--collapsed");
          if (inputCollapseToggleEl) {
            inputCollapseToggleEl.innerHTML = iconChevronDown;
            inputCollapseToggleEl.setAttribute("aria-label", "收起输入栏");
          }
        }

        // 切换 Body 的 class
        const isHalf = document.body.classList.toggle("input-half-screen");

        // 【关键修复】：根据状态切换 SVG 图标
        if (isHalf) {
          inputBarEl.classList.add("input-bar--half-screen");
          inputSizeToggleEl.innerHTML = iconCollapseFull; // 显示“四角向内”
          inputSizeToggleEl.setAttribute("aria-label", "退出半屏模式");
          inputSizeToggleEl.setAttribute("title", "退出半屏专注模式");
        } else {
          inputBarEl.classList.remove("input-bar--half-screen");
          inputSizeToggleEl.innerHTML = iconExpandFull;   // 显示“四角向外”
          inputSizeToggleEl.setAttribute("aria-label", "切换半屏模式");
          inputSizeToggleEl.setAttribute("title", "切换半屏专注模式");
        }
      });
    }
  }

  function bindEvents() {
    if (generateBtn) {
      generateBtn.addEventListener("click", generateStory);
    }

    if (userInputEl) {
      userInputEl.addEventListener("keydown", function (e) {
        // Ctrl + Enter 快捷提交
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          generateStory();
        }
      });
    }

    if (newSessionBtn) {
      newSessionBtn.addEventListener("click", function () {
        if(confirm("确定要开始新会话吗？当前记录将被清空。")) {
            resetSession();
        }
      });
    }

    bindActionSuggestionsToggle();
    bindSuggestionChips();
    bindInputPanelEvents();
  }

  function init() {
    ensureSession();
    bindEvents();
    refreshSessionSummary();
  }

  // 确保 DOM 加载完成后执行
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();