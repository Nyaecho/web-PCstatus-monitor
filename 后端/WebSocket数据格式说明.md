# 设备监控 WebSocket 数据格式交换说明 v2.0

## 概述

本文档描述前端与后端 WebSocket 服务器之间的数据交换格式。

- **服务器地址**: `ws://localhost:8765`
- **协议版本**: 2.0
- **特点**: 支持前端按需订阅指标类别，减少不必要的数据传输

---

## 1. 连接流程

```
前端                          后端
  |                            |
  |--- 连接 WebSocket -------->|
  |<-- welcome (欢迎消息) ------|
  |                            |
  |--- subscribe (订阅) ------>|
  |<-- subscribed (确认) ------|
  |                            |
  |<-- metrics (定时推送) -----|
  |<-- metrics (定时推送) -----|
  |...                         |
```

---

## 2. 消息格式

所有消息均为 JSON 格式，包含两个字段：

```json
{
  "type": "消息类型",
  "data": { ... }
}
```

---

## 3. 后端 → 前端 消息

### 3.1 welcome (欢迎消息)

连接建立后自动发送，告知客户端服务器支持的功能。

```json
{
  "type": "welcome",
  "data": {
    "version": "2.0",
    "supported_categories": ["cpu", "ram", "gpu", "network", "disk", "battery", "system"]
  }
}
```

### 3.2 static_info (静态信息)

响应 `get_static` 请求时返回，包含不常变化的硬件信息。

```json
{
  "type": "static_info",
  "data": {
    "os": "Windows 11",
    "hostname": "Nyaecho_Laptop",
    "cpu": {
      "model": "AMD Ryzen 7 8845H w/ Radeon 780M Graphics",
      "cores_physical": 8,
      "cores_logical": 16,
      "freq_max": "3801.0 MHz"
    },
    "ram": {
      "total_gb": 23.29
    },
    "disk": {
      "total_gb": 1191.35
    },
    "gpu": [
      {
        "id": 0,
        "name": "NVIDIA GeForce RTX 4060 Laptop GPU",
        "memory_total_gb": 8.0
      }
    ],
    "system": {
      "boot_time": "2026-05-26 21:22:57",
      "up_time": "20:09:31",
      "python_version": "3.13.7"
    }
  }
}
```

### 3.3 subscribed (订阅确认)

响应 `subscribe` 请求时返回。

```json
{
  "type": "subscribed",
  "data": {
    "interval": 1.0,
    "categories": ["cpu", "ram", "gpu", "network", "disk", "battery", "system"]
  }
}
```

### 3.4 unsubscribed (取消订阅确认)

响应 `unsubscribe` 请求时返回。

```json
{
  "type": "unsubscribed",
  "data": {}
}
```

### 3.5 metrics (实时指标)

按订阅的频率定时推送，只包含订阅的类别数据。

```json
{
  "type": "metrics",
  "data": {
    "cpu": {
      "percent": 17.0,
      "temp": null,
      "freq_current_mhz": 3801.0
    },
    "ram": {
      "percent": 52.4,
      "used_gb": 12.2,
      "available_gb": 11.1,
      "total_gb": 23.29
    },
    "gpu": {
      "load_percent": 17.0,
      "temp": 43,
      "memory": {
        "used_gb": 1.3,
        "total_gb": 8.0,
        "percent": 16.26
      }
    },
    "network": {
      "speed": {
        "sent_kb": 12.5,
        "recv_kb": 45.2
      },
      "total": {
        "sent_gb": 0.12,
        "recv_gb": 1.16
      }
    },
    "disk": {
      "percent": 93.4,
      "used_gb": 112.1,
      "free_gb": 7.91,
      "total_gb": 120.01
    },
    "battery": {
      "percent": 98,
      "power_plugged": true,
      "secs_left": null
    },
    "system": {
      "up_time": "20:09:31",
      "timestamp": "2026-05-27T17:32:29.148599"
    }
  }
}
```

### 3.6 error (错误消息)

请求出错时返回。

```json
{
  "type": "error",
  "data": {
    "message": "错误描述"
  }
}
```

---

## 4. 前端 → 后端 消息

### 4.1 subscribe (订阅)

订阅指定类别的实时指标。

```json
{
  "type": "subscribe",
  "interval": 1.0,
  "categories": ["cpu", "ram", "gpu"]
}
```

**参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `interval` | float | 否 | 更新频率，单位秒，默认 1.0，范围 0.1-60.0 |
| `categories` | string[] | 否 | 订阅的指标类别数组，为空或不传则订阅所有类别 |

**可选的 categories 值**:

| 值 | 说明 |
|------|------|
| `cpu` | CPU 占用率、温度、频率 |
| `ram` | 内存使用情况 |
| `gpu` | GPU 负载、温度、显存（需要 NVIDIA GPU） |
| `network` | 网络速度、流量统计 |
| `disk` | 系统盘使用情况 |
| `battery` | 电池电量、充电状态 |
| `system` | 系统运行时间、时间戳 |

### 4.2 unsubscribe (取消订阅)

取消订阅，服务器将停止推送指标。

```json
{
  "type": "unsubscribe"
}
```

### 4.3 get_static (获取静态信息)

请求获取静态硬件信息（通常在连接后调用一次）。

```json
{
  "type": "get_static"
}
```

---

## 5. 数据字段详细说明

### 5.1 CPU 指标

