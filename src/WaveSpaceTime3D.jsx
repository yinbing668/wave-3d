import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, MousePointer2, Layers } from 'lucide-react';

const WaveSpaceTime3D = () => {
    const canvasRef = useRef(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    // 视角控制状态
    const [rotation, setRotation] = useState({ azim: -60, elev: 25 }); // 稍微降低一点俯视角，更有纵深感
    const [isDragging, setIsDragging] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

    // 显示控制
    const [showHistory, setShowHistory] = useState(true);
    const [showVibration, setShowVibration] = useState(true);

    // 物理参数
    const config = {
        xMax: 4.0,
        tMax: 2.5,
        v: 2.0,
        duration: 2.0,
        xPoints: 100, // 提升采样点，让曲线更圆滑    
        amp: 1.0
    };
    const omega = Math.PI / config.duration;

    // --- 核心数学逻辑 ---

    const getDisplacement = useCallback((t, x) => {
        const phase = omega * (t - x / config.v);
        if (phase >= 0 && phase <= Math.PI) {
            return Math.sin(phase) * config.amp;
        }
        return 0;
    }, [omega, config.v, config.amp]);

    // 3D 投影逻辑
    const project = useCallback((x, y, z, width, height) => {
        // 1. 中心化
        const cx = x - config.xMax / 2;
        const cy = y - config.tMax / 2;
        const cz = z;

        // 2. 角度转弧度
        const radAzim = (rotation.azim * Math.PI) / 180;
        const radElev = (rotation.elev * Math.PI) / 180;

        // 3. 旋转变换
        const sa = Math.sin(radAzim);
        const ca = Math.cos(radAzim);
        const se = Math.sin(radElev);
        const ce = Math.cos(radElev);

        const rotX = cx * ca - cy * sa;
        const rotY = cx * sa + cy * ca;

        // 投影到 2D
        // 调整缩放系数：1000x600 下使用 /5.0 比较合适
        const scale = Math.min(width, height) / 5.0;

        const screenX = width / 2 + rotX * scale;
        // Y轴(Time)向里，所以在屏幕上是加上 rotY * se; Z轴向上，屏幕坐标减去
        const screenY = height / 2 + (rotY * se - cz * ce) * scale;

        return { x: screenX, y: screenY };
    }, [rotation, config.xMax, config.tMax]);

    // --- 绘图函数 ---
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // 清空画布 & 设置背景
        ctx.clearRect(0, 0, width, height);

        // --- 1. 绘制精致的网格 (Grid) ---
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)'; // 非常淡的 Slate-400
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]); // 虚线网格
        ctx.beginPath();

        // Time 线
        for (let i = 0; i <= config.xMax; i += 1) {
            const p1 = project(i, 0, 0, width, height);
            const p2 = project(i, config.tMax, 0, width, height);
            ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        }
        // Position 线
        for (let i = 0; i <= config.tMax; i += 0.5) {
            const p1 = project(0, i, 0, width, height);
            const p2 = project(config.xMax, i, 0, width, height);
            ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        }
        ctx.stroke();
        ctx.setLineDash([]); // 恢复实线

        // --- 2. 绘制坐标轴 (Antialiased & Stylish) ---
        const origin = project(0, 0, 0, width, height);
        const xEnd = project(config.xMax, 0, 0, width, height);
        const tEnd = project(0, config.tMax, 0, width, height); // 注意：T轴实际上是Y轴方向
        const zEnd = project(0, 0, 1.8, width, height);

        // 绘制轴线
        const drawAxisLine = (from, to, color) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();

            // 箭头
            const headLen = 8;
            const angle = Math.atan2(to.y - from.y, to.x - from.x);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(to.x, to.y);
            ctx.lineTo(to.x - headLen * Math.cos(angle - Math.PI / 6), to.y - headLen * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(to.x - headLen * Math.cos(angle + Math.PI / 6), to.y - headLen * Math.sin(angle + Math.PI / 6));
            ctx.fill();
        };

        drawAxisLine(origin, xEnd, '#334155'); // X: Slate-700
        drawAxisLine(origin, tEnd, '#334155'); // T: Slate-700
        // Z轴画一根参考线
        const zBottom = project(0, 0, -0.5, width, height);
        drawAxisLine(zBottom, zEnd, '#94a3b8'); // Z: Slate-400

        // --- 3. 刻度与文字 (Typography) ---
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '500 12px Inter, system-ui, sans-serif'; // 更现代的字体
        ctx.fillStyle = '#64748b'; // Slate-500

        // X轴刻度
        for (let i = 0; i <= config.xMax; i++) {
            const p = project(i, 0, 0, width, height);
            ctx.fillText(i.toString(), p.x, p.y + 18);
            // 小圆点刻度
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        // T轴刻度
        for (let t = 0; t <= config.tMax; t += 0.5) {
            const p = project(0, t, 0, width, height);
            ctx.fillText(t.toString(), p.x, p.y + 18);
            // 小圆点刻度
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // 轴标题
        ctx.font = 'bold 14px Inter, system-ui, sans-serif';
        ctx.fillStyle = '#1e293b'; // Slate-800
        ctx.fillText("位置 x (m)", xEnd.x, xEnd.y + 40);
        ctx.fillText("时间 t (s)", tEnd.x - 50, tEnd.y);
        ctx.fillText("位移 y", zEnd.x, zEnd.y - 25);


        // --- 4. 绘制波形历史 (Snapshot History) ---
        // 风格：半透明蓝色，细线
        if (showHistory) {
            ctx.lineWidth = 1.5;
            for (let t = 0; t <= currentTime; t += 0.1) {
                ctx.beginPath();
                // 渐变透明度：离现在越近越清晰
                const alpha = 0.1 + (t / (config.tMax + 0.1)) * 0.3;
                ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`;

                for (let i = 0; i <= config.xPoints; i++) {
                    const x = (i / config.xPoints) * config.xMax;
                    const z = getDisplacement(t, x);
                    const p = project(x, t, z, width, height);
                    if (i === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                }
                ctx.stroke();
            }
        }

        // --- 5. 绘制振动历史 (Vibration History) ---
        // 风格：青色，更实一点
        if (showVibration) {
            const watchPoints = [0, 1.0, 2.0, 3.0, 4.0];

            watchPoints.forEach(wx => {
                if (wx > config.xMax) return;

                ctx.beginPath();
                ctx.strokeStyle = '#14b8a6'; // Teal-500
                ctx.lineWidth = 2;

                for (let t = 0; t <= currentTime; t += 0.05) {
                    const z = getDisplacement(t, wx);
                    const p = project(wx, t, z, width, height);
                    if (t === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                }
                ctx.stroke();

                if (currentTime > 0) {
                    const zNow = getDisplacement(currentTime, wx);
                    const pNow = project(wx, currentTime, zNow, width, height);

                    // 振动点的光晕
                    ctx.shadowBlur = 5;
                    ctx.shadowColor = '#14b8a6';
                    ctx.fillStyle = '#fff';
                    ctx.beginPath();
                    ctx.arc(pNow.x, pNow.y, 4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0; // Reset

                    // 振动点中心
                    ctx.fillStyle = '#0d9488';
                    ctx.beginPath();
                    ctx.arc(pNow.x, pNow.y, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        }

        // --- 6. 绘制当前时刻波形 (The Star of the Show) ---
        // 风格：红色渐变 + 发光
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';

        // 创建渐变色
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, '#f43f5e'); // Rose-500
        gradient.addColorStop(1, '#ef4444'); // Red-500
        ctx.strokeStyle = gradient;

        // 添加发光效果
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(244, 63, 94, 0.6)';

        ctx.beginPath();
        for (let i = 0; i <= config.xPoints; i++) {
            const x = (i / config.xPoints) * config.xMax;
            const z = getDisplacement(currentTime, x);
            const p = project(x, currentTime, z, width, height);
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();

        // Reset shadow
        ctx.shadowBlur = 0;

        // --- 7. 辅助元素 ---

        // 平面参考线 (细虚线)
        const markerStart = project(0, currentTime, 0, width, height);
        const markerEnd = project(config.xMax, currentTime, 0, width, height);
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(markerStart.x, markerStart.y);
        ctx.lineTo(markerEnd.x, markerEnd.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // T轴红色指示点
        const tMarker = project(0, currentTime, 0, width, height);
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(tMarker.x, tMarker.y, 4, 0, Math.PI * 2);
        ctx.fill();

    }, [currentTime, project, getDisplacement, config, showHistory, showVibration]);

    // --- Animation Effects ---
    useEffect(() => {
        let animId;
        if (isPlaying) {
            const loop = () => {
                setCurrentTime(prev => {
                    if (prev >= config.tMax) {
                        setIsPlaying(false);
                        return config.tMax;
                    }
                    return prev + 0.015;
                });
                animId = requestAnimationFrame(loop);
            };
            animId = requestAnimationFrame(loop);
        }
        return () => cancelAnimationFrame(animId);
    }, [isPlaying, config.tMax]);

    useEffect(() => {
        draw();
    }, [draw]);

    const handleMouseDown = (e) => {
        setIsDragging(true);
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };
    const handleMouseMove = (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - lastMousePos.x;
        const deltaY = e.clientY - lastMousePos.y;
        setRotation(prev => ({
            azim: prev.azim - deltaX * 0.5,
            elev: Math.max(0, Math.min(90, prev.elev + deltaY * 0.5))
        }));
        setLastMousePos({ x: e.clientX, y: e.clientY });
    };
    const handleMouseUp = () => setIsDragging(false);

    return (
        <div className="flex flex-col h-screen bg-slate-50 p-6 font-sans text-slate-800">

            {/* 顶部标题栏 */}
            <div className="mb-4 flex flex-col md:flex-row justify-between md:items-end gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">3D 时空波形图</h1>
                    <p className="text-slate-500 text-sm mt-1 flex items-center gap-4">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span> 波形 (Position)
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-teal-500"></span> 振动 (Time)
                        </span>
                    </p>
                </div>

                {/* 控制开关 */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowVibration(!showVibration)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all shadow-sm ${showVibration ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                    >
                        <div className={`w-2 h-2 rounded-full ${showVibration ? 'bg-teal-500' : 'bg-slate-300'}`}></div>
                        定点振动
                    </button>
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all shadow-sm ${showHistory ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                    >
                        <div className={`w-2 h-2 rounded-full ${showHistory ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                        波形历史
                    </button>
                </div>
            </div>

            {/* 主画布区域 */}
            <div className="flex-1 bg-white rounded-2xl shadow-xl border border-slate-100 relative overflow-hidden cursor-move ring-1 ring-slate-900/5">
                <canvas
                    ref={canvasRef}
                    width={1000}
                    height={600}
                    className="w-full h-full block touch-none"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                />

                <div className="absolute top-4 right-4 bg-white/80 p-3 rounded-xl shadow-sm border border-slate-100 backdrop-blur-md pointer-events-none">
                    <div className="flex items-center gap-2 text-slate-600 text-sm font-medium">
                        <MousePointer2 size={16} className="text-indigo-500" />
                        <span>拖拽旋转视角</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                        Azim: {rotation.azim.toFixed(0)}°, Elev: {rotation.elev.toFixed(0)}°
                    </div>
                </div>

                {/* 当前时间的大号显示 */}
                <div className="absolute top-6 left-6 pointer-events-none">
                    <div className="text-5xl font-mono font-bold text-slate-900/10 select-none tracking-tighter">
                        {currentTime.toFixed(2)}s
                    </div>
                </div>
            </div>

            {/* 底部控制栏 */}
            <div className="mt-4 bg-white p-4 rounded-2xl shadow-lg border border-slate-100 flex flex-col md:flex-row items-center gap-6 ring-1 ring-slate-900/5">
                <div className="flex gap-2 w-full md:w-auto">
                    <button
                        onClick={() => {
                            if (currentTime >= config.tMax) setCurrentTime(0);
                            setIsPlaying(!isPlaying);
                        }}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-semibold transition-all shadow-md active:scale-95"
                    >
                        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                        {isPlaying ? "暂停" : (currentTime >= config.tMax ? "重播" : "播放")}
                    </button>

                    <button
                        onClick={() => {
                            setIsPlaying(false);
                            setCurrentTime(0);
                        }}
                        className="p-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors border border-transparent hover:border-slate-200"
                        title="重置"
                    >
                        <RotateCcw size={20} />
                    </button>
                </div>

                <div className="flex-1 flex flex-col gap-2 w-full">
                    <div className="flex justify-between text-xs text-slate-500 font-medium font-mono">
                        <span>0.00s</span>
                        <span className="text-rose-500 font-bold">t = {currentTime.toFixed(2)}s</span>
                        <span>{config.tMax}s</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max={config.tMax}
                        step="0.01"
                        value={currentTime}
                        onChange={(e) => {
                            setIsPlaying(false);
                            setCurrentTime(parseFloat(e.target.value));
                        }}
                        className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-rose-500 hover:bg-slate-200 transition-colors"
                    />
                </div>

                {/* 快捷跳转按钮 */}
                <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                    {[0.5, 1.0, 1.5, 2.0, 2.5].map(t => (
                        <button
                            key={t}
                            onClick={() => { setIsPlaying(false); setCurrentTime(t); }}
                            className="px-3 py-1.5 text-xs bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-600 font-bold font-mono whitespace-nowrap border border-slate-200 transition-colors"
                        >
                            {t}s
                        </button>
                    ))}
                </div>
            </div>

        </div>
    );
};

export default WaveSpaceTime3D;
