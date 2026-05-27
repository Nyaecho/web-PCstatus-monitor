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

# 日志开关：True 显示详细日志，False 只显示基本连接信息
VERBOSE_LOG = True


# ============================================================================
# 控制台颜色
# ============================================================================

class LogColors:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    MAGENTA = "\033[95m"
    CYAN = "\033[96m"
    WHITE = "\033[97m"


def log_recv(client: str, msg_type: str, data: dict):
    if not VERBOSE_LOG:
        return
    
    timestamp = datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]
    type_colors = {
        "subscribe": LogColors.GREEN,
        "unsubscribe": LogColors.YELLOW,
        "get_static": LogColors.CYAN,
    }
    color = type_colors.get(msg_type, LogColors.WHITE)
    
    print(f"{LogColors.DIM}[{timestamp}]{LogColors.RESET} "
          f"{LogColors.BLUE}← 收到{LogColors.RESET} "
          f"{LogColors.BOLD}[{client}]{LogColors.RESET} "
          f"{color}{msg_type}{LogColors.RESET}")
    
    data_str = json.dumps(data, ensure_ascii=False, indent=2)
    for line in data_str.split('\n'):
        print(f"           {LogColors.DIM}{line}{LogColors.RESET}")


def log_send(client: str, msg_type: str, data: dict = None, data_summary: str = None):
    if not VERBOSE_LOG:
        return
    
    timestamp = datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]
    type_colors = {
        "welcome": LogColors.MAGENTA,
        "subscribed": LogColors.GREEN,
        "unsubscribed": LogColors.YELLOW,
        "static_info": LogColors.CYAN,
        "metrics": LogColors.WHITE,
        "error": LogColors.RED,
    }
    color = type_colors.get(msg_type, LogColors.WHITE)
    
    summary = data_summary or ""
    print(f"{LogColors.DIM}[{timestamp}]{LogColors.RESET} "
          f"{LogColors.GREEN}→ 发送{LogColors.RESET} "
          f"{LogColors.BOLD}[{client}]{LogColors.RESET} "
          f"{color}{msg_type}{LogColors.RESET} "
          f"{LogColors.DIM}{summary}{LogColors.RESET}")
    
    if msg_type == "metrics" and data:
        metrics_summary = format_metrics_summary(data)
        print(f"           {LogColors.DIM}{metrics_summary}{LogColors.RESET}")
    elif data and msg_type != "metrics":
        data_str = json.dumps(data, ensure_ascii=False, indent=2)
        for line in data_str.split('\n'):
            print(f"           {LogColors.DIM}{line}{LogColors.RESET}")


def log_event(event_type: str, message: str):
    """打印事件日志（始终显示）"""
    timestamp = datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]
    event_colors = {
        "连接": LogColors.GREEN,
        "断开": LogColors.YELLOW,
        "丢失": LogColors.RED,
        "错误": LogColors.RED,
        "订阅": LogColors.GREEN,
        "跳过": LogColors.YELLOW,
        "启动": LogColors.MAGENTA,
        "停止": LogColors.RED,
        "任务": LogColors.BLUE,
    }
    color = event_colors.get(event_type, LogColors.WHITE)
    
    print(f"{LogColors.DIM}[{timestamp}]{LogColors.RESET} "
          f"{color}● {event_type}{LogColors.RESET} "
          f"{message}")


def format_metrics_summary(data: dict) -> str:
    parts = []
    if "cpu" in data:
        parts.append(f"CPU:{data['cpu'].get('percent', 0)}%")
    if "ram" in data:
        parts.append(f"RAM:{data['ram'].get('percent', 0)}%")
    if "gpu" in data:
        parts.append(f"GPU:{data['gpu'].get('load_percent', 0)}%")
    if "network" in data:
        net = data["network"]["speed"]
        parts.append(f"NET:↑{net.get('sent_kb', 0)}KB/s ↓{net.get('recv_kb', 0)}KB/s")
    if "disk" in data:
        parts.append(f"DISK:{data['disk'].get('percent', 0)}%")
    if "battery" in data:
        bat = data["battery"]
        status = "充电" if bat.get("power_plugged") else "放电"
        parts.append(f"BAT:{bat.get('percent', 0)}%{status}")
    return " | ".join(parts)


