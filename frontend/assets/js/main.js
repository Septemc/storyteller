// assets/js/main.js
(function () {
  const storyLogEl = document.getElementById("story-log");
  const generateBtn = document.getElementById("generate-btn");
  const userInputEl = document.getElementById("user-input");
  const inputStatusEl = document.getElementById("input-status");
  const sessionLabelEl = document.getElementById("session-label");
  const sessionLabelInlineEl = document.getElementById("session-label-inline");
  const newSessionBtn = document.getElementById("new-session-btn");

  const actionHistoryEl = document.getElementById("action-history");
  const inputBarEl = document.getElementById("input-bar");
  const inputCollapseToggleEl = document.getElementById("input-collapse-toggle");
  const inputSizeToggleEl = document.getElementById("input-size-toggle");
  const actionSuggestionsEl = document.getElementById("action-suggestions");
  const actionSuggestionsToggleEl = document.getElementById("action-suggestions-toggle");

  const statWordsEl = document.getElementById("stat-words");
  const statDurationEl = document.getElementById("stat-duration");
  const statDurationFrontEl = document.getElementById("stat-duration-front");
  const statTotalWordsEl = document.getElementById("stat-total-words");

  const dungeonNameEl = document.getElementById("dungeon-name");
  const dungeonNodeNameEl = document.getElementById("dungeon-node-name");
  const dungeonProgressEl = document.getElementById("dungeon-progress");

  const characterSummaryEl = document.getElementById("character-summary");
  const variableSummaryEconomyEl = document.getElementById("var-economy");
  const variableSummaryAbilityEl = document.getElementById("var-ability");
  const variableSummaryFactionEl = document.getElementById("var-faction");

  let currentSessionId = null;
  let totalWordCount = 0;

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

    if (statTotalWordsEl) {
      statTotalWordsEl.textContent = "0";
    }
    if (storyLogEl) {
      storyLogEl.innerHTML = "";
    }

    updateSessionLabel();

    if (inputStatusEl) {
      inputStatusEl.textContent = "已创建新会话。";
    }

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

  function bindActionSuggestionsToggle() {
    if (!actionSuggestionsEl || !actionSuggestionsToggleEl) return;

    actionSuggestionsToggleEl.addEventListener("click", function () {
      const isOpen = actionSuggestionsEl.classList.toggle("action-suggestions--open");
      actionSuggestionsToggleEl.textContent = isOpen
        ? "下次行动建议 ▲"
        : "下次行动建议 ▼";
    });
  }

  function bindSuggestionChips() {
    if (!userInputEl) return;

    const chips = document.querySelectorAll(".suggestion-chip[data-suggest]");
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        const suggest = this.getAttribute("data-suggest") || this.textContent || "";
        if (!suggest) return;

        if (!userInputEl.value) {
          userInputEl.value = suggest;
        } else {
          const prefix = userInputEl.value.replace(/\s*$/, "");
          userInputEl.value = prefix + "\n" + suggest;
        }
        userInputEl.focus();
      });
    });
  }

  function bindInputPanelEvents() {
    if (inputCollapseToggleEl && inputBarEl) {
      inputCollapseToggleEl.addEventListener("click", function () {
        const collapsed = inputBarEl.classList.toggle("input-bar--collapsed");
        inputCollapseToggleEl.textContent = collapsed ? "⌃" : "⌄";
        inputCollapseToggleEl.setAttribute(
          "aria-label",
          collapsed ? "展开输入栏" : "收起输入栏"
        );

        if (collapsed && document.body.classList.contains("input-half-screen")) {
          document.body.classList.remove("input-half-screen");
          inputBarEl.classList.remove("input-bar--half-screen");
          if (inputSizeToggleEl) {
            inputSizeToggleEl.textContent = "↗";
            inputSizeToggleEl.setAttribute("aria-label", "放大输入框");
          }
        }
      });
    }

    if (inputSizeToggleEl && inputBarEl) {
      inputSizeToggleEl.addEventListener("click", function () {
        if (inputBarEl.classList.contains("input-bar--collapsed")) {
          inputBarEl.classList.remove("input-bar--collapsed");
          if (inputCollapseToggleEl) {
            inputCollapseToggleEl.textContent = "⌄";
            inputCollapseToggleEl.setAttribute("aria-label", "收起输入栏");
          }
        }

        const isHalf = document.body.classList.toggle("input-half-screen");
        if (isHalf) {
          inputBarEl.classList.add("input-bar--half-screen");
          inputSizeToggleEl.textContent = "↙";
          inputSizeToggleEl.setAttribute("aria-label", "缩小输入框");
        } else {
          inputBarEl.classList.remove("input-bar--half-screen");
          inputSizeToggleEl.textContent = "↗";
          inputSizeToggleEl.setAttribute("aria-label", "放大输入框");
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
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          generateStory();
        }
      });
    }

    if (newSessionBtn) {
      newSessionBtn.addEventListener("click", function () {
        resetSession();
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
