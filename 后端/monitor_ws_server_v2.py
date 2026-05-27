"""
设备监控 WebSocket 服务器 v2.0
支持前端按需订阅指标，减少数据传输
"""

import asyncio
import datetime
import json
import os
import platform
import socket
import subprocess
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Set

try:
    import psutil
except ImportError as exc:
    raise SystemExit("Missing dependency: psutil. Install with 'pip install psutil'.") from exc

try:
    import websockets
except ImportError as exc:
    raise SystemExit("Missing dependency: websockets. Install with 'pip install websockets'.") from exc

try:
    import GPUtil
    HAS_GPU = True
except ImportError:
    HAS_GPU = False

try:
    import pynvml
    HAS_NVML = True
except ImportError:
    HAS_NVML = False


# ============================================================================
# 配置
# ============================================================================

HOST = "0.0.0.0"
PORT = 8765


# ============================================================================
# 指标类别枚举
# ============================================================================

class MetricCategory(str, Enum):
    """可订阅的指标类别"""
    CPU = "cpu"
    RAM = "ram"
    GPU = "gpu"
    NETWORK = "network"
    DISK = "disk"
    BATTERY = "battery"
    SYSTEM = "system"


# ============================================================================
# 客户端订阅状态
# ============================================================================

@dataclass
class ClientSubscription:
    """客户端订阅配置"""
    websocket: object
    interval: float = 1.0
    categories: Set[str] = field(default_factory=lambda: {
        MetricCategory.CPU,
        MetricCategory.RAM,
        MetricCategory.GPU,
        MetricCategory.NETWORK,
        MetricCategory.DISK,
        MetricCategory.BATTERY,
        MetricCategory.SYSTEM
    })
    last_update: float = 0.0


# ============================================================================
# 全局状态
# ============================================================================

_clients: dict = {}  # websocket -> ClientSubscription
_clients_lock = asyncio.Lock()

# 网络速度计算状态
_prev_net_sent = 0
_prev_net_recv = 0
_prev_net_time = 0.0

# NVML 状态
_nvml_ready = False
_nvml_failed = False


# ============================================================================
# 初始化函数
# ============================================================================

def _init_net_counters() -> None:
    """初始化网络计数器"""
    global _prev_net_sent, _prev_net_recv, _prev_net_time
    try:
        net_init = psutil.net_io_counters()
        _prev_net_sent = net_init.bytes_sent
        _prev_net_recv = net_init.bytes_recv
        _prev_net_time = time.time()
    except Exception:
        _prev_net_sent = 0
        _prev_net_recv = 0
        _prev_net_time = time.time()


def _init_nvml() -> None:
    """初始化 NVML"""
    global _nvml_ready, _nvml_failed
    if not HAS_NVML or _nvml_ready or _nvml_failed:
        return
    try:
        pynvml.nvmlInit()
        _nvml_ready = True
    except Exception:
        _nvml_failed = True


# ============================================================================
# 数据采集函数
# ============================================================================

def _get_disk_root() -> str:
    """获取系统盘根目录"""
    if os.name == "nt":
        return os.path.splitdrive(os.path.abspath(os.sep))[0] + os.sep
    return "/"


