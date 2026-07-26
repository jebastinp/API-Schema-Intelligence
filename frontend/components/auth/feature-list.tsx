"use client";

import { Check } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  "API Schema Discovery",
  "Schema Evolution Tracking",
  "SQL Generator",
  "Informatica IICS XQuery",
  "Incremental API Scanner",
  "Version Comparison",
  "Enterprise Ready",
];

export function FeatureList() {
  return (
    <div className="mt-6 grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {features.map((feature, index) => {
        return (
          <motion.div
            key={feature}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.12 + index * 0.06, ease: "easeOut" }}
            className="flex items-center gap-3"
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EEF6FF] text-[#007AFF]">
              <Check className="h-4 w-4 stroke-[3]" />
            </div>
            <p className="text-[14px] font-medium tracking-[-0.01em] text-[#0F172A] lg:text-[15px]">
              {feature}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}
