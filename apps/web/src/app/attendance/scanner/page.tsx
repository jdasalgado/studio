"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Badge, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@studio/ui";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@studio/ui";
import { useToast } from "@/hooks/use-toast";
import {
    ScanLine, ArrowLeft, LoaderCircle, User as UserIcon, SwitchCamera, History,
    CheckCircle2, AlertTriangle, LogIn, LogOut, RefreshCw, Zap, Eye, EyeOff, Lock
} from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@studio/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@studio/ui";
import { ScrollArea } from "@studio/ui";
import { formatDistanceToNow, isToday } from "date-fns";
import { useWorkers } from "@/hooks/use-workers";
import { useAttendance } from "@/hooks/use-attendance";
import { useScanLogs } from "@/hooks/use-scan-logs";
import { useMealStubs } from "@/hooks/use-meal-stubs";
import { useAttendanceSettings } from "@/hooks/use-attendance-settings";
import { useScannerSettings } from "@/hooks/use-scanner-settings";
import { FALLBACK_SCANNER_PASSWORDS } from "@/lib/scanner-config";
import { getWorkerByIdOrWorkerId } from "@/actions/db";
import jsQR from "jsqr";

interface AutoAttendanceScanResult {
    worker: any;
    action: 'Clock In' | 'Clock Out' | 'Cooldown';
    status?: string;
    statusBadgeColor?: 'emerald' | 'amber' | 'blue' | 'rose' | 'muted';
    message: string;
    time: Date;
    success: boolean;
}