| 字段 | 类型 | 说明 |
|------|------|------|
| `cpu.percent` | float | CPU 总占用率 (0-100) |
| `cpu.temp` | int\|null | CPU 温度 (°C)，Windows 上可能为 null |
| `cpu.freq_current_mhz` | float\|null | 当前频率 (MHz) |

### 5.2 内存指标

| 字段 | 类型 | 说明 |
|------|------|------|
| `ram.percent` | float | 内存使用率 (0-100) |
| `ram.used_gb` | float | 已用内存 (GB) |
| `ram.available_gb` | float | 可用内存 (GB) |
| `ram.total_gb` | float | 总内存 (GB) |

### 5.3 GPU 指标

| 字段 | 类型 | 说明 |
|------|------|------|
| `gpu.load_percent` | float | GPU 负载 (0-100) |
| `gpu.temp` | int | GPU 温度 (°C) |
| `gpu.memory.used_gb` | float | 显存已用 (GB) |
| `gpu.memory.total_gb` | float | 显存总量 (GB) |
| `gpu.memory.percent` | float | 显存使用率 (0-100) |

**注意**: GPU 数据仅在检测到 NVIDIA GPU 时返回。如果没有 GPU，`metrics` 中将不包含 `gpu` 字段。

### 5.4 网络指标

| 字段 | 类型 | 说明 |
|------|------|------|
| `network.speed.sent_kb` | float | 上传速度 (KB/s) |
| `network.speed.recv_kb` | float | 下载速度 (KB/s) |
| `network.total.sent_gb` | float | 总上传流量 (GB) |
| `network.total.recv_gb` | float | 总下载流量 (GB) |

### 5.5 磁盘指标

| 字段 | 类型 | 说明 |
|------|------|------|
| `disk.percent` | float | 系统盘使用率 (0-100) |
| `disk.used_gb` | float | 已用空间 (GB) |
| `disk.free_gb` | float | 可用空间 (GB) |
| `disk.total_gb` | float | 总空间 (GB) |

### 5.6 电池指标

| 字段 | 类型 | 说明 |
|------|------|------|
| `battery.percent` | int | 电量百分比 (0-100) |
| `battery.power_plugged` | bool | 是否正在充电 |
| `battery.secs_left` | int\|null | 剩余时间 (秒)，充电中或未知时为 null |

**注意**: 台式机可能没有电池数据，`metrics` 中将不包含 `battery` 字段。

### 5.7 系统指标

| 字段 | 类型 | 说明 |
|------|------|------|
| `system.up_time` | string | 系统运行时间 (格式: "HH:MM:SS") |
| `system.timestamp` | string | 当前时间 (ISO 8601 格式) |

---

## 6. 前端使用示例

### 6.1 JavaScript 连接示例

```javascript
class DeviceMonitor {
  constructor(url = 'ws://localhost:8765') {
    this.url = url;
    this.ws = null;
    this.callbacks = {};
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('已连接到监控服务器');
      this.emit('connected');
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this.emit(msg.type, msg.data);
    };

    this.ws.onclose = () => {
      console.log('连接已断开');
      this.emit('disconnected');
    };
  }

  // 订阅指标
  subscribe(categories = [], interval = 1.0) {
    this.send({
      type: 'subscribe',
      interval: interval,
      categories: categories
    });
  }

  // 取消订阅
  unsubscribe() {
    this.send({ type: 'unsubscribe' });
  }

  // 获取静态信息
  getStaticInfo() {
    this.send({ type: 'get_static' });
  }

  // 发送消息
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  // 事件监听
  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  // 触发事件
  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => cb(data));
    }
  }
}

// 使用示例
const monitor = new DeviceMonitor();

monitor.on('welcome', (data) => {
  console.log('服务器版本:', data.version);
  monitor.getStaticInfo();
  monitor.subscribe(['cpu', 'ram', 'gpu'], 1.0);
});

monitor.on('static_info', (data) => {
  console.log('系统信息:', data);
});

monitor.on('metrics', (data) => {
  console.log('CPU:', data.cpu.percent + '%');
  console.log('内存:', data.ram.percent + '%');
  if (data.gpu) {
    console.log('GPU:', data.gpu.load_percent + '%');
  }
});

monitor.connect();
```

### 6.2 仅监控 CPU 和内存 (每 0.5 秒更新)

```javascript
monitor.subscribe(['cpu', 'ram'], 0.5);
```

### 6.3 监控所有指标 (每 2 秒更新)

```javascript
monitor.subscribe([], 2.0);  // 空数组表示订阅所有类别
```

---

## 7. 性能优化建议

1. **按需订阅**: 只订阅需要的指标类别，减少数据传输
2. **合理设置频率**: 
   - 仪表盘显示: 1-2 秒
   - 实时图表: 0.5-1 秒
   - 精细监控: 0.1-0.5 秒
3. **使用 `get_static`**: 静态信息只需获取一次，不要定时请求
4. **处理 null 值**: 某些指标（如 CPU 温度、GPU）可能为 null，前端需做兼容处理

---

## 8. 错误处理

| 情况 | 处理方式 |
|------|----------|
| 无效 JSON | 返回 error 消息 |
| 未知消息类型 | 返回 error 消息 |
| 无效的 category | 忽略，不报错 |
| interval 超出范围 | 自动修正到 0.1-60.0 |
| GPU 不可用 | metrics 中不包含 gpu 字段 |
| 电池不存在 | metrics 中不包含 battery 字段 |

---

## 9. 变更记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 2.0 | 2026-05-27 | 重构为按需订阅模式，支持多类别订阅 |
| 1.0 | - | 初始版本，固定推送所有指标 |
