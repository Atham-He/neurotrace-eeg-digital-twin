(function exposeCortexClient(global) {
  "use strict";

  class CortexClient {
    constructor(options = {}) {
      this.url = options.url || "wss://localhost:6868";
      this.onStatus = options.onStatus || (() => {});
      this.onStream = options.onStream || (() => {});
      this.socket = null;
      this.nextId = 1;
      this.pending = new Map();
      this.streamColumns = new Map();
      this.clientId = "";
      this.clientSecret = "";
      this.cortexToken = "";
      this.sessionId = "";
      this.headset = null;
    }

    async connect() {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) return;

      this.onStatus("正在连接本机 Cortex 服务…");
      await new Promise((resolve, reject) => {
        let settled = false;
        const socket = new WebSocket(this.url);
        this.socket = socket;

        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            socket.close();
            reject(new Error("连接 Cortex 超时。请确认 EMOTIV Launcher 已启动。"));
          }
        }, 7000);

        socket.addEventListener("open", () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          this.onStatus("Cortex WebSocket 已连接");
          resolve();
        });

        socket.addEventListener("error", () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(
            new Error(
              "无法连接 wss://localhost:6868。请打开 EMOTIV Launcher，并确认 Cortex 本地证书已被系统信任。",
            ),
          );
        });

        socket.addEventListener("close", () => {
          this.onStatus("Cortex 连接已关闭", "warning");
          for (const request of this.pending.values()) {
            request.reject(new Error("Cortex 连接在请求完成前关闭"));
          }
          this.pending.clear();
        });

        socket.addEventListener("message", (event) => this.handleMessage(event));
      });
    }

    handleMessage(event) {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch (_error) {
        return;
      }

      if (message.id !== undefined && this.pending.has(message.id)) {
        const request = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          request.reject(new Error(message.error.message || `Cortex error ${message.error.code}`));
        } else {
          request.resolve(message.result);
        }
        return;
      }

      if (message.warning) {
        this.onStatus(message.warning.message || `Cortex warning ${message.warning.code}`, "warning");
      }

      const streamName = ["eeg", "eq", "dev", "mot"].find((name) => Array.isArray(message[name]));
      if (streamName) {
        this.onStream({
          name: streamName,
          values: message[streamName],
          columns: this.streamColumns.get(streamName) || [],
          time: message.time,
          sid: message.sid,
        });
      }
    }

    call(method, params) {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return Promise.reject(new Error("Cortex WebSocket 尚未连接"));
      }

      const id = this.nextId++;
      const payload = { id, jsonrpc: "2.0", method };
      if (params && Object.keys(params).length) payload.params = params;

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`${method} 请求超时`));
        }, 12000);

        this.pending.set(id, {
          resolve: (result) => {
            clearTimeout(timer);
            resolve(result);
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          },
        });

        this.socket.send(JSON.stringify(payload));
      });
    }

    async initialize({ clientId, clientSecret, headsetPattern, headsetLabel }) {
      this.clientId = clientId.trim();
      this.clientSecret = clientSecret.trim();
      const expectedLabel = headsetLabel || "EMOTIV EEG 设备";
      const expectedHeadset = new RegExp(headsetPattern || ".+", "i");
      if (!this.clientId || !this.clientSecret) {
        throw new Error("Client ID 和 Client Secret 均不能为空");
      }

      await this.connect();
      await this.call("getCortexInfo");

      this.onStatus("正在请求应用授权，请留意 EMOTIV Launcher…");
      const access = await this.call("requestAccess", {
        clientId: this.clientId,
        clientSecret: this.clientSecret,
      });

      if (!access.accessGranted) {
        throw new Error(access.message || "请在 EMOTIV Launcher 中批准该 Cortex 应用，然后重试");
      }

      this.onStatus(`应用已授权，正在查找 ${expectedLabel}…`);
      await this.call("controlDevice", { command: "refresh" }).catch(() => null);
      let headsets = await this.call("queryHeadsets");

      if (!headsets.length) {
        await this.wait(1800);
        headsets = await this.call("queryHeadsets");
      }

      const selectedHeadset = headsets.find((item) => expectedHeadset.test(item.id || ""));
      if (!selectedHeadset) {
        const discovered = headsets.map((item) => item.id).filter(Boolean).join("、");
        const suffix = discovered ? `当前只发现：${discovered}。` : "当前未发现已连接设备。";
        throw new Error(`未发现 ${expectedLabel}。请先在 EMOTIV Launcher 中连接正确型号。${suffix}`);
      }

      if (selectedHeadset.status !== "connected") {
        this.onStatus(`已发现 ${selectedHeadset.id}，正在连接…`);
        await this.call("controlDevice", { command: "connect", headset: selectedHeadset.id });
        this.headset = await this.waitForConnected(selectedHeadset.id);
      } else {
        this.headset = selectedHeadset;
      }

      this.onStatus("设备已连接，正在获取 Cortex token…");
      const auth = await this.call("authorize", {
        clientId: this.clientId,
        clientSecret: this.clientSecret,
      });
      this.cortexToken = auth.cortexToken;
      if (!this.cortexToken) throw new Error("Cortex 未返回有效 token");

      this.onStatus("正在建立活动会话…");
      const session = await this.call("createSession", {
        cortexToken: this.cortexToken,
        headset: this.headset.id,
        status: "active",
      });
      this.sessionId = session.id;

      this.onStatus("正在订阅 EEG、质量和设备数据流…");
      const subscription = await this.call("subscribe", {
        cortexToken: this.cortexToken,
        session: this.sessionId,
        streams: ["eeg", "eq", "dev"],
      });

      for (const stream of subscription.success || []) {
        this.streamColumns.set(stream.streamName, stream.cols || []);
      }

      const failed = subscription.failure || [];
      const eegFailed = failed.find((item) => item.streamName === "eeg");
      if (eegFailed) {
        throw new Error(
          `设备已连接，但原始 EEG 订阅失败：${eegFailed.message || eegFailed.code}。请检查 Developer API license。`,
        );
      }

      this.onStatus(`${this.headset.id} 已开始传输实时 EEG`, "success");
      return {
        headset: this.headset,
        sessionId: this.sessionId,
        streams: subscription.success || [],
      };
    }

    async waitForConnected(headsetId) {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        await this.wait(1000);
        const headsets = await this.call("queryHeadsets", { id: headsetId });
        const headset = headsets.find((item) => item.id === headsetId);
        if (headset && headset.status === "connected") return headset;
      }
      throw new Error(`连接 ${headsetId} 超时`);
    }

    wait(milliseconds) {
      return new Promise((resolve) => setTimeout(resolve, milliseconds));
    }

    async close() {
      if (this.sessionId && this.cortexToken && this.socket?.readyState === WebSocket.OPEN) {
        await this.call("updateSession", {
          cortexToken: this.cortexToken,
          session: this.sessionId,
          status: "close",
        }).catch(() => null);
      }
      this.socket?.close();
      this.sessionId = "";
      this.cortexToken = "";
    }
  }

  global.CortexClient = CortexClient;
})(window);