def collect_static_info() -> dict:
    """采集静态系统信息（启动时调用一次）"""
    try:
        boot_time_timestamp = psutil.boot_time()
        boot_time = datetime.datetime.fromtimestamp(boot_time_timestamp)
        up_time_dur = datetime.datetime.now() - boot_time
        up_time = str(up_time_dur).split(".")[0]
    except Exception:
        up_time = "Unknown"
        boot_time = datetime.datetime.now()

    disk_root = _get_disk_root()
    try:
        disk = psutil.disk_usage(disk_root)
        disk_total_gb = round(disk.total / (1024 ** 3), 2)
    except Exception:
        disk_total_gb = 0.0

    # CPU 详细信息
    cpu_model = platform.processor() or "Unknown Processor"
    cpu_cores_physical = psutil.cpu_count(logical=False) or 0
    cpu_cores_logical = psutil.cpu_count(logical=True) or 0
    cpu_freq = psutil.cpu_freq()
    cpu_freq_max = f"{cpu_freq.max:.1f} MHz" if cpu_freq else "N/A"

    # 内存详细信息
    ram_total_gb = round(psutil.virtual_memory().total / (1024 ** 3), 2)

    # GPU 信息
    gpu_list = []
    if HAS_GPU:
        try:
            gpus = GPUtil.getGPUs()
            for gpu in gpus:
                gpu_list.append({
                    "id": gpu.id,
                    "name": gpu.name,
                    "memory_total_gb": round(gpu.memoryTotal / 1024, 2)
                })
        except Exception:
            pass

    # WMI GPU 信息（Windows）
    if platform.system() == "Windows":
        try:
            import wmi
            c = wmi.WMI()
            for gpu in c.Win32_VideoController():
                if gpu.AdapterRAM:
                    gpu_list.append({
                        "name": gpu.Name,
                        "memory_total_gb": round(int(gpu.AdapterRAM) / (1024 ** 3), 2) if gpu.AdapterRAM else 0,
                        "driver_version": gpu.DriverVersion
                    })
        except Exception:
            pass

    return {
        "os": f"{platform.system()} {platform.release()}",
        "hostname": socket.gethostname(),
        "cpu": {
            "model": cpu_model,
            "cores_physical": cpu_cores_physical,
            "cores_logical": cpu_cores_logical,
            "freq_max": cpu_freq_max
        },
        "ram": {
            "total_gb": ram_total_gb
        },
        "disk": {
            "total_gb": disk_total_gb
        },
        "gpu": gpu_list,
        "system": {
            "boot_time": boot_time.strftime("%Y-%m-%d %H:%M:%S"),
            "up_time": up_time,
            "python_version": platform.python_version()
        }
    }


def collect_cpu_metrics() -> dict:
    """采集 CPU 指标"""
    cpu_percent = psutil.cpu_percent(interval=None)
    
    # CPU 温度
    cpu_temp = None
    try:
        temps = psutil.sensors_temperatures()
        if temps:
            values = []
            for entries in temps.values():
                for entry in entries:
                    current = getattr(entry, "current", None)
                    if current is not None:
                        values.append(current)
            if values:
                cpu_temp = int(round(max(values)))
    except Exception:
        pass

    # CPU 频率
    cpu_freq = psutil.cpu_freq()
    cpu_freq_current = round(cpu_freq.current, 1) if cpu_freq else None

    return {
        "percent": round(cpu_percent, 1),
        "temp": cpu_temp,
        "freq_current_mhz": cpu_freq_current
    }


def collect_ram_metrics() -> dict:
    """采集内存指标"""
    vm = psutil.virtual_memory()
    return {
        "percent": round(vm.percent, 1),
        "used_gb": round(vm.used / (1024 ** 3), 2),
        "available_gb": round(vm.available / (1024 ** 3), 2),
        "total_gb": round(vm.total / (1024 ** 3), 2)
    }


def collect_gpu_metrics() -> Optional[dict]:
    """采集 GPU 指标"""
    # 尝试 NVML
    if HAS_NVML:
        _init_nvml()
        if _nvml_ready:
            try:
                handle = pynvml.nvmlDeviceGetHandleByIndex(0)
                util = pynvml.nvmlDeviceGetUtilizationRates(handle)
                mem = pynvml.nvmlDeviceGetMemoryInfo(handle)
                temp = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
                mem_percent = (mem.used / mem.total) * 100 if mem.total else 0.0
                return {
                    "load_percent": round(util.gpu, 1),
                    "temp": int(temp),
                    "memory": {
                        "used_gb": round(mem.used / (1024 ** 3), 2),
                        "total_gb": round(mem.total / (1024 ** 3), 2),
                        "percent": round(mem_percent, 1)
                    }
                }
            except Exception:
                pass

    # 尝试 nvidia-smi
    try:
        result = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total",
                "--format=csv,noheader,nounits"
            ],
            capture_output=True,
            text=True,
            timeout=1.5
        )
        if result.returncode == 0:
            line = result.stdout.strip().splitlines()[0].strip()
            if line:
                parts = [p.strip() for p in line.split(",")]
                if len(parts) >= 4:
                    util = float(parts[0])
                    temp = float(parts[1])
                    mem_used = float(parts[2])
                    mem_total = float(parts[3])
                    mem_percent = (mem_used / mem_total) * 100 if mem_total else 0.0
                    return {
                        "load_percent": round(util, 1),
                        "temp": int(temp),
                        "memory": {
                            "used_gb": round(mem_used / (1024 ** 3), 2),
                            "total_gb": round(mem_total / (1024 ** 3), 2),
                            "percent": round(mem_percent, 1)
                        }
                    }
    except Exception:
        pass

    # 尝试 GPUtil
    if HAS_GPU:
        try:
            gpus = GPUtil.getGPUs()
            if gpus:
                gpu = gpus[0]
                return {
                    "load_percent": round(gpu.load * 100, 1),
                    "temp": int(gpu.temperature),
                    "memory": {
                        "used_gb": round(gpu.memoryUsed / 1024, 2),
                        "total_gb": round(gpu.memoryTotal / 1024, 2),
                        "percent": round(gpu.memoryUtil * 100, 1)
                    }
                }
        except Exception:
            pass

    return None


