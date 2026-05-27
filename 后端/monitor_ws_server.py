import asyncio
import datetime
import json
import os
import platform
import socket
import subprocess
import time

try:
    import psutil
except ImportError as exc:
    raise SystemExit("Missing dependency: psutil. Install with 'pip install psutil'.") from exc

try:
    import websockets
except ImportError as exc:
    raise SystemExit("Missing dependency: websockets. Install with 'pip install websockets'.") from exc

try:
    import GPUtil  # Optional GPU metrics
    HAS_GPU = True
except ImportError:
    HAS_GPU = False

try:
    import pynvml  # Optional NVIDIA NVML bindings
    HAS_NVML = True
except ImportError:
    HAS_NVML = False

HOST = "0.0.0.0"
PORT = 8765

_metric_query_interval = 1.0

# State variables for network speed tracking
_prev_net_sent = 0
_prev_net_recv = 0
_prev_time = 0.0

_last_metrics = None
_last_metrics_time = 0.0

_active_client = None
_client_lock = asyncio.Lock()

_nvml_ready = False
_nvml_failed = False


def _get_disk_root() -> str:
    if os.name == "nt":
        return os.path.splitdrive(os.path.abspath(os.sep))[0] + os.sep
    return "/"


def get_system_static_info() -> dict:
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

    return {
        "os": f"{platform.system()} {platform.release()}",
        "hostname": socket.gethostname(),
        "cpu_model": platform.processor() or "Unknown Processor",
        "cpu_cores": psutil.cpu_count(logical=True) or 0,
        "cpu_freq": f"{psutil.cpu_freq().max:.1f} MHz" if psutil.cpu_freq() else "N/A",
        "ram_total_gb": round(psutil.virtual_memory().total / (1024 ** 3), 2),
        "disk_total_gb": disk_total_gb,
        "up_time": up_time,
        "boot_time": boot_time.strftime("%Y-%m-%d %H:%M:%S")
    }


def _init_net_counters() -> None:
    global _prev_net_sent, _prev_net_recv, _prev_time
    try:
        net_init = psutil.net_io_counters()
        _prev_net_sent = net_init.bytes_sent
        _prev_net_recv = net_init.bytes_recv
        _prev_time = time.time()
    except Exception:
        _prev_net_sent = 0
        _prev_net_recv = 0
        _prev_time = time.time()


def _init_nvml() -> None:
    global _nvml_ready, _nvml_failed
    if not HAS_NVML or _nvml_ready or _nvml_failed:
        return
    try:
        pynvml.nvmlInit()
        _nvml_ready = True
    except Exception:
        _nvml_failed = True


def _get_nvml_metrics() -> dict | None:
    if not HAS_NVML:
        return None
    _init_nvml()
    if not _nvml_ready:
        return None
    try:
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        util = pynvml.nvmlDeviceGetUtilizationRates(handle)
        mem = pynvml.nvmlDeviceGetMemoryInfo(handle)
        temp = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
        mem_percent = (mem.used / mem.total) * 100 if mem.total else 0.0 # type: ignore
        return {
            "gpu_percent": round(util.gpu, 1), # type: ignore
            "gpu_temp": int(temp),
            "gpu_mem_percent": round(mem_percent, 1)
        }
    except Exception:
        return None


def _get_nvidia_smi_metrics() -> dict | None:
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
        if result.returncode != 0:
            return None
        line = result.stdout.strip().splitlines()[0].strip()
        if not line:
            return None
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 4:
            return None
        util = float(parts[0])
        temp = float(parts[1])
        mem_used = float(parts[2])
        mem_total = float(parts[3])
        mem_percent = (mem_used / mem_total) * 100 if mem_total else 0.0
        return {
            "gpu_percent": round(util, 1),
            "gpu_temp": int(temp),
            "gpu_mem_percent": round(mem_percent, 1)
        }
    except Exception:
        return None


def _get_gpu_metrics() -> dict | None:
    metrics = _get_nvml_metrics()
    if metrics:
        return metrics

    metrics = _get_nvidia_smi_metrics()
    if metrics:
        return metrics

    if HAS_GPU:
        try:
            gpus = GPUtil.getGPUs()
            if gpus:
                gpu = gpus[0]
                return {
                    "gpu_percent": round(gpu.load * 100, 1),
                    "gpu_temp": int(gpu.temperature),
                    "gpu_mem_percent": round(gpu.memoryUtil * 100, 1)
                }
        except Exception:
            pass

    return None


def _get_cpu_temp() -> int | None:
    try:
        temps = psutil.sensors_temperatures()
    except Exception:
        return None
    if not temps:
        return None
    values = []
    for entries in temps.values():
        for entry in entries:
            current = getattr(entry, "current", None)
            if current is not None:
                values.append(current)
    if not values:
        return None
    return int(round(max(values)))