# ============================================================================
# 指标类别枚举
# ============================================================================

class MetricCategory(str, Enum):
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
    websocket: object
    client_id: str = ""
    interval: float = 1.0
    categories: Set[str] = field(default_factory=lambda: set(MetricCategory))
    task: Optional[asyncio.Task] = None


# ============================================================================
# 全局状态
# ============================================================================

_clients: dict = {}  # websocket -> ClientSubscription
_clients_lock = asyncio.Lock()

_prev_net_sent = 0
_prev_net_recv = 0
_prev_net_time = 0.0

_nvml_ready = False
_nvml_failed = False


# ============================================================================
# 初始化函数
# ============================================================================

def _init_net_counters() -> None:
    global _prev_net_sent, _prev_net_recv, _prev_net_time
    try:
        net_init = psutil.net_io_counters()
        _prev_net_sent = net_init.bytes_sent
        _prev_net_recv = net_init.bytes_recv
        _prev_net_time = time.monotonic()
    except Exception:
        _prev_net_sent = 0
        _prev_net_recv = 0
        _prev_net_time = time.monotonic()


def _init_nvml() -> None:
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
    if os.name == "nt":
        return os.path.splitdrive(os.path.abspath(os.sep))[0] + os.sep
    return "/"


def collect_static_info() -> dict:
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

    cpu_model = platform.processor() or "Unknown Processor"
    cpu_cores_physical = psutil.cpu_count(logical=False) or 0
    cpu_cores_logical = psutil.cpu_count(logical=True) or 0
    cpu_freq = psutil.cpu_freq()
    cpu_freq_max = f"{cpu_freq.max:.1f} MHz" if cpu_freq else "N/A"
    ram_total_gb = round(psutil.virtual_memory().total / (1024 ** 3), 2)

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
        "ram": {"total_gb": ram_total_gb},
        "disk": {"total_gb": disk_total_gb},
        "gpu": gpu_list,
        "system": {
            "boot_time": boot_time.strftime("%Y-%m-%d %H:%M:%S"),
            "up_time": up_time,
            "python_version": platform.python_version()
        }
    }


def collect_cpu_metrics() -> dict:
    cpu_percent = psutil.cpu_percent(interval=None)
    cpu_temp = 0
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

    cpu_freq = psutil.cpu_freq()
    cpu_freq_current = round(cpu_freq.current, 1) if cpu_freq else 0

    return {
        "percent": round(cpu_percent, 1),
        "temp": cpu_temp,
        "freq_current_mhz": cpu_freq_current
    }


def collect_ram_metrics() -> dict:
    vm = psutil.virtual_memory()
    return {
        "percent": round(vm.percent, 1),
        "used_gb": round(vm.used / (1024 ** 3), 2),
        "available_gb": round(vm.available / (1024 ** 3), 2),
        "total_gb": round(vm.total / (1024 ** 3), 2)
    }


