"use client";

import Image from "next/image";
import { motion } from "framer-motion";

import logoFull from "@/logo/ChatGPT Image Jul 27, 2026 at 01_19_26 AM.png";

export function BrandHeader() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="flex items-center"
    >
      <Image
        src={logoFull}
        alt="Schema Studio"
        priority
        className="block h-[132px] w-auto max-w-[560px] object-contain object-left sm:h-[152px] sm:max-w-[640px] lg:h-[180px] lg:max-w-[760px] xl:h-[196px] xl:max-w-[820px]"
      />
    </motion.div>
  );
}
