"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { LoaderCircle, Eye, EyeOff } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  Button,
  Input,
  Label,
} from "@studio/ui";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@studio/store";
import { supabase } from "@studio/database";
import { validateLoginIdentifier } from "@/actions/legacy-auth";
import { requestPasswordReset } from "@/actions/auth";
import { recordAuthActivity } from "@/actions/db";
import { LandingNav } from "@/components/landing/landing-nav";
import { useIsNativeApp } from "@/lib/native-app";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Reset Password state
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { user, isUserLoading } = useAuthStore();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("reset") === "success") {
        toast({
          title: "Password Updated",
          description: "Your password was changed successfully! Please log in with your Worker ID and new password.",
        });
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (params.get("reason") === "idle") {
        toast({
          variant: "destructive",
          title: "Session Expired",
          description: "You have been logged out due to 10 minutes of inactivity.",
        });
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [toast]);

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push("/dashboard");
    }
  }, [user, isUserLoading, router]);

  const handleSignIn = async () => {
    if (!identifier.trim() || !password) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please enter your Worker ID and password.",
      });
      return;
    }

    setIsSigningIn(true);
    try {
      const validation = await validateLoginIdentifier(identifier.trim(), "worker");
      if (!validation.success) {
        toast({
          variant: "destructive",
          title: validation.isDeactivated ? "Account Deactivated" : "Login Failed",
          description: validation.error || "Unable to proceed with login.",
        });
        setIsSigningIn(false);
        return;
      }

      const loginEmail = validation.email || identifier.trim();

      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (error) throw error;

      if (authData?.user?.id && typeof window !== "undefined") {
        sessionStorage.setItem(`cog_session_login_${authData.user.id}`, Date.now().toString());
      }

      try {
        await recordAuthActivity("User Login", {
          userId: authData?.user?.id || null,
          email: loginEmail,
          details: "User logged in successfully via Web",
        });
      } catch (logErr) {
        console.warn('Failed to record login activity:', logErr);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message || "Invalid login credentials.",
      });
      setIsSigningIn(false);
    }
  };

  const handlePasswordReset = async () => {
    const input = resetIdentifier.trim();
    if (!input) {
      toast({
        variant: "destructive",
        title: "Worker ID or Email Required",
        description: "Please enter your Worker ID or registered email.",
      });
      return;
    }
    setIsResetting(true);
    try {
      const res = await requestPasswordReset(input, window.location.origin);
      if (!res.success) {
        toast({
          variant: "destructive",
          title: res.isDeactivated ? "Account Deactivated" : "Reset Failed",
          description: res.error || "Failed to send reset link.",
        });
        return;
      }
      toast({
        title: "Reset Email Sent",
        description: `Instructions sent to ${res.email}`,
      });
      setIsResetDialogOpen(false);
      setResetIdentifier("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Reset Failed",
        description: error.message || "Failed to send reset link.",
      });
    } finally {
      setIsResetting(false);
    }
  };

  const isNative = useIsNativeApp();

  return (
    <div className={`relative flex min-h-screen items-center justify-center p-4 ${isNative ? 'pt-4' : 'pt-20'}`}>
      {/* Floating Capsule Header - only displayed on Web, hidden on APK */}
      {!isNative && <LandingNav currentPath="/login" />}

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
          <div className="flex justify-center items-center">
            <Image
              src="/church-logo.png"
              alt="COG Logo"
              width={78}
              height={78}
              className="rounded-sm drop-shadow-[0_4px_8px_rgba(0, 0, 0, 0.9)]"
            />
          </div>
          <CardTitle className="font-headline text-2xl text-white">COG App</CardTitle>
          <CardDescription className="text-white/90 text-sm">
            Enter your Worker ID and Password
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-7">
          <div className="grid gap-3.5">
            {/* Worker ID Login Button */}
            <Button
              type="button"
              variant="default"
              className="w-full h-10 font-semibold cursor-default"
            >
              Worker ID Login
            </Button>

            {/* Worker ID */}
            <div className="grid gap-2">
              <Label htmlFor="identifier" className="text-white text-sm font-medium">
                Worker ID
              </Label>
              <Input
                id="identifier"
                type="text"
                placeholder="e.g. 01042"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={isSigningIn}
                onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                className="h-11 sm:h-10 text-sm font-sans"
              />
            </div>

            {/* Password */}
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password" className="text-white text-sm font-medium">
                  Password
                </Label>
                <Dialog
                  open={isResetDialogOpen}
                  onOpenChange={(open) => {
                    setIsResetDialogOpen(open);
                    if (open && identifier) {
                      setResetIdentifier(identifier.trim());
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="ml-auto inline-block text-xs sm:text-sm underline text-white/90 hover:text-white transition-colors cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Reset Password</DialogTitle>
                      <DialogDescription>
                        Enter your Worker ID or registered email to receive reset instructions.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-2 py-4">
                      <Label htmlFor="reset-identifier">
                        Worker ID or Email
                      </Label>
                      <Input
                        id="reset-identifier"
                        placeholder="e.g. 01042 or m@example.com"
                        value={resetIdentifier}
                        onChange={(e) => setResetIdentifier(e.target.value)}
                        disabled={isResetting}
                        className="h-11 sm:h-10 text-sm font-sans"
                        onKeyDown={(e) => e.key === "Enter" && handlePasswordReset()}
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        onClick={handlePasswordReset}
                        disabled={isResetting}
                        className="w-full h-11 sm:h-10 text-sm font-medium"
                      >
                        {isResetting && <LoaderCircle className="h-4 w-4 animate-spin mr-2" />}
                        Send Reset Link
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSigningIn}
                  onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                  className="pr-10 h-11 sm:h-10 text-sm font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              onClick={handleSignIn}
              className="w-full h-10 mt-2 font-medium text-sm cursor-pointer"
              disabled={isSigningIn}
            >
              {isSigningIn ? <LoaderCircle className="animate-spin" /> : "Login"}
            </Button>

            {/* Terms & Privacy Notice */}
            <p className="text-xs text-center text-white/80 mt-3 leading-relaxed">
              By signing in, you agree to our{" "}
              <Link
                href="/terms"
                className="text-blue-300 hover:text-white underline underline-offset-2 transition-colors font-semibold"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="text-blue-300 hover:text-white underline underline-offset-2 transition-colors font-semibold"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