def collect_gpu_metrics() -> dict:
    if HAS_NVML:
        _init_nvml()
        if _nvml_ready:
            try:
                handle = pynvml.nvmlDeviceGetHandleByIndex(0)
                util = pynvml.nvmlDeviceGetUtilizationRates(handle)
                mem = pynvml.nvmlDeviceGetMemoryInfo(handle)
                temp = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
                mem_percent = (mem.used / mem.total) * 100 if mem.total else 0.0
                
                # 获取 GPU 频率
                try:
                    graphics_clock = pynvml.nvmlDeviceGetClockInfo(handle, pynvml.NVML_CLOCK_GRAPHICS)
                    mem_clock = pynvml.nvmlDeviceGetClockInfo(handle, pynvml.NVML_CLOCK_MEM)
                except:
                    graphics_clock = 0
                    mem_clock = 0
                
                return {
                    "load_percent": round(util.gpu, 1),
                    "temp": int(temp),
                    "freq_mhz": int(graphics_clock),
                    "mem_freq_mhz": int(mem_clock),
                    "memory": {
                        "used_gb": round(mem.used / (1024 ** 3), 2),
                        "total_gb": round(mem.total / (1024 ** 3), 2),
                        "percent": round(mem_percent, 1)
                    }
                }
            except Exception:
                pass

    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=utilization.gpu,temperature.gpu,memory.used,memory.total,clocks.current.graphics,clocks.current.memory", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=1.5
        )
        if result.returncode == 0:
            line = result.stdout.strip().splitlines()[0].strip()
            if line:
                parts = [p.strip() for p in line.split(",")]
                if len(parts) >= 6:
                    util, temp, mem_used, mem_total, gpu_clock, mem_clock = float(parts[0]), float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4]), float(parts[5])
                    mem_percent = (mem_used / mem_total) * 100 if mem_total else 0.0
                    return {
                        "load_percent": round(util, 1),
                        "temp": int(temp),
                        "freq_mhz": int(gpu_clock),
                        "mem_freq_mhz": int(mem_clock),
                        "memory": {
                            "used_gb": round(mem_used / (1024 ** 3), 2),
                            "total_gb": round(mem_total / (1024 ** 3), 2),
                            "percent": round(mem_percent, 1)
                        }
                    }
    except Exception:
        pass

    if HAS_GPU:
        try:
            gpus = GPUtil.getGPUs()
            if gpus:
                gpu = gpus[0]
                return {
                    "load_percent": round(gpu.load * 100, 1),
                    "temp": int(gpu.temperature),
                    "freq_mhz": 0,
                    "mem_freq_mhz": 0,
                    "memory": {
                        "used_gb": round(gpu.memoryUsed / 1024, 2),
                        "total_gb": round(gpu.memoryTotal / 1024, 2),
                        "percent": round(gpu.memoryUtil * 100, 1)
                    }
                }
        except Exception:
            pass

    return {
        "load_percent": 0,
        "temp": 0,
        "freq_mhz": 0,
        "mem_freq_mhz": 0,
        "memory": {
            "used_gb": 0,
            "total_gb": 0,
            "percent": 0
        }
    }


def collect_network_metrics() -> dict:
    global _prev_net_sent, _prev_net_recv, _prev_net_time

    net_sent_speed_kb = 0.0
    net_recv_speed_kb = 0.0
    total_sent_gb = 0.0
    total_recv_gb = 0.0

    try:
        curr_net = psutil.net_io_counters()
        curr_time = time.monotonic()
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
        "speed": {"sent_kb": net_sent_speed_kb, "recv_kb": net_recv_speed_kb},
        "total": {"sent_gb": total_sent_gb, "recv_gb": total_recv_gb}
    }


def collect_disk_metrics() -> dict:
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
        return {"percent": 0, "used_gb": 0, "free_gb": 0, "total_gb": 0}


def collect_battery_metrics() -> dict:
    try:
        battery = psutil.sensors_battery()
        if battery:
            return {
                "percent": battery.percent,
                "power_plugged": battery.power_plugged,
                "secs_left": battery.secsleft if battery.secsleft not in (psutil.POWER_TIME_UNLIMITED, psutil.POWER_TIME_UNKNOWN) else 0
            }
    except Exception:
        pass
    return {
        "percent": 0,
        "power_plugged": False,
        "secs_left": 0
    }


def collect_system_metrics() -> dict:
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


def collect_metrics(categories: Set[str]) -> dict:
    result = {}
    if MetricCategory.CPU in categories:
        result["cpu"] = collect_cpu_metrics()
    if MetricCategory.RAM in categories:
        result["ram"] = collect_ram_metrics()
    if MetricCategory.GPU in categories:
        result["gpu"] = collect_gpu_metrics()
    if MetricCategory.NETWORK in categories:
        result["network"] = collect_network_metrics()
    if MetricCategory.DISK in categories:
        result["disk"] = collect_disk_metrics()
    if MetricCategory.BATTERY in categories:
        result["battery"] = collect_battery_metrics()
    if MetricCategory.SYSTEM in categories:
        result["system"] = collect_system_metrics()
    return result


