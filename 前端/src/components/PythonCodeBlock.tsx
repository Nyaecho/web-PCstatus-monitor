import { useState } from "react";
import { Copy, Check, Terminal, Play, Server, ChevronDown, ChevronUp } from "lucide-react";

interface PythonCodeBlockProps {
  wsUrl: string;
}

export default function PythonCodeBlock({ wsUrl }: PythonCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"code" | "guide">("guide");
  const [isExpanded, setIsExpanded] = useState(false);

  const pythonScript = `import asyncio
import json
import socket
import datetime
import platform
import time
import websockets
import psutil

# Check for GPU monitoring support (GPUtil is optional, standard psutil is core)
try:
    import GPUtil
    has_gpu = True
except ImportError:
    has_gpu = False

print("Starting Device Performance Monitor Backend server...")
print("Analyzing local system resources...")

def get_system_static_info():
    try:
        boot_time_timestamp = psutil.boot_time()
        bt = datetime.datetime.fromtimestamp(boot_time_timestamp)
        up_time_dur = datetime.datetime.now() - bt
        up_time = str(up_time_dur).split('.')[0]
    except Exception:
        up_time = "Unknown"
        bt = datetime.datetime.now()

    info = {
        "os": f"{platform.system()} {platform.release()}",
        "hostname": socket.gethostname(),
        "cpu_model": platform.processor() or "Unknown Processor",
        "cpu_cores": psutil.cpu_count(logical=True),
        "cpu_freq": f"{psutil.cpu_freq().max:.1f} MHz" if psutil.cpu_freq() else "N/A",
        "ram_total_gb": round(psutil.virtual_memory().total / (1024**3), 2),
        "disk_total_gb": round(psutil.disk_usage('/').total / (1024**3), 2),
        "up_time": up_time,
        "boot_time": bt.strftime("%Y-%m-%d %H:%M:%S")
    }
    return info

# State variables for Delta network speed tracking
prev_net_sent = 0
prev_net_recv = 0
prev_time = 0

# Initialize network telemetry readings
try:
    net_init = psutil.net_io_counters()
    prev_net_sent = net_init.bytes_sent
    prev_net_recv = net_init.bytes_recv
    prev_time = time.time()
except Exception:
    pass

def get_realtime_metrics():
    global prev_net_sent, prev_net_recv, prev_time
    
    # 1. CPU Usage
    cpu_percent = psutil.cpu_percent(interval=None)
    cpu_cores_percent = psutil.cpu_percent(interval=None, percpu=True)
    
    # 2. Virtual Memory (RAM)
    vm = psutil.virtual_memory()
    ram_percent = vm.percent
    ram_used_gb = round(vm.used / (1024**3), 2)
    ram_total_gb = round(vm.total / (1024**3), 2)
    
    # 3. Disk Usage (Root Partition)
    try:
        disk = psutil.disk_usage('/')
        disk_percent = disk.percent
        disk_used_gb = round(disk.used / (1024**3), 2)
        disk_total_gb = round(disk.total / (1024**3), 2)
    except Exception:
        disk_percent = 0
        disk_used_gb = 0
        disk_total_gb = 0
    
    # 4. Network Speed Calculation (Bytes/Sec converted to KB/s)
    net_sent_speed_kb = 0.0
    net_recv_speed_kb = 0.0
    try:
        curr_net = psutil.net_io_counters()
        curr_time = time.time()
        dt = curr_time - prev_time if curr_time > prev_time else 0.001
        
        sent_bytes = curr_net.bytes_sent - prev_net_sent
        recv_bytes = curr_net.bytes_recv - prev_net_recv
        
        if sent_bytes >= 0:
            net_sent_speed_kb = round((sent_bytes / 1024) / dt, 2)
        if recv_bytes >= 0:
            net_recv_speed_kb = round((recv_bytes / 1024) / dt, 2)
            
        prev_net_sent = curr_net.bytes_sent
        prev_net_recv = curr_net.bytes_recv
        prev_time = curr_time
    except Exception:
        pass
        
    # 5. Top heavy processes sorted by CPU and memory overhead
    processes = []
    try:
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'memory_info']):
            try:
                pinfo = proc.info
                p_cpu = pinfo['cpu_percent']
                p_mem = pinfo['memory_percent']
                
                if p_cpu > 0.1 or p_mem > 0.1:
                    processes.append({
                        "pid": pinfo['pid'],
                        "name": pinfo['name'] or "Unknown Process",
                        "cpu_percent": round(p_cpu, 1),
                        "memory_percent": round(p_mem, 1),
                        "memory_used_mb": round((pinfo['memory_info'].rss if pinfo['memory_info'] else 0) / (1024**2), 1)
                    })
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
    except Exception:
        pass
            
    processes = sorted(processes, key=lambda p: (p['cpu_percent'], p['memory_percent']), reverse=True)[:15]
    
    metrics = {
        "cpu_percent": cpu_percent,
        "cpu_cores_percent": cpu_cores_percent,
        "ram_percent": ram_percent,
        "ram_used_gb": ram_used_gb,
        "ram_total_gb": ram_total_gb,
        "disk_percent": disk_percent,
        "disk_used_gb": disk_used_gb,
        "disk_total_gb": disk_total_gb,
        "net_sent_speed_kb": net_sent_speed_kb,
        "net_recv_speed_kb": net_recv_speed_kb,
        "processes": processes,
        "timestamp": datetime.datetime.now().strftime("%H:%M:%S")
    }
    
    # 6. Optional GPU monitoring if GPUtil is loaded
    if has_gpu:
        try:
            gpus = GPUtil.getGPUs()
            if gpus:
                gpu = gpus[0]
                metrics["gpu_percent"] = round(gpu.load * 100, 1)
                metrics["gpu_temp"] = gpu.temperature
                metrics["gpu_mem_percent"] = round(gpu.memoryUtil * 100, 1)
        except Exception:
            pass
            
    return metrics

async def handle_client(websocket):
    client_ip, client_port = websocket.remote_address[:2]
    print(f"\\nConnected to: {client_ip}:{client_port}")
    
    # Send static system configuration upon initial contact
    try:
        static_info = get_system_static_info()
        await websocket.send(json.dumps({
            "type": "static_info",
            "data": static_info
        }))
        
        # Initial call to seed CPU stats calculation
        psutil.cpu_percent(interval=None)
        await asyncio.sleep(0.1)
        
        interval = 1.0 # Telemetry publishing rate in seconds
        
        while True:
            # Check for control requests/rates from the frontend
            try:
                # Read with a very tight timeout to avoid locking the loop
                raw_msg = await asyncio.wait_for(websocket.recv(), timeout=0.02)
                msg = json.loads(raw_msg)
                if msg.get("type") == "set_interval":
                    interval = max(0.2, float(msg.get("value", 1.0)))
                    print(f"Data transmission rate adjusted to: {interval}s")
            except asyncio.TimeoutError:
                pass
            
            # Form byte payload and transmit
            metrics = get_realtime_metrics()
            await websocket.send(json.dumps({
                "type": "metrics",
                "data": metrics
            }))
            
            await asyncio.sleep(interval)
            
    except websockets.exceptions.ConnectionClosedOK:
        print(f"Safe disconnection: {client_ip}:{client_port}")
    except websockets.exceptions.ConnectionClosedError:
        print(f"Lost link connection: {client_ip}:{client_port}")
    except Exception as e:
        print(f"Operational error: {e}")

async def main():
    # Bind to standard port 8765
    async with websockets.serve(handle_client, "0.0.0.0", 8765):
         print("================================================")
         print("   CYBER SYSTEM MONITOR - LOCAL PYTHON DAEMON   ")
         print("================================================")
         print("● Current Status: ONLINE | Active Listener")
         print("● Service Address: ws://localhost:8765")
         print("● Compatibility: Win / macOS / Linux")
         print("\\n👉 Ready! Paste connection details in the Web UI to link. ")
         print("   Press [Ctrl + C] to terminate daemon process safely.")
         print("================================================")
         await asyncio.get_running_loop().create_future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\\nDaemon terminated safely. Goodbye!")`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(pythonScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="python-daemon-guide" className="border border-blue-100 bg-white rounded-[28px] overflow-hidden shadow-sm">
      {/* Accordion Toggle Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-6 bg-white hover:bg-slate-50 duration-150 text-left cursor-pointer"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-blue-50 text-blue-600">
            <Server size={18} className={isExpanded ? "animate-pulse" : ""} />
          </div>
          <div>
            <h3 className="text-xs font-bold tracking-[0.2em] uppercase text-blue-500 font-sans">
              本地硬件遥测后台守护进程 (PYTHON 桥接服务)
            </h3>
            <p className="text-xs text-slate-400 font-serif italic mt-0.5">
              安全、轻量级的本地数据中继运行逻辑，用于实现真机指标载荷的顺畅打通与传输。
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-mono px-2.5 py-0.5 bg-blue-50/50 border border-blue-100 rounded-full text-blue-600 font-semibold">
            Python 3.9+
          </span>
          {isExpanded ? (
            <ChevronUp size={16} className="text-slate-400" />
          ) : (
            <ChevronDown size={16} className="text-slate-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="p-6 bg-white border-t border-slate-100">
          {/* Instructions Option Headers & Tabs */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <div className="flex bg-slate-100/80 p-0.5 rounded-xl border border-slate-200 select-none">
              <button
                onClick={() => setActiveTab("guide")}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === "guide"
                    ? "bg-white text-blue-600 border border-slate-200 shadow-sm font-semibold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Terminal size={14} /> 部署配置指南
              </button>
              <button
                onClick={() => setActiveTab("code")}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === "code"
                    ? "bg-white text-blue-600 border border-slate-200 shadow-sm font-semibold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Play size={14} /> 桥接脚本源码
              </button>
            </div>

            {activeTab === "code" && (
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100/80 rounded-xl text-xs font-medium transition-all border border-blue-100/50 cursor-pointer font-sans"
                title="拷贝代码至剪贴板"
              >
                {copied ? (
                  <>
                    <Check size={13} className="text-green-600" />
                    <span className="text-green-600 font-semibold text-xs">复制成功！</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span className="text-xs">复制代码</span>
                  </>
                )}
              </button>
            )}
          </div>

          {activeTab === "guide" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-600 font-mono text-xs font-bold border border-blue-100">
                        1
                      </span>
                      <h4 className="font-semibold text-slate-800 text-sm font-sans">拉取核心运行环境</h4>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed font-serif italic">
                      确认待检电脑已安装 Python 3 环境。在您的终端命令窗口中拉取硬件指标遥测读取库：
                    </p>
                  </div>
                  <div className="bg-[#1E293B] p-3 rounded-xl border border-slate-850 font-mono text-[11px] text-blue-300 select-all leading-tight mt-4">
                    pip install websockets psutil gputil
                  </div>
                </div>

                <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-600 font-mono text-xs font-bold border border-blue-100">
                        2
                      </span>
                      <h4 className="font-semibold text-slate-800 text-sm font-sans">本地保存桥接逻辑</h4>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed font-serif italic">
                      点击旁边的“桥接脚本源码”页签复制代码，并在本地新建文件将其妥善保存为：
                    </p>
                  </div>
                  <p className="mt-4 font-mono text-xs text-slate-700 bg-white p-2.5 rounded-xl text-center border border-slate-200">
                    monitor.py
                  </p>
                </div>

                <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-600 font-mono text-xs font-bold border border-blue-100">
                        3
                      </span>
                      <h4 className="font-semibold text-slate-800 text-sm font-sans">一键开启遥测捕获</h4>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed font-serif italic">
                      在命令行执行脚本，服务程序会自动捆绑底层系统内核硬件监视钩子并启用安全管道：
                    </p>
                  </div>
                  <div className="bg-[#1E293B] p-3 rounded-xl border border-slate-850 font-mono text-[11px] text-blue-300 select-all leading-tight mt-4">
                    python monitor.py
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50/40 border border-blue-100/50 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs font-mono text-blue-800 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span>
                    桥接遥测服务监听地址：<b className="text-blue-600 font-bold">{wsUrl}</b>
                  </span>
                </div>
                <button
                  onClick={() => {
                    const el = document.getElementById("connection-panel");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="underline hover:text-blue-600 duration-150 text-left font-sans text-xs cursor-pointer font-medium"
                >
                  修改物理接收 URL 地址
                </button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <pre className="p-5 bg-[#1E293B] rounded-2xl overflow-x-auto text-[11px] font-mono text-slate-250 leading-relaxed max-h-80 border border-slate-800">
                <code>{pythonScript}</code>
              </pre>
              <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-slate-900/90 p-2 rounded-xl border border-slate-800 backdrop-blur-sm shadow-md">
                <span className="text-[10px] font-sans text-slate-400 px-1">请向下滚动以阅览完整的本地桥接中继运行逻辑代码</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
