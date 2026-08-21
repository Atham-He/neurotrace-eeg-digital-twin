(function bootstrapNeuroScope() {
  "use strict";

  const EXCELLENT_QUALITY_THRESHOLD = 85;

  let CHANNELS = window.createDeviceChannels("epoc-x");

  const PHASES = [
    {
      key: "baseline",
      start: 0,
      end: 8,
      title: "BASELINE + IED DEMO / 基线与尖慢波",
      description: "8–10 Hz 背景上加入两次孤立左颞尖慢波示意；间歇期放电不等同于一次发作。",
      classification: "INTERICTAL-LIKE DEMO",
      frequency: 9.2,
      amplitude: 48,
      rhythmicity: 0.18,
    },
    {
      key: "onset",
      start: 8,
      end: 13,
      title: "FOCAL RHYTHMIC ONSET / 左颞节律起始",
      description: "F7/T7/P7 优势的演变性 theta 节律逐渐增强；这是合成事件，不是诊断结论。",
      classification: "ICTAL-LIKE EVOLUTION",
      frequency: 6.2,
      amplitude: 118,
      rhythmicity: 0.68,
    },
    {
      key: "spread",
      start: 13,
      end: 20,
      title: "SPATIAL RECRUITMENT / 邻近通道募集",
      description: "节律在左颞保持优势，并逐步募集左额、中央和顶区相关通道；动画只表达时序证据。",
      classification: "EVOLVING RHYTHMIC DEMO",
      frequency: 5.4,
      amplitude: 176,
      rhythmicity: 0.84,
    },
    {
      key: "recovery",
      start: 20,
      end: 24,
      title: "POST-ICTAL SLOWING / 发作后慢化",
      description: "左颞优势活动退去，保留局灶 delta/theta 慢化示意；继续观察背景恢复。",
      classification: "POST-ICTAL-LIKE DEMO",
      frequency: 2.3,
      amplitude: 78,
      rhythmicity: 0.32,
    },
  ];

  const state = {
    profileId: "epoc-x",
    duration: 24,
    time: 0,
    speed: 1,
    playing: false,
    scenario: "temporal",
    showHidden: false,
    activeChannels: [],
    lastRankingKey: "",
    lastRankAt: 0,
    lastFrame: performance.now(),
    lastUiUpdate: 0,
    dataMode: "demo",
    liveBuffers: Object.fromEntries(CHANNELS.map((channel) => [channel.name, []])),
    liveSamples: 0,
    liveMontageSignature: "",
    battery: null,
    wireless: null,
    validationDimension: "hardware",
    brain: {
      yaw: 1.22,
      pitch: -0.08,
      scale: 1,
      autoRotate: true,
      dragging: false,
      lastX: 0,
      lastY: 0,
      layers: { cortex: true, regions: true, electrodes: true, particles: true },
    },
  };

  const dom = {};
  const brainGeometry = { points: [], lines: [], regionNodes: [] };
  let cortexClient = null;
  let genericClient = null;
  let brainRenderer = null;

  function queryDom() {
    const ids = [
      "scenario-select", "device-status", "sampling-rate", "open-connect", "open-validation",
      "device-picker", "device-picker-trigger", "device-picker-menu", "device-selected-art",
      "device-selected-name", "device-selected-meta", "device-profile-select", "channel-total",
      "quality-filter", "sensor-map-title",
      "sensor-map-description", "cortex-fields", "bridge-fields", "bridge-endpoint",
      "connection-note", "connect-title", "connect-intro",
      "electrode-layer-label",
      "close-validation", "validation-drawer", "validation-list", "validation-score",
      "validation-status-title", "good-count", "attention-count", "poor-count",
      "hardware-evaluation-list", "hardware-evaluation-title", "validation-dimension-tabs",
      "validation-dimension-code", "validation-dimension-purpose", "validation-dimension-gate",
      "validation-device-art", "validation-device-name", "validation-device-source",
      "toggle-sensor-map", "sensor-map-wrap", "sensor-map", "channel-list", "waveform-stage",
      "onset-cursor", "toggle-hidden", "hidden-count", "hidden-copy", "dominant-frequency",
      "peak-amplitude", "rhythmicity", "classification", "brain-stage", "brain-canvas",
      "brain-readout", "region-name", "confidence-bar", "confidence-value", "region-evidence",
      "phase-index", "phase-title", "phase-description", "evidence-channels", "phase-steps",
      "reset-playback", "play-toggle", "current-time", "timeline-track", "timeline-progress",
      "timeline-thumb", "event-range", "speed-select", "auto-rotate", "connect-modal",
      "close-connect", "client-id", "client-secret", "connection-log", "use-demo",
      "connect-device", "channel-template",
    ];
    for (const id of ids) dom[toCamel(id)] = document.getElementById(id);
  }

  function toCamel(value) {
    return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  function initialize() {
    queryDom();
    const parameters = new URLSearchParams(window.location.search);
    brainRenderer = parameters.get("renderer") === "canvas" || typeof window.BrainRenderer !== "function"
      ? null
      : new window.BrainRenderer(dom.brainCanvas);
    if (!brainRenderer?.ready) createBrainGeometry();
    renderDevicePickerMenu();
    bindEvents();
    const requestedProfile = window.NEURO_DEVICE_PROFILES[parameters.get("device")]
      ? parameters.get("device")
      : "epoc-x";
    dom.deviceProfileSelect.value = requestedProfile;
    applyDeviceProfile(requestedProfile, false);
    const requestedScenario = ["temporal", "quality", "normal"].includes(parameters.get("scenario"))
      ? parameters.get("scenario")
      : "temporal";
    dom.scenarioSelect.value = requestedScenario;
    applyScenario(requestedScenario);
    const requestedTime = Number(parameters.get("time"));
    if (Number.isFinite(requestedTime)) state.time = clamp(requestedTime, 0, state.duration);
    if (parameters.get("autoplay") === "1") {
      state.playing = true;
      dom.playToggle.classList.add("playing");
    }
    rankChannels(true);
    updateInterface(true);
    if (parameters.get("validation") === "1") toggleDrawer(true);
    if (parameters.get("devices") === "1") toggleDevicePicker(true);
    resizeCanvases();
    requestAnimationFrame(animationFrame);
  }

  function deviceArtworkMarkup(profile, decorative = false) {
    if (!profile.image) return '<span class="device-generic-art">10–20</span>';
    const alt = decorative ? "" : `${profile.name} 实物图`;
    return `<img src="${profile.image}" alt="${alt}" loading="eager" />`;
  }

  function renderDevicePickerMenu() {
    const fragment = document.createDocumentFragment();
    for (const profile of Object.values(window.NEURO_DEVICE_PROFILES)) {
      const row = document.createElement("div");
      row.className = "device-menu-item";
      row.dataset.profileId = profile.id;
      row.innerHTML = `
        <button class="device-option" type="button" role="option" data-device-id="${profile.id}" aria-selected="false">
          <span class="device-option-art">${deviceArtworkMarkup(profile)}</span>
          <span class="device-option-copy">
            <strong>${profile.name}</strong>
            <span>${profile.formFactor}</span>
            <small>${profile.channels.length} CH · ${profile.samplingRate} SPS · ${profile.connectorLabel}</small>
          </span>
        </button>
        ${profile.officialPage
          ? `<a class="device-official-link" href="${profile.officialPage}" target="_blank" rel="noreferrer" title="查看 ${profile.name} 官方页面">官方 ↗</a>`
          : '<span class="device-official-link" aria-label="通用配置，不对应具体设备">PROFILE</span>'}
      `;
      fragment.appendChild(row);
    }
    dom.devicePickerMenu.replaceChildren(fragment);
  }

  function updateDevicePicker(profile) {
    dom.deviceSelectedArt.innerHTML = deviceArtworkMarkup(profile);
    dom.deviceSelectedName.textContent = profile.name;
    dom.deviceSelectedMeta.textContent = `${profile.channels.length} CH · ${profile.connectorLabel}`;
    dom.devicePickerMenu.querySelectorAll("[data-profile-id]").forEach((row) => {
      const selected = row.dataset.profileId === profile.id;
      row.classList.toggle("selected", selected);
      row.querySelector("[role='option']")?.setAttribute("aria-selected", String(selected));
    });
    dom.validationDeviceArt.innerHTML = deviceArtworkMarkup(profile, true);
    dom.validationDeviceName.textContent = profile.shortName;
    if (profile.officialPage) {
      dom.validationDeviceSource.hidden = false;
      dom.validationDeviceSource.href = profile.officialPage;
      dom.validationDeviceSource.textContent = "官方资料 ↗";
    } else {
      dom.validationDeviceSource.hidden = true;
      dom.validationDeviceSource.removeAttribute("href");
    }
  }

  function toggleDevicePicker(open) {
    dom.devicePickerMenu.classList.toggle("open", open);
    dom.devicePickerMenu.setAttribute("aria-hidden", String(!open));
    dom.devicePickerTrigger.setAttribute("aria-expanded", String(open));
  }

  function createSensorMap() {
    dom.sensorMap.replaceChildren();
    for (const channel of CHANNELS) {
      const point = document.createElement("span");
      point.className = "sensor-point";
      point.dataset.channel = channel.name;
      point.textContent = channel.name;
      point.style.left = `${channel.map[0]}%`;
      point.style.top = `${channel.map[1]}%`;
      point.title = `${channel.name} · ${channel.side}`;
      dom.sensorMap.appendChild(point);
    }
  }

  function currentProfile() {
    return window.NEURO_DEVICE_PROFILES[state.profileId];
  }

  function applyDeviceProfile(profileId, resetScenario) {
    const profile = window.NEURO_DEVICE_PROFILES[profileId] || window.NEURO_DEVICE_PROFILES["epoc-x"];
    state.profileId = profile.id;
    state.dataMode = "demo";
    state.playing = false;
    state.liveSamples = 0;
    state.liveMontageSignature = "";
    state.lastRankingKey = "";
    cortexClient?.close();
    genericClient?.close();
    CHANNELS = window.createDeviceChannels(profile.id);
    state.liveBuffers = Object.fromEntries(CHANNELS.map((channel) => [channel.name, []]));
    dom.deviceProfileSelect.value = profile.id;
    updateDevicePicker(profile);
    dom.samplingRate.textContent = `${profile.samplingRate} SPS`;
    dom.channelTotal.innerHTML = `<i></i>${CHANNELS.length} EEG`;
    dom.qualityFilter.textContent = `优秀 ≥${EXCELLENT_QUALITY_THRESHOLD}`;
    dom.sensorMapTitle.textContent = `${profile.shortName} 通道质量`;
    dom.sensorMapDescription.textContent = `${CHANNELS.length} 个 EEG 通道；参考：${profile.reference}。${profile.montageNotice ? ` ${profile.montageNotice}` : ""}`;
    dom.electrodeLayerLabel.textContent = `${profile.shortName} 电极`;
    dom.deviceStatus.classList.remove("live");
    dom.deviceStatus.querySelector("span").textContent = `${profile.shortName} 演示数据`;
    createSensorMap();
    configureConnectionDialog();
    renderValidationFramework();
    if (resetScenario) applyScenario(state.scenario);
  }

  function configureConnectionDialog() {
    const profile = currentProfile();
    const cortex = profile.connector === "cortex";
    dom.connectTitle.textContent = `连接 ${profile.name}`;
    dom.cortexFields.hidden = !cortex;
    dom.bridgeFields.hidden = cortex;
    dom.connectIntro.textContent = cortex
      ? `请先打开 EMOTIV Launcher、登录 EmotivID 并连接 ${profile.name}。凭据仅保存在当前页面内存中。`
      : `请让 ${profile.name} 的采集程序通过统一 WebSocket Bridge 输出 EEG 和质量数据。`;
    dom.connectionNote.querySelector("span").innerHTML = cortex
      ? "实时原始 EEG 的 <code>eeg</code> 数据流需要相应 Cortex Developer API 权限；设备、电池和质量流会按账户权限订阅。"
      : "非 Cortex 设备通过统一 Bridge 适配；Bridge 必须同时提供通道名、时间戳和 0–100 的质量值。";
    dom.connectDevice.textContent = cortex ? "授权并连接 Cortex" : "连接设备 Bridge";
    setConnectionLog("等待连接…");
  }

  function openSensorMap() {
    dom.sensorMapWrap.classList.add("open");
    dom.sensorMapWrap.setAttribute("aria-hidden", "false");
    dom.toggleSensorMap.textContent = "关闭电极图";
  }

  function bindEvents() {
    dom.deviceProfileSelect.addEventListener("change", (event) => applyDeviceProfile(event.target.value, true));
    dom.devicePickerTrigger.addEventListener("click", () => {
      const open = !dom.devicePickerMenu.classList.contains("open");
      toggleDevicePicker(open);
    });
    dom.devicePickerMenu.addEventListener("click", (event) => {
      const option = event.target.closest("[data-device-id]");
      if (!option) return;
      applyDeviceProfile(option.dataset.deviceId, true);
      toggleDevicePicker(false);
    });
    dom.validationDimensionTabs.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-validation-dimension]");
      if (!tab) return;
      state.validationDimension = tab.dataset.validationDimension;
      renderValidationFramework();
    });
    document.addEventListener("click", (event) => {
      if (!dom.devicePicker.contains(event.target)) toggleDevicePicker(false);
    });
    dom.scenarioSelect.addEventListener("change", (event) => applyScenario(event.target.value));
    dom.playToggle.addEventListener("click", togglePlayback);
    dom.resetPlayback.addEventListener("click", () => setTime(0));
    dom.speedSelect.addEventListener("change", (event) => { state.speed = Number(event.target.value); });
    dom.toggleHidden.addEventListener("click", () => openSensorMap());
    dom.toggleSensorMap.addEventListener("click", () => {
      const open = dom.sensorMapWrap.classList.toggle("open");
      dom.sensorMapWrap.setAttribute("aria-hidden", String(!open));
      dom.toggleSensorMap.textContent = open ? "关闭电极图" : "查看电极图";
    });

    dom.timelineTrack.addEventListener("click", (event) => {
      if (event.target.classList.contains("event-marker")) return;
      const rect = dom.timelineTrack.getBoundingClientRect();
      setTime(((event.clientX - rect.left) / rect.width) * state.duration);
    });
    document.querySelectorAll("[data-time]").forEach((button) => {
      button.addEventListener("click", () => setTime(Number(button.dataset.time)));
    });

    dom.autoRotate.addEventListener("click", () => {
      state.brain.autoRotate = !state.brain.autoRotate;
      dom.autoRotate.classList.toggle("active", state.brain.autoRotate);
    });

    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => setBrainView(button.dataset.view));
    });
    document.querySelectorAll("[data-layer]").forEach((input) => {
      input.addEventListener("change", () => { state.brain.layers[input.dataset.layer] = input.checked; });
    });

    const canvas = dom.brainCanvas;
    canvas.addEventListener("pointerdown", (event) => {
      state.brain.dragging = true;
      state.brain.lastX = event.clientX;
      state.brain.lastY = event.clientY;
      state.brain.autoRotate = false;
      dom.autoRotate.classList.remove("active");
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!state.brain.dragging) return;
      state.brain.yaw += (event.clientX - state.brain.lastX) * 0.008;
      state.brain.pitch = clamp(state.brain.pitch + (event.clientY - state.brain.lastY) * 0.006, -1.35, 1.35);
      state.brain.lastX = event.clientX;
      state.brain.lastY = event.clientY;
    });
    canvas.addEventListener("pointerup", (event) => {
      state.brain.dragging = false;
      canvas.releasePointerCapture(event.pointerId);
    });
    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      state.brain.scale = clamp(state.brain.scale - event.deltaY * 0.0008, 0.72, 1.42);
    }, { passive: false });

    dom.openValidation.addEventListener("click", () => toggleDrawer(true));
    dom.closeValidation.addEventListener("click", () => toggleDrawer(false));
    dom.openConnect.addEventListener("click", () => toggleConnectModal(true));
    dom.closeConnect.addEventListener("click", () => toggleConnectModal(false));
    dom.useDemo.addEventListener("click", () => toggleConnectModal(false));
    dom.connectModal.addEventListener("click", (event) => {
      if (event.target === dom.connectModal) toggleConnectModal(false);
    });
    dom.connectDevice.addEventListener("click", connectSelectedDevice);

    window.addEventListener("resize", resizeCanvases);
    document.addEventListener("keydown", (event) => {
      if (event.code === "Space" && !["INPUT", "SELECT"].includes(document.activeElement.tagName)) {
        event.preventDefault();
        togglePlayback();
      }
      if (event.key === "Escape") {
        toggleDevicePicker(false);
        toggleDrawer(false);
        toggleConnectModal(false);
      }
    });
  }

  function applyScenario(scenario) {
    state.scenario = scenario;
    state.dataMode = "demo";
    state.time = 0;
    state.playing = false;
    dom.playToggle.classList.remove("playing");
    dom.deviceStatus.classList.remove("live");
    dom.deviceStatus.querySelector("span").textContent = `${currentProfile().shortName} 演示数据`;
    dom.samplingRate.textContent = `${currentProfile().samplingRate} SPS`;

    for (const channel of CHANNELS) {
      channel.quality = channel.baseQuality;
    }

    if (scenario === "quality") {
      const degraded = { AF3: 36, F7: 28, F3: 44, FC5: 31, T7: 22, P7: 38, O1: 57, O2: 49, P8: 55, T8: 42, FC6: 61, F4: 58, F8: 25, AF4: 18 };
      for (const channel of CHANNELS) channel.quality = degraded[channel.name] ?? Math.max(18, channel.baseQuality - 52);
    }

    state.lastRankingKey = "";
    rankChannels(true);
    updateInterface(true);
  }

  function togglePlayback() {
    if (state.dataMode === "live") return;
    if (state.time >= state.duration) state.time = 0;
    state.playing = !state.playing;
    dom.playToggle.classList.toggle("playing", state.playing);
    dom.playToggle.setAttribute("aria-label", state.playing ? "暂停" : "播放");
  }

  function setTime(value) {
    if (state.dataMode === "live") return;
    state.time = clamp(value, 0, state.duration);
    if (state.time >= state.duration) {
      state.playing = false;
      dom.playToggle.classList.remove("playing");
    }
    rankChannels(true);
    updateInterface(true);
  }

  function currentPhase() {
    if (state.dataMode === "live" || state.scenario === "normal") return PHASES[0];
    return PHASES.find((phase) => state.time >= phase.start && state.time < phase.end) || PHASES[PHASES.length - 1];
  }

  function eventIntensity(time = state.time) {
    if (state.dataMode === "live" || state.scenario !== "temporal") return 0;
    if (time < 8) return interictalPulseIntensity(time);
    if (time < 10) return smoothStep((time - 8) / 2) * 0.72;
    if (time < 13) return 0.72 + smoothStep((time - 10) / 3) * 0.18;
    if (time < 17) return 0.9 + smoothStep((time - 13) / 4) * 0.1;
    if (time < 20) return 1 - smoothStep((time - 17) / 3) * 0.18;
    return Math.max(0, 0.62 * (1 - (time - 20) / 4));
  }

  function interictalPulseIntensity(time) {
    const pulseAt = (center) => Math.exp(-Math.pow((time - center) / 0.075, 2));
    return Math.max(pulseAt(5.65), pulseAt(7.15)) * 0.38;
  }

  function propagationFactor(time = state.time) {
    if (time < 13 || state.scenario !== "temporal") return 0;
    return smoothStep(clamp((time - 13) / 5, 0, 1));
  }

  function rankChannels(force = false) {
    const phase = currentPhase();
    const rankingKey = `${phase.key}:${state.scenario}:${state.dataMode}`;
    if (!force && rankingKey === state.lastRankingKey && performance.now() - state.lastRankAt < 2500) return;

    const intensity = eventIntensity();
    const sorted = CHANNELS.filter((channel) => channel.quality >= EXCELLENT_QUALITY_THRESHOLD).sort((a, b) => {
      if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
      return channelPriority(b, intensity) - channelPriority(a, intensity);
    });

    state.activeChannels = sorted.slice(0, 8);
    state.lastRankingKey = rankingKey;
    state.lastRankAt = performance.now();
    renderChannelRows();
  }

  function channelPriority(channel, intensity) {
    return channel.quality * 0.62 + channel.relevance * intensity * 54 + (channel.pinned ? 1000 : 0);
  }

  function renderChannelRows() {
    const channels = state.activeChannels;
    const fragment = document.createDocumentFragment();

    if (!channels.length) {
      const empty = document.createElement("div");
      empty.className = "empty-channel-state";
      empty.innerHTML = `<strong>没有达到优秀阈值的通道</strong><span>当前仅展示质量 ≥ ${EXCELLENT_QUALITY_THRESHOLD} 的 EEG 通道，请检查接触或设备连接。</span>`;
      fragment.appendChild(empty);
    }

    for (const channel of channels) {
      const row = dom.channelTemplate.content.firstElementChild.cloneNode(true);
      row.dataset.channel = channel.name;
      const identity = row.querySelector(".channel-identity");
      identity.querySelector("strong").textContent = channel.name;
      identity.querySelector("small").textContent = channel.side;
      const pin = row.querySelector(".pin-button");
      pin.classList.toggle("active", channel.pinned);
      pin.title = channel.pinned ? "取消固定" : "固定通道";
      pin.addEventListener("click", () => {
        channel.pinned = !channel.pinned;
        rankChannels(true);
      });
      fragment.appendChild(row);
    }

    dom.channelList.replaceChildren(fragment);
    dom.hiddenCount.textContent = String(CHANNELS.length - state.activeChannels.length);
    requestAnimationFrame(resizeCanvases);
  }

  function animationFrame(now) {
    const delta = Math.min((now - state.lastFrame) / 1000, 0.08);
    state.lastFrame = now;

    if (state.playing && state.dataMode === "demo") {
      state.time += delta * state.speed;
      if (state.time >= state.duration) {
        state.time = state.duration;
        state.playing = false;
        dom.playToggle.classList.remove("playing");
      }
    }

    if (state.brain.autoRotate && !state.brain.dragging) {
      state.brain.yaw += delta * 0.13;
    }

    if (now - state.lastUiUpdate > 90) {
      rankChannels(false);
      drawWaveforms();
      updateInterface(false);
      state.lastUiUpdate = now;
    }
    drawBrain(now / 1000);
    requestAnimationFrame(animationFrame);
  }

  function drawWaveforms() {
    const rows = dom.channelList.querySelectorAll(".channel-row");
    for (const row of rows) {
      const channel = CHANNELS.find((item) => item.name === row.dataset.channel);
      if (!channel) continue;
      const canvas = row.querySelector("canvas");
      const context = canvas.getContext("2d");
      const width = canvas.width / devicePixelRatio;
      const height = canvas.height / devicePixelRatio;
      if (!width || !height) continue;

      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      const isEventChannel = eventIntensity() > 0.15 && channel.relevance > 0.5 && channel.quality >= EXCELLENT_QUALITY_THRESHOLD;
      row.classList.toggle("event-channel", isEventChannel);
      const qualityDot = row.querySelector(".quality-dot");
      qualityDot.className = `quality-dot ${qualityClass(channel.quality)}`;
      row.querySelector(".score-type").textContent = isEventChannel ? "EVENT · QUALITY" : "QUALITY";
      row.querySelector(".channel-score strong").textContent = isEventChannel
        ? `${Math.round(channel.relevance * eventIntensity() * 100)}% · Q${Math.round(channel.quality)}`
        : `${Math.round(channel.quality)}%`;

      const color = channel.quality < 45 ? "#67757a" : isEventChannel ? "#ff7654" : "#59d3d5";
      const samples = state.dataMode === "live" ? liveSignal(channel) : demoSignal(channel, 260);
      if (samples.length < 2) {
        drawEmptySignal(context, width, height);
        continue;
      }

      const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
      const maxAbs = state.dataMode === "live"
        ? Math.max(90, percentile(samples.map((value) => Math.abs(value - mean)), 0.94) * 1.8)
        : 4.2;

      context.beginPath();
      samples.forEach((sample, index) => {
        const x = (index / (samples.length - 1)) * width;
        const normalized = clamp((sample - mean) / maxAbs, -0.95, 0.95);
        const y = height / 2 - normalized * height * 0.45;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.strokeStyle = color;
      context.lineWidth = 1;
      context.globalAlpha = 0.92;
      context.shadowBlur = isEventChannel ? 5 : 3;
      context.shadowColor = color;
      context.stroke();
      context.shadowBlur = 0;
      context.globalAlpha = 1;
      context.fillStyle = color;
      context.fillRect(width - 1, height / 2 - 2, 1, 4);
    }
  }

  function demoSignal(channel, count) {
    const values = [];
    const start = state.time - 4;
    for (let index = 0; index < count; index += 1) {
      const time = start + (index / (count - 1)) * 4;
      const baseFrequency = 8.4 + (channel.index % 5) * 0.36;
      const phase = channel.index * 0.61;
      let value = 0.42 * Math.sin(Math.PI * 2 * baseFrequency * time + phase);
      value += 0.19 * Math.sin(Math.PI * 2 * 3.2 * time + phase * 0.7);
      value += 0.08 * Math.sin(Math.PI * 2 * 21.7 * time + channel.index);

      if (state.scenario === "temporal") {
        const temporalWeight = clamp((channel.relevance - 0.22) / 0.78, 0, 1);

        if (time < 8) {
          const sharpSlow = sharpSlowComplex(time, 5.65) + sharpSlowComplex(time, 7.15);
          value += temporalWeight * sharpSlow;
        } else if (time < 13) {
          const progress = smoothStep(clamp((time - 8) / 5, 0, 1));
          const envelope = smoothStep(clamp((time - 8) / 1.2, 0, 1));
          const frequency = 5.2 + progress * 1.35;
          const synchrony = 0.72 + progress * 0.2;
          const alignedPhase = phase * (1 - synchrony * temporalWeight);
          const rhythmic = Math.sin(Math.PI * 2 * frequency * (time - 8) + alignedPhase);
          const harmonic = Math.sin(Math.PI * 4 * frequency * (time - 8) + alignedPhase * 0.5);
          value *= 1 - envelope * temporalWeight * 0.42;
          value += temporalWeight * envelope * (1.15 + progress * 1.25) * (rhythmic + harmonic * 0.22);
        } else if (time < 20) {
          const progress = smoothStep(clamp((time - 13) / 7, 0, 1));
          const leftRecruitable = channel.side.startsWith("左") ? 0.42 + channel.relevance * 0.58 : channel.relevance * 0.18;
          const recruitmentStart = 13 + (1 - leftRecruitable) * 3.8;
          const recruitment = smoothStep(clamp((time - recruitmentStart) / 1.35, 0, 1));
          const frequency = 6.55 - progress * 1.45;
          const alignedPhase = phase * (1 - (0.76 + progress * 0.18) * leftRecruitable);
          const rhythmic = Math.sin(Math.PI * 2 * frequency * (time - 13) + alignedPhase);
          const sharpComponent = Math.sin(Math.PI * 4 * frequency * (time - 13) + alignedPhase * 0.45);
          value *= 1 - recruitment * leftRecruitable * 0.5;
          value += leftRecruitable * recruitment * (2.15 - progress * 0.28) * (rhythmic + sharpComponent * 0.25);
        } else {
          const recovery = clamp((time - 20) / 4, 0, 1);
          const slowFrequency = 2.15 + recovery * 0.55;
          const slowEnvelope = 0.95 - recovery * 0.48;
          value *= 0.58 + recovery * 0.3;
          value += temporalWeight * slowEnvelope * 1.35 * Math.sin(Math.PI * 2 * slowFrequency * (time - 20) + phase * 0.18);
        }
      }

      if (channel.quality < 45) {
        value += 0.8 * Math.sin(Math.PI * 2 * 26.4 * time + phase);
        value += Math.sin(Math.PI * 2 * 0.42 * time + phase) > 0.88 ? 2.2 : 0;
      } else if (channel.quality < 65) {
        value += 0.3 * Math.sin(Math.PI * 2 * 24.1 * time + phase);
      }
      values.push(value);
    }
    return values;
  }

  function sharpSlowComplex(time, center) {
    const gaussian = (offset, width) => Math.exp(-0.5 * Math.pow(offset / width, 2));
    const relative = time - center;
    const sharpUp = gaussian(relative, 0.035) * 3.4;
    const sharpReturn = gaussian(relative - 0.07, 0.055) * 2.25;
    const afterGoingSlow = gaussian(relative - 0.28, 0.19) * 1.05;
    return sharpUp - sharpReturn - afterGoingSlow;
  }

  function liveSignal(channel) {
    const buffer = state.liveBuffers[channel.name] || [];
    return buffer.slice(-1024);
  }

  function drawEmptySignal(context, width, height) {
    context.save();
    context.setLineDash([4, 6]);
    context.strokeStyle = "rgba(96, 131, 138, .3)";
    context.beginPath();
    context.moveTo(0, height / 2);
    context.lineTo(width, height / 2);
    context.stroke();
    context.restore();
  }

  function updateInterface(force) {
    const phase = currentPhase();
    const phaseIndex = PHASES.indexOf(phase);
    const percent = clamp((state.time / state.duration) * 100, 0, 100);
    const qualityCounts = countQuality();
    const requiredExcellent = Math.min(4, Math.max(2, Math.ceil(CHANNELS.length * 0.35)));
    const blocked = qualityCounts.good < requiredExcellent || state.scenario === "quality";
    const live = state.dataMode === "live";

    dom.currentTime.textContent = live ? "LIVE" : formatTime(state.time);
    dom.timelineProgress.style.width = `${percent}%`;
    dom.timelineThumb.style.left = `${percent}%`;
    dom.goodCount.textContent = String(qualityCounts.good);
    dom.attentionCount.textContent = String(qualityCounts.average);
    dom.poorCount.textContent = String(qualityCounts.poor);
    updateSensorMap();

    document.querySelectorAll("#phase-steps button").forEach((button, index) => {
      button.classList.toggle("active", index === phaseIndex);
    });

    dom.dominantFrequency.innerHTML = `${live ? "—" : phase.frequency.toFixed(1)} <small>Hz</small>`;
    dom.peakAmplitude.innerHTML = `${live ? "—" : phase.amplitude} <small>µV</small>`;
    dom.rhythmicity.textContent = live ? "—" : phase.rhythmicity.toFixed(2);
    const metricBox = dom.classification.closest("div");
    metricBox.classList.remove("alert", "blocked");

    if (live) {
      dom.classification.textContent = "LIVE / 未接识别算法";
      dom.phaseIndex.textContent = "LIVE";
      dom.phaseTitle.textContent = "REAL-TIME ACQUISITION / 实时采集";
      dom.phaseDescription.textContent = `正在显示 ${currentProfile().shortName} 原始 EEG；当前原型未对实时数据输出癫痫识别结论。`;
      setBrainReadout("实时 EEG 已连接", 0, "实时模式仅显示信号与质量；接入经过验证的模型后才启用脑区概率映射。", "baseline");
      dom.evidenceChannels.textContent = `${currentProfile().shortName} · RAW EEG · QUALITY`;
    } else if (blocked) {
      metricBox.classList.add("blocked");
      dom.classification.textContent = "DATA INSUFFICIENT";
      dom.phaseIndex.textContent = "GATE";
      dom.phaseTitle.textContent = "QUALITY GATE / 数据不足";
      dom.phaseDescription.textContent = "可用通道不足，区域映射已暂停；请优先补液并调整参考与记录电极。";
      setBrainReadout("脑区映射已暂停", 0, "当前信号质量不足，系统不会用低质量通道生成强确定性热区。", "blocked");
      dom.evidenceChannels.textContent = "CQ GATE · ABSTAIN";
    } else if (state.scenario === "normal" || phase.key === "baseline") {
      const isolatedDischarge = state.scenario === "temporal" && interictalPulseIntensity(state.time) > 0.16;
      dom.classification.textContent = isolatedDischarge ? "INTERICTAL-LIKE DEMO" : "BACKGROUND";
      dom.phaseIndex.textContent = `0${phaseIndex + 1} / 04`;
      dom.phaseTitle.textContent = state.scenario === "normal" ? "NORMAL BASELINE / 正常基线" : phase.title;
      dom.phaseDescription.textContent = phase.description;
      if (isolatedDischarge) {
        setBrainReadout("左颞尖慢波样活动（示意）", 0.54, "单次尖慢波只作为间歇期样本展示，不等同于一次癫痫发作。", "recovery");
      } else {
        setBrainReadout("未发现明显异常区域", 0, "当前为基线状态，脑区仅显示低强度、非同步背景活动。", "baseline");
      }
      dom.evidenceChannels.textContent = state.activeChannels.slice(0, 3).map((channel) => channel.name).join(" · ");
    } else {
      metricBox.classList.add("alert");
      dom.classification.textContent = phase.classification;
      dom.phaseIndex.textContent = `0${phaseIndex + 1} / 04`;
      dom.phaseTitle.textContent = phase.title;
      dom.phaseDescription.textContent = phase.description;
      const confidence = phase.key === "onset" ? 0.74 : phase.key === "spread" ? 0.82 : 0.63;
      const region = phase.key === "spread"
        ? "左颞优势 · 左额/中央/顶区募集"
        : phase.key === "recovery"
          ? "左颞区发作后慢化（示意）"
          : "左颞区疑似节律起始（脑叶级）";
      const evidence = [...state.activeChannels]
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, phase.key === "spread" ? 4 : 3)
        .map((channel) => channel.name);
      const readoutCopy = phase.key === "spread"
        ? `证据通道：${evidence.join("、")}。暖色节点表示相关通道募集，不代表已测得的脑内传播路径。`
        : phase.key === "recovery"
          ? `证据通道：${evidence.join("、")}。显示的是局灶慢化示意，仍需与伪迹和临床信息复核。`
          : `证据通道：${evidence.join("、")}。演变性 theta 节律支持左颞脑叶级推测。`;
      setBrainReadout(region, confidence, readoutCopy, phase.key === "recovery" ? "recovery" : "alert");
      dom.evidenceChannels.textContent = evidence.join(" · ");
    }

    dom.phaseTitle.closest("div").style.borderLeftColor = blocked ? "var(--yellow)" : eventIntensity() > 0.15 ? "var(--orange)" : "var(--cyan)";
    dom.onsetCursor.classList.toggle("visible", state.scenario === "temporal" && state.time >= 8 && state.time < 20);
    dom.eventRange.style.opacity = state.scenario === "temporal" ? "1" : "0";
    updateValidation(blocked);

    if (force) drawWaveforms();
  }

  function setBrainReadout(title, confidence, copy, status) {
    dom.brainReadout.classList.remove("alert", "recovery", "blocked");
    if (status !== "baseline") dom.brainReadout.classList.add(status);
    dom.regionName.textContent = title;
    dom.confidenceBar.style.width = `${Math.round(confidence * 100)}%`;
    dom.confidenceValue.textContent = confidence ? `${Math.round(confidence * 100)}%` : "—";
    dom.regionEvidence.textContent = copy;
  }

  function updateSensorMap() {
    const activeNames = new Set(state.activeChannels.map((channel) => channel.name));
    dom.sensorMap.querySelectorAll(".sensor-point").forEach((point) => {
      const channel = CHANNELS.find((item) => item.name === point.dataset.channel);
      point.className = `sensor-point ${qualityClass(channel.quality)}${activeNames.has(channel.name) ? " active" : ""}`;
      point.title = `${channel.name} · ${channel.side} · 质量 ${Math.round(channel.quality)}%`;
    });
  }

  function countQuality() {
    return CHANNELS.reduce((counts, channel) => {
      if (channel.quality >= EXCELLENT_QUALITY_THRESHOLD) counts.good += 1;
      else if (channel.quality >= 45) counts.average += 1;
      else counts.poor += 1;
      return counts;
    }, { good: 0, average: 0, poor: 0 });
  }

  function qualityClass(quality) {
    if (quality >= EXCELLENT_QUALITY_THRESHOLD) return "good";
    if (quality >= 45) return "average";
    return "poor";
  }

  function createBrainGeometry() {
    const latitudeSteps = 23;
    const longitudeSteps = 42;
    const grid = [];

    for (let latitudeIndex = 0; latitudeIndex <= latitudeSteps; latitudeIndex += 1) {
      const phi = -Math.PI / 2 + (latitudeIndex / latitudeSteps) * Math.PI;
      const row = [];
      for (let longitudeIndex = 0; longitudeIndex < longitudeSteps; longitudeIndex += 1) {
        const theta = (longitudeIndex / longitudeSteps) * Math.PI * 2;
        const organic = 1 + 0.035 * Math.sin(theta * 7 + phi * 3) + 0.02 * Math.sin(theta * 13 - phi * 5);
        let x = 1.03 * Math.cos(phi) * Math.cos(theta) * organic;
        const y = 0.78 * Math.sin(phi) * (0.96 + 0.04 * Math.cos(theta * 4));
        const z = 1.16 * Math.cos(phi) * Math.sin(theta) * organic;
        if (Math.abs(x) < 0.065 && y > -0.2) x += Math.sign(x || Math.cos(theta)) * 0.045;
        const point = { x, y, z, region: regionForPoint(x, y, z) };
        const pointIndex = brainGeometry.points.push(point) - 1;
        row.push(pointIndex);
        if (longitudeIndex > 0 && latitudeIndex % 2 === 0) {
          brainGeometry.lines.push([row[longitudeIndex - 1], pointIndex]);
        }
        if (latitudeIndex > 0 && longitudeIndex % 3 === 0) {
          brainGeometry.lines.push([grid[latitudeIndex - 1][longitudeIndex], pointIndex]);
        }
      }
      if (latitudeIndex % 2 === 0) brainGeometry.lines.push([row[row.length - 1], row[0]]);
      grid.push(row);
    }

    brainGeometry.regionNodes = [
      { key: "left-temporal", label: "LEFT TEMPORAL", position: [-0.78, -0.25, 0.06], weight: 1 },
      { key: "left-frontal", label: "LEFT FRONTAL", position: [-0.57, 0.16, 0.62], weight: 0.66 },
      { key: "left-parietal", label: "LEFT PARIETAL", position: [-0.62, 0.24, -0.36], weight: 0.48 },
      { key: "right-temporal", label: "RIGHT TEMPORAL", position: [0.78, -0.25, 0.06], weight: 0.12 },
    ];
  }

  function regionForPoint(x, y, z) {
    const side = x < 0 ? "left" : "right";
    if (y < -0.2 && z > -0.5) return `${side}-temporal`;
    if (z > 0.38) return `${side}-frontal`;
    if (z < -0.56) return `${side}-occipital`;
    return `${side}-parietal`;
  }

  function drawBrain(animationTime) {
    const canvas = dom.brainCanvas;
    const intensity = eventIntensity();
    const blocked = state.scenario === "quality";
    if (brainRenderer?.ready) {
      brainRenderer.render({
        yaw: state.brain.yaw,
        pitch: state.brain.pitch,
        scale: state.brain.scale,
        time: animationTime,
        intensity,
        spread: propagationFactor(),
        phaseKey: currentPhase().key,
        blocked,
        layers: state.brain.layers,
        channels: CHANNELS,
        qualityThreshold: EXCELLENT_QUALITY_THRESHOLD,
      });
      return;
    }
    const context = canvas.getContext("2d");
    const width = canvas.width / devicePixelRatio;
    const height = canvas.height / devicePixelRatio;
    if (!width || !height) return;
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    const centerX = width * 0.61;
    const centerY = height * 0.49;
    const baseScale = Math.min(width * 0.25, height * 0.38) * state.brain.scale;
    const projected = brainGeometry.points.map((point) => projectPoint(
      morphBrainPoint(point, animationTime, intensity, blocked),
      centerX,
      centerY,
      baseScale,
    ));

    drawBrainHalo(context, centerX, centerY, baseScale, intensity, blocked);
    drawActivityScan(context, centerX, centerY, baseScale, animationTime, intensity, blocked);

    if (state.brain.layers.cortex) {
      context.save();
      context.lineWidth = 0.55;
      for (const [startIndex, endIndex] of brainGeometry.lines) {
        const start = projected[startIndex];
        const end = projected[endIndex];
        if (start.depth < -0.82 && end.depth < -0.82) continue;
        const active = !blocked && intensity > 0.1 && isHighlightedRegion(brainGeometry.points[startIndex].region);
        context.strokeStyle = active
          ? `rgba(255, 112, 77, ${0.12 + intensity * 0.18})`
          : `rgba(63, 184, 191, ${0.08 + Math.max(start.depth, 0) * 0.12})`;
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.stroke();
      }

      const sortedPoints = projected.map((point, index) => ({ ...point, index })).sort((a, b) => a.depth - b.depth);
      for (const point of sortedPoints) {
        const geometryPoint = brainGeometry.points[point.index];
        const active = !blocked && intensity > 0.08 && isHighlightedRegion(geometryPoint.region);
        const depthAlpha = clamp((point.depth + 1.5) / 3, 0.08, 0.7);
        context.fillStyle = active
          ? `rgba(255, ${Math.round(108 + 58 * (1 - intensity))}, 84, ${0.16 + intensity * 0.44 * depthAlpha})`
          : `rgba(61, 185, 191, ${0.09 + depthAlpha * 0.23})`;
        const size = 0.65 + depthAlpha * 1.05;
        context.fillRect(point.x, point.y, size, size);
      }
      context.restore();
    }

    if (state.brain.layers.regions) {
      drawNeuralConnections(context, centerX, centerY, baseScale, animationTime, intensity, blocked);
      drawRegionNodes(context, centerX, centerY, baseScale, animationTime, intensity, blocked);
    }
    if (state.brain.layers.electrodes) drawElectrodes(context, centerX, centerY, baseScale, intensity);
    if (state.brain.layers.particles) drawParticles(context, centerX, centerY, baseScale, animationTime, intensity, blocked);
  }

  function morphBrainPoint(point, time, intensity, blocked) {
    const baselinePulse = Math.sin(time * 1.65 + point.x * 2.1 + point.z * 1.3) * 0.009;
    const regionalWave = !blocked && intensity > 0.05 && isHighlightedRegion(point.region)
      ? Math.sin(time * 4.4 - point.y * 4 + point.z * 2.2) * intensity * 0.026
      : 0;
    const factor = 1 + baselinePulse + regionalWave;
    return {
      x: point.x * factor,
      y: point.y * (1 + baselinePulse * 0.7 + regionalWave * 0.45),
      z: point.z * factor,
    };
  }

  function projectPoint(point, centerX, centerY, scale) {
    const yaw = state.brain.yaw;
    const pitch = state.brain.pitch;
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const x1 = point.x * cosYaw + point.z * sinYaw;
    const z1 = -point.x * sinYaw + point.z * cosYaw;
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const y2 = point.y * cosPitch - z1 * sinPitch;
    const z2 = point.y * sinPitch + z1 * cosPitch;
    const perspective = 1 + z2 * 0.08;
    return { x: centerX + x1 * scale * perspective, y: centerY - y2 * scale * perspective, depth: z2, perspective };
  }

  function drawBrainHalo(context, centerX, centerY, scale, intensity, blocked) {
    const gradient = context.createRadialGradient(centerX, centerY, scale * 0.1, centerX, centerY, scale * 1.45);
    if (blocked) {
      gradient.addColorStop(0, "rgba(239, 178, 83, .035)");
      gradient.addColorStop(1, "rgba(239, 178, 83, 0)");
    } else if (intensity > 0.1) {
      gradient.addColorStop(0, `rgba(255, 91, 62, ${0.04 + intensity * 0.07})`);
      gradient.addColorStop(1, "rgba(255, 91, 62, 0)");
    } else {
      gradient.addColorStop(0, "rgba(57, 206, 212, .06)");
      gradient.addColorStop(1, "rgba(57, 206, 212, 0)");
    }
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(centerX, centerY, scale * 1.45, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(69, 157, 167, .12)";
    context.lineWidth = 1;
    context.stroke();
    context.beginPath();
    context.arc(centerX, centerY, scale * 1.25, 0, Math.PI * 2);
    context.strokeStyle = "rgba(69, 157, 167, .07)";
    context.stroke();
  }

  function drawActivityScan(context, centerX, centerY, scale, time, intensity, blocked) {
    context.save();
    const scanProgress = (Math.sin(time * 0.95) + 1) / 2;
    const scanY = centerY - scale * 0.75 + scanProgress * scale * 1.5;
    const scanWidth = Math.sqrt(Math.max(0, 1 - Math.pow((scanY - centerY) / (scale * 0.78), 2))) * scale * 1.18;
    const active = !blocked && intensity > 0.08;
    const color = active ? "255, 105, 73" : blocked ? "238, 179, 84" : "80, 218, 221";
    const gradient = context.createLinearGradient(centerX - scanWidth, scanY, centerX + scanWidth, scanY);
    gradient.addColorStop(0, `rgba(${color}, 0)`);
    gradient.addColorStop(0.5, `rgba(${color}, ${active ? 0.28 : 0.12})`);
    gradient.addColorStop(1, `rgba(${color}, 0)`);
    context.strokeStyle = gradient;
    context.lineWidth = 1;
    context.shadowBlur = active ? 9 : 5;
    context.shadowColor = `rgba(${color}, .5)`;
    context.beginPath();
    context.moveTo(centerX - scanWidth, scanY);
    context.lineTo(centerX + scanWidth, scanY);
    context.stroke();

    context.shadowBlur = 0;
    context.globalAlpha = 0.28;
    context.beginPath();
    context.ellipse(
      centerX,
      centerY + Math.sin(time * 0.7) * scale * 0.04,
      scale * 1.26,
      scale * 0.34,
      Math.sin(time * 0.22) * 0.12,
      time * 0.18,
      time * 0.18 + Math.PI * 1.15,
    );
    context.strokeStyle = `rgba(${color}, .34)`;
    context.stroke();
    context.restore();
  }

  function drawNeuralConnections(context, centerX, centerY, scale, time, intensity, blocked) {
    const nodeByKey = new Map(brainGeometry.regionNodes.map((node) => [node.key, node]));
    const links = [
      ["left-temporal", "left-frontal", 0.95],
      ["left-temporal", "left-parietal", 0.78],
      ["left-temporal", "right-temporal", 0.34],
    ];

    for (let linkIndex = 0; linkIndex < links.length; linkIndex += 1) {
      const [fromKey, toKey, weight] = links[linkIndex];
      const fromNode = nodeByKey.get(fromKey);
      const toNode = nodeByKey.get(toKey);
      const from = projectPoint(vectorToPoint(fromNode.position), centerX, centerY, scale);
      const to = projectPoint(vectorToPoint(toNode.position), centerX, centerY, scale);
      const active = !blocked && intensity > 0.08;
      const strength = active ? intensity * weight * (linkIndex === 0 ? 1 : 0.35 + propagationFactor() * 0.65) : 0.09;
      const control = {
        x: (from.x + to.x) / 2 + (to.y - from.y) * 0.28,
        y: Math.min(from.y, to.y) - scale * (0.16 + linkIndex * 0.035),
      };

      context.save();
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.quadraticCurveTo(control.x, control.y, to.x, to.y);
      context.strokeStyle = active
        ? `rgba(255, 111, 75, ${0.08 + strength * 0.28})`
        : `rgba(78, 211, 214, ${0.035 + strength * 0.12})`;
      context.lineWidth = active ? 0.8 + strength * 0.9 : 0.55;
      context.setLineDash(active ? [] : [3, 7]);
      context.stroke();
      context.setLineDash([]);

      const pulseCount = active ? 3 : 1;
      for (let pulseIndex = 0; pulseIndex < pulseCount; pulseIndex += 1) {
        const progress = (time * (0.36 + linkIndex * 0.05) + pulseIndex / pulseCount + linkIndex * 0.17) % 1;
        const pulse = quadraticPoint(from, control, to, progress);
        context.beginPath();
        context.arc(pulse.x, pulse.y, active ? 1.6 + strength * 1.8 : 1, 0, Math.PI * 2);
        context.fillStyle = active ? `rgba(255, 180, 111, ${0.35 + strength * 0.62})` : "rgba(105, 231, 230, .32)";
        context.shadowColor = active ? "#ff744f" : "#5ae1e0";
        context.shadowBlur = active ? 10 : 5;
        context.fill();
      }
      context.restore();
    }
  }

  function vectorToPoint(vector) {
    return { x: vector[0], y: vector[1], z: vector[2] };
  }

  function quadraticPoint(start, control, end, progress) {
    const inverse = 1 - progress;
    return {
      x: inverse * inverse * start.x + 2 * inverse * progress * control.x + progress * progress * end.x,
      y: inverse * inverse * start.y + 2 * inverse * progress * control.y + progress * progress * end.y,
    };
  }

  function drawRegionNodes(context, centerX, centerY, scale, animationTime, intensity, blocked) {
    for (const node of brainGeometry.regionNodes) {
      const point = projectPoint({ x: node.position[0], y: node.position[1], z: node.position[2] }, centerX, centerY, scale);
      const active = !blocked && intensity > 0.08 && node.key.startsWith("left-");
      const localIntensity = active ? intensity * node.weight * (node.key === "left-frontal" ? 0.35 + propagationFactor() * 0.65 : 1) : 0.08;
      const radius = (active ? 22 + localIntensity * 38 : 12) * point.perspective;
      const gradient = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
      if (active) {
        gradient.addColorStop(0, `rgba(255, 197, 117, ${0.55 * localIntensity})`);
        gradient.addColorStop(0.25, `rgba(255, 79, 56, ${0.38 * localIntensity})`);
        gradient.addColorStop(1, "rgba(255, 60, 43, 0)");
      } else {
        gradient.addColorStop(0, "rgba(74, 211, 215, .12)");
        gradient.addColorStop(1, "rgba(74, 211, 215, 0)");
      }
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();

      context.beginPath();
      context.arc(point.x, point.y, active ? 3.2 : 1.6, 0, Math.PI * 2);
      context.fillStyle = active ? "#ffb172" : "rgba(94, 225, 225, .58)";
      context.shadowColor = active ? "#ff6a4d" : "#59dadd";
      context.shadowBlur = active ? 14 : 6;
      context.fill();
      context.shadowBlur = 0;

      if (active) {
        context.beginPath();
        context.arc(point.x, point.y, radius * (0.55 + 0.2 * Math.sin(animationTime * 3)), 0, Math.PI * 2);
        context.strokeStyle = `rgba(255, 112, 78, ${0.22 * localIntensity})`;
        context.stroke();
      }
    }
  }

  function drawElectrodes(context, centerX, centerY, scale, intensity) {
    const activeNames = new Set(state.activeChannels.slice(0, 5).map((channel) => channel.name));
    for (const channel of CHANNELS) {
      const point = projectPoint({ x: channel.brain[0], y: channel.brain[1], z: channel.brain[2] }, centerX, centerY, scale * 1.02);
      if (point.depth < -0.65) continue;
      const relevant = intensity > 0.12 && channel.relevance > 0.6 && channel.quality >= EXCELLENT_QUALITY_THRESHOLD;
      context.beginPath();
      context.arc(point.x, point.y, relevant ? 3 : 2, 0, Math.PI * 2);
      context.fillStyle = channel.quality < 45 ? "#b45a4d" : relevant ? "#ff8b62" : "#62e2e1";
      context.shadowColor = context.fillStyle;
      context.shadowBlur = relevant ? 10 : 4;
      context.fill();
      context.shadowBlur = 0;
      if (activeNames.has(channel.name) && point.depth > 0.08) {
        context.fillStyle = relevant ? "rgba(255, 157, 113, .8)" : "rgba(131, 211, 214, .62)";
        context.font = "7px Consolas";
        context.fillText(channel.name, point.x + 5, point.y - 4);
      }
    }
  }

  function drawParticles(context, centerX, centerY, scale, time, intensity, blocked) {
    const particleCount = 34;
    for (let index = 0; index < particleCount; index += 1) {
      const orbit = time * (0.18 + (index % 5) * 0.012) + index * 2.17;
      const active = !blocked && intensity > 0.08;
      const center = active ? [-0.52, -0.12, 0.08] : [0, 0, 0];
      const radius = 0.55 + (index % 7) * 0.075;
      const point3d = {
        x: center[0] + Math.cos(orbit) * radius,
        y: center[1] + Math.sin(orbit * 1.7) * radius * 0.48,
        z: center[2] + Math.sin(orbit) * radius,
      };
      const point = projectPoint(point3d, centerX, centerY, scale);
      context.beginPath();
      context.arc(point.x, point.y, active ? 1.1 + intensity * 0.8 : 0.8, 0, Math.PI * 2);
      context.fillStyle = active ? `rgba(255, 126, 83, ${0.22 + intensity * 0.48})` : "rgba(91, 220, 220, .28)";
      context.fill();
    }
  }

  function isHighlightedRegion(region) {
    if (region === "left-temporal") return true;
    return propagationFactor() > 0.25 && (region === "left-frontal" || region === "left-parietal");
  }

  function setBrainView(view) {
    const buttons = document.querySelectorAll("[data-view]");
    buttons.forEach((button) => button.classList.toggle("active", button.dataset.view === view && view !== "reset"));
    if (view === "lateral") { state.brain.yaw = 1.22; state.brain.pitch = -0.08; }
    if (view === "superior") { state.brain.yaw = 0; state.brain.pitch = -1.26; }
    if (view === "posterior") { state.brain.yaw = Math.PI; state.brain.pitch = -0.04; }
    if (view === "reset") { state.brain.yaw = 1.22; state.brain.pitch = -0.08; state.brain.scale = 1; }
    state.brain.autoRotate = false;
    dom.autoRotate.classList.remove("active");
  }

  function updateValidation(blocked) {
    const counts = countQuality();
    const usable = counts.good;
    const requiredExcellent = Math.min(4, Math.max(2, Math.ceil(CHANNELS.length * 0.35)));
    const eventCoverage = state.scenario === "temporal" ? state.activeChannels.filter((channel) => channel.relevance > 0.6).length : 0;
    const items = [
      { status: usable >= requiredExcellent ? "pass" : "warn", id: "A-REL-01", label: "优秀通道比例", detail: `${currentProfile().shortName} · 仅质量 ≥ ${EXCELLENT_QUALITY_THRESHOLD} 展示`, value: `${usable}/${CHANNELS.length}` },
      { status: blocked ? "warn" : "pass", id: "B-QA-01", label: "低质量推理门控", detail: blocked ? "脑区输出已正确暂停" : "低质量通道不驱动区域热图", value: blocked ? "ABSTAIN" : "PASS" },
      { status: "pass", id: "C-SYNC-01", label: "可视化时间同步", detail: "EEG / 事件框 / 脑模型使用统一游标", value: "< 1 FRAME" },
      { status: eventCoverage >= 3 || state.scenario !== "temporal" ? "pass" : "warn", id: "E-DYN-01", label: "Top-8 证据覆盖", detail: "演示标签中的关键通道覆盖", value: state.scenario === "temporal" ? `${eventCoverage}/4` : "N/A" },
      { status: "pass", id: "F-TRACE-01", label: "结果证据可追溯", detail: "时间窗 / 通道 / 模型状态", value: "100%" },
      { status: "pass", id: "G-INTERP-01", label: "不确定性表达", detail: "推测区域与精确定位明确区分", value: "VISIBLE" },
      { status: "pass", id: "H-FAIL-01", label: "故障状态区分", detail: "模型失败不等于未发现异常", value: "PASS" },
    ];

    const fragment = document.createDocumentFragment();
    for (const item of items) {
      const node = document.createElement("div");
      node.className = `validation-item ${item.status === "pass" ? "" : item.status}`;
      node.innerHTML = `<i></i><div><strong>${item.id} · ${item.label}</strong><small>${item.detail}</small></div><b>${item.value}</b>`;
      fragment.appendChild(node);
    }
    dom.validationList.replaceChildren(fragment);
    const warnings = items.filter((item) => item.status !== "pass").length;
    dom.validationScore.textContent = String(blocked ? 76 : warnings ? 88 : 96);
    dom.validationStatusTitle.textContent = `${items.length - warnings} 项通过 · ${warnings} 项关注`;
  }

  function renderValidationFramework() {
    const profile = currentProfile();
    const dimensions = window.buildValidationFramework(profile, EXCELLENT_QUALITY_THRESHOLD);
    const active = dimensions.find((dimension) => dimension.id === state.validationDimension) || dimensions[0];
    state.validationDimension = active.id;

    const tabFragment = document.createDocumentFragment();
    for (const dimension of dimensions) {
      const tab = document.createElement("button");
      const selected = dimension.id === active.id;
      tab.className = `validation-dimension-tab${selected ? " active" : ""}`;
      tab.type = "button";
      tab.role = "tab";
      tab.dataset.validationDimension = dimension.id;
      tab.setAttribute("aria-selected", String(selected));
      tab.innerHTML = `<small>${dimension.code.split(" / ")[0]} · ${dimension.items.length} ITEMS</small>${dimension.name}`;
      tabFragment.appendChild(tab);
    }
    dom.validationDimensionTabs.replaceChildren(tabFragment);

    dom.validationDimensionCode.textContent = active.code;
    dom.hardwareEvaluationTitle.textContent = active.name;
    dom.validationDimensionPurpose.textContent = active.summary;
    dom.validationDimensionGate.textContent = active.gate;
    updateDevicePicker(profile);

    const itemFragment = document.createDocumentFragment();
    for (const aspect of active.items) {
      const node = document.createElement("article");
      node.className = "validation-framework-item";
      node.innerHTML = `
        <div class="framework-item-head"><span>${aspect.id}</span><b>${aspect.priority}</b></div>
        <strong>${aspect.title}</strong>
        <div class="framework-detail"><b>METRIC</b><span>${aspect.metric}</span></div>
        <div class="framework-detail"><b>方法</b><span>${aspect.method}</span></div>
        <div class="framework-detail"><b>为什么</b><span>${aspect.reason}</span></div>
        <div class="framework-detail gate"><b>判定</b><span>${aspect.gate}</span></div>
      `;
      itemFragment.appendChild(node);
    }
    dom.hardwareEvaluationList.replaceChildren(itemFragment);
  }

  function toggleDrawer(open) {
    dom.validationDrawer.classList.toggle("open", open);
    dom.validationDrawer.setAttribute("aria-hidden", String(!open));
  }

  function toggleConnectModal(open) {
    dom.connectModal.classList.toggle("open", open);
    dom.connectModal.setAttribute("aria-hidden", String(!open));
  }

  async function connectSelectedDevice() {
    if (currentProfile().connector === "cortex") await connectCortexDevice();
    else await connectBridgeDevice();
  }

  async function connectCortexDevice() {
    const clientId = dom.clientId.value;
    const clientSecret = dom.clientSecret.value;
    dom.connectDevice.disabled = true;
    setConnectionLog("正在初始化 Cortex API…");

    try {
      cortexClient?.close();
      cortexClient = new window.CortexClient({
        onStatus: (message, type) => setConnectionLog(message, type),
        onStream: handleCortexStream,
      });
      const result = await cortexClient.initialize({
        clientId,
        clientSecret,
        headsetPattern: currentProfile().cortexIdPattern,
        headsetLabel: currentProfile().name,
      });
      state.dataMode = "live";
      state.playing = true;
      state.lastRankingKey = "";
      dom.deviceStatus.classList.add("live");
      dom.deviceStatus.querySelector("span").textContent = `${result.headset.id} 实时在线`;
      const eegRate = result.headset.settings?.eegRate;
      if (eegRate) dom.samplingRate.textContent = `${eegRate} SPS`;
      rankChannels(true);
      updateInterface(true);
      setConnectionLog(`${result.headset.id} 已连接，实时 EEG 正在进入通道缓冲区。`, "success");
      setTimeout(() => toggleConnectModal(false), 1100);
    } catch (error) {
      setConnectionLog(error.message || String(error), "error");
    } finally {
      dom.connectDevice.disabled = false;
    }
  }

  async function connectBridgeDevice() {
    const profile = currentProfile();
    const endpoint = dom.bridgeEndpoint.value.trim();
    dom.connectDevice.disabled = true;
    setConnectionLog(`正在初始化 ${profile.shortName} 统一 Bridge…`);

    try {
      genericClient?.close();
      genericClient = new window.GenericDeviceClient({
        onStatus: (message, type) => setConnectionLog(message, type),
        onStream: handleGenericStream,
      });
      await genericClient.connect(endpoint, profile);
      state.dataMode = "live";
      state.playing = true;
      state.lastRankingKey = "";
      dom.deviceStatus.classList.add("live");
      dom.deviceStatus.querySelector("span").textContent = `${profile.shortName} Bridge 在线`;
      dom.samplingRate.textContent = `${profile.samplingRate} SPS`;
      rankChannels(true);
      updateInterface(true);
      setConnectionLog(`${profile.name} 已通过统一 Bridge 接入。`, "success");
      setTimeout(() => toggleConnectModal(false), 1000);
    } catch (error) {
      setConnectionLog(error.message || String(error), "error");
    } finally {
      dom.connectDevice.disabled = false;
    }
  }

  function setConnectionLog(message, type) {
    dom.connectionLog.className = `connection-log ${type === "success" ? "success" : type === "warning" || type === "error" ? "error" : ""}`;
    dom.connectionLog.textContent = message;
  }

  function adaptCortexMontage(columns) {
    const profile = currentProfile();
    if (!profile.dynamicMontage || !Array.isArray(columns)) return;
    const channelNames = columns
      .map((column) => String(column).trim())
      .filter((column) => /^(FP|AF|FT|FC|TP|CP|PO|F|T|C|P|O|I)(Z|\d{1,2})$/i.test(column))
      .slice(0, 32);
    if (channelNames.length < 2) return;
    const signature = channelNames.map((name) => name.toUpperCase()).join("|");
    if (signature === state.liveMontageSignature) return;

    state.liveMontageSignature = signature;
    CHANNELS = window.createDeviceChannelsFromNames(profile.id, channelNames);
    state.liveBuffers = Object.fromEntries(CHANNELS.map((channel) => [channel.name, []]));
    state.lastRankingKey = "";
    dom.channelTotal.innerHTML = `<i></i>${CHANNELS.length} EEG`;
    dom.sensorMapTitle.textContent = `${profile.shortName} 实际 montage`;
    dom.sensorMapDescription.textContent = `${CHANNELS.length} 个 Cortex 实际返回通道；参考：${profile.reference}。`;
    createSensorMap();
    rankChannels(true);
    updateInterface(true);
    resizeCanvases();
  }

  function handleCortexStream(stream) {
    if (stream.name === "eeg") {
      adaptCortexMontage(stream.columns);
      for (const channel of CHANNELS) {
        const index = stream.columns.findIndex((column) => String(column).toUpperCase() === channel.name.toUpperCase());
        if (index < 0) continue;
        const value = Number(stream.values[index]);
        if (!Number.isFinite(value)) continue;
        const buffer = state.liveBuffers[channel.name];
        buffer.push(value);
        if (buffer.length > 2048) buffer.splice(0, buffer.length - 2048);
      }
      state.liveSamples += 1;
    }

    if (stream.name === "eq") {
      for (const channel of CHANNELS) {
        const index = stream.columns.findIndex((column) => String(column).toUpperCase() === channel.name.toUpperCase());
        if (index < 0) continue;
        const value = Number(stream.values[index]);
        if (Number.isFinite(value)) channel.quality = normalizeQuality(value);
      }
      state.lastRankingKey = "";
      rankChannels(true);
    }

    if (stream.name === "dev") {
      stream.columns.forEach((column, index) => {
        const label = String(column).toLowerCase();
        if (label.includes("batterypercent")) state.battery = Number(stream.values[index]);
        if (label.includes("signal")) state.wireless = Number(stream.values[index]);
      });
    }
  }

  function handleGenericStream(stream) {
    if (stream.name === "eeg") {
      for (const channel of CHANNELS) {
        const value = Number(stream.valuesByChannel[channel.name]);
        if (!Number.isFinite(value)) continue;
        const buffer = state.liveBuffers[channel.name];
        buffer.push(value);
        if (buffer.length > 2048) buffer.splice(0, buffer.length - 2048);
      }
      state.liveSamples += 1;
    }

    if (stream.name === "quality") {
      for (const channel of CHANNELS) {
        const value = Number(stream.valuesByChannel[channel.name]);
        if (Number.isFinite(value)) channel.quality = normalizeQuality(value);
      }
      state.lastRankingKey = "";
      rankChannels(true);
    }

    if (stream.name === "device") {
      if (Number.isFinite(Number(stream.meta.battery))) state.battery = Number(stream.meta.battery);
      if (Number.isFinite(Number(stream.meta.signal))) state.wireless = Number(stream.meta.signal);
      if (Number.isFinite(Number(stream.meta.samplingRate))) {
        dom.samplingRate.textContent = `${Number(stream.meta.samplingRate)} SPS`;
      }
    }
  }

  function normalizeQuality(value) {
    if (value <= 1) return clamp(value * 100, 0, 100);
    if (value <= 4) return clamp(value * 25, 0, 100);
    return clamp(value, 0, 100);
  }

  function resizeCanvases() {
    const allCanvases = [dom.brainCanvas, ...dom.channelList.querySelectorAll("canvas")];
    for (const canvas of allCanvases) {
      if (!canvas) continue;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width * devicePixelRatio));
      const height = Math.max(1, Math.round(rect.height * devicePixelRatio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    }
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds - minutes * 60;
    return `${String(minutes).padStart(2, "0")}:${remaining.toFixed(2).padStart(5, "0")}`;
  }

  function percentile(values, ratio) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function smoothStep(value) {
    const x = clamp(value, 0, 1);
    return x * x * (3 - 2 * x);
  }

  initialize();
})();