# ============================================================================
# 客户端推送任务
# ============================================================================

async def client_push_task(sub: ClientSubscription):
    """单个客户端的独立推送任务"""
    log_event("任务", f"{sub.client_id} 推送任务启动 (间隔 {sub.interval}s)")
    
    try:
        # 首次立即发送
        metrics = collect_metrics(sub.categories)
        msg = {"type": "metrics", "data": metrics}
        await sub.websocket.send(json.dumps(msg, ensure_ascii=False))
        log_send(sub.client_id, "metrics", metrics)

        # 循环等待并发送
        while True:
            await asyncio.sleep(sub.interval)
            
            # 检查任务是否被取消
            if asyncio.current_task().cancelled():
                break
            
            metrics = collect_metrics(sub.categories)
            msg = {"type": "metrics", "data": metrics}
            await sub.websocket.send(json.dumps(msg, ensure_ascii=False))
            log_send(sub.client_id, "metrics", metrics)

    except asyncio.CancelledError:
        log_event("任务", f"{sub.client_id} 推送任务被取消")
    except websockets.exceptions.ConnectionClosed:
        log_event("丢失", f"{sub.client_id} 连接已断开")
    except Exception as exc:
        log_event("错误", f"{sub.client_id} 推送任务出错: {exc}")
    finally:
        log_event("任务", f"{sub.client_id} 推送任务结束")


# ============================================================================
# 消息处理
# ============================================================================

async def handle_subscribe(client_ws, client_id: str, data: dict) -> dict:
    interval = max(0.1, min(60.0, float(data.get("interval", 1.0))))
    
    categories = set()
    requested = data.get("categories", [])
    
    if not requested:
        categories = set(MetricCategory)
    else:
        for cat in requested:
            try:
                categories.add(MetricCategory(cat))
            except ValueError:
                pass

    # 检查是否已有相同的订阅配置
    async with _clients_lock:
        if client_ws in _clients:
            old_sub = _clients[client_ws]
            # 如果配置相同且任务正在运行，直接返回成功
            if (old_sub.interval == interval and 
                old_sub.categories == categories and 
                old_sub.task is not None and 
                not old_sub.task.done()):
                log_event("跳过", f"{client_id} 订阅配置未变化，跳过重建")
                return {
                    "type": "subscribed",
                    "data": {
                        "interval": interval,
                        "categories": list(categories)
                    }
                }
            # 配置不同，取消旧任务
            if old_sub.task and not old_sub.task.done():
                log_event("任务", f"{client_id} 配置变化，取消旧任务")
                old_sub.task.cancel()

    # 创建新的订阅
    sub = ClientSubscription(
        websocket=client_ws,
        client_id=client_id,
        interval=interval,
        categories=categories
    )

    # 添加到客户端列表
    async with _clients_lock:
        _clients[client_ws] = sub

    # 启动独立的推送任务
    sub.task = asyncio.create_task(client_push_task(sub))

    log_event("订阅", f"{client_id} 订阅了 {len(categories)} 个类别, 间隔 {interval}s")
    
    return {
        "type": "subscribed",
        "data": {
            "interval": interval,
            "categories": list(categories)
        }
    }


async def handle_unsubscribe(client_ws, client_id: str) -> dict:
    async with _clients_lock:
        if client_ws in _clients:
            sub = _clients[client_ws]
            if sub.task and not sub.task.done():
                sub.task.cancel()
            sub = _clients[client_ws]
            # 取消推送任务
            if sub.task and not sub.task.done():
                sub.task.cancel()
            del _clients[client_ws]
    
    log_event("取消", f"{client_id} 取消了订阅")
    
    return {"type": "unsubscribed", "data": {}}


