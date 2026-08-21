(function exposeGenericDeviceClient(global) {
  "use strict";

  class GenericDeviceClient {
    constructor(options = {}) {
      this.onStatus = options.onStatus || (() => {});
      this.onStream = options.onStream || (() => {});
      this.socket = null;
    }

    connect(endpoint, profile) {
      if (!/^wss?:\/\//i.test(endpoint)) {
        return Promise.reject(new Error("Bridge 地址必须以 ws:// 或 wss:// 开头"));
      }

      return new Promise((resolve, reject) => {
        this.onStatus(`正在连接 ${endpoint}…`);
        let settled = false;
        const socket = new WebSocket(endpoint);
        this.socket = socket;
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true;
          socket.close();
          reject(new Error("通用设备 Bridge 连接超时"));
        }, 7000);

        socket.addEventListener("open", () => {
          clearTimeout(timer);
          settled = true;
          socket.send(JSON.stringify({
            action: "subscribe",
            streams: ["eeg", "quality", "device"],
            profile: profile.id,
            channels: profile.channels.map((item) => item[0]),
          }));
          this.onStatus(`${profile.name} Bridge 已连接`, "success");
          resolve({ profile, endpoint });
        });

        socket.addEventListener("message", (event) => this.handleMessage(event));
        socket.addEventListener("error", () => {
          if (!settled) {
            clearTimeout(timer);
            settled = true;
            reject(new Error("无法连接设备 Bridge，请检查采集服务和 WebSocket 地址"));
          } else {
            this.onStatus("设备 Bridge 发生连接错误", "error");
          }
        });
        socket.addEventListener("close", () => this.onStatus("设备 Bridge 已断开", "warning"));
      });
    }

    handleMessage(event) {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch (_error) {
        this.onStatus("Bridge 返回了无法解析的 JSON", "warning");
        return;
      }

      if (message.type === "eeg" || message.stream === "eeg") {
        this.onStream(normalizeStream("eeg", message));
      } else if (["quality", "eq", "cq"].includes(message.type || message.stream)) {
        this.onStream(normalizeStream("quality", message));
      } else if (message.type === "device" || message.stream === "device") {
        this.onStream(normalizeStream("device", message));
      } else if (message.type === "status" && message.message) {
        this.onStatus(message.message, message.level);
      }
    }

    close() {
      this.socket?.close();
      this.socket = null;
    }
  }

  function normalizeStream(name, message) {
    if (message.channels && !Array.isArray(message.channels)) {
      return {
        name,
        valuesByChannel: message.channels,
        time: message.timestamp || message.time || performance.now() / 1000,
        meta: message.meta || {},
      };
    }
    const columns = message.columns || message.cols || [];
    const values = message.values || message.data || [];
    return {
      name,
      valuesByChannel: Object.fromEntries(columns.map((column, index) => [column, values[index]])),
      time: message.timestamp || message.time || performance.now() / 1000,
      meta: message.meta || {},
    };
  }

  global.GenericDeviceClient = GenericDeviceClient;
})(window);