def collect_network_metrics() -> dict:
    """采集网络指标"""
    global _prev_net_sent, _prev_net_recv, _prev_net_time

    net_sent_speed_kb = 0.0
    net_recv_speed_kb = 0.0
    total_sent_gb = 0.0
    total_recv_gb = 0.0

    try:
        curr_net = psutil.net_io_counters()
        curr_time = time.time()
        dt = curr_time - _prev_net_time if curr_time > _prev_net_time else 0.001

        sent_bytes = curr_net.bytes_sent - _prev_net_sent
        recv_bytes = curr_net.bytes_recv - _prev_net_recv

        if sent_bytes >= 0:
            net_sent_speed_kb = round((sent_bytes / 1024) / dt, 2)
        if recv_bytes >= 0:
            net_recv_speed_kb = round((recv_bytes / 1024) / dt, 2)

        total_sent_gb = round(curr_net.bytes_sent / (1024 ** 3), 2)
        total_recv_gb = round(curr_net.bytes_recv / (1024 ** 3), 2)

        _prev_net_sent = curr_net.bytes_sent
        _prev_net_recv = curr_net.bytes_recv
        _prev_net_time = curr_time
    except Exception:
        pass

    return {
        "speed": {
            "sent_kb": net_sent_speed_kb,
            "recv_kb": net_recv_speed_kb
        },
        "total": {
            "sent_gb": total_sent_gb,
            "recv_gb": total_recv_gb
        }
    }


def collect_disk_metrics() -> dict:
    """采集磁盘指标"""
    disk_root = _get_disk_root()
    try:
        disk = psutil.disk_usage(disk_root)
        return {
            "percent": round(disk.percent, 1),
            "used_gb": round(disk.used / (1024 ** 3), 2),
            "free_gb": round(disk.free / (1024 ** 3), 2),
            "total_gb": round(disk.total / (1024 ** 3), 2)
        }
    except Exception:
        return {
            "percent": 0,
            "used_gb": 0,
            "free_gb": 0,
            "total_gb": 0
        }


def collect_battery_metrics() -> Optional[dict]:
    """采集电池指标"""
    try:
        battery = psutil.sensors_battery()
        if battery:
            return {
                "percent": battery.percent,
                "power_plugged": battery.power_plugged,
                "secs_left": battery.secsleft if battery.secsleft not in (psutil.POWER_TIME_UNLIMITED, psutil.POWER_TIME_UNKNOWN) else None
            }
    except Exception:
        pass
    return None


def collect_system_metrics() -> dict:
    """采集系统指标"""
    try:
        boot_time_timestamp = psutil.boot_time()
        boot_time = datetime.datetime.fromtimestamp(boot_time_timestamp)
        up_time_dur = datetime.datetime.now() - boot_time
        up_time = str(up_time_dur).split(".")[0]
    except Exception:
        up_time = "Unknown"

    return {
        "up_time": up_time,
        "timestamp": datetime.datetime.now().isoformat()
    }


# ============================================================================
# 指标采集调度器
# ============================================================================

def collect_metrics(categories: Set[str]) -> dict:
    """根据订阅的类别采集指标"""
    result = {}

    if MetricCategory.CPU in categories:
        result["cpu"] = collect_cpu_metrics()

    if MetricCategory.RAM in categories:
        result["ram"] = collect_ram_metrics()

    if MetricCategory.GPU in categories:
        gpu_data = collect_gpu_metrics()
        if gpu_data:
            result["gpu"] = gpu_data

    if MetricCategory.NETWORK in categories:
        result["network"] = collect_network_metrics()

    if MetricCategory.DISK in categories:
        result["disk"] = collect_disk_metrics()

    if MetricCategory.BATTERY in categories:
        battery_data = collect_battery_metrics()
        if battery_data:
            result["battery"] = battery_data

    if MetricCategory.SYSTEM in categories:
        result["system"] = collect_system_metrics()

    return result


# ============================================================================
# 消息处理
# ============================================================================

