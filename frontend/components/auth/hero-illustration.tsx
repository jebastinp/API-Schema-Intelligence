"use client";

import { Braces, CreditCard, Database, LaptopMinimal, SquareCode } from "lucide-react";
import { motion } from "framer-motion";

function FloatingNode({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut" }}
      className={`absolute flex h-12 w-12 items-center justify-center rounded-2xl border border-[#DCE8FF] bg-white/92 text-[#0A66FF] shadow-[0_20px_40px_-30px_rgba(15,23,42,0.22)] ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function HeroIllustration() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.22, ease: "easeOut" }}
      className="relative mt-10 h-[220px] w-full max-w-[540px] opacity-95 sm:h-[260px]"
    >
      <div className="absolute inset-x-[14%] bottom-2 h-16 rounded-full bg-[radial-gradient(circle,_rgba(10,102,255,0.13),_transparent_68%)] blur-2xl" />
      <div className="absolute left-8 right-8 top-[118px] border-t border-dashed border-[#CFE0FF]" />
      <div className="absolute left-[22%] top-[144px] h-12 w-12 rounded-[18px] border border-dashed border-[#CFE0FF]" />
      <div className="absolute right-[22%] top-[144px] h-12 w-12 rounded-[18px] border border-dashed border-[#CFE0FF]" />
      <div className="absolute left-1/2 top-[36px] h-[152px] w-[152px] -translate-x-1/2 rounded-[42px] bg-[linear-gradient(180deg,rgba(235,244,255,0.92),rgba(255,255,255,0.68))] shadow-[0_40px_80px_-50px_rgba(10,102,255,0.32)]" />
      <div className="absolute left-1/2 top-[56px] h-[112px] w-[112px] -translate-x-1/2 rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,#CFE0FF_0%,#A7C7FF_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]" />
      <div className="absolute left-1/2 top-[73px] h-7 w-[76px] -translate-x-1/2 rounded-2xl bg-white/32" />
      <div className="absolute left-1/2 top-[108px] h-4 w-[76px] -translate-x-1/2 rounded-full bg-white/28" />
      <div className="absolute left-1/2 top-[132px] h-4 w-[62px] -translate-x-1/2 rounded-full bg-white/24" />
      <div className="absolute left-[12%] top-[152px] h-[58px] w-[92px] rounded-[24px] bg-[linear-gradient(180deg,#F8FBFF_0%,#EEF4FF_100%)] shadow-[0_26px_46px_-34px_rgba(15,23,42,0.26)]" />
      <div className="absolute right-[10%] top-[152px] h-[58px] w-[92px] rounded-[24px] bg-[linear-gradient(180deg,#F8FBFF_0%,#EEF4FF_100%)] shadow-[0_26px_46px_-34px_rgba(15,23,42,0.26)]" />
      <FloatingNode className="left-[18%] top-[92px]">
        <Braces className="h-5 w-5 stroke-[2.2]" />
      </FloatingNode>
      <FloatingNode className="left-1/2 top-[56px] -translate-x-1/2">
        <CreditCard className="h-5 w-5 stroke-[2.2]" />
      </FloatingNode>
      <FloatingNode className="right-[14%] top-[110px]">
        <SquareCode className="h-5 w-5 stroke-[2.2]" />
      </FloatingNode>
      <div className="absolute left-[17%] top-[185px] h-4 w-4 rounded-[4px] bg-[#9FC1FF] shadow-[0_10px_18px_-12px_rgba(10,102,255,0.7)]" />
      <div className="absolute right-[17%] top-[188px] h-4 w-4 rounded-[4px] bg-[#9FC1FF] shadow-[0_10px_18px_-12px_rgba(10,102,255,0.7)]" />
      <div className="absolute left-[46%] top-[96px] text-[#E5EFFD]">
        <Database className="h-14 w-14 stroke-1" />
      </div>
      <div className="absolute left-[6%] top-[170px] text-[#E8F1FF]">
        <LaptopMinimal className="h-10 w-10 stroke-1" />
      </div>
    </motion.div>
  );
}
