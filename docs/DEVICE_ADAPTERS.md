# 多 EEG 设备兼容层

> 目标：让页面、动态通道选择、时间轴和脑模型不依赖某一个厂商的数据格式。

## 1. 架构

```text
厂商设备 / 采集软件
        ↓
设备 Adapter
        ↓
统一 EEG / quality / device 消息
        ↓
统一通道模型
        ↓
优秀质量门控 → 动态波形 → 算法 → 脑区可视化
```

界面只读取统一字段：

- 通道名；
- EEG 数值；
- 采样时间戳；
- 0–100 的质量值；
- 采样率、连接、电池和无线状态；
- 通道在头皮图和三维脑表面的显示位置。

## 2. 当前兼容状态

| 设备/Profile | 通道布局 | 接入方式 | 当前状态 |
|---|---|---|---|
| EMOTIV EPOC X | 固定 14 通道 | Cortex `wss://localhost:6868` | 真实连接客户端已实现 |
| EMOTIV Flex 2 | 最多 32 通道、位置可配置；Demo 为示例 10–20 montage | Cortex `wss://localhost:6868` | Profile、型号筛选及 Cortex 实际 montage 重建已实现 |
| InteraXon Muse 2 | TP9、AF7、AF8、TP10 | 统一 WebSocket Bridge | Profile 与实时 Bridge 客户端已实现 |
| OpenBCI Cyton | 默认 8 通道 10–20 示例，可修改 | 统一 WebSocket Bridge | Profile 与实时 Bridge 客户端已实现 |
| OpenBCI Ganglion | 默认 4 通道示例，可修改 | 统一 WebSocket Bridge | Profile 与实时 Bridge 客户端已实现 |
| 通用 10–20 | 默认 16 通道 | 统一 WebSocket Bridge | Profile 与实时 Bridge 客户端已实现 |

“Profile 已实现”表示页面能够正确切换通道、电极位置、采样率、质量筛选和脑表面电极，不表示浏览器已经内置该厂商的 USB/Bluetooth 驱动。非 Cortex 设备由本机采集程序、BrainFlow 或 LSL Bridge 转为统一 WebSocket 消息。

## 3. 统一 Bridge 协议

默认地址：

```text
ws://localhost:8765
```

连接后，页面发送订阅请求：

```json
{
  "action": "subscribe",
  "streams": ["eeg", "quality", "device"],
  "profile": "openbci-cyton",
  "channels": ["Fp1", "Fp2", "C3", "C4", "P7", "P8", "O1", "O2"]
}
```

Bridge 可以按对象格式发送 EEG：

```json
{
  "type": "eeg",
  "timestamp": 1724231000.125,
  "channels": {
    "Fp1": 12.4,
    "Fp2": 9.8,
    "C3": -4.1,
    "C4": -3.7
  }
}
```

也可以按列数组格式发送：

```json
{
  "stream": "eeg",
  "time": 1724231000.125,
  "columns": ["Fp1", "Fp2", "C3", "C4"],
  "values": [12.4, 9.8, -4.1, -3.7]
}
```

质量数据统一为 0–100：

```json
{
  "type": "quality",
  "timestamp": 1724231000.5,
  "channels": {
    "Fp1": 94,
    "Fp2": 88,
    "C3": 67,
    "C4": 31
  }
}
```

设备状态：

```json
{
  "type": "device",
  "timestamp": 1724231000.5,
  "meta": {
    "battery": 82,
    "signal": 91,
    "samplingRate": 250
  }
}
```

## 4. 通道质量门控

主波形区执行硬门控：

| 质量值 | 页面行为 | 下游行为 |
|---|---|---|
| `≥ 85` | 允许进入左侧主波形区 | 可以参与事件相关度排序和模型输入 |
| `45–84` | 不进入主波形区，只在质量详情/电极图显示 | 默认不作为主证据通道 |
| `< 45` | 标记为较差 | 不参与脑区推测 |

事件相关度不能把质量不足的通道“救回”主视图。先通过质量门控，再在优秀通道中按事件相关度排序。

## 5. Device Profile 字段

每个设备 Profile 包含：

```text
id
name / shortName
connector: cortex | bridge
samplingRate
reference
qualitySource
channels[]:
  name
  side
  demoQuality
  eventRelevance
  sensorMapPosition
  brainSurfacePosition
```

当前 Profile 定义位于 [device-profiles.js](./app/device-profiles.js)，统一 Bridge 客户端位于 [generic-device-client.js](./app/generic-device-client.js)。

## 6. 新增设备流程

1. 在 `device-profiles.js` 增加设备、采样率、参考和通道布局；
2. 将厂商 SDK、BrainFlow 或 LSL 输出转为统一 Bridge 协议；
3. 明确质量值来源，不能用随机或未知含义的数值；
4. 验证通道名、单位、时间戳和头皮位置；
5. 验证质量阈值在该设备上的含义；
6. 进行断连、缺包、重连和质量下降测试；
7. 通过后才允许该设备的通道参与脑区映射。

## 7. 关键限制

- 不同设备的厂商质量分不一定可直接比较，Adapter 必须完成归一化和设备级验证；
- 采样率、参考、通道布局和带宽变化可能要求模型重新训练或校准；
- “界面兼容”不等于“算法已经在该设备上验证”；
- 新设备必须独立验证事件检测性能和脑区映射性能，不能沿用 EPOC X 的结果。
