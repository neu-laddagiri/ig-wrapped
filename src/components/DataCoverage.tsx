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
  Search,
  Plug,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useId, type ElementType } from "react";
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
  search_history: Search,
  connected_apps: Plug,
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
  const panelId = useId();
  const detectedCount = items.filter((i) => i.detected).length;
  const previewItems = items.filter((i) => i.detected).slice(0, 4);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-xl border border-ig-border bg-ig-secondary"
    >
      <div className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <h2 className="text-lg font-semibold text-fg">Data Coverage</h2>
          <p className="mt-0.5 text-sm text-ig-muted">
            <span className="font-semibold text-fg">{detectedCount}</span> of{" "}
            {items.length} categories found
          </p>
        </div>
        <button
          type="button"
          onClick={() => onExpandedChange(!expanded)}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="inline-flex items-center gap-1.5 self-start rounded-full border border-ig-border bg-ig-secondary px-4 py-1.5 text-xs font-medium text-fg transition hover:bg-ig-hover sm:self-auto"
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
        <div className="flex flex-wrap gap-2 border-t border-ig-border px-6 py-3 sm:px-8">
          {previewItems.map((item) => {
            const Icon = iconMap[item.id];
            return (
              <span
                key={item.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-ig-border bg-ig-secondary px-2.5 py-1 text-xs text-fg"
              >
                <Icon className="h-3 w-3 text-fg" />
                {item.label}
              </span>
            );
          })}
          {detectedCount > previewItems.length && (
            <span className="rounded-full border border-ig-border bg-ig-secondary px-2.5 py-1 text-xs text-ig-muted">
              +{detectedCount - previewItems.length} more
            </span>
          )}
        </div>
      )}

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-ig-border px-6 pb-6 pt-2 sm:px-8 sm:pb-8">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item, i) => {
                  const Icon = iconMap[item.id];
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.03 * i }}
                      className={`rounded-xl border p-4 transition ${
 item.detected
 ? "border-ig-border bg-ig-subtle"
 : "border-ig-border bg-ig-subtle opacity-60"
 }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-lg ${
 item.detected
 ? "bg-ig-secondary text-fg"
 : "bg-ig-secondary"
 }`}
                          >
                            <Icon
                              className={`h-4 w-4 ${item.detected ? "text-fg" : "text-ig-muted"}`}
                            />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-fg">
                              {item.label}
                            </p>
                            <p className="text-xs text-ig-muted">
                              {item.description}
                            </p>
                          </div>
                        </div>
                        {item.detected ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-ig-good" />
                        ) : (
                          <XCircle className="h-4 w-4 shrink-0 text-ig-muted" />
                        )}
                      </div>
                      <p className="mt-3 text-xs text-ig-muted">
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
