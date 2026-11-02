"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@studio/ui";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@studio/ui";
import { useToast } from "@/hooks/use-toast";
import { ScanLine, LoaderCircle, SwitchCamera, History, CheckCircle2, XCircle, AlertTriangle, Lock, Eye, EyeOff } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@studio/ui";
import { ScrollArea } from "@studio/ui";
import { formatDistanceToNow, isToday, format } from "date-fns";
import { getMealStubs, updateMealStub, getWorkerByIdOrWorkerId } from "@/actions/db";
import { useWorkers } from "@/hooks/use-workers";
import { useScanLogs } from "@/hooks/use-scan-logs";
import { useScannerSettings } from "@/hooks/use-scanner-settings";
import { FALLBACK_SCANNER_PASSWORDS } from "@/lib/scanner-config";
import jsQR from "jsqr";

type ScanLogEntry = {
    id: string;
    details: string;
    scannerName: string;
    timestamp: Date;
    status: 'success' | 'warning' | 'error';
};

export default function QRScannerPage() {
    const { toast } = useToast();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const isProcessingRef = useRef(false);
    const barcodeDetectorRef = useRef<any>(null);

    // Initialize hardware-accelerated Native BarcodeDetector if available
    useEffect(() => {
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
            try {
                barcodeDetectorRef.current = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
            } catch (e) {
                console.warn('BarcodeDetector initialization:', e);
            }
        }
    }, []);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLockModalOpen, setIsLockModalOpen] = useState(false);
    const [lockPassword, setLockPassword] = useState('');
    const [lockPasswordError, setLockPasswordError] = useState('');
    const [showLockPassword, setShowLockPassword] = useState(false);

    const { settings: scannerSettings } = useScannerSettings();

    const isValidPassword = useCallback((input: string) => {
        const p = input.trim();
        if (!p) return false;
        const configured = scannerSettings?.lockPassword || 'CogMain123';
        if (p === configured) return true;
        if (scannerSettings?.allowFallbackPasswords !== false) {
            return FALLBACK_SCANNER_PASSWORDS.includes(p);
        }
        return false;
    }, [scannerSettings]);

    const handleConfirmLock = (e: React.FormEvent) => {
        e.preventDefault();
        if (isValidPassword(lockPassword)) {
            setIsAuthenticated(false);
            setPasswordInput('');
            setLockPassword('');
            setLockPasswordError('');
            setIsLockModalOpen(false);
            toast({
                title: 'Scanner Locked',
                description: 'The scanner session has been locked.',
            });
        } else {
            setLockPasswordError('Incorrect password. Please try again.');
            toast({
                variant: 'destructive',
                title: 'Authentication Failed',
                description: 'Incorrect scanner password to lock.',
            });
        }
    };
    const [scanLogs, setScanLogs] = useState<ScanLogEntry[]>([]);
    const [lastScanResult, setLastScanResult] = useState<{
        workerName: string;
        message: string;
        status: 'success' | 'warning' | 'error';
    } | null>(null);

    const { workers } = useWorkers({ limit: 10000, unrestricted: true });
    const { scanLogs: dbScanLogs, createScanLog: createScanLogSql, isLoading: logsLoading } = useScanLogs(50, 'Meal Stub');
    const animFrameRef = useRef<number>(0);
    const streamRef = useRef<MediaStream | null>(null);

    // Get camera devices on auth
    useEffect(() => {
        if (!isAuthenticated) return;
        let isMounted = true;

        const getDevices = async () => {
            try {
                const initialStream = await navigator.mediaDevices.getUserMedia({ video: true });
                initialStream.getTracks().forEach(t => t.stop()); // close probe stream

                if (!isMounted) return;
                setHasCameraPermission(true);

                const all = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = all.filter(d => d.kind === 'videoinput');
                if (!isMounted) return;

                setDevices(videoDevices);
                if (videoDevices.length > 0) {
                    setSelectedDeviceId(videoDevices[0].deviceId);
                }
            } catch (err) {
                if (!isMounted) return;
                setHasCameraPermission(false);
                toast({
                    variant: 'destructive',
                    title: 'Camera Access Denied',
                    description: 'Enable camera permissions in your browser to use the scanner.',
                });
            }
        };

        getDevices();
        return () => {
            isMounted = false;
        };
    }, [isAuthenticated, toast]);

    const playBeep = useCallback((type: 'success' | 'warning' | 'error' = 'success') => {
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            if (ctx.state === 'suspended') {
                ctx.resume();
            }
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === 'success') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                gain.gain.setValueAtTime(0.12, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.1);

                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.12);
                gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.12);
                osc2.start(ctx.currentTime + 0.12);
                osc2.stop(ctx.currentTime + 0.26);
            } else if (type === 'warning') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(440, ctx.currentTime);
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.2);
            } else {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, ctx.currentTime);
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                osc.start();
                osc.stop(ctx.currentTime + 0.25);
            }
        } catch {
            // Audio context failed or blocked by browser policy, ignore safely
        }
    }, []);

    const resetScanner = useCallback(() => {
        isProcessingRef.current = false;
        setIsProcessing(false);
        setLastScanResult(null);
        if (videoRef.current) {
            if (streamRef.current && videoRef.current.srcObject !== streamRef.current) {
                videoRef.current.srcObject = streamRef.current;
            }
            videoRef.current.play().catch(() => {});
        }
    }, []);

    const addLog = (details: string, status: 'success' | 'warning' | 'error') => {
        setScanLogs(prev => [
            {
                id: Date.now().toString(),
                details,
                scannerName: 'Public Scanner',
                timestamp: new Date(),
                status,
            },
            ...prev,
        ].slice(0, 25));
    };

    const handleScan = useCallback(async (data: string) => {
        if (!data || isProcessingRef.current) return;
        isProcessingRef.current = true;
        setIsProcessing(true);

        const parts = data.split(':');
        let rawWorkerId = parts[1] || parts[0];
        let token: string | undefined = parts[2];
        const type = parts[0];

        if (parts.length === 1) {
            // Direct Worker ID format
            rawWorkerId = parts[0];
            token = undefined;
        } else if (type !== 'MEAL_STUB' && type !== 'COG_USER' && type !== 'ATTENDANCE' && type !== 'STATIC') {
            playBeep('error');
            toast({
                variant: 'destructive',
                title: 'Invalid QR Code',
                description: 'This QR code is not formatted for meal stub claims.',
            });
            setLastScanResult({
                workerName: 'Unknown',
                message: 'Invalid QR Code Format',
                status: 'error',
            });
            setTimeout(resetScanner, 2000);
            return;
        }

        try {
            let worker = workers?.find(
                w => w.id === rawWorkerId || w.workerId === rawWorkerId || w.email?.toLowerCase() === rawWorkerId.toLowerCase()
            );

            // Fallback: lookup directly from DB if not in memory
            if (!worker && rawWorkerId) {
                try {
                    worker = (await getWorkerByIdOrWorkerId(rawWorkerId)) as any;
                } catch (err) {
                    console.error("Direct worker lookup error:", err);
                }
            }

            const workerId = worker?.id || rawWorkerId;
            const workerName = worker ? `${worker.firstName} ${worker.lastName}` : `Worker (${rawWorkerId.slice(0, 8)})`;

            // Validate token if provided and worker has a token recorded
            if (worker?.qrToken && token && worker.qrToken !== token) {
                playBeep('error');
                toast({
                    variant: 'destructive',
                    title: 'Invalid or Expired QR',
                    description: 'This QR code has expired. Please use your latest QR code.',
                });
                setLastScanResult({
                    workerName,
                    message: 'QR token has expired',
                    status: 'error',
                });
                setTimeout(resetScanner, 3000);
                return;
            }

            // Fetch stubs for this worker
            const stubs = await getMealStubs({ workerId });
            const validStub = stubs.find(s => {
                if (s.status !== 'Issued') return false;
                const d = s.date instanceof Date ? s.date : new Date(s.date);
                return isToday(d) || format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            });

            if (validStub) {
                await updateMealStub(validStub.id, {
                    status: 'Claimed',
                    claimedAt: new Date(),
                });
                playBeep('success');
                const details = `Claimed meal stub for ${workerName}.`;
                toast({
                    title: 'Meal Stub Claimed!',
                    description: details,
                });
                setLastScanResult({
                    workerName,
                    message: 'Meal stub claimed successfully!',
                    status: 'success',
                });
                addLog(details, 'success');

                try {
                    await createScanLogSql({
                        scanType: 'Meal Stub',
                        details,
                        mealStubId: validStub.id,
                        targetUserId: workerId,
                        targetUserName: workerName,
                        scannerId: 'public_scanner',
                        scannerName: 'Public Scanner',
                    });
                } catch {
                    // Ignore audit log error gracefully
                }
            } else {
                const alreadyClaimedStub = stubs.find(s => {
                    if (s.status !== 'Claimed' && !(s as any).claimedAt) return false;
                    const d = s.date instanceof Date ? s.date : new Date(s.date);
                    return isToday(d) || format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                });

                if (alreadyClaimedStub) {
                    playBeep('warning');
                    const claimedTime = (alreadyClaimedStub as any).claimedAt
                        ? format(new Date((alreadyClaimedStub as any).claimedAt), 'h:mm a')
                        : 'earlier today';
                    const details = `${workerName} already claimed their meal stub today at ${claimedTime}.`;
                    toast({
                        variant: 'destructive',
                        title: 'Already Claimed Today',
                        description: details,
                    });
                    setLastScanResult({
                        workerName,
                        message: `Already claimed today at ${claimedTime}.`,
                        status: 'warning',
                    });
                    addLog(details, 'warning');
                } else {
                    playBeep('error');
                    const details = `No active issued meal stub found for ${workerName} today.`;
                    toast({
                        variant: 'destructive',
                        title: 'No Meal Stub Found',
                        description: details,
                    });
                    setLastScanResult({
                        workerName,
                        message: 'No issued meal stub for today.',
                        status: 'error',
                    });
                    addLog(details, 'error');
                }
            }
        } catch (e: any) {
            playBeep('error');
            console.error('Meal stub scan error:', e);
            toast({
                variant: 'destructive',
                title: 'Scan Error',
                description: 'Could not process meal stub scan. Please try again.',
            });
            setLastScanResult({
                workerName: 'Error',
                message: 'Processing error occurred.',
                status: 'error',
            });
        } finally {
            setTimeout(resetScanner, 2500);
        }
    }, [workers, toast, resetScanner, playBeep]);

    // Stable ref for handleScan so camera stream never restarts on scan
    const handleScanRef = useRef(handleScan);
    useEffect(() => {
        handleScanRef.current = handleScan;
    }, [handleScan]);

    // 1. Camera stream management — runs ONLY when device/permission/auth changes
    useEffect(() => {
        if (!isAuthenticated || !hasCameraPermission || !selectedDeviceId) return;

        const videoElement = videoRef.current;
        if (!videoElement) return;

        let isRunning = true;

        const start = async () => {
            try {
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(t => t.stop());
                    streamRef.current = null;
                }

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        deviceId: { ideal: selectedDeviceId },
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                });

                if (!isRunning) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                streamRef.current = stream;
                videoElement.srcObject = stream;
                videoElement.setAttribute('playsinline', 'true');
                videoElement.play().catch(err => {
                    if (err.name !== 'AbortError') {
                        console.error('Video play error:', err);
                    }
                });
            } catch (err) {
                console.error('Camera stream error:', err);
            }
        };

        start();

        return () => {
            isRunning = false;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
                streamRef.current = null;
            }
        };
    }, [selectedDeviceId, hasCameraPermission, isAuthenticated]);

    // 2. Continuous ultra-fast scan loop (Hardware BarcodeDetector + Downsampled jsQR)
    useEffect(() => {
        if (!isAuthenticated || !hasCameraPermission) return;

        const videoElement = videoRef.current;
        const canvas = canvasRef.current;
        if (!videoElement || !canvas) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        let isScanning = true;

        const scan = async () => {
            if (!isScanning) return;

            if (videoElement.readyState >= 2 && !isProcessingRef.current) {
                // 1. Ultra-fast Native BarcodeDetector (< 2ms)
                if (barcodeDetectorRef.current) {
                    try {
                        const barcodes = await barcodeDetectorRef.current.detect(videoElement);
                        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue && !isProcessingRef.current) {
                            handleScanRef.current(barcodes[0].rawValue);
                            return;
                        }
                    } catch {
                        // Fall back to optimized canvas jsQR
                    }
                }

                // 2. High-speed downsampled jsQR fallback (sub-8ms execution)
                const vw = videoElement.videoWidth;
                const vh = videoElement.videoHeight;
                if (vw > 0 && vh > 0) {
                    const scale = Math.min(1, 640 / Math.max(vw, vh));
                    const scanWidth = Math.round(vw * scale);
                    const scanHeight = Math.round(vh * scale);

                    if (canvas.width !== scanWidth || canvas.height !== scanHeight) {
                        canvas.width = scanWidth;
                        canvas.height = scanHeight;
                    }
                    ctx.drawImage(videoElement, 0, 0, scanWidth, scanHeight);
                    const imageData = ctx.getImageData(0, 0, scanWidth, scanHeight);
                    const code = jsQR(imageData.data, scanWidth, scanHeight, {
                        inversionAttempts: 'dontInvert',
                    });

                    if (code?.data && !isProcessingRef.current) {
                        handleScanRef.current(code.data);
                        return;
                    }
                }
            }

            if (isScanning) {
                animFrameRef.current = requestAnimationFrame(scan);
            }
        };

        animFrameRef.current = requestAnimationFrame(scan);

        return () => {
            isScanning = false;
            cancelAnimationFrame(animFrameRef.current);
        };
    }, [isAuthenticated, hasCameraPermission]);

    if (!isAuthenticated) {
        return (
            <div
                className="relative flex min-h-screen items-center justify-center bg-cover bg-center bg-no-repeat p-4 overflow-y-auto"
                style={{ backgroundImage: "url('/cog-bg.png')" }}
            >
                <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]" />
                <Card className="relative z-10 w-full max-w-sm rounded-2xl border border-white/20 bg-card/95 backdrop-blur-md shadow-none p-5 sm:p-7 my-auto animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex flex-col items-center text-center space-y-2 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 mb-1">
                            <ScanLine className="h-6 w-6" />
                        </div>
                        <h2 className="font-headline text-2xl font-bold tracking-tight text-foreground">
                            Meal Stub Scanner
                        </h2>
                        <p className="text-xs text-muted-foreground leading-relaxed max-w-[260px]">
                            Enter the scanner password to unlock camera scanning.
                        </p>
                    </div>

                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (isValidPassword(passwordInput)) {
                                setIsAuthenticated(true);
                                toast({ title: 'Scanner Unlocked', description: 'Scanner is now active.' });
                            } else {
                                toast({
                                    variant: 'destructive',
                                    title: 'Invalid Password',
                                    description: 'Incorrect scanner password.',
                                });
                            }
                        }}
                        className="flex flex-col gap-3.5"
                    >
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                className="flex h-11 w-full rounded-xl border border-input/80 bg-background/90 px-3.5 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all font-medium"
                                value={passwordInput}
                                onChange={e => setPasswordInput(e.target.value)}
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                tabIndex={-1}
                                title={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        <Button type="submit" className="w-full rounded-xl h-11 font-bold text-sm shadow-none hover:shadow-none transition-all cursor-pointer">
                            Unlock Scanner
                        </Button>
                    </form>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen h-[100dvh] bg-background overflow-hidden">
            {/* Fixed Header Pinned to Top */}
            <header className="flex items-center justify-between border-b border-border/80 px-4 sm:px-6 py-2 sm:py-3.5 shrink-0 bg-background/95 backdrop-blur-md z-40">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-base sm:text-xl font-headline font-bold leading-tight">Meal Stub Scanner</h1>
                        <p className="text-[11px] sm:text-xs text-muted-foreground hidden xs:block">Scan QR codes to claim meal stubs in real time.</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {devices.length > 1 && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 rounded-xl text-xs"
                            onClick={() => {
                                const idx = devices.findIndex(d => d.deviceId === selectedDeviceId);
                                setSelectedDeviceId(devices[(idx + 1) % devices.length].deviceId);
                            }}
                        >
                            <SwitchCamera className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Switch Camera</span>
                        </Button>
                    )}

                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                        onClick={() => {
                            if (scannerSettings?.requirePasswordToLock === false) {
                                setIsAuthenticated(false);
                                setPasswordInput('');
                                toast({ title: 'Scanner Locked', description: 'The scanner session has been locked.' });
                            } else {
                                setLockPassword('');
                                setLockPasswordError('');
                                setIsLockModalOpen(true);
                            }
                        }}
                        title="Lock Scanner"
                    >
                        <Lock className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Lock</span>
                    </Button>
                </div>
            </header>

            <main className="grid flex-1 min-h-0 grid-cols-1 landscape:grid-cols-2 md:grid-cols-2 gap-4 sm:gap-6 px-4 sm:px-6 py-3 sm:py-5 w-full overflow-y-auto">
                {/* Scanner Viewfinder Card */}
                <Card className="flex flex-col rounded-2xl border border-border/80 shadow-xs h-full">
                    <CardHeader className="text-center pb-2 pt-3 sm:pt-5 shrink-0">
                        <div className="flex justify-center mb-1">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-xs">
                                <ScanLine className="h-5 w-5" />
                            </div>
                        </div>
                        <CardTitle className="font-headline text-lg sm:text-xl font-bold">Live Scanner</CardTitle>
                        <CardDescription className="text-xs">Position the worker's QR code in the center frame.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0 p-3 sm:p-5 flex flex-col items-center justify-center">
                        <div className="w-full max-w-md lg:max-w-lg mx-auto space-y-3 h-full flex flex-col justify-center">
                            <div className="relative w-full aspect-[4/3] max-h-[340px] sm:max-h-[400px] lg:max-h-[460px] bg-slate-950 rounded-2xl overflow-hidden border border-border/60 shadow-inner mx-auto my-auto">
                                <video
                                    ref={videoRef}
                                    className="absolute inset-0 w-full h-full object-cover"
                                    autoPlay
                                    muted
                                    playsInline
                                />
                                {/* Hidden canvas for jsQR capture */}
                                <canvas ref={canvasRef} className="hidden" />

                                {/* Targeting box */}
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="w-44 h-44 sm:w-52 sm:h-52 md:w-56 md:h-56 border-2 border-dashed border-primary/80 rounded-2xl animate-pulse" />
                                </div>

                                {isProcessing && (
                                    <div className="absolute inset-0 bg-black/60 backdrop-blur-2xs flex flex-col items-center justify-center gap-2">
                                        <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
                                        <span className="text-xs font-bold text-white tracking-wide">Processing Scan...</span>
                                    </div>
                                )}

                                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse pointer-events-none" />
                            </div>

                            {/* Live Result Feedback Banner */}
                            {lastScanResult && (
                                <div
                                    className={`p-3.5 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${lastScanResult.status === 'success'
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                                        : lastScanResult.status === 'warning'
                                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                                            : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                                        }`}
                                >
                                    {lastScanResult.status === 'success' ? (
                                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                    ) : lastScanResult.status === 'warning' ? (
                                        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                                    ) : (
                                        <XCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-xs">{lastScanResult.workerName}</p>
                                        <p className="text-[11px] opacity-90">{lastScanResult.message}</p>
                                    </div>
                                </div>
                            )}

                            {hasCameraPermission === false && (
                                <Alert variant="destructive" className="rounded-xl">
                                    <AlertTitle>Camera Access Required</AlertTitle>
                                    <AlertDescription className="space-y-2 mt-1">
                                        <p>Please allow camera permissions in your device settings to scan.</p>
                                        <div className="flex flex-wrap items-center gap-2 pt-1">
                                            {typeof window !== 'undefined' && !!(window as any).AndroidNativeApp?.openAppSettings && (
                                                <Button
                                                    type="button"
                                                    variant="default"
                                                    size="sm"
                                                    onClick={() => (window as any).AndroidNativeApp.openAppSettings()}
                                                    className="gap-1.5 text-xs"
                                                >
                                                    Open App Settings
                                                </Button>
                                            )}
                                        </div>
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Scan History Card */}
                <Card className="flex flex-col rounded-2xl border border-border/80 shadow-xs h-full">
                    <CardHeader className="pb-3 pt-3 sm:pt-5 border-b border-border/60 shrink-0">
                        <CardTitle className="text-base sm:text-lg flex items-center gap-2 font-headline font-bold">
                            <History className="h-4 w-4 text-primary" />
                            <span>Recent Scans</span>
                        </CardTitle>
                        <CardDescription className="text-xs">Real-time log of scanned meal stubs.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0 overflow-hidden p-3 sm:p-5">
                        <ScrollArea className="h-full max-h-[460px] sm:max-h-[520px] pr-3">
                            {logsLoading ? (
                                <div className="flex justify-center items-center h-32"><LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                            ) : (!dbScanLogs || dbScanLogs.length === 0) ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                                    <ScanLine className="h-8 w-8 text-muted-foreground/30 mb-2" />
                                    <p className="text-xs font-semibold">No recent scans yet</p>
                                    <p className="text-[11px]">Scanned worker meal stubs will show here.</p>
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {dbScanLogs.map(log => {
                                        const logTime = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
                                        return (
                                            <div
                                                key={log.id}
                                                className="p-3 rounded-xl border border-border/60 bg-card hover:bg-muted/30 transition-colors flex items-start gap-2.5"
                                            >
                                                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-emerald-500" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-xs text-foreground leading-snug">{log.details}</p>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                                        {log.scannerName} &bull; {formatDistanceToNow(logTime, { addSuffix: true })}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </main>

            {/* Lock Scanner Confirmation Dialog */}
            <Dialog open={isLockModalOpen} onOpenChange={(open) => {
                setIsLockModalOpen(open);
                if (!open) {
                    setLockPassword('');
                    setLockPasswordError('');
                }
            }}>
                <DialogContent className="sm:max-w-sm rounded-3xl p-6 border-border/80 shadow-2xl">
                    <DialogHeader className="text-center space-y-2">
                        <div className="mx-auto w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center border border-destructive/20 shadow-xs">
                            <Lock className="h-6 w-6" />
                        </div>
                        <DialogTitle className="font-headline text-xl font-bold">Lock Scanner</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Enter a Password to lock the scanner
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleConfirmLock} className="space-y-4 pt-2">
                        <div className="relative">
                            <input
                                type={showLockPassword ? "text" : "password"}
                                value={lockPassword}
                                onChange={(e) => {
                                    setLockPassword(e.target.value);
                                    setLockPasswordError('');
                                }}
                                placeholder="Enter a Password to lock the scanner"
                                autoFocus
                                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 pr-10 text-sm shadow-2xs focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                            <button
                                type="button"
                                onClick={() => setShowLockPassword(!showLockPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                tabIndex={-1}
                            >
                                {showLockPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        {lockPasswordError && (
                            <p className="text-xs text-destructive font-medium text-center">{lockPasswordError}</p>
                        )}
                        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-1">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setIsLockModalOpen(false);
                                    setLockPassword('');
                                    setLockPasswordError('');
                                }}
                                className="w-full sm:w-1/2 rounded-xl h-10 text-xs font-semibold cursor-pointer"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="destructive"
                                className="w-full sm:w-1/2 rounded-xl h-10 text-xs font-semibold cursor-pointer"
                            >
                                Lock Scanner
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
