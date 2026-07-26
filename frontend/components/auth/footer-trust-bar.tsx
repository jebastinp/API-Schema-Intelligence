"use client";

import { motion } from "framer-motion";

export function FooterTrustBar() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.28 }}
      className="text-center text-[12px] font-medium tracking-[0.01em] text-[#64748B] sm:text-[13px]"
    >
      Secure by Design • Enterprise Grade • Trusted API Intelligence
    </motion.div>
  );
}
