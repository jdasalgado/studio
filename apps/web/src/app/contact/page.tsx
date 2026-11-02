"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@studio/store";
import { isNativeMobileApp } from "@/lib/native-app";
import Image from "next/image";
import Link from "next/link";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Send,
  Sparkles,
  Calendar,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { Button, Input, Textarea, Label } from "@studio/ui";
import { useToast } from "@/hooks/use-toast";
import { showSubmitSuccess, showSubmitError } from "@/hooks/use-submission-modal";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingFooter } from "@/components/landing/landing-footer";
import { isValidPhilippineNumber, cleanPhoneNumber, isValidEmail, isValidName, cleanName, MAX_LENGTHS } from "@/lib/validation";
import { createInquiry } from "@/actions/db";

export default function ContactPage() {
  const router = useRouter();
  const { user, isUserLoading } = useAuthStore();
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    const native = isNativeMobileApp();
    setIsNative(native);
    if (native && !isUserLoading) {
      if (user) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    }
  }, [user, isUserLoading, router]);
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast({
        variant: "destructive",
        title: "Required Fields",
        description: "Please enter your name, email, and message.",
      });
      return;
    }

    if (name.trim().length > MAX_LENGTHS.NAME) {
      toast({
        variant: "destructive",
        title: "Name Too Long",
        description: `Full name must not exceed ${MAX_LENGTHS.NAME} characters.`,
      });
      return;
    }

    if (!isValidName(name.trim(), 2, MAX_LENGTHS.NAME)) {
      toast({
        variant: "destructive",
        title: "Invalid Full Name",
        description: `Please enter a valid name (letters only, up to ${MAX_LENGTHS.NAME} characters).`,
      });
      return;
    }

    if (!isValidEmail(email.trim(), MAX_LENGTHS.EMAIL)) {
      toast({
        variant: "destructive",
        title: "Invalid Email Address",
        description: `Please enter a valid email address (up to ${MAX_LENGTHS.EMAIL} characters).`,
      });
      return;
    }

    if (phone.trim() && !isValidPhilippineNumber(phone.trim())) {
      toast({
        variant: "destructive",
        title: "Invalid Contact Number",
        description: "Phone number must be exactly 11 digits starting with 09 (e.g. 09171234567) and numbers only.",
      });
      return;
    }

    if (message.trim().length > MAX_LENGTHS.MESSAGE) {
      toast({
        variant: "destructive",
        title: "Message Too Long",
        description: `Message must not exceed ${MAX_LENGTHS.MESSAGE} characters.`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createInquiry({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        message: message.trim(),
      });

      if (res.success) {
        showSubmitSuccess({
          title: "Message Sent Successfully!",
          description: "Thank you for reaching out to COG Dasmariñas. Our ministry team has received your message and will get back to you shortly.",
          confirmText: "Done",
        });
        setName("");
        setEmail("");
        setPhone("");
        setMessage("");
      } else {
        toast({
          variant: "destructive",
          title: "Submission Error",
          description: "Could not save your message. Please try again or contact us directly.",
        });
      }
    } catch (err: any) {
      console.error("Error submitting contact inquiry:", err);
      toast({
        variant: "destructive",
        title: "Error Sending Message",
        description: err?.message || "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isNative) return null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100 flex flex-col selection:bg-primary selection:text-white">
      {/* Floating Pill Navigation Header */}
      <LandingNav currentPath="/contact" />

      {/* Header Banner */}
      <section className="relative pt-28 sm:pt-32 pb-16 sm:pb-20 px-4 sm:px-6 overflow-hidden bg-slate-950 text-white">
        {/* Background Ambient Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/cog-bg-9.jpg"
            alt="COG Dasmariñas Contact"
            fill
            className="object-cover opacity-75 scale-105"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/50 via-slate-950/40 to-slate-950/75" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center pt-4 sm:pt-6">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-tight mb-4 sm:mb-6">
            <span className="text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.9)] block mb-1">
              Get in Touch &
            </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-sky-200 to-indigo-200 drop-shadow-sm">
              Visit COG Dasmariñas
            </span>
          </h1>

          <p className="text-base sm:text-xl text-slate-200/90 max-w-3xl mx-auto leading-relaxed drop-shadow">
            Have questions about our Sunday services, ministries, or need prayer? Connect with our pastors and ministry team today.
          </p>
        </div>
      </section>

      {/* Main Content: Info & Interactive Form */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-5 gap-12 items-start animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Left Column: Church Info & Schedule (2 cols) */}
          <div className="lg:col-span-2 space-y-8">
            {/* Contact Details Card */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                Church Information
              </h2>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Location</div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">
                      Church of God Building, Marilag Subdivision, Emilio Aguinaldo Highway
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Contact Number</div>
                    <a
                      href="tel:09952491933"
                      className="text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      09952491933
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Email</div>
                    <a
                      href="mailto:churchofgoddasmamain@gmail.com"
                      className="text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors break-all"
                    >
                      churchofgoddasmamain@gmail.com
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Social Media Channels Card */}
            <div className="bg-gradient-to-br from-blue-900 to-indigo-950 text-white p-6 sm:p-8 rounded-3xl shadow-md border border-blue-800/50">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-1">
                  Official Social Media
                </h2>
                <p className="text-sm text-blue-200">Connect with COG Dasmariñas online</p>
              </div>

              <div className="space-y-3 pt-1 text-sm">
                {/* Facebook */}
                <a
                  href="https://www.facebook.com/cogdasma/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-400/40 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-bold text-white group-hover:text-blue-200 transition-colors">Facebook</div>
                      <div className="text-xs text-blue-200">@cogdasma</div>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-white/50 group-hover:text-white transition-colors" />
                </a>

                {/* Instagram */}
                <a
                  href="https://www.instagram.com/cogdasma"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-pink-400/40 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-bold text-white group-hover:text-pink-200 transition-colors">Instagram</div>
                      <div className="text-xs text-blue-200">@cogdasma</div>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-white/50 group-hover:text-white transition-colors" />
                </a>

                {/* YouTube */}
                <a
                  href="https://www.youtube.com/channel/UCdVA4lBnvLdJM_6o3TzB2sQ"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-400/40 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-bold text-white group-hover:text-red-200 transition-colors">YouTube</div>
                      <div className="text-xs text-blue-200">Church of God Dasmariñas</div>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-white/50 group-hover:text-white transition-colors" />
                </a>

                {/* TikTok */}
                <a
                  href="https://www.tiktok.com/@cogworship"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/40 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-white/20 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 2.89 3.5 2.77 1.81-.02 3.26-1.54 3.26-3.35.01-4.32-.01-8.64.01-12.96z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-bold text-white group-hover:text-cyan-200 transition-colors">TikTok</div>
                      <div className="text-xs text-blue-200">@cogworship</div>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-white/50 group-hover:text-white transition-colors" />
                </a>
              </div>
            </div>
          </div>

          {/* Right Column: Contact Message Form (3 cols) */}
          <div className="lg:col-span-3 bg-slate-50 dark:bg-slate-800/40 p-8 sm:p-10 rounded-3xl border border-slate-200/80 dark:border-slate-700/60 shadow-lg">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Send Us a Message
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-8">
              Fill in the form below and we will respond to you as soon as possible.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="contact-name" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="contact-name"
                    placeholder="Juan Dela Cruz"
                    maxLength={MAX_LENGTHS.NAME}
                    value={name}
                    onChange={(e) => setName(cleanName(e.target.value, MAX_LENGTHS.NAME))}
                    required
                    className="h-12 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  />
                  <div className="flex justify-end">
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-email" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Email Address <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="contact-email"
                    type="email"
                    maxLength={MAX_LENGTHS.EMAIL}
                    placeholder="juan@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value.slice(0, MAX_LENGTHS.EMAIL))}
                    required
                    className="h-12 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-phone" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Phone Number (Optional)
                </Label>
                <Input
                  id="contact-phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="09171234567"
                  value={phone}
                  onChange={(e) => setPhone(cleanPhoneNumber(e.target.value))}
                  className="h-12 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-message" className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Your Message / Prayer Request <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="contact-message"
                  placeholder="How can we pray for you or assist you?"
                  maxLength={MAX_LENGTHS.MESSAGE}
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTHS.MESSAGE))}
                  required
                  className="rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 resize-none"
                />
                <div className="flex justify-end">
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 rounded-xl font-bold bg-primary hover:bg-primary/90 text-white shadow-md active:scale-98 transition-all"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">Sending Message...</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Send Message
                  </span>
                )}
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
