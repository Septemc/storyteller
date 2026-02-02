(function () {
  // --- UI 元素引用 ---
  // Tabs
  const tabButtons = document.querySelectorAll('.settings-tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Visual Selectors
  const themeOptions = document.querySelectorAll('#theme-grid .visual-option');
  const bgOptions = document.querySelectorAll('#bg-grid .visual-option');

  // Form Fields
  const postprocessingRulesEl = document.getElementById("postprocessing-rules");
  const summaryEnabledEl = document.getElementById("summary-enabled");
  const summaryProfileIdEl = document.getElementById("summary-profile-id");
  const summaryFrequencyEl = document.getElementById("summary-frequency");
  const summaryRagConfigEl = document.getElementById("summary-rag-config");
  const variablesEnabledEl = document.getElementById("variables-enabled");
  const variablesProfileIdEl = document.getElementById("variables-profile-id");
  const variablesApiConfigIdEl = document.getElementById("variables-api-config-id");
  const alignmentStrictEl = document.getElementById("alignment-strict");
  const alignmentRuleIdEl = document.getElementById("alignment-rule-id");
  const textoptEnabledEl = document.getElementById("textopt-enabled");
  const textoptProfileIdEl = document.getElementById("textopt-profile-id");
  const worldEvolutionEnabledEl = document.getElementById("world-evolution-enabled");
  const worldEvolutionProfileIdEl = document.getElementById("world-evolution-profile-id");
  const defaultProfilesEl = document.getElementById("default-profiles");

  // Actions
  const loadBtn = document.getElementById("settings-load-btn");
  const saveBtn = document.getElementById("settings-save-btn");
  const statusEl = document.getElementById("settings-status");

  // State
  let currentSettings = {};

  // --- 1. 核心逻辑：应用主题 ---
  function applyVisuals(theme, bg) {
    // 1. 设置 Data Theme + 本地存储
    if (theme) {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('app_theme', theme);

      // 更新 UI 选择状态
      themeOptions.forEach(opt => {
        if (opt.dataset.value === theme) opt.classList.add('selected');
        else opt.classList.remove('selected');
      });
    }

    // 2. 设置 Background Class + 本地存储
    if (bg) {
      // 移除旧的 bg-* 类
      document.body.classList.forEach(cls => {
        if (cls.startsWith('bg-')) document.body.classList.remove(cls);
      });
      document.body.classList.add(`bg-${bg}`);
      localStorage.setItem('app_bg', bg);

      // 更新 UI 选择状态
      bgOptions.forEach(opt => {
        if (opt.dataset.value === bg) opt.classList.add('selected');
        else opt.classList.remove('selected');
      });
    }
  }


  // --- 2. 交互逻辑：Tab 切换 ---
  function switchTab(targetId) {
    // 按钮状态
    tabButtons.forEach(btn => {
      if (btn.dataset.target === targetId) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    // 面板显隐
    tabPanes.forEach(pane => {
      if (pane.id === targetId) pane.classList.add('active');
      else pane.classList.remove('active');
    });
  }

  // --- 3. 数据处理：填充表单 ---
  function populateForm(settings) {
    currentSettings = settings; // Cache
    const ui = settings.ui || {};

    // 统一通过 applyVisuals 应用主题和背景（内部会同步到 localStorage）
    applyVisuals(ui.theme || 'dark', ui.background || 'grid');

    
// 填充文本域
    postprocessingRulesEl.value = JSON.stringify(
      settings.text && settings.text.post_processing_rules ? settings.text.post_processing_rules : [],
      null, 2
    );

    const summary = settings.summary || {};
    summaryEnabledEl.checked = !!summary.enabled;
    summaryProfileIdEl.value = summary.profile_id || "";
    summaryFrequencyEl.value = summary.scene_frequency || 1;
    summaryRagConfigEl.value = JSON.stringify(summary.rag_config || {}, null, 2);

    const variables = settings.variables || {};
    variablesEnabledEl.checked = !!variables.enabled;
    variablesProfileIdEl.value = variables.profile_id || "";
    variablesApiConfigIdEl.value = variables.api_config_id || "";
    alignmentStrictEl.checked = !!variables.alignment_strict;
    alignmentRuleIdEl.value = variables.alignment_rule_id || "";

    const textopt = settings.text_opt || {};
    textoptEnabledEl.checked = !!textopt.enabled;
    textoptProfileIdEl.value = textopt.profile_id || "";

    const evolution = settings.world_evolution || {};
    worldEvolutionEnabledEl.checked = !!evolution.enabled;
    worldEvolutionProfileIdEl.value = evolution.profile_id || "";

    const defaults = settings.default_profiles || {};
    defaultProfilesEl.value = JSON.stringify(defaults, null, 2);
  }

  // --- 4. 数据处理：收集表单 ---
  function collectForm() {
    // 获取当前选中的 theme 和 bg
    const activeThemeEl = document.querySelector('#theme-grid .visual-option.selected');
    const activeBgEl = document.querySelector('#bg-grid .visual-option.selected');

    const themeVal = activeThemeEl ? activeThemeEl.dataset.value : 'dark';
    const bgVal = activeBgEl ? activeBgEl.dataset.value : 'grid';

    // JSON 安全解析助手
    const safeParse = (el, name) => {
      try {
        return el.value.trim() ? JSON.parse(el.value) : (name === 'rules' ? [] : {});
      } catch (e) {
        alert(`${name} JSON 格式错误，请检查！`);
        throw e;
      }
    };

    let postRules, ragConfig, defaultProfiles;
    try {
      postRules = safeParse(postprocessingRulesEl, 'rules');
      ragConfig = safeParse(summaryRagConfigEl, 'rag');
      defaultProfiles = safeParse(defaultProfilesEl, 'profiles');
    } catch (e) {
      return null; // 停止保存
    }

    return {
      ui: {
        theme: themeVal,
        background: bgVal
      },
      text: {
        post_processing_rules: postRules
      },
      summary: {
        enabled: summaryEnabledEl.checked,
        profile_id: summaryProfileIdEl.value.trim(),
        scene_frequency: parseInt(summaryFrequencyEl.value || "1", 10),
        rag_config: ragConfig
      },
      variables: {
        enabled: variablesEnabledEl.checked,
        profile_id: variablesProfileIdEl.value.trim(),
        api_config_id: variablesApiConfigIdEl.value.trim(),
        alignment_strict: alignmentStrictEl.checked,
        alignment_rule_id: alignmentRuleIdEl.value.trim()
      },
      text_opt: {
        enabled: textoptEnabledEl.checked,
        profile_id: textoptProfileIdEl.value.trim()
      },
      world_evolution: {
        enabled: worldEvolutionEnabledEl.checked,
        profile_id: worldEvolutionProfileIdEl.value.trim()
      },
      default_profiles: defaultProfiles
    };
  }

  // --- 5. API 交互 ---
  async function loadSettings() {
    statusEl.textContent = "加载中...";
    try {
      const resp = await fetch("/api/settings/global");
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      populateForm(data);
      statusEl.textContent = "已加载";
      setTimeout(() => statusEl.textContent = "就绪", 2000);
    } catch (err) {
      console.error(err);
      statusEl.textContent = "加载失败";
    }
  }

  async function saveSettings() {
    const settings = collectForm();
    if (!settings) return; // JSON 错误已弹窗

    // 在前端立即应用主题与背景（会同时写入 localStorage）
    applyVisuals(settings.ui.theme, settings.ui.background);

    statusEl.textContent = "保存中...";
    try {
      const resp = await fetch("/api/settings/global", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      statusEl.textContent = "保存成功";
      setTimeout(() => statusEl.textContent = "就绪", 2000);
    } catch (err) {
      console.error(err);
      statusEl.textContent = "保存失败";
    }
  }



  // --- 6. 事件绑定 ---
  function bindEvents() {
    // Tabs
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.target));
    });

    // Visual Selectors (Theme)
    themeOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        applyVisuals(opt.dataset.value, null); // 仅切换主题
      });
    });

    // Visual Selectors (Background)
    bgOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        applyVisuals(null, opt.dataset.value); // 仅切换背景
      });
    });

    // Buttons
    loadBtn.addEventListener("click", loadSettings);
    saveBtn.addEventListener("click", saveSettings);
  }

  // --- 初始化 ---
  function init() {
    bindEvents();
    loadSettings();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();