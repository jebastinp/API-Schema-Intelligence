"use client";

import { Lock } from "lucide-react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { BrandHeader } from "@/components/auth/brand-header";
import { EnterpriseBadge } from "@/components/auth/enterprise-badge";
import { FeatureList } from "@/components/auth/feature-list";
import { FooterTrustBar } from "@/components/auth/footer-trust-bar";

export function AuthShell({
  title,
  subtitle,
  showCardHeader = true,
  children,
}: {
  title: string;
  subtitle: string;
  showCardHeader?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative h-screen overflow-hidden bg-white">
      <div className="absolute inset-0 bg-[#FFFFFF]" />
      <div className="absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-[#E5E7EB] lg:block" />
      <div className="absolute right-[-18%] top-[-8%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,_rgba(90,200,250,0.12),_transparent_68%)] blur-3xl" />
      <div className="absolute bottom-[-18%] right-[-6%] h-[420px] w-[620px] bg-[radial-gradient(circle,_rgba(0,122,255,0.08),_transparent_68%)] blur-3xl" />

      <div className="relative mx-auto flex h-screen w-full max-w-[1600px] flex-col overflow-hidden px-5 py-5 sm:px-8 lg:px-0 lg:py-0">
        <div className="grid h-full flex-1 items-center gap-8 overflow-hidden lg:grid-cols-[1.1fr_0.9fr] lg:gap-0 xl:grid-cols-[1.22fr_0.98fr]">
          <section className="flex items-start justify-center overflow-hidden pt-1 lg:h-full lg:px-10 lg:pt-4 xl:px-16 xl:pt-6">
            <div className="w-full max-w-[690px]">
              <BrandHeader />
              <div className="-mt-2 xl:mt-0">
                <EnterpriseBadge />
                <motion.h1
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.12, ease: "easeOut" }}
                  className="mt-5 max-w-[560px] text-[42px] font-bold leading-[1.04] tracking-[-0.055em] text-[#0F172A] sm:text-[48px] lg:text-[54px] xl:text-[60px]"
                >
                  <span className="block">See every field.</span>
                  <span className="mt-2 block">Understand every change.</span>
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.16, ease: "easeOut" }}
                  className="mt-5 max-w-[610px] text-[14px] leading-7 text-[#475569] sm:text-[15px] sm:leading-7 lg:text-[16px]"
                >
                  Schema Studio automatically discovers every field across millions of API records, tracks schema
                  evolution, and generates production-ready SQL and Informatica IICS XQuery.
                </motion.p>
                <FeatureList />
              </div>
            </div>
          </section>

          <section className="flex min-h-0 flex-col justify-center lg:h-full lg:px-10 xl:px-16">
            <div className="mx-auto flex w-full max-w-[560px] flex-col items-center">
              <div className="w-full rounded-[20px] border border-[#E5E7EB] bg-white/96 px-6 py-6 shadow-[0_28px_60px_-44px_rgba(15,23,42,0.16)] backdrop-blur-xl sm:px-8 sm:py-7">
                {showCardHeader ? (
                  <div className="text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(180deg,#EEF6FF_0%,#E8F2FF_100%)] text-[#007AFF] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                      <Lock className="h-6 w-6 fill-[#007AFF] stroke-white stroke-[1.8]" />
                    </div>
                    <h2 className="mt-5 text-[28px] font-bold tracking-[-0.04em] text-[#0F172A] sm:text-[30px]">{title}</h2>
                    <p className="mt-2 text-[15px] text-[#64748B]">{subtitle}</p>
                  </div>
                ) : null}
                <div className={showCardHeader ? "mt-7" : ""}>{children}</div>
              </div>
              <div className="mt-5">
                <FooterTrustBar />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