def _get_fan_speeds() -> tuple[int | None, int | None]:
    try:
        fans = psutil.sensors_fans()
    except Exception:
        return (None, None)
    if not fans:
        return (None, None)
    percents = []
    for entries in fans.values():
        for fan in entries:
            current = getattr(fan, "current", None)
            high = getattr(fan, "high", None)
            if current is None or not high:
                continue
            if high <= 0:
                continue
            percents.append((current / high) * 100)
    if not percents:
        return (None, None)
    percents.sort(reverse=True)
    fan1 = int(round(percents[0]))
    fan2 = int(round(percents[1])) if len(percents) > 1 else None
    return (fan1, fan2)


def get_realtime_metrics() -> dict:
    global _prev_net_sent, _prev_net_recv, _prev_time, _last_metrics, _last_metrics_time, _metric_query_interval

    now = time.monotonic()
    if _last_metrics is not None and (now - _last_metrics_time) < _metric_query_interval:
        return _last_metrics

    # CPU usage
    cpu_percent = psutil.cpu_percent(interval=None)

    # RAM usage
    vm = psutil.virtual_memory()
    ram_percent = vm.percent
    ram_used_gb = round(vm.used / (1024 ** 3), 2)
    ram_total_gb = round(vm.total / (1024 ** 3), 2)

    # Network speed (KB/s)
    net_sent_speed_kb = 0.0
    net_recv_speed_kb = 0.0
    try:
        curr_net = psutil.net_io_counters()
        curr_time = time.time()
        dt = curr_time - _prev_time if curr_time > _prev_time else 0.001

        sent_bytes = curr_net.bytes_sent - _prev_net_sent
        recv_bytes = curr_net.bytes_recv - _prev_net_recv

        if sent_bytes >= 0:
            net_sent_speed_kb = round((sent_bytes / 1024) / dt, 2)
        if recv_bytes >= 0:
            net_recv_speed_kb = round((recv_bytes / 1024) / dt, 2)

        _prev_net_sent = curr_net.bytes_sent
        _prev_net_recv = curr_net.bytes_recv
        _prev_time = curr_time
    except Exception:
        pass

    cpu_temp = _get_cpu_temp()
    fan_speed_1, fan_speed_2 = _get_fan_speeds()

    metrics = {
        "cpu_percent": cpu_percent,
        "ram_percent": ram_percent,
        "ram_used_gb": ram_used_gb,
        "ram_total_gb": ram_total_gb,
        "net_sent_speed_kb": net_sent_speed_kb,
        "net_recv_speed_kb": net_recv_speed_kb,
        "cpu_temp": cpu_temp if cpu_temp is not None else 0,
        "fan_speed_1": fan_speed_1 if fan_speed_1 is not None else 0,
        "fan_speed_2": fan_speed_2 if fan_speed_2 is not None else 0,
        "gpu_percent": 0.0,
        "gpu_temp": 0,
        "gpu_mem_percent": 0.0
    }

    # Optional GPU metrics
    gpu_metrics = _get_gpu_metrics()
    if gpu_metrics:
        metrics.update(gpu_metrics)

    _last_metrics = metrics
    _last_metrics_time = now

    return metrics


async def handle_client(websocket):
    client_ip, client_port = websocket.remote_address[:2]
    print(f"Connected: {client_ip}:{client_port}")

    global _active_client, _metric_query_interval
    async with _client_lock:
        if _active_client is not None and not getattr(_active_client, "closed", False):
            await websocket.close(code=1008, reason="Only one client allowed")
            print(f"Rejected: {client_ip}:{client_port} (single client limit)")
            return
        _active_client = websocket

    try:
        await websocket.send(json.dumps({
            "type": "static_info",
            "data": get_system_static_info()
        }))

        # Seed CPU stats
        psutil.cpu_percent(interval=None)
        await asyncio.sleep(0.1)

        interval = 1.0
        _metric_query_interval = interval
        while True:
            # Read control messages without blocking the send loop
            try:
                raw_msg = await asyncio.wait_for(websocket.recv(), timeout=0.02)
                msg = json.loads(raw_msg)
                if msg.get("type") == "set_interval":
                    interval = max(0.1, float(msg.get("value", 1.0)))
                    _metric_query_interval = interval
                    print(f"Interval updated: {interval}s")
            except asyncio.TimeoutError:
                pass

            await websocket.send(json.dumps({
                "type": "metrics",
                "data": get_realtime_metrics()
            }))

            await asyncio.sleep(interval)

    except websockets.exceptions.ConnectionClosedOK:
        print(f"Disconnected: {client_ip}:{client_port}")
    except websockets.exceptions.ConnectionClosedError:
        print(f"Connection lost: {client_ip}:{client_port}")
    except Exception as exc:
        print(f"Error: {exc}")
    finally:
        async with _client_lock:
            if _active_client is websocket:
                _active_client = None


async def main() -> None:
    _init_net_counters()
    print("============================================")
    print(" DEVICE MONITOR WS SERVER")
    print("============================================")
    print(f"Listening on ws://{HOST}:{PORT}")
    print("Press Ctrl+C to stop")

    # Allow all cross-origin WebSocket connections.
    async with websockets.serve(handle_client, HOST, PORT, origins=None):
        await asyncio.get_running_loop().create_future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Server stopped.")
