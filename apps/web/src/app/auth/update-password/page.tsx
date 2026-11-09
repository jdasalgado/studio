"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@studio/database";
import { Button, Input, Label, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@studio/ui";
import { useToast } from "@/hooks/use-toast";
import { Lock, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { LandingNav } from "@/components/landing/landing-nav";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const hasAttemptedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    try {
      localStorage.setItem('cog_last_activity_time', Date.now().toString());
    } catch {}

    const initRecovery = async () => {
      if (typeof window === "undefined") return;

      try {
        // 1. Check URL Search Parameters (direct recovery link with token_hash)
        const searchParams = new URLSearchParams(window.location.search);
        const tokenHash = searchParams.get("token_hash") || searchParams.get("token");
        const type = searchParams.get("type") || "recovery";
        const queryError = searchParams.get("error_description") || searchParams.get("error");

        if (queryError) {
          setErrorMessage(decodeURIComponent(queryError.replace(/\+/g, " ")));
          setVerifying(false);
          return;
        }

        if (tokenHash) {
          if (hasAttemptedRef.current) {
            const { data: currentSession } = await supabase.auth.getSession();
            if (currentSession?.session) {
              setSessionReady(true);
              setErrorMessage(null);
            }
            setVerifying(false);
            return;
          }

          hasAttemptedRef.current = true;
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: (type as any) || "recovery",
          });

          if (error) {
            console.error("verifyOtp error:", error);
            const { data: currentSession } = await supabase.auth.getSession();
            if (currentSession?.session) {
              setSessionReady(true);
              setErrorMessage(null);
            } else {
              setErrorMessage(error.message || "This password reset link is invalid or has expired.");
            }
          } else if (data?.session || data?.user) {
            setSessionReady(true);
            setErrorMessage(null);
            try {
              window.history.replaceState({}, '', window.location.pathname);
              localStorage.setItem('cog_last_activity_time', Date.now().toString());
            } catch {}
          }
          setVerifying(false);
          return;
        }

        // 2. Check URL Hash parameters (redirected from Supabase verify action_link)
        if (window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const hashError = hashParams.get("error_description") || hashParams.get("error");
          if (hashError) {
            setErrorMessage(decodeURIComponent(hashError.replace(/\+/g, " ")));
            setVerifying(false);
            return;
          }

          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              setErrorMessage(error.message || "Failed to establish security session.");
            } else if (data?.session) {
              setSessionReady(true);
              setErrorMessage(null);
              try {
                window.history.replaceState({}, '', window.location.pathname);
                localStorage.setItem('cog_last_activity_time', Date.now().toString());
              } catch {}
            }
            setVerifying(false);
            return;
          }
        }

        // 3. Fallback: check if active user session already exists
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          setSessionReady(true);
        } else {
          setErrorMessage("No active password reset session found. Please request a new reset link.");
        }
      } catch (err: any) {
        console.error("Recovery init error:", err);
        setErrorMessage(err?.message || "Failed to verify password reset link.");
      } finally {
        setVerifying(false);
      }
    };

    initRecovery();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ variant: "destructive", title: "Error", description: "Passwords do not match." });
      return;
    }

    if (password.length < 6) {
      toast({ variant: "destructive", title: "Error", description: "Password must be at least 6 characters." });
      return;
    }

    if (password.length > 64) {
      toast({ variant: "destructive", title: "Error", description: "Password must not exceed 64 characters." });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      toast({ 
        title: "Success", 
        description: "Your password has been successfully updated! You can now log in." 
      });

      // Sign out to ensure clean state and prompt login with new credentials
      await supabase.auth.signOut().catch(() => {});
      router.push("/login?reset=success");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Could not update password.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 pt-20">
      {/* Floating Capsule Header */}
      <LandingNav currentPath="/auth/update-password" />

      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/cog-bg.png"
          alt="Background"
          fill
          className="object-cover"
          priority
          quality={90}
        />
        {/* Overlay for better card visibility */}
        <div className="absolute inset-0 bg-black/30" />
        {/* Vignette effect - dark shadow around edges */}
        <div className="absolute inset-0 shadow-[inset_0_0_120px_60px_rgba(0,0,0,0.5)]" />
      </div>

      <Card className="relative z-10 mx-auto max-w-[470px] w-full shadow-[0_8px_32px_0_rgba(0,0,0,0.9),0_0_80px_rgba(0, 0, 0, 0.9)] backdrop-blur-xl bg-black/15 border border-black/20 dark:bg-black/10 dark:border-black/10 animate-in fade-in zoom-in-95 slide-in-from-bottom-6 duration-700 ease-out">
        <CardHeader className="space-y-2.5 text-center pt-7 pb-3 px-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-md mb-2 shadow-inner border border-white/20">
            <Lock className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="font-headline text-2xl text-white">Update Password</CardTitle>
          <CardDescription className="text-white/90 text-sm">
            Enter your new password below to regain access to your account.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-8 pb-7">
          {verifying ? (
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-white">
              <Loader2 className="h-8 w-8 animate-spin text-white/80" />
              <p className="text-sm text-white/80">Verifying security link...</p>
            </div>
          ) : errorMessage && !sessionReady ? (
            <div className="space-y-4 text-center">
              <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-sm flex items-start gap-3 text-left">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">Link Invalid or Expired</p>
                  <p className="text-xs text-red-200 mt-1">{errorMessage}</p>
                </div>
              </div>
              <Button asChild className="w-full bg-white text-black hover:bg-gray-200 font-semibold h-11">
                <Link href="/login">Back to Login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2 text-left">
                <Label htmlFor="password" className="text-white">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    maxLength={64}
                    value={password}
                    onChange={(e) => setPassword(e.target.value.slice(0, 64))}
                    placeholder="Enter new password (min. 6 chars)"
                    minLength={6}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/30 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors cursor-pointer p-0.5 rounded focus:outline-hidden"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2 text-left">
                <Label htmlFor="confirmPassword" className="text-white">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    maxLength={64}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value.slice(0, 64))}
                    placeholder="Confirm new password"
                    minLength={6}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/30 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white transition-colors cursor-pointer p-0.5 rounded focus:outline-hidden"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full bg-white text-black hover:bg-gray-200 mt-2 font-semibold h-11" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