export default function QRScannerPage() {
    const router = useRouter();
    const { toast } = useToast();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animFrameRef = useRef<number>(0);
    const streamRef = useRef<MediaStream | null>(null);
    const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
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

    const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
    const [scannedWorker, setScannedWorker] = useState<any | null>(null);
    const [scanResult, setScanResult] = useState<AutoAttendanceScanResult | null>(null);
    const [countdown, setCountdown] = useState<number>(5);
    const [isProcessing, setIsProcessing] = useState(false);
    const [scanMode, setScanMode] = useState<'Attendance' | 'Meal Stub'>('Attendance');
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

    const handleBack = useCallback(() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back();
        } else {
            router.push('/attendance');
        }
    }, [router]);

    const { workers: allWorkers, isLoading: workersLoading } = useWorkers({ limit: 10000, unrestricted: true });
    const { scanLogs, isLoading: logsLoading, createScanLog: createScanLogSql } = useScanLogs(50, 'Attendance');
    const { createAttendanceRecord: createAttendanceSql, recordAutoAttendance: recordAutoAttendanceSql } = useAttendance();
    const { mealStubs: allMealStubs, updateMealStub: updateMealStubSql } = useMealStubs();
    const { settings: shiftSettings } = useAttendanceSettings();

    const requestCameraPermission = useCallback(async () => {
        if (typeof window !== 'undefined' && (window as any).AndroidNativeApp?.requestCameraPermission) {
            try {
                (window as any).AndroidNativeApp.requestCameraPermission();
            } catch (e) {
                console.error("Native camera request error:", e);
            }
        }

        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            toast({ variant: 'destructive', title: 'Camera Not Supported', description: 'Your browser or device does not support camera access.' });
            setHasCameraPermission(false);
            return;
        }

        try {
            const initialStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' } }
            });
            initialStream.getTracks().forEach(t => t.stop());

            setHasCameraPermission(true);

            if (navigator.mediaDevices.enumerateDevices) {
                const allDevices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
                setDevices(videoDevices);

                const backCamera = videoDevices.find(d => {
                    const label = (d.label || '').toLowerCase();
                    return label.includes('back') || label.includes('rear') || label.includes('environment');
                });

                if (backCamera) {
                    setSelectedDeviceId(backCamera.deviceId);
                } else if (videoDevices.length > 0) {
                    setSelectedDeviceId(videoDevices[0].deviceId);
                }
            }
        } catch (err) {
            console.error('Camera permission/access error:', err);
            setHasCameraPermission(false);
            toast({
                variant: 'destructive',
                title: 'Camera Access Denied',
                description: 'Please enable camera permissions in your device settings.',
            });
        }
    }, [toast]);

    // Get camera devices on auth
    useEffect(() => {
        if (!isAuthenticated) return;
        requestCameraPermission();
    }, [isAuthenticated, requestCameraPermission]);

    const handleSwitchCamera = () => {
        if (devices.length < 2) return;
        const idx = devices.findIndex(d => d.deviceId === selectedDeviceId);
        setSelectedDeviceId(devices[(idx + 1) % devices.length].deviceId);
    };

    // Audio chime generator using Web Audio API
    const playBeep = useCallback((type: 'success' | 'warning' | 'error') => {
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
        if (resetTimeoutRef.current) {
            clearTimeout(resetTimeoutRef.current);
            resetTimeoutRef.current = null;
        }
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
        setScannedWorker(null);
        setScanResult(null);
        setCountdown(5);
        isProcessingRef.current = false;
        setIsProcessing(false);

        if (videoRef.current) {
            if (streamRef.current && videoRef.current.srcObject !== streamRef.current) {
                videoRef.current.srcObject = streamRef.current;
            }
            videoRef.current.play().catch(() => {});
        }
    }, []);

    const logScanEvent = useCallback(async (logData: any) => {
        try {
            await createScanLogSql({ ...logData, scannerId: 'public_scanner', scannerName: 'Public Scanner' });
        } catch (e) {
            console.error("Failed to write to scan log", e);
        }
    }, [createScanLogSql]);

    const handleScan = useCallback(async (data: string) => {
        if (!data || isProcessingRef.current) return;
        isProcessingRef.current = true;
        setIsProcessing(true);

        let type = 'COG_USER';
        let payload = data.trim();
        let tokenOrTs: string | undefined = undefined;

        if (data.includes(':')) {
            const parts = data.split(':');
            type = parts[0];
            payload = parts[1] || parts[0];
            tokenOrTs = parts[2];
        }

        let worker = allWorkers?.find(w => w.id === payload || w.workerId === payload || w.email?.toLowerCase() === payload.toLowerCase());

        // Fallback: If not in memory cache (e.g. newly created account, or created while scanner was already open), lookup directly from DB
        if (!worker && payload) {
            try {
                worker = (await getWorkerByIdOrWorkerId(payload)) as any;
            } catch (err) {
                console.error("Direct worker lookup error:", err);
            }
        }

        if (scanMode === 'Attendance') {
            if (type !== 'ATTENDANCE' && type !== 'STATIC' && type !== 'COG_USER' && type !== 'MEAL_STUB') {
                playBeep('error');
                toast({ variant: 'destructive', title: 'Invalid QR Type', description: 'This QR code cannot be used for attendance.' });
                setTimeout(resetScanner, 2000);
                return;
            }
            if (!worker) {
                playBeep('error');
                toast({ variant: 'destructive', title: 'Worker Not Found', description: 'The scanned ID does not correspond to any worker.' });
                setTimeout(resetScanner, 2000);
                return;
            }
            if (worker.qrToken && tokenOrTs && worker.qrToken !== tokenOrTs) {
                playBeep('error');
                toast({ variant: 'destructive', title: 'Invalid or Expired QR', description: 'This QR code has been regenerated. Please use your latest QR code.' });
                setTimeout(resetScanner, 3000);
                return;
            }

            // --- AUTOMATIC HYBRID ATTENDANCE (Zero-click) ---
            try {
                const result = await recordAutoAttendanceSql(worker.id);

                if (result.action === 'Cooldown') {
                    playBeep('warning');
                    toast({
                        variant: 'destructive',
                        title: 'Cooldown Active',
                        description: result.message
                    });
                    setScanResult({
                        worker,
                        action: 'Cooldown',
                        status: 'Cooldown',
                        statusBadgeColor: 'amber',
                        message: result.message,
                        time: new Date(result.time),
                        success: false
                    });
                } else {
                    playBeep('success');
                    const details = `${result.action === 'Clock In' ? 'Timed in' : 'Timed out'} ${worker.firstName} ${worker.lastName} (${result.status}).`;
                    toast({
                        title: `${result.action} Successful!`,
                        description: details
                    });
                    logScanEvent({
                        scanType: 'Attendance',
                        details,
                        targetUserId: worker.id,
                        targetUserName: `${worker.firstName} ${worker.lastName}`
                    });
                    setScanResult({
                        worker,
                        action: result.action,
                        status: result.status,
                        statusBadgeColor: result.statusBadgeColor as any,
                        message: result.message,
                        time: new Date(result.time),
                        success: true
                    });
                }
            } catch (e: any) {
                console.error("Auto attendance error:", e);
                playBeep('error');
                toast({ variant: 'destructive', title: 'Attendance Error', description: e?.message || 'Could not record attendance.' });
                setTimeout(resetScanner, 2500);
                return;
            }

            // Auto-reset back to live scan after 5 seconds with live countdown
            setCountdown(5);
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            resetTimeoutRef.current = setTimeout(() => {
                resetScanner();
            }, 5000);
            return;
        }

        if (scanMode === 'Meal Stub') {
            if (type !== 'MEAL_STUB' && type !== 'COG_USER') {
                playBeep('error');
                toast({ variant: 'destructive', title: 'Invalid QR Type', description: 'This QR code is not a Meal Stub.' });
                setTimeout(resetScanner, 2000);
                return;
            }
            try {
                if (worker?.qrToken && tokenOrTs && worker.qrToken !== tokenOrTs) {
                    playBeep('error');
                    toast({ variant: 'destructive', title: 'Invalid or Expired QR', description: 'This QR code has been regenerated. Please use your latest QR code.' });
                    setTimeout(resetScanner, 3000);
                    return;
                }
                if (tokenOrTs && typeof tokenOrTs === 'string' && /^\d{13}$/.test(tokenOrTs)) {
                    const diffMins = (Date.now() - parseInt(tokenOrTs, 10)) / 1000 / 60;
                    if (diffMins > 5) {
                        playBeep('warning');
                        toast({ variant: 'destructive', title: 'QR Code Expired', description: 'Please refresh your meal stub QR code and try again.' });
                        setTimeout(resetScanner, 2000);
                        return;
                    }
                }
                const todaysStub = allMealStubs?.find(s => {
                    if (s.workerId !== payload && s.workerId !== worker?.id) return false;
                    if (s.status !== 'Issued') return false;
                    const d = s.date instanceof Date ? s.date : new Date(s.date);
                    return isToday(d);
                });
                if (todaysStub) {
                    await updateMealStubSql({ id: todaysStub.id, data: { status: 'Claimed', claimedAt: new Date() } });
                    playBeep('success');
                    const details = `Claimed meal stub for ${todaysStub.workerName}.`;
                    toast({ title: "Meal Stub Claimed!", description: details });
                    logScanEvent({ scanType: 'Meal Stub', details, mealStubId: todaysStub.id, targetUserId: todaysStub.workerId, targetUserName: todaysStub.workerName });
                } else {
                    playBeep('error');
                    const workerName = worker ? `${worker.firstName} ${worker.lastName}` : 'this user';
                    toast({ variant: "destructive", title: "No Meal Stub Found", description: `No valid meal stub found for ${workerName} for today.` });
                }
            } catch (e) {
                console.error("Error processing meal stub:", e);
                playBeep('error');
                toast({ variant: "destructive", title: "Error", description: "Could not process meal stub scan." });
            } finally {
                setTimeout(resetScanner, 3000);
            }
            return;
        }

        toast({ variant: 'destructive', title: 'Unknown Scan', description: 'Invalid QR code format.' });
        setTimeout(resetScanner, 2000);
    }, [isProcessing, scanMode, allWorkers, allMealStubs, updateMealStubSql, recordAutoAttendanceSql, toast, resetScanner, logScanEvent, playBeep]);

    const handleRecordAttendance = useCallback(async (type: 'Clock In' | 'Clock Out') => {
        if (!scannedWorker?.id) return;
        try {
            await createAttendanceSql({ workerProfileId: scannedWorker.id, type });
            const details = `${type === 'Clock In' ? 'Timed in' : 'Timed out'} ${scannedWorker.firstName} ${scannedWorker.lastName}.`;
            toast({ title: "Success", description: details });
            logScanEvent({ scanType: 'Attendance', details, targetUserId: scannedWorker.id, targetUserName: `${scannedWorker.firstName} ${scannedWorker.lastName}` });
        } catch (e) {
            console.error("Failed to record attendance", e);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not record attendance.' });
        } finally {
            resetScanner();
        }
    }, [createAttendanceSql, logScanEvent, resetScanner, scannedWorker, toast]);

    // jsQR scan loop — start camera stream
    useEffect(() => {
        if (!isAuthenticated || !hasCameraPermission) return;

        const videoElement = videoRef.current;
        if (!videoElement) return;

        let isSubscribed = true;

        const start = async () => {
            try {
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(t => t.stop());
                    streamRef.current = null;
                }

                const constraints: MediaStreamConstraints = {
                    video: selectedDeviceId
                        ? { deviceId: { ideal: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
                        : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
                };

                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                if (!isSubscribed) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                streamRef.current = stream;
                videoElement.srcObject = stream;
                videoElement.setAttribute('playsinline', 'true');
                videoElement.play().catch((err) => {
                    // Ignore AbortError when video is interrupted
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
            isSubscribed = false;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
                streamRef.current = null;
            }
        };
    }, [selectedDeviceId, hasCameraPermission, isAuthenticated]);

    // Stable ref for handleScan
    const handleScanRef = useRef(handleScan);
    useEffect(() => {
        handleScanRef.current = handleScan;
    }, [handleScan]);

    // High-speed hardware-accelerated + downsampled jsQR scan loop
    useEffect(() => {
        if (!isAuthenticated || !hasCameraPermission) return;
        const videoElement = videoRef.current;
        const canvas = canvasRef.current;
        if (!videoElement || !canvas) return;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        let active = true;

        const scan = async () => {
            if (!active) return;

            if (videoElement.readyState >= 2 && !isProcessingRef.current && !scannedWorker && !scanResult) {
                // 1. Ultra-fast Native BarcodeDetector (Hardware Accelerated, < 2ms)
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

                // 2. High-speed downsampled jsQR fallback (Sub-8ms execution)
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

            if (active) {
                animFrameRef.current = requestAnimationFrame(scan);
            }
        };

        animFrameRef.current = requestAnimationFrame(scan);
        return () => {
            active = false;
            cancelAnimationFrame(animFrameRef.current);
        };
    }, [isAuthenticated, hasCameraPermission, scannedWorker, scanResult]);

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
                            Attendance Scanner
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
                        <h1 className="text-base sm:text-xl font-headline font-bold leading-tight">
                            Attendance Scanner
                        </h1>
                        <p className="text-[11px] sm:text-xs text-muted-foreground hidden xs:block">
                            Scan QR codes for automatic attendance.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {devices.length > 1 && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 rounded-xl text-xs"
                            onClick={handleSwitchCamera}
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
                        <CardTitle className="font-headline text-lg sm:text-xl font-bold">Live Scan</CardTitle>
                        <CardDescription className="text-xs">Position the QR code in the frame. System automatically records Time In / Time Out.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0 p-3 sm:p-5 flex flex-col items-center justify-center">
                        <div className="w-full max-w-md lg:max-w-lg mx-auto space-y-3 h-full flex flex-col justify-center">
                            <div className="space-y-3 w-full my-auto">
                                <div className="relative w-full aspect-[4/3] max-h-[340px] sm:max-h-[400px] lg:max-h-[460px] bg-slate-950 rounded-2xl overflow-hidden border border-border/60 shadow-inner mx-auto">
                                    <video
                                        ref={videoRef}
                                        className="absolute inset-0 w-full h-full object-cover"
                                        autoPlay
                                        muted
                                        playsInline
                                    />
                                    {/* Hidden canvas for jsQR capture */}
                                    <canvas ref={canvasRef} className="hidden" />

                                    {/* Targeting box (shown only when scanning) */}
                                    {!scanResult && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="w-44 h-44 sm:w-52 sm:h-52 md:w-56 md:h-56 border-2 border-dashed border-primary/80 rounded-2xl animate-pulse" />
                                        </div>
                                    )}

                                    {(isProcessing || workersLoading) && !scanResult && (
                                        <div className="absolute inset-0 bg-black/60 backdrop-blur-2xs flex flex-col items-center justify-center gap-2 z-10">
                                            <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
                                            <span className="text-xs font-bold text-white tracking-wide">Processing Scan...</span>
                                        </div>
                                    )}

                                    {!scanResult && (
                                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse pointer-events-none" />
                                    )}

                                    {/* Scan Result Overlay — keeps video mounted in background, eliminating black screen */}
                                    {scanResult && (
                                        <div className="absolute inset-0 z-20 bg-card/95 backdrop-blur-md p-4 flex flex-col items-center justify-center overflow-y-auto animate-in fade-in duration-200">
                                            {/* Avatar & Badge Icon */}
                                            <div className="relative mb-2 shrink-0">
                                                <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-4 border-background shadow-xl ring-4 ring-offset-2 ring-primary/20">
                                                    <AvatarImage src={scanResult.worker.avatarUrl} alt={`${scanResult.worker.firstName} ${scanResult.worker.lastName}`} />
                                                    <AvatarFallback><UserIcon className="h-8 w-8 sm:h-10 sm:w-10" /></AvatarFallback>
                                                </Avatar>
                                                <div className={`absolute -bottom-1 -right-1 p-1 rounded-full shadow-lg text-white ${scanResult.action === 'Clock In'
                                                    ? 'bg-emerald-600'
                                                    : scanResult.action === 'Clock Out'
                                                        ? 'bg-blue-600'
                                                        : 'bg-amber-600'
                                                    }`}>
                                                    {scanResult.action === 'Clock In' ? (
                                                        <LogIn className="h-3.5 w-3.5" />
                                                    ) : scanResult.action === 'Clock Out' ? (
                                                        <LogOut className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <AlertTriangle className="h-3.5 w-3.5" />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Worker Name & Role */}
                                            <h2 className="text-base sm:text-lg font-headline font-bold text-foreground">
                                                {scanResult.worker.firstName} {scanResult.worker.lastName}
                                            </h2>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5">
                                                {scanResult.worker.roleId || scanResult.worker.employmentType || 'Personnel'}
                                            </p>

                                            {/* Action & Status Card */}
                                            <div className={`w-full max-w-xs rounded-xl p-2.5 border mb-2 flex flex-col items-center gap-0.5 shadow-sm ${scanResult.action === 'Clock In'
                                                ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                                                : scanResult.action === 'Clock Out'
                                                    ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800'
                                                    : 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
                                                }`}>
                                                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${scanResult.action === 'Clock In'
                                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                                                    : scanResult.action === 'Clock Out'
                                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200'
                                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                                                    }`}>
                                                    {scanResult.action === 'Clock In' ? '✓ TIMED IN' : scanResult.action === 'Clock Out' ? '✓ TIMED OUT' : '⚠ COOLDOWN ACTIVE'}
                                                </span>

                                                <span className="text-xl font-extrabold font-mono tracking-tight text-foreground my-0.5">
                                                    {scanResult.time ? new Date(scanResult.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : ''}
                                                </span>

                                                <div className="flex items-center gap-1">
                                                    <Badge variant={
                                                        scanResult.status === 'On Time' || scanResult.status === 'Shift Completed'
                                                            ? 'success'
                                                            : scanResult.status === 'Late' || scanResult.status === 'Undertime'
                                                                ? 'warning'
                                                                : 'secondary'
                                                    } className="text-[10px] px-2 py-0">
                                                        {scanResult.status || 'Recorded'}
                                                    </Badge>
                                                </div>

                                                <p className="text-[10px] text-muted-foreground px-1 text-center leading-tight mt-0.5">
                                                    {scanResult.message}
                                                </p>
                                            </div>

                                            {/* Auto-reset indicator */}
                                            <div className="w-full max-w-xs flex flex-col items-center gap-1">
                                                <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                                                    <div
                                                        className="bg-primary h-full transition-all duration-1000 ease-linear"
                                                        style={{ width: `${(countdown / 5) * 100}%` }}
                                                    />
                                                </div>
                                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                    <RefreshCw className="h-2.5 w-2.5 animate-spin text-primary" /> Auto-resetting in {countdown}s...
                                                </p>
                                                <Button variant="ghost" size="sm" onClick={resetScanner} className="text-xs text-primary hover:underline h-6 mt-0">
                                                    Scan next worker now →
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {devices.length > 1 && !scanResult && (
                                        <div className="absolute bottom-3 right-3 z-10">
                                            <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer" onClick={handleSwitchCamera}>
                                                <SwitchCamera className="h-4 w-4" />
                                                <span className="sr-only">Switch Camera</span>
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {hasCameraPermission === false && (
                                    <Alert variant="destructive" className="rounded-xl">
                                        <AlertTitle>Camera Access Required</AlertTitle>
                                        <AlertDescription className="space-y-2 mt-1">
                                            <p>Please allow camera permissions in your device settings to scan.</p>
                                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={requestCameraPermission}
                                                    className="gap-1.5 text-xs bg-background hover:bg-muted text-foreground"
                                                >
                                                    <RefreshCw className="h-3.5 w-3.5" />
                                                    Retry Camera Access
                                                </Button>
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
                                            <div className="text-[11px] text-muted-foreground/90 mt-2 p-2.5 rounded-lg bg-background/50 border border-destructive/20 space-y-1">
                                                <p className="font-semibold text-foreground">Using the Mobile APK?</p>
                                                <p>
                                                    Go to phone <strong>Settings &gt; Apps &gt; COG App &gt; Permissions &gt; Camera</strong> and select <strong>&quot;Allow only while using the app&quot;</strong>, then return here and tap <strong>Retry</strong>.
                                                </p>
                                            </div>
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Scans Card */}
                <Card className="flex flex-col rounded-2xl border border-border/80 shadow-xs h-full">
                    <CardHeader className="pb-3 pt-3 sm:pt-5 border-b border-border/60 shrink-0">
                        <CardTitle className="text-base sm:text-lg flex items-center gap-2 font-headline font-bold">
                            <History className="h-4 w-4 text-primary" />
                            <span>Recent Scans</span>
                        </CardTitle>
                        <CardDescription className="text-xs">Real-time log of attendance scans.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-0 overflow-hidden p-3 sm:p-5">
                        <ScrollArea className="h-full max-h-[460px] sm:max-h-[520px] pr-3">
                            {logsLoading ? (
                                <div className="flex justify-center items-center h-32"><LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                            ) : (!scanLogs || scanLogs.length === 0) ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                                    <ScanLine className="h-8 w-8 text-muted-foreground/30 mb-2" />
                                    <p className="text-xs font-semibold">No recent scans yet</p>
                                    <p className="text-[11px]">Scanned worker attendance will show here.</p>
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {scanLogs.map(log => {
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
                                                        {log.scannerName} &bull; {logTime ? formatDistanceToNow(logTime, { addSuffix: true }) : 'Just now'}
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
