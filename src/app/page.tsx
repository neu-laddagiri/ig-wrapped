"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud } from "lucide-react";
import { Hero } from "@/components/Hero";
import { UploadCard } from "@/components/UploadCard";
import { PrivacyBadges } from "@/components/PrivacyBadges";
import { DataCoverage } from "@/components/DataCoverage";
import { ExportSuccessBanner } from "@/components/ExportSuccessBanner";
import { AccountMenu } from "@/components/AccountMenu";
import { AccountStatusCard } from "@/components/AccountStatusCard";
import { AuthModal } from "@/components/AuthModal";
import { SaveFullAnalysisPanel } from "@/components/SaveFullAnalysisPanel";
import { ExportGuide } from "@/components/ExportGuide";
import {
  DashboardTabs,
  type DashboardTabId,
} from "@/components/DashboardTabs";
import { OverviewTab } from "@/components/OverviewTab";
import { NetworkManagerTab } from "@/components/NetworkManagerTab";
import { WrappedInsightsTab } from "@/components/WrappedInsightsTab";
import { DmsTab } from "@/components/DmsTab";
import { AdsPrivacyTab } from "@/components/AdsPrivacyTab";
import { SecurityTab } from "@/components/SecurityTab";
import { LinkedInHelperTab } from "@/components/LinkedInHelperTab";
import { ExportDataTab } from "@/components/ExportDataTab";
import { SavedAnalysesTab } from "@/components/SavedAnalysesTab";
import { FunStatsTab } from "@/components/FunStatsTab";
import { parseInstagramZip } from "@/lib/zipParser";
import { resolveMostActiveEra } from "@/lib/mostActiveEra";
import {
  computeFileFingerprint,
  saveLinkedInProgress,
} from "@/lib/linkedinStorage";
import type { SavedAnalysisRow } from "@/types/analysis";
import type { DmAiSummariesMap } from "@/types/dmAiSummary";
import type { LinkedInHelperEntry, ParsedExportData } from "@/types/instagram";