async def handle_subscribe(client_ws, data: dict) -> dict:
    """处理订阅请求"""
    interval = max(0.1, min(60.0, float(data.get("interval", 1.0))))
    
    # 解析订阅的类别
    categories = set()
    requested = data.get("categories", [])
    
    if not requested:
        # 如果没有指定，订阅所有类别
        categories = set(MetricCategory)
    else:
        for cat in requested:
            try:
                categories.add(MetricCategory(cat))
            except ValueError:
                pass  # 忽略无效类别

    async with _clients_lock:
        _clients[client_ws] = ClientSubscription(
            websocket=client_ws,
            interval=interval,
            categories=categories
        )

    return {
        "type": "subscribed",
        "data": {
            "interval": interval,
            "categories": list(categories)
        }
    }


async def handle_unsubscribe(client_ws) -> dict:
    """处理取消订阅请求"""
    async with _clients_lock:
        if client_ws in _clients:
            del _clients[client_ws]
    
    return {
        "type": "unsubscribed",
        "data": {}
    }


async def handle_message(client_ws, raw_msg: str) -> Optional[dict]:
    """处理客户端消息"""
    try:
        msg = json.loads(raw_msg)
    except json.JSONDecodeError:
        return {"type": "error", "data": {"message": "Invalid JSON"}}

    msg_type = msg.get("type")

    if msg_type == "subscribe":
        return await handle_subscribe(client_ws, msg)
    elif msg_type == "unsubscribe":
        return await handle_unsubscribe(client_ws)
    elif msg_type == "get_static":
        return {"type": "static_info", "data": collect_static_info()}
    else:
        return {"type": "error", "data": {"message": f"Unknown message type: {msg_type}"}}


# ============================================================================
# WebSocket 连接处理
# ============================================================================

async def handle_client(websocket):
    """处理 WebSocket 客户端连接"""
    client_ip, client_port = websocket.remote_address[:2]
    print(f"[连接] {client_ip}:{client_port}")

    # 发送欢迎消息和静态信息
    try:
        await websocket.send(json.dumps({
            "type": "welcome",
            "data": {
                "version": "2.0",
                "supported_categories": [c.value for c in MetricCategory]
            }
        }, ensure_ascii=False))

        # 等待客户端订阅
        async for raw_msg in websocket:
            response = await handle_message(websocket, raw_msg)
            if response:
                await websocket.send(json.dumps(response, ensure_ascii=False))

    except websockets.exceptions.ConnectionClosedOK:
        print(f"[断开] {client_ip}:{client_port}")
    except websockets.exceptions.ConnectionClosedError:
        print(f"[丢失] {client_ip}:{client_port}")
    except Exception as exc:
        print(f"[错误] {client_ip}:{client_port}: {exc}")
    finally:
        async with _clients_lock:
            if websocket in _clients:
                del _clients[websocket]


async def metrics_broadcaster():
    """定时广播指标给所有订阅的客户端"""
    # 初始化 CPU 统计
    psutil.cpu_percent(interval=None)
    await asyncio.sleep(0.1)

    while True:
        await asyncio.sleep(0.05)  # 50ms 检查一次

        now = time.monotonic()
        
        async with _clients_lock:
            clients_snapshot = list(_clients.items())

        for ws, sub in clients_snapshot:
            # 检查是否到达更新时间
            if (now - sub.last_update) < sub.interval:
                continue

            try:
                # 采集指标
                metrics = collect_metrics(sub.categories)
                
                # 发送
                await ws.send(json.dumps({
                    "type": "metrics",
                    "data": metrics
                }, ensure_ascii=False))

                # 更新时间
                sub.last_update = now

            except websockets.exceptions.ConnectionClosed:
                async with _clients_lock:
                    if ws in _clients:
                        del _clients[ws]
            except Exception as exc:
                print(f"[广播错误] {exc}")


# ============================================================================
# 主函数
# ============================================================================

async def main() -> None:
    _init_net_counters()
    _init_nvml()

    print("=" * 50)
    print("  设备监控 WebSocket 服务器 v2.0")
    print("=" * 50)
    print(f"监听地址: ws://{HOST}:{PORT}")
    print(f"GPU 支持: {'NVML' if _nvml_ready else 'GPUtil' if HAS_GPU else 'nvidia-smi'}")
    print("按 Ctrl+C 停止服务器")
    print("=" * 50)

    # 启动 WebSocket 服务器和广播任务
    async with websockets.serve(handle_client, HOST, PORT, origins=None):
        await metrics_broadcaster()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n服务器已停止。")
