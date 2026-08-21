(function exposeDeviceProfiles(global) {
  "use strict";

  const profiles = {
    "epoc-x": {
      id: "epoc-x",
      name: "EMOTIV EPOC X",
      shortName: "EPOC X",
      connector: "cortex",
      cortexIdPattern: "EPOC",
      samplingRate: 256,
      reference: "CMS/DRL · P3/P4",
      qualitySource: "Cortex contact quality + EEG quality",
      manufacturer: "EMOTIV",
      formFactor: "14 通道无线 EEG 头戴设备",
      connectorLabel: "Cortex API",
      image: "./assets/devices/epoc-x.webp",
      officialPage: "https://www.emotiv.com/epoc-x",
      imageCredit: "EMOTIV 官方产品图",
      channels: [
        ["AF3", "左前额", 93, 0.45, 30, 14, -0.56, 0.47, 0.82],
        ["F7", "左额颞", 91, 0.84, 17, 32, -0.82, 0.18, 0.56],
        ["F3", "左额", 88, 0.56, 36, 32, -0.47, 0.35, 0.64],
        ["FC5", "左额中央", 86, 0.72, 24, 48, -0.73, 0.1, 0.31],
        ["T7", "左颞", 96, 1, 8, 57, -0.92, -0.24, 0.06],
        ["P7", "左顶颞", 89, 0.92, 18, 73, -0.79, -0.05, -0.52],
        ["O1", "左枕", 82, 0.35, 38, 88, -0.42, -0.05, -0.91],
        ["O2", "右枕", 68, 0.12, 62, 88, 0.42, -0.05, -0.91],
        ["P8", "右顶颞", 79, 0.18, 82, 73, 0.79, -0.05, -0.52],
        ["T8", "右颞", 84, 0.24, 92, 57, 0.92, -0.24, 0.06],
        ["FC6", "右额中央", 75, 0.14, 76, 48, 0.73, 0.1, 0.31],
        ["F4", "右额", 87, 0.12, 64, 32, 0.47, 0.35, 0.64],
        ["F8", "右额颞", 58, 0.18, 83, 32, 0.82, 0.18, 0.56],
        ["AF4", "右前额", 34, 0.08, 70, 14, 0.56, 0.47, 0.82],
      ],
    },
    "emotiv-flex-2": {
      id: "emotiv-flex-2",
      name: "EMOTIV Flex 2 · 32ch",
      shortName: "FLEX 2",
      connector: "cortex",
      cortexIdPattern: "FLEX",
      dynamicMontage: true,
      samplingRate: 256,
      reference: "CMS/DRL · 可配置 10–20 位置或耳部",
      qualitySource: "Cortex contact quality + EEG quality",
      manufacturer: "EMOTIV",
      formFactor: "最多 32 通道可配置无线 EEG 帽",
      connectorLabel: "Cortex API",
      image: "./assets/devices/emotiv-flex-2.webp",
      officialPage: "https://www.emotiv.com/flex",
      imageCredit: "EMOTIV 官方产品图",
      montageNotice: "Demo 使用示例 10–20 32 通道布局；实时数据以 Cortex 返回的实际 montage 为准。",
      channels: [
        ["Fp1", "左前额极", 94, 0.35, 40, 10, -0.35, 0.55, 0.88],
        ["Fp2", "右前额极", 92, 0.12, 60, 10, 0.35, 0.55, 0.88],
        ["AF3", "左前额", 93, 0.48, 35, 18, -0.52, 0.47, 0.78],
        ["AF4", "右前额", 90, 0.1, 65, 18, 0.52, 0.47, 0.78],
        ["F7", "左额颞", 95, 0.84, 18, 31, -0.82, 0.18, 0.56],
        ["F3", "左额", 91, 0.58, 37, 31, -0.47, 0.35, 0.64],
        ["Fz", "额中线", 89, 0.28, 50, 30, 0, 0.42, 0.68],
        ["F4", "右额", 88, 0.1, 63, 31, 0.47, 0.35, 0.64],
        ["F8", "右额颞", 84, 0.12, 82, 31, 0.82, 0.18, 0.56],
        ["FC5", "左额中央", 94, 0.72, 25, 42, -0.7, 0.2, 0.42],
        ["FC1", "左额中央内侧", 90, 0.46, 42, 42, -0.25, 0.2, 0.45],
        ["FC2", "右额中央内侧", 87, 0.12, 58, 42, 0.25, 0.2, 0.45],
        ["FC6", "右额中央", 82, 0.1, 75, 42, 0.7, 0.2, 0.42],
        ["T7", "左颞", 97, 1, 8, 54, -0.94, -0.2, 0.06],
        ["C3", "左中央", 93, 0.68, 35, 52, -0.48, 0.08, 0.08],
        ["Cz", "中央中线", 91, 0.34, 50, 50, 0, 0.12, 0.08],
        ["C4", "右中央", 89, 0.1, 65, 52, 0.48, 0.08, 0.08],
        ["T8", "右颞", 83, 0.16, 92, 54, 0.94, -0.2, 0.06],
        ["CP5", "左中央顶", 95, 0.78, 25, 62, -0.7, -0.05, -0.25],
        ["CP1", "左中央顶内侧", 90, 0.5, 42, 63, -0.25, 0.05, -0.32],
        ["CP2", "右中央顶内侧", 86, 0.1, 58, 63, 0.25, 0.05, -0.32],
        ["CP6", "右中央顶", 81, 0.1, 75, 62, 0.7, -0.05, -0.25],
        ["P7", "左顶颞", 96, 0.92, 18, 72, -0.79, -0.05, -0.52],
        ["P3", "左顶", 92, 0.58, 38, 72, -0.46, 0.26, -0.48],
        ["Pz", "顶中线", 89, 0.3, 50, 73, 0, 0.2, -0.55],
        ["P4", "右顶", 86, 0.1, 62, 72, 0.46, 0.26, -0.48],
        ["P8", "右顶颞", 80, 0.12, 82, 72, 0.79, -0.05, -0.52],
        ["PO3", "左顶枕", 91, 0.42, 40, 82, -0.35, 0, -0.78],
        ["PO4", "右顶枕", 84, 0.1, 60, 82, 0.35, 0, -0.78],
        ["O1", "左枕", 88, 0.35, 42, 89, -0.42, -0.05, -0.91],
        ["Oz", "枕中线", 86, 0.2, 50, 91, 0, -0.04, -0.96],
        ["O2", "右枕", 79, 0.08, 58, 89, 0.42, -0.05, -0.91],
      ],
    },
    "muse-2": {
      id: "muse-2",
      name: "InteraXon Muse 2",
      shortName: "MUSE 2",
      connector: "bridge",
      samplingRate: 256,
      reference: "设备参考配置",
      qualitySource: "Bridge impedance/derived quality",
      manufacturer: "InteraXon",
      formFactor: "4 通道 EEG 头带",
      connectorLabel: "统一 Bridge",
      image: "./assets/devices/muse-2.png",
      officialPage: "https://choosemuse.com/products/muse-2",
      imageCredit: "Muse 官方产品图",
      channels: [
        ["TP9", "左颞后", 94, 1, 13, 62, -0.88, -0.2, -0.32],
        ["AF7", "左前额", 91, 0.68, 28, 18, -0.67, 0.43, 0.72],
        ["AF8", "右前额", 88, 0.16, 72, 18, 0.67, 0.43, 0.72],
        ["TP10", "右颞后", 83, 0.2, 87, 62, 0.88, -0.2, -0.32],
      ],
    },
    "openbci-cyton": {
      id: "openbci-cyton",
      name: "OpenBCI Cyton · 8ch",
      shortName: "CYTON 8",
      connector: "bridge",
      samplingRate: 250,
      reference: "可配置 SRB/BIAS",
      qualitySource: "Bridge impedance + derived signal quality",
      manufacturer: "OpenBCI",
      formFactor: "8 通道生物信号采集板",
      connectorLabel: "统一 Bridge",
      image: "./assets/devices/openbci-cyton.png",
      officialPage: "https://shop.openbci.com/products/cyton-biosensing-board-8-channel",
      imageCredit: "OpenBCI 官方产品图",
      channels: [
        ["Fp1", "左前额", 94, 0.55, 37, 12, -0.42, 0.52, 0.84],
        ["Fp2", "右前额", 92, 0.13, 63, 12, 0.42, 0.52, 0.84],
        ["C3", "左中央", 90, 0.68, 35, 50, -0.51, 0.1, 0.08],
        ["C4", "右中央", 88, 0.12, 65, 50, 0.51, 0.1, 0.08],
        ["P7", "左顶颞", 91, 1, 18, 72, -0.79, -0.05, -0.52],
        ["P8", "右顶颞", 84, 0.16, 82, 72, 0.79, -0.05, -0.52],
        ["O1", "左枕", 86, 0.35, 40, 89, -0.42, -0.05, -0.91],
        ["O2", "右枕", 82, 0.1, 60, 89, 0.42, -0.05, -0.91],
      ],
    },
    "openbci-ganglion": {
      id: "openbci-ganglion",
      name: "OpenBCI Ganglion · 4ch",
      shortName: "GANGLION 4",
      connector: "bridge",
      samplingRate: 200,
      reference: "可配置参考",
      qualitySource: "Bridge impedance + derived signal quality",
      manufacturer: "OpenBCI",
      formFactor: "4 通道生物信号采集板",
      connectorLabel: "统一 Bridge",
      image: "./assets/devices/openbci-ganglion.png",
      officialPage: "https://shop.openbci.com/products/ganglion-board",
      imageCredit: "OpenBCI 官方产品图",
      channels: [
        ["F7", "左额颞", 93, 0.82, 18, 32, -0.82, 0.18, 0.56],
        ["T7", "左颞", 95, 1, 9, 57, -0.92, -0.24, 0.06],
        ["T8", "右颞", 89, 0.2, 91, 57, 0.92, -0.24, 0.06],
        ["F8", "右额颞", 82, 0.12, 82, 32, 0.82, 0.18, 0.56],
      ],
    },
    "generic-1020": {
      id: "generic-1020",
      name: "通用 10–20 · 16ch",
      shortName: "GENERIC 16",
      connector: "bridge",
      samplingRate: 256,
      reference: "由采集端声明",
      qualitySource: "Adapter normalized quality",
      manufacturer: "Device Adapter",
      formFactor: "通用 10–20 映射 Profile",
      connectorLabel: "统一 Bridge",
      image: null,
      officialPage: null,
      imageCredit: "非具体硬件型号",
      channels: [
        ["Fp1", "左前额", 94, 0.45, 38, 11, -0.42, 0.52, 0.84],
        ["Fp2", "右前额", 92, 0.12, 62, 11, 0.42, 0.52, 0.84],
        ["F7", "左额颞", 91, 0.82, 17, 31, -0.82, 0.18, 0.56],
        ["F3", "左额", 89, 0.58, 37, 31, -0.47, 0.35, 0.64],
        ["F4", "右额", 88, 0.12, 63, 31, 0.47, 0.35, 0.64],
        ["F8", "右额颞", 81, 0.14, 83, 31, 0.82, 0.18, 0.56],
        ["C3", "左中央", 90, 0.68, 36, 51, -0.51, 0.1, 0.08],
        ["C4", "右中央", 87, 0.12, 64, 51, 0.51, 0.1, 0.08],
        ["T7", "左颞", 96, 1, 8, 57, -0.92, -0.24, 0.06],
        ["T8", "右颞", 84, 0.2, 92, 57, 0.92, -0.24, 0.06],
        ["P7", "左顶颞", 93, 0.92, 18, 72, -0.79, -0.05, -0.52],
        ["P3", "左顶", 86, 0.54, 38, 71, -0.46, 0.26, -0.48],
        ["P4", "右顶", 85, 0.12, 62, 71, 0.46, 0.26, -0.48],
        ["P8", "右顶颞", 79, 0.14, 82, 72, 0.79, -0.05, -0.52],
        ["O1", "左枕", 88, 0.35, 40, 89, -0.42, -0.05, -0.91],
        ["O2", "右枕", 82, 0.1, 60, 89, 0.42, -0.05, -0.91],
      ],
    },
  };

  function inferTenTwentyDefinition(channelName, index, total) {
    const name = String(channelName).trim();
    const normalized = name.toUpperCase();
    const match = normalized.match(/^(FP|AF|FT|FC|TP|CP|PO|F|T|C|P|O|I)(Z|\d{1,2})$/);
    const rowMap = { FP: 10, AF: 18, F: 30, FT: 38, FC: 42, T: 54, C: 52, TP: 64, CP: 63, P: 73, PO: 82, O: 90, I: 96 };
    let mapX;
    let mapY;
    let side;

    if (match) {
      const prefix = match[1];
      const position = match[2];
      mapY = rowMap[prefix] || 50;
      if (position === "Z") {
        mapX = 50;
        side = "中线";
      } else {
        const number = Number(position);
        const distance = Math.min(42, 7 + Math.ceil(number / 2) * 9);
        mapX = number % 2 ? 50 - distance : 50 + distance;
        side = number % 2 ? "左侧" : "右侧";
      }
    } else {
      const angle = (index / Math.max(1, total)) * Math.PI * 2 - Math.PI / 2;
      mapX = 50 + Math.cos(angle) * 40;
      mapY = 50 + Math.sin(angle) * 42;
      side = mapX < 48 ? "左侧" : mapX > 52 ? "右侧" : "中线";
    }

    const brainX = Math.max(-0.94, Math.min(0.94, (mapX - 50) / 44));
    const brainZ = Math.max(-0.96, Math.min(0.92, (50 - mapY) / 44));
    const relevance = /^(T7|P7|F7|FT7|TP7|FC5|CP5)$/i.test(name) ? 0.82 : side === "左侧" ? 0.42 : 0.12;
    return [name, side, 88 - (index % 5) * 2, relevance, mapX, mapY, brainX, 0.08, brainZ];
  }

  function createDeviceChannels(profileId) {
    const profile = profiles[profileId] || profiles["epoc-x"];
    return profile.channels.map((definition, index) => ({
      name: definition[0],
      side: definition[1],
      quality: definition[2],
      baseQuality: definition[2],
      relevance: definition[3],
      map: [definition[4], definition[5]],
      brain: [definition[6], definition[7], definition[8]],
      index,
      pinned: false,
    }));
  }

  function createDeviceChannelsFromNames(profileId, channelNames) {
    const profile = profiles[profileId] || profiles["epoc-x"];
    const definitions = new Map(profile.channels.map((definition) => [String(definition[0]).toUpperCase(), definition]));
    return channelNames.map((channelName, index) => {
      const definition = definitions.get(String(channelName).toUpperCase())
        || inferTenTwentyDefinition(channelName, index, channelNames.length);
      return {
        name: String(channelName),
        side: definition[1],
        quality: definition[2],
        baseQuality: definition[2],
        relevance: definition[3],
        map: [definition[4], definition[5]],
        brain: [definition[6], definition[7], definition[8]],
        index,
        pinned: false,
      };
    });
  }

  global.NEURO_DEVICE_PROFILES = profiles;
  global.createDeviceChannels = createDeviceChannels;
  global.createDeviceChannelsFromNames = createDeviceChannelsFromNames;
})(window);
