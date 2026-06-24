"use client";

import { motion, AnimatePresence } from "framer-motion";
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
  ChevronDown,
  ChevronUp,
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
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

export function DataCoverage({
  items,
  expanded,
  onExpandedChange,
}: DataCoverageProps) {
  const detectedCount = items.filter((i) => i.detected).length;
  const previewItems = items.filter((i) => i.detected).slice(0, 4);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-xl"
    >
      <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <h2 className="text-lg font-semibold text-white">Data Coverage</h2>
          <p className="mt-0.5 text-sm text-white/45">
            <span className="font-semibold text-white">{detectedCount}</span> of{" "}
            {items.length} categories found
          </p>
        </div>
        <button
          type="button"
          onClick={() => onExpandedChange(!expanded)}
          className="inline-flex items-center gap-1.5 self-start rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/75 transition hover:bg-white/10 sm:self-auto"
        >
          {expanded ? (
            <>
              Hide data coverage
              <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Show data coverage
              <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>

      {!expanded && previewItems.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-white/10 px-6 py-3 sm:px-8">
          {previewItems.map((item) => {
            const Icon = iconMap[item.id];
            return (
              <span
                key={item.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/65"
              >
                <Icon className="h-3 w-3 text-[#DD2A7B]" />
                {item.label}
              </span>
            );
          })}
          {detectedCount > previewItems.length && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/40">
              +{detectedCount - previewItems.length} more
            </span>
          )}
        </div>
      )}

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10 px-6 pb-6 pt-2 sm:px-8 sm:pb-8">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item, i) => {
                  const Icon = iconMap[item.id];
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.03 * i }}
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
                            <p className="text-xs text-white/40">
                              {item.description}
                            </p>
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
