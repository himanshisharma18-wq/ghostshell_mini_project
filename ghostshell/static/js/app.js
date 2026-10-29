(() => {
  'use strict';

  const form = document.querySelector('#prompt-form');
  const input = document.querySelector('#prompt-input');
  const conversation = document.querySelector('#conversation');
  const typing = document.querySelector('#typing-indicator');
  const sendButton = document.querySelector('#send-button');
  const charCount = document.querySelector('#char-count');
  const connection = document.querySelector('#connection-status');
  const modelSelect = document.querySelector('#model-select');
  const modelLibrary = document.querySelector('#model-library');
  const recentPrompts = document.querySelector('#recent-prompts');
  const toast = document.querySelector('#toast');
  const sessionPreview = document.querySelector('#session-preview');
  const sessionCount = document.querySelector('#session-count');
  const recentCount = document.querySelector('#recent-count');
  const modelCount = document.querySelector('#model-count');
  const defaultModel = modelSelect.options[0]?.value || 'qwen2.5:1.5b';
  let latestHealth = { ok: false, model: defaultModel, models: [] };

  const modeInfo = {
    command: { label: 'COMMAND FOR REVIEW', placeholder: 'Paste a shell command to understand…' },
    error: { label: 'PASTE THE ERROR OR TRACEBACK', placeholder: 'Paste the full error, log, or traceback…' },
    code: { label: 'CODE TO UNDERSTAND', placeholder: 'Paste a small code snippet to explore…' },
    safety: { label: 'PATTERN FOR A SAFETY REVIEW', placeholder: 'Paste a command or code snippet to review…' },
  };

  let activeMode = 'command';
  let busy = false;
  let requestVersion = 0;
  let sessionVersion = 0;
  let activeController = null;
  let toastTimer;
  let promptedCount = 0;
  const recent = [];

  function setMode(mode) {
    activeMode = Object.hasOwn(modeInfo, mode) ? mode : 'command';
    document.querySelectorAll('.mode-button').forEach((button) => {
      const selected = button.dataset.mode === activeMode;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', String(selected));
    });
    document.querySelector('#prompt-label-text').textContent = modeInfo[activeMode].label;
    input.placeholder = modeInfo[activeMode].placeholder;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 5200);
  }

  function formatTime() {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date());
  }

  function appendUserMessage(text) {
    const article = document.createElement('article');
    article.className = 'chat-message user-message';
    const content = document.createElement('div');
    content.className = 'chat-content';
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    const name = document.createElement('span');
    name.className = 'assistant-name';
    name.textContent = 'YOU';
    const time = document.createElement('span');
    time.className = 'message-time';
    time.textContent = formatTime();
    meta.append(name, time);
    const bubble = document.createElement('div');
    bubble.className = 'user-bubble';
    bubble.textContent = text;
    content.append(meta, bubble);
    article.append(content);
    conversation.append(article);
    scrollToLatest();
  }

  function appendAssistantMessage(text, model = '') {
    const article = document.createElement('article');
    article.className = 'chat-message';
    const avatar = document.createElement('div');
    avatar.className = 'assistant-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = 'g';
    const content = document.createElement('div');
    content.className = 'chat-content';
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    const name = document.createElement('span');
    name.className = 'assistant-name';
    name.textContent = 'GHOSTSHELL';
    const time = document.createElement('span');
    time.className = 'message-time';
    time.textContent = formatTime();
    meta.append(name, time);
    if (model) {
      const modelTag = document.createElement('span');
      modelTag.className = 'response-model';
      modelTag.textContent = model;
      meta.append(modelTag);
    }
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble assistant-bubble';
    // Model output is untrusted; insert as text, never as HTML.
    bubble.textContent = text;
    const tools = document.createElement('div');
    tools.className = 'message-tools';
    const copy = document.createElement('button');
    copy.className = 'copy-button';
    copy.type = 'button';
    copy.textContent = 'Copy answer';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text);
        copy.textContent = 'Copied';
        window.setTimeout(() => { copy.textContent = 'Copy answer'; }, 1600);
      } catch {
        showToast('Clipboard access was blocked. Select and copy the answer instead.');
      }
    });
    tools.append(copy);
    content.append(meta, bubble, tools);
    article.append(avatar, content);
    conversation.append(article);
    scrollToLatest();
  }

  function scrollToLatest() {
    conversation.scrollTop = conversation.scrollHeight;
  }

  function modelIsInstalled(model, installed) {
    return installed.includes(model) || (!model.includes(':') && installed.includes(`${model}:latest`));
  }

  function refreshModelSelector(status) {
    const installed = Array.isArray(status.models) ? status.models : [];
    latestHealth = { ...status, models: installed };
    const priorChoice = modelSelect.value;
    const names = [...new Set([priorChoice, status.model || defaultModel, ...installed].filter(Boolean))];
    modelSelect.replaceChildren();
    names.forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      const isInstalled = modelIsInstalled(name, installed);
      option.textContent = `${name}${isInstalled ? '' : ' · not installed'}`;
      modelSelect.append(option);
    });
    modelSelect.value = names.includes(priorChoice) ? priorChoice : (status.model || defaultModel);

    modelCount.textContent = String(installed.length).padStart(2, '0');
    modelLibrary.replaceChildren();
    if (!installed.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-note';
      empty.textContent = status.ok ? 'No local models found. Pull one with Ollama, then refresh.' : 'Start Ollama to see its installed model tags.';
      modelLibrary.append(empty);
      return;
    }
    installed.slice(0, 6).forEach((name) => {
      const button = document.createElement('button');
      button.className = 'model-row';
      button.type = 'button';
      button.setAttribute('aria-pressed', String(modelSelect.value === name));
      const icon = document.createElement('span');
      icon.className = 'model-row-icon';
      icon.textContent = '◈';
      const label = document.createElement('span');
      label.className = 'model-row-name';
      label.textContent = name;
      const state = document.createElement('span');
      state.className = modelSelect.value === name ? 'model-state is-selected' : 'model-state';
      state.textContent = modelSelect.value === name ? 'SELECTED' : 'INSTALLED';
      button.append(icon, label, state);
      button.addEventListener('click', () => {
        modelSelect.value = name;
        refreshModelSelector(latestHealth);
      });
      modelLibrary.append(button);
    });
    if (installed.length > 6) {
      const remainder = document.createElement('p');
      remainder.className = 'model-remainder';
      remainder.textContent = `+ ${installed.length - 6} more installed · choose from the selector above`;
      modelLibrary.append(remainder);
    }
  }

  async function checkHealth() {
    try {
      const response = await fetch('/api/health', { headers: { Accept: 'application/json' } });
      const status = await response.json();
      refreshModelSelector(status);
      const privacyScope = document.querySelector('#privacy-scope');
      const isLoopback = status.local_only === true;
      privacyScope.textContent = isLoopback ? 'LOOPBACK' : 'CUSTOM HOST';
      privacyScope.classList.toggle('is-custom', !isLoopback);
      connection.classList.remove('is-checking', 'is-offline', 'is-online');
      if (status.ok) {
        connection.classList.add('is-online');
        const count = Array.isArray(status.models) ? status.models.length : 0;
        const scope = isLoopback ? 'local model' : 'model';
        connection.querySelector('.status-label').textContent = `${count} ${scope}${count === 1 ? '' : 's'} · Ollama`;
      } else {
        connection.classList.add('is-offline');
        connection.querySelector('.status-label').textContent = 'Ollama is offline';
      }
    } catch {
      connection.classList.remove('is-checking', 'is-online');
      connection.classList.add('is-offline');
      connection.querySelector('.status-label').textContent = 'Local service unavailable';
    }
  }

  function renderRecent() {
    recentPrompts.replaceChildren();
    recentCount.textContent = String(recent.length);
    if (!recent.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-note';
      empty.textContent = 'Prompts you try here will appear in this browser session.';
      recentPrompts.append(empty);
      return;
    }
    recent.forEach((item) => {
      const button = document.createElement('button');
      button.className = 'recent-item';
      button.type = 'button';
      button.title = 'Load this prompt into the editor';
      const tag = document.createElement('span');
      tag.className = 'recent-mode';
      tag.textContent = item.modeLabel;
      const text = document.createElement('span');
      text.className = 'recent-text';
      text.textContent = item.text.replace(/\s+/g, ' ').slice(0, 68);
      button.append(tag, text);
      button.addEventListener('click', () => {
        setMode(item.mode);
        input.value = item.text;
        charCount.textContent = String(input.value.length);
        input.focus();
      });
      recentPrompts.append(button);
    });
  }

  function rememberPrompt(mode, text) {
    const labels = { command: 'COMMAND', error: 'ERROR', code: 'CODE', safety: 'SAFETY' };
    recent.unshift({ mode, modeLabel: labels[mode], text });
    if (recent.length > 5) recent.pop();
    promptedCount += 1;
    sessionCount.textContent = `${promptedCount} ASKED`;
    sessionPreview.textContent = text.replace(/\s+/g, ' ').slice(0, 140);
    renderRecent();
  }

  function loadExample(mode, prompt) {
    setMode(mode);
    input.value = prompt;
    charCount.textContent = String(input.value.length);
    input.focus();
    document.querySelector('#prompt-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  document.querySelectorAll('.mode-button').forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.mode));
  });

  document.querySelectorAll('.example-card').forEach((card) => {
    card.addEventListener('click', () => loadExample(card.dataset.mode, card.dataset.prompt));
  });

  document.querySelectorAll('.tool-launch').forEach((button) => {
    button.addEventListener('click', () => {
      const sample = document.querySelector(`.example-card[data-mode="${button.dataset.mode}"]`);
      const prompt = sample?.dataset.prompt || '';
      loadExample(button.dataset.mode, prompt);
    });
  });

  input.addEventListener('input', () => {
    charCount.textContent = String(input.value.length);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  modelSelect.addEventListener('change', () => {
    const statusLabel = connection.querySelector('.status-label');
    if (modelSelect.value) statusLabel.textContent = `Selected · ${modelSelect.value}`;
    refreshModelSelector(latestHealth);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || busy) return;
    if (message.length > 10_000) {
      showToast('Keep each message under 10,000 characters.');
      return;
    }

    const requestId = ++requestVersion;
    const currentSession = sessionVersion;
    const controller = new AbortController();
    activeController = controller;
    busy = true;
    sendButton.disabled = true;
    typing.hidden = false;
    rememberPrompt(activeMode, message);
    appendUserMessage(message);
    input.value = '';
    charCount.textContent = '0';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ mode: activeMode, message, model: modelSelect.value || defaultModel }),
        signal: controller.signal,
      });
      if (requestId !== requestVersion || currentSession !== sessionVersion) return;
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || `Request failed (${response.status}).`);
      if (typeof payload.response !== 'string' || !payload.response.trim()) {
        throw new Error('The local model returned an empty answer. Try again with a shorter prompt.');
      }
      appendAssistantMessage(payload.response, payload.model);
    } catch (error) {
      if (requestId !== requestVersion || currentSession !== sessionVersion) return;
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      showToast(errorMessage);
      appendAssistantMessage(errorMessage);
    } finally {
      if (requestId !== requestVersion) return;
      busy = false;
      sendButton.disabled = false;
      typing.hidden = true;
      activeController = null;
      input.focus();
      scrollToLatest();
      checkHealth();
    }
  });

  document.querySelector('#clear-chat').addEventListener('click', () => {
    sessionVersion += 1;
    requestVersion += 1;
    if (activeController) {
      // This aborts the browser's wait; Flask/Ollama may finish local work already sent.
      activeController.abort();
      activeController = null;
    }
    busy = false;
    sendButton.disabled = false;
    typing.hidden = true;
    conversation.replaceChildren();
    const welcome = document.createElement('div');
    welcome.className = 'welcome-message';
    const avatar = document.createElement('div');
    avatar.className = 'welcome-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = 'g';
    const content = document.createElement('div');
    content.className = 'welcome-content';
    const meta = document.createElement('div');
    meta.className = 'message-meta';
    const name = document.createElement('span');
    name.className = 'assistant-name';
    name.textContent = 'GHOSTSHELL';
    const time = document.createElement('span');
    time.className = 'message-time';
    time.textContent = 'session cleared';
    meta.append(name, time);
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble welcome-bubble';
    const first = document.createElement('p');
    first.textContent = "Session cleared. Pick another tool when you're ready.";
    bubble.append(first);
    content.append(meta, bubble);
    welcome.append(avatar, content);
    conversation.append(welcome);
    recent.length = 0;
    promptedCount = 0;
    sessionCount.textContent = '0 ASKED';
    sessionPreview.textContent = 'No prompt submitted yet. Choose any tool to begin.';
    renderRecent();
    input.focus();
  });

  renderRecent();
  checkHealth();
  window.setInterval(checkHealth, 30_000);
})();