async def handle_message(client_ws, client_id: str, raw_msg: str) -> Optional[dict]:
    try:
        msg = json.loads(raw_msg)
    except json.JSONDecodeError:
        log_event("错误", f"{client_id} 发送了无效的 JSON")
        return {"type": "error", "data": {"message": "Invalid JSON"}}

    msg_type = msg.get("type", "unknown")
    log_recv(client_id, msg_type, msg)

    if msg_type == "subscribe":
        response = await handle_subscribe(client_ws, client_id, msg)
    elif msg_type == "unsubscribe":
        response = await handle_unsubscribe(client_ws, client_id)
    elif msg_type == "get_static":
        response = {"type": "static_info", "data": collect_static_info()}
    else:
        log_event("错误", f"{client_id} 发送了未知消息类型: {msg_type}")
        response = {"type": "error", "data": {"message": f"Unknown message type: {msg_type}"}}

    log_send(client_id, response["type"], response.get("data"))
    return response


# ============================================================================
# WebSocket 连接处理
# ============================================================================

async def handle_client(websocket):
    client_ip, client_port = websocket.remote_address[:2]
    client_id = f"{client_ip}:{client_port}"
    
    log_event("连接", f"{client_id} 已连接")

    welcome_msg = {
        "type": "welcome",
        "data": {
            "version": "2.0",
            "supported_categories": [c.value for c in MetricCategory]
        }
    }
    await websocket.send(json.dumps(welcome_msg, ensure_ascii=False))
    log_send(client_id, "welcome", welcome_msg["data"])

    try:
        async for raw_msg in websocket:
            response = await handle_message(websocket, client_id, raw_msg)
            if response:
                await websocket.send(json.dumps(response, ensure_ascii=False))
    except websockets.exceptions.ConnectionClosedOK:
        log_event("断开", f"{client_id} 正常断开连接")
    except websockets.exceptions.ConnectionClosedError as e:
        log_event("丢失", f"{client_id} 连接异常断开: {e}")
    except Exception as exc:
        log_event("错误", f"{client_id} 发生错误: {exc}")
    finally:
        # 清理：取消推送任务并移除订阅
        async with _clients_lock:
            if websocket in _clients:
                sub = _clients[websocket]
                if sub.task and not sub.task.done():
                    sub.task.cancel()
                del _clients[websocket]
        log_event("断开", f"{client_id} 已从订阅列表移除")


# ============================================================================
# 主函数
# ============================================================================

async def main() -> None:
    _init_net_counters()
    _init_nvml()

    print()
    print(f"{LogColors.MAGENTA}{LogColors.BOLD}{'=' * 60}{LogColors.RESET}")
    print(f"{LogColors.MAGENTA}{LogColors.BOLD}  设备监控 WebSocket 服务器 v2.0{LogColors.RESET}")
    print(f"{LogColors.MAGENTA}{LogColors.BOLD}{'=' * 60}{LogColors.RESET}")
    print()
    print(f"  {LogColors.CYAN}监听地址:{LogColors.RESET} ws://{HOST}:{PORT}")
    print(f"  {LogColors.CYAN}GPU 支持:{LogColors.RESET} {'NVML' if _nvml_ready else 'GPUtil' if HAS_GPU else 'nvidia-smi'}")
    print(f"  {LogColors.CYAN}详细日志:{LogColors.RESET} {'开启' if VERBOSE_LOG else '关闭'}")
    print(f"  {LogColors.CYAN}推送模式:{LogColors.RESET} 延迟后调用（非轮询）")
    print()
    print(f"  {LogColors.DIM}按 Ctrl+C 停止服务器{LogColors.RESET}")
    print()
    print(f"{LogColors.MAGENTA}{'=' * 60}{LogColors.RESET}")
    print()

    # 初始化 CPU 统计
    psutil.cpu_percent(interval=None)

    # 启动 WebSocket 服务器
    async with websockets.serve(handle_client, HOST, PORT, origins=None):
        await asyncio.get_running_loop().create_future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print()
        log_event("停止", "服务器已停止")
        print()
