"use client";

import { motion } from "framer-motion";

export function Hero() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="text-center"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/60 backdrop-blur-sm"
      >
        <span className="h-2 w-2 rounded-full bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] animate-pulse" />
        Privacy-first · Client-side only
      </motion.div>

      <h1 className="text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
        <span className="bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#515BD4] bg-clip-text text-transparent">
          IG Wrapped
        </span>
      </h1>

      <p className="mx-auto mt-4 max-w-2xl text-xl font-medium text-white/90 sm:text-2xl">
        Your Instagram data, decoded.
      </p>

      <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/50 sm:text-lg">
        Analyze your followers, following, activity, ads, messages, and account
        history from your official Instagram export — all locally in your
        browser.
      </p>
    </motion.section>
  );
}
