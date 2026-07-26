"use client";

import { motion } from "framer-motion";

export function EnterpriseBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.08, ease: "easeOut" }}
      className="inline-flex h-9 items-center rounded-[12px] bg-[#F1F7FF] px-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#007AFF]"
    >
      Enterprise API Schema Intelligence Platform
    </motion.div>
  );
}