function restoreParsedFromSnapshot(
  parsed: SavedAnalysisRow["full_analysis_json"]["parsed"]
): ParsedExportData {
  return {
    ...parsed,
    filePaths: [],
    mostActiveEra: parsed.mostActiveEra ?? null,
    security: parsed.security
      ? {
          ...parsed.security,
          events: parsed.security.events ?? [],
        }
      : null,
  };
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<DashboardTabId>("overview");
  const [parsedData, setParsedData] = useState<ParsedExportData | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileFingerprint, setFileFingerprint] = useState<string>("");
  const [linkedinProgress, setLinkedinProgress] = useState<LinkedInHelperEntry[]>(
    []
  );
  const [dmShowThreadNames, setDmShowThreadNames] = useState(false);
  const [dmShowFirstMessagePreview, setDmShowFirstMessagePreview] =
    useState(false);
  const [expandedGroupThreads, setExpandedGroupThreads] = useState<string[]>(
    []
  );
  const [dmAiSummaries, setDmAiSummaries] = useState<DmAiSummariesMap>({});
  const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);
  const [isLoadedFromCloud, setIsLoadedFromCloud] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [exportGuideExpanded, setExportGuideExpanded] = useState(true);
  const [dataCoverageExpanded, setDataCoverageExpanded] = useState(false);
  const [dashboardBanner, setDashboardBanner] = useState<{
    visible: boolean;
    mode: "upload" | "saved";
  }>({ visible: false, mode: "upload" });

  const dashboardRef = useRef<HTMLDivElement>(null);
  const pendingScrollRef = useRef(false);

  const scrollToDashboard = useCallback(() => {
    requestAnimationFrame(() => {
      dashboardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  useEffect(() => {
    if (!parsedData || !pendingScrollRef.current) return;
    pendingScrollRef.current = false;
    const timer = window.setTimeout(() => {
      scrollToDashboard();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [parsedData, fileName, scrollToDashboard]);

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    setIsLoading(true);
    setFileName(file.name);
    setLoadingText("Reading ZIP file…");
    setIsLoadedFromCloud(false);
    setCurrentSavedId(null);

    try {
      const fingerprint = await computeFileFingerprint(file);
      setFileFingerprint(fingerprint);

      const data = await parseInstagramZip(file, (progress) => {
        setLoadingText(progress.stage);
      });
      setParsedData(data);
      setLinkedinProgress([]);
      setDmShowThreadNames(false);
      setDmShowFirstMessagePreview(false);
      setExpandedGroupThreads([]);
      setDmAiSummaries({});
      setActiveTab("overview");
      setExportGuideExpanded(false);
      setDataCoverageExpanded(false);
      pendingScrollRef.current = true;
      setDashboardBanner({ visible: true, mode: "upload" });
    } catch (err) {
      setParsedData(null);
      setFileFingerprint("");
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while parsing your export."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleLoadSavedAnalysis = useCallback((row: SavedAnalysisRow) => {
    const snapshot = row.full_analysis_json;
    setParsedData(restoreParsedFromSnapshot(snapshot.parsed));
    setFileName(row.export_name ?? snapshot.exportName);
    setFileFingerprint(
      row.file_fingerprint ?? snapshot.fileFingerprint ?? ""
    );
    setLinkedinProgress(row.linkedin_progress_json ?? []);
    setDmShowThreadNames(snapshot.dmShowThreadNames ?? false);
    setDmShowFirstMessagePreview(
      snapshot.dmShowFirstMessagePreview ?? false
    );
    setExpandedGroupThreads(snapshot.expandedGroupThreads ?? []);
    setDmAiSummaries(snapshot.dmAiSummaries ?? {});
    setActiveTab(snapshot.activeTab ?? "overview");
    setCurrentSavedId(row.id);
    setIsLoadedFromCloud(true);
    setError(null);
    setExportGuideExpanded(false);
    setDataCoverageExpanded(false);
    setDashboardBanner({ visible: true, mode: "saved" });

    const fp = row.file_fingerprint ?? snapshot.fileFingerprint;
    if (fp && row.linkedin_progress_json?.length) {
      saveLinkedInProgress(fp, row.linkedin_progress_json);
    }
  }, []);

  const handleClearLocalSession = useCallback(() => {
    if (
      !confirm(
        "Clear the current analysis from this session? Unsaved local progress will be lost."
      )
    ) {
      return;
    }
    setParsedData(null);
    setFileName(null);
    setFileFingerprint("");
    setLinkedinProgress([]);
    setDmShowThreadNames(false);
    setDmShowFirstMessagePreview(false);
    setExpandedGroupThreads([]);
    setDmAiSummaries({});
    setCurrentSavedId(null);
    setIsLoadedFromCloud(false);
    setActiveTab("overview");
    setError(null);
    setExportGuideExpanded(true);
    setDataCoverageExpanded(false);
    setDashboardBanner({ visible: false, mode: "upload" });
  }, []);

  return (
    <>
      <div className="relative min-h-screen overflow-hidden bg-[#050509] text-white">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-32 top-0 h-[500px] w-[500px] rounded-full bg-[#F58529]/15 blur-[120px]" />
          <div className="absolute right-0 top-1/4 h-[400px] w-[400px] rounded-full bg-[#DD2A7B]/12 blur-[100px]" />
          <div className="absolute bottom-0 left-1/3 h-[450px] w-[450px] rounded-full bg-[#515BD4]/10 blur-[110px]" />
          <div className="absolute bottom-1/4 right-1/4 h-[300px] w-[300px] rounded-full bg-[#8134AF]/10 blur-[90px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div className="flex-1" />
            <AccountMenu
              onSignIn={() => setAuthOpen(true)}
              onNavigateTab={setActiveTab}
            />
          </div>

          <Hero />

          <div className="mt-10 space-y-6">
            <AccountStatusCard />

            <UploadCard
              onFileSelect={handleFileSelect}
              isLoading={isLoading}
              loadingText={loadingText}
              error={error}
              fileName={fileName}
              compact={Boolean(parsedData && !isLoading)}
            />

            {!parsedData && <PrivacyBadges />}
          </div>

          <div className="mt-10">
            <ExportGuide
              expanded={exportGuideExpanded}
              onExpandedChange={setExportGuideExpanded}
            />
          </div>

          <AnimatePresence mode="wait">
            {parsedData && (
              <motion.div
                key={fileName ?? "parsed"}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="mt-12 space-y-8"
              >
                {isLoadedFromCloud && (
                  <div className="flex items-center gap-3 rounded-2xl border border-[#515BD4]/25 bg-[#515BD4]/10 px-4 py-3">
                    <Cloud className="h-5 w-5 text-[#818cf8]" />
                    <p className="text-sm text-white/70">
                      <span className="font-medium text-white">
                        Loaded saved analysis
                      </span>
                      {" — "}
                      Viewing cloud snapshot for{" "}
                      <span className="text-white/90">{fileName}</span>. No ZIP
                      required.
                    </p>
                  </div>
                )}

                <SaveFullAnalysisPanel
                  parsedData={parsedData}
                  fileName={fileName ?? "export.zip"}
                  fileFingerprint={fileFingerprint}
                  linkedinProgress={linkedinProgress}
                  activeTab={activeTab}
                  dmShowThreadNames={dmShowThreadNames}
                  dmShowFirstMessagePreview={dmShowFirstMessagePreview}
                  expandedGroupThreads={expandedGroupThreads}
                  dmAiSummaries={dmAiSummaries}
                  currentSavedId={currentSavedId}
                  onSignIn={() => setAuthOpen(true)}
                  onSaved={(id) => {
                    setCurrentSavedId(id);
                    setIsLoadedFromCloud(true);
                  }}
                  onDeleted={() => setCurrentSavedId(null)}
                  onLoadSaved={() => setActiveTab("saved")}
                  onClearLocal={handleClearLocalSession}
                />

                <DataCoverage
                  items={parsedData.coverage}
                  expanded={dataCoverageExpanded}
                  onExpandedChange={setDataCoverageExpanded}
                />

                <div
                  ref={dashboardRef}
                  id="dashboard"
                  className="scroll-mt-24 space-y-6"
                >
                  <DashboardTabs
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                  />

                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm sm:p-6"
                  >
                    {activeTab === "overview" && (
                      <OverviewTab data={parsedData} fileName={fileName} />
                    )}
                    {activeTab === "network" && (
                      <NetworkManagerTab
                        network={parsedData.network}
                        linkedinProgress={linkedinProgress}
                      />
                    )}
                    {activeTab === "wrapped" && (
                      <WrappedInsightsTab
                        wrapped={parsedData.wrapped}
                        network={parsedData.network}
                        mostActiveEra={resolveMostActiveEra(parsedData)}
                      />
                    )}
                    {activeTab === "funstats" && (
                      <FunStatsTab
                        network={parsedData.network}
                        wrapped={parsedData.wrapped}
                        messages={parsedData.messages}
                        ads={parsedData.ads}
                        mostActiveEra={resolveMostActiveEra(parsedData)}
                        showThreadNames={dmShowThreadNames}
                      />
                    )}
                    {activeTab === "dms" && (
                      <DmsTab
                        messages={parsedData.messages}
                        showThreadNames={dmShowThreadNames}
                        onShowThreadNamesChange={setDmShowThreadNames}
                        showFirstMessagePreview={dmShowFirstMessagePreview}
                        onShowFirstMessagePreviewChange={
                          setDmShowFirstMessagePreview
                        }
                        dmAiSummaries={dmAiSummaries}
                        onDmAiSummariesChange={setDmAiSummaries}
                        isLoadedFromCloud={isLoadedFromCloud}
                      />
                    )}
                    {activeTab === "ads" && (
                      <AdsPrivacyTab ads={parsedData.ads} />
                    )}
                    {activeTab === "security" && (
                      <SecurityTab security={parsedData.security} />
                    )}
                    {activeTab === "linkedin" && (
                      <LinkedInHelperTab
                        key={fileFingerprint || fileName}
                        network={parsedData.network}
                        fingerprint={fileFingerprint}
                        entries={linkedinProgress}
                        onEntriesChange={setLinkedinProgress}
                      />
                    )}
                    {activeTab === "export" && (
                      <ExportDataTab
                        data={parsedData}
                        network={parsedData.network}
                      />
                    )}
                    {activeTab === "saved" && (
                      <SavedAnalysesTab
                        onSignIn={() => setAuthOpen(true)}
                        onLoadAnalysis={handleLoadSavedAnalysis}
                      />
                    )}
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!parsedData && !isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-12 space-y-6"
            >
              <div className="rounded-3xl border border-white/8 bg-white/[0.02] px-6 py-16 text-center">
                <p className="text-sm text-white/35">
                  Upload your Instagram data export ZIP to unlock the dashboard.
                </p>
              </div>
              <SavedAnalysesTab
                onSignIn={() => setAuthOpen(true)}
                onLoadAnalysis={handleLoadSavedAnalysis}
              />
            </motion.div>
          )}
        </div>

        <footer className="relative z-10 mt-16 border-t border-white/8 py-8 text-center text-xs text-white/30">
          <p>
            IG Wrapped · Local-first analysis · Optional account save · No
            scraping · No LinkedIn automation
          </p>
        </footer>
      </div>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => setAuthOpen(false)}
      />

      <ExportSuccessBanner
        visible={dashboardBanner.visible && Boolean(parsedData)}
        mode={dashboardBanner.mode}
        onDismiss={() => setDashboardBanner((b) => ({ ...b, visible: false }))}
        onJumpToDashboard={() => {
          scrollToDashboard();
          setDashboardBanner((b) => ({ ...b, visible: false }));
        }}
      />
    </>
  );
}
