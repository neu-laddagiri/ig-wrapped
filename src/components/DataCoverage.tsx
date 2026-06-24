"use client";

import { motion } from "framer-motion";
import {
  Users,
  Heart,
  MessageSquare,
  Bookmark,
  CircleDot,
  Eye,
  Video,
  Megaphone,
  Building2,
  Mail,
  LogIn,
  User,
  Shield,
  IdCard,
  Image,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { ElementType } from "react";
import type { CoverageCategoryId, DataCoverageItem } from "@/types/instagram";

const iconMap: Record<CoverageCategoryId, ElementType> = {
  followers_following: Users,
  likes: Heart,
  comments: MessageSquare,
  saved: Bookmark,
  story_interactions: CircleDot,
  posts_viewed: Eye,
  videos_watched: Video,
  ads: Megaphone,
  advertisers: Building2,
  messages: Mail,
  login_activity: LogIn,
  profile_activity: User,
  security_changes: Shield,
  personal_information: IdCard,
  media_files: Image,
};

interface DataCoverageProps {
  items: DataCoverageItem[];
}

export function DataCoverage({ items }: DataCoverageProps) {
  const detectedCount = items.filter((i) => i.detected).length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-xl sm:p-8"
    >
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Data Coverage</h2>
          <p className="mt-1 text-sm text-white/45">
            Categories detected in your export
          </p>
        </div>
        <p className="text-sm text-white/50">
          <span className="font-semibold text-white">{detectedCount}</span> of{" "}
          {items.length} categories found
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => {
          const Icon = iconMap[item.id];
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 * i }}
              className={`rounded-2xl border p-4 transition ${
                item.detected
                  ? "border-white/12 bg-white/[0.04]"
                  : "border-white/5 bg-white/[0.02] opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      item.detected
                        ? "bg-gradient-to-br from-[#F58529]/20 via-[#DD2A7B]/15 to-[#515BD4]/20"
                        : "bg-white/5"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 ${item.detected ? "text-[#DD2A7B]" : "text-white/30"}`}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {item.label}
                    </p>
                    <p className="text-xs text-white/40">{item.description}</p>
                  </div>
                </div>
                {item.detected ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-white/25" />
                )}
              </div>
              <p className="mt-3 text-xs text-white/35">
                {item.detected
                  ? `${item.fileCount} file${item.fileCount === 1 ? "" : "s"} found`
                  : "Not found"}
              </p>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}
