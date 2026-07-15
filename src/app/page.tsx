"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud } from "lucide-react";
import { Hero } from "@/components/Hero";
import { UploadCard } from "@/components/UploadCard";
import { PrivacyBadges } from "@/components/PrivacyBadges";
import { BetaBuildBanner } from "@/components/BetaBuildBanner";
import { DataCoverage } from "@/components/DataCoverage";
import { ExportSuccessBanner } from "@/components/ExportSuccessBanner";
import { AccountMenu } from "@/components/AccountMenu";
import { AccountStatusCard } from "@/components/AccountStatusCard";
import { AuthModal } from "@/components/AuthModal";
import { SaveFullAnalysisPanel } from "@/components/SaveFullAnalysisPanel";
import { ExportGuide } from "@/components/ExportGuide";
import {
  DashboardTabs,
  groupForTab,
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
import { resolveInsightsBundle } from "@/lib/insightsEngine";
import { findUnifiedAccount } from "@/lib/relationshipEngine";
import {
  indexFromCanonicalList,
  openAccountReceipt,
  resolveCanonicalAccount,
} from "@/lib/canonicalAccounts";
import {
  buildDirectDmIndexFromMessages,
  indexFromDirectDmRecords,
} from "@/lib/insights/directDmIndex";
import { inferLinkedInSchoolContext } from "@/lib/linkedinSearchQuery";
import {
  AccountDetailDrawer,
  useAccountDetail,
} from "@/components/AccountDetailDrawer";
import { SocialGraphTab } from "@/components/SocialGraphTab";
import { ErasTab } from "@/components/ErasTab";
import { PersonalityTab } from "@/components/PersonalityTab";
import { YearbookTab } from "@/components/YearbookTab";
import { DataExplorerTab } from "@/components/DataExplorerTab";
import { SearchWrappedTab } from "@/components/SearchWrappedTab";
import { GroupChatsTab } from "@/components/GroupChatsTab";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { PresentationModeBanner } from "@/components/PresentationModeBanner";
import { PresentationPrivacyGuard } from "@/components/PresentationPrivacyGuard";
import { PresentationToggle } from "@/components/PresentationToggle";
import { StoryModeModal } from "@/components/StoryModeModal";
import { AnalysisChatPanel } from "@/components/AnalysisChatPanel";
import { CompareTab } from "@/components/CompareTab";
import { ActionPlanTab } from "@/components/ActionPlanTab";
import { generateDemoData, DEMO_FILE_FINGERPRINT } from "@/lib/demoData";
import { usePresentationMode } from "@/contexts/PresentationContext";
import {
  computeFileFingerprint,
  saveLinkedInProgress,
} from "@/lib/linkedinStorage";
import type { SavedAnalysisRow } from "@/types/analysis";
import type { DmAiSummariesMap } from "@/types/dmAiSummary";
import type { OverviewAiSummaryResult } from "@/types/overviewAiSummary";
import type { LinkedInHelperEntry, ParsedExportData } from "@/types/instagram";

const PRESENTATION_SAFE_TABS = new Set<DashboardTabId>([
  "overview",
  "actionplan",
  "wrapped",
  "yearbook",
  "eras",
  "personality",
  "groups",
]);

function restoreParsedFromSnapshot(
  parsed: SavedAnalysisRow["full_analysis_json"]["parsed"]
): ParsedExportData {
  return {
    ...parsed,
    filePaths: [],
    mostActiveEra: parsed.mostActiveEra ?? null,
    insights: parsed.insights ?? null,
    security: parsed.security
      ? { ...parsed.security, events: parsed.security.events ?? [] }
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
  const [dmShowThreadNames, setDmShowThreadNames] = useState(true);
  const [dmShowFirstMessagePreview, setDmShowFirstMessagePreview] =
    useState(false);
  const [expandedGroupThreads, setExpandedGroupThreads] = useState<string[]>(
    []
  );
  const [dmAiSummaries, setDmAiSummaries] = useState<DmAiSummariesMap>({});
  const [overviewAiSummary, setOverviewAiSummary] =
    useState<OverviewAiSummaryResult | null>(null);
  const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);
  const [isLoadedFromCloud, setIsLoadedFromCloud] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const accountDetail = useAccountDetail();

  const insights = useMemo(
    () =>
      parsedData
        ? resolveInsightsBundle(parsedData, linkedinProgress)
        : null,
    [parsedData, linkedinProgress]
  );

  const canonicalIndex = useMemo(
    () => indexFromCanonicalList(insights?.canonicalAccounts ?? []),
    [insights?.canonicalAccounts]
  );

  const directDmRecords = insights?.directDmThreadRecords;
  const parsedMessages = parsedData?.messages;
  const parsedNetwork = parsedData?.network;
  const directDmIndex = useMemo(() => {
    if (directDmRecords?.length) {
      return indexFromDirectDmRecords(directDmRecords);
    }
    if (parsedMessages) {
      return buildDirectDmIndexFromMessages(parsedMessages, {
        network: parsedNetwork ?? null,
      });
    }
    return indexFromDirectDmRecords([]);
  }, [directDmRecords, parsedMessages, parsedNetwork]);

  const dmAccountKeyByThreadId = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of directDmIndex.byThreadId.values()) {
      map.set(r.threadId, r.accountKey);
    }
    return map;
  }, [directDmIndex]);

  const linkedInSchoolContext = useMemo(
    () =>
      inferLinkedInSchoolContext([
        ...(insights?.searchWrapped?.topTerms?.map((t) => t.query) ?? []),
        ...(insights?.searchWrapped?.topAccounts?.map((t) => t.query) ?? []),
        ...(insights?.searchWrapped?.repeatedSearches?.map((t) => t.query) ??
          []),
      ]),
    [insights?.searchWrapped]
  );

  const selectedAccountKey = accountDetail.selection?.accountKey ?? null;
  const selectedThreadId = accountDetail.selection?.threadId;
  const selectedDmRecord = selectedThreadId
    ? directDmIndex.byThreadId.get(selectedThreadId)
    : selectedAccountKey
      ? directDmIndex.byAccountKey.get(selectedAccountKey) ??
        directDmIndex.byAccountKey.get(selectedAccountKey.toLowerCase())
      : undefined;
  const selectedCanonical = selectedAccountKey
    ? resolveCanonicalAccount(canonicalIndex, selectedAccountKey)
    : selectedDmRecord
      ? resolveCanonicalAccount(canonicalIndex, selectedDmRecord.accountKey)
      : undefined;
  const drawerUsername =
    selectedCanonical?.username ??
    selectedAccountKey ??
    selectedDmRecord?.username ??
    selectedDmRecord?.accountKey ??
    undefined;
  const unifiedAccount =
    drawerUsername && insights
      ? findUnifiedAccount(insights.accounts, drawerUsername)
      : undefined;
  const linkedinForAccount = linkedinProgress.find(
    (e) =>
      e.username === drawerUsername ||
      e.username === selectedAccountKey
  );
  const drawerReceipt =
    selectedAccountKey || selectedThreadId
      ? openAccountReceipt({
          directDmIndex,
          canonicalIndex,
          accountKey: selectedAccountKey ?? undefined,
          threadId: selectedThreadId,
          linkedinEntry: linkedinForAccount,
        })
      : null;

  const [exportGuideExpanded, setExportGuideExpanded] = useState(true);
  const [dataCoverageExpanded, setDataCoverageExpanded] = useState(false);
  const [dashboardBanner, setDashboardBanner] = useState<{
    visible: boolean;
    mode: "upload" | "saved";
  }>({ visible: false, mode: "upload" });
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [storyHideNames, setStoryHideNames] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { presentationMode } = usePresentationMode();

  const dashboardRef = useRef<HTMLDivElement>(null);
  const tabPanelRef = useRef<HTMLDivElement>(null);
  const savePanelRef = useRef<HTMLDivElement>(null);
  const pendingScrollRef = useRef(false);
  const parseAbortRef = useRef<AbortController | null>(null);
  const [pendingScrollTarget, setPendingScrollTarget] = useState<
    "saved-analyses" | null
  >(null);

  const DASHBOARD_SCROLL_OFFSET = 112;

  const scrollToTabContent = useCallback((force = false) => {
    requestAnimationFrame(() => {
      const el = tabPanelRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (
        !force &&
        rect.top >= DASHBOARD_SCROLL_OFFSET - 24 &&
        rect.top <= window.innerHeight * 0.55
      ) {
        return;
      }
      const y = rect.top + window.scrollY - DASHBOARD_SCROLL_OFFSET;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    });
  }, []);

  const scrollToDashboard = useCallback(() => {
    scrollToTabContent(true);
  }, [scrollToTabContent]);

  const navigateToSavedAnalyses = useCallback(() => {
    setActiveTab("saved");
    setPendingScrollTarget("saved-analyses");
  }, []);

  const handleTabChange = useCallback(
    (tab: DashboardTabId) => {
      setActiveTab(tab);
      if (!parsedData) return;
      scrollToTabContent(false);
    },
    [parsedData, scrollToTabContent]
  );

  useEffect(() => {
    if (pendingScrollTarget !== "saved-analyses") return;

    if (parsedData) {
      if (activeTab !== "saved" || groupForTab(activeTab) !== "data") return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 24;

    const tryScroll = () => {
      if (cancelled) return;
      attempts += 1;
      const el = document.getElementById("saved-analyses-section");
      if (el) {
        const y =
          el.getBoundingClientRect().top +
          window.scrollY -
          DASHBOARD_SCROLL_OFFSET;
        window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
        setPendingScrollTarget(null);
        return;
      }
      if (attempts < maxAttempts) {
        window.setTimeout(tryScroll, 50);
      } else {
        setPendingScrollTarget(null);
      }
    };

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(tryScroll, 100);
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [pendingScrollTarget, activeTab, parsedData]);

  useEffect(() => {
    if (!dashboardBanner.visible) return;
    const timer = window.setTimeout(() => {
      setDashboardBanner((b) => ({ ...b, visible: false }));
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [dashboardBanner.visible, dashboardBanner.mode]);

  useEffect(() => {
    if (!parsedData || !pendingScrollRef.current) return;
    pendingScrollRef.current = false;
    const timer = window.setTimeout(() => {
      scrollToDashboard();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [parsedData, fileName, scrollToDashboard]);

  const handleFileSelect = useCallback(async (file: File) => {
    parseAbortRef.current?.abort();
    const controller = new AbortController();
    parseAbortRef.current = controller;
    setError(null);
    setIsLoading(true);
    setLoadingProgress(0);
    setLoadingText("Reading ZIP file…");
    try {
      const [fingerprint, data] = await Promise.all([
        computeFileFingerprint(file),
        parseInstagramZip(
          file,
          (progress) => {
            if (parseAbortRef.current !== controller) return;
            setLoadingText(progress.stage);
            setLoadingProgress(progress.percent);
          },
          controller.signal
        ),
      ]);
      if (parseAbortRef.current !== controller) return;

      setFileName(file.name);
      setFileFingerprint(fingerprint);
      setParsedData(data);
      setIsDemoMode(false);
      setIsLoadedFromCloud(false);
      setCurrentSavedId(null);
      setLinkedinProgress([]);
      setDmShowThreadNames(true);
      setDmShowFirstMessagePreview(false);
      setExpandedGroupThreads([]);
      setDmAiSummaries({});
      setOverviewAiSummary(null);
      setActiveTab("overview");
      setExportGuideExpanded(false);
      setDataCoverageExpanded(false);
      pendingScrollRef.current = true;
      setDashboardBanner({ visible: true, mode: "upload" });
    } catch (err) {
      if (parseAbortRef.current !== controller) return;
      if (controller.signal.aborted) {
        setError(null);
      } else {
        controller.abort();
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong while parsing your export."
        );
      }
    } finally {
      if (parseAbortRef.current === controller) {
        parseAbortRef.current = null;
        setIsLoading(false);
        setLoadingProgress(0);
      }
    }
  }, []);

  const handleCancelParsing = useCallback(() => {
    parseAbortRef.current?.abort();
    setLoadingText("Canceling…");
  }, []);

  const handleTryDemo = useCallback(() => {
    setError(null);
    setParsedData(generateDemoData());
    setFileName("demo-synthetic-export.zip");
    setFileFingerprint(DEMO_FILE_FINGERPRINT);
    setIsDemoMode(true);
    setIsLoadedFromCloud(false);
    setCurrentSavedId(null);
    setLinkedinProgress([]);
    setDmShowThreadNames(true);
    setDmShowFirstMessagePreview(false);
    setExpandedGroupThreads([]);
    setDmAiSummaries({});
    setOverviewAiSummary(null);
    setActiveTab("overview");
    setExportGuideExpanded(false);
    setDataCoverageExpanded(false);
    pendingScrollRef.current = true;
    setDashboardBanner({ visible: true, mode: "upload" });
  }, []);

  const handleLoadSavedAnalysis = useCallback((row: SavedAnalysisRow) => {
    setIsDemoMode(false);
    const snapshot = row.full_analysis_json;
    setParsedData(restoreParsedFromSnapshot(snapshot.parsed));
    setFileName(row.export_name ?? snapshot.exportName);
    setFileFingerprint(
      row.file_fingerprint ?? snapshot.fileFingerprint ?? ""
    );
    setLinkedinProgress(row.linkedin_progress_json ?? []);
    setDmShowThreadNames(snapshot.dmShowThreadNames ?? true);
    setDmShowFirstMessagePreview(
      snapshot.dmShowFirstMessagePreview ?? false
    );
    setExpandedGroupThreads(snapshot.expandedGroupThreads ?? []);
    setDmAiSummaries(snapshot.dmAiSummaries ?? {});
    setOverviewAiSummary(snapshot.overviewAiSummary ?? null);
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
    parseAbortRef.current?.abort();
    parseAbortRef.current = null;
    setIsLoading(false);
    setLoadingProgress(0);
    setParsedData(null);
    setIsDemoMode(false);
    setFileName(null);
    setFileFingerprint("");
    setLinkedinProgress([]);
    setDmShowThreadNames(true);
    setDmShowFirstMessagePreview(false);
    setExpandedGroupThreads([]);
    setDmAiSummaries({});
    setOverviewAiSummary(null);
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
          <div className="mb-8 flex items-start justify-end gap-3">
            {parsedData && <PresentationToggle />}
            {!presentationMode && (
              <AccountMenu
                onSignIn={() => setAuthOpen(true)}
                onNavigateToSavedAnalyses={navigateToSavedAnalyses}
              />
            )}
          </div>

          <Hero />

          <div className="mt-8 space-y-6">
            {!presentationMode && (
              <UploadCard
                onFileSelect={handleFileSelect}
                onTryDemo={handleTryDemo}
                isLoading={isLoading}
                loadingText={loadingText}
                loadingProgress={loadingProgress}
                onCancel={handleCancelParsing}
                error={error}
                fileName={fileName}
                compact={Boolean(parsedData && !isLoading)}
              />
            )}

            {!parsedData && <PrivacyBadges />}
          </div>

          <div className="mt-8 space-y-4">
            <BetaBuildBanner />
            <AccountStatusCard />
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
                {isDemoMode && (
                  <DemoModeBanner onClear={handleClearLocalSession} />
                )}
                <PresentationModeBanner />

                {isLoadedFromCloud && !isDemoMode && !presentationMode && (
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

                {!presentationMode && (
                  <div ref={savePanelRef}>
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
                  overviewAiSummary={overviewAiSummary}
                  currentSavedId={currentSavedId}
                  isDemoMode={isDemoMode}
                  onSignIn={() => setAuthOpen(true)}
                  onSaved={(id) => {
                    setCurrentSavedId(id);
                    setIsLoadedFromCloud(true);
                  }}
                  onDeleted={() => setCurrentSavedId(null)}
                  onLoadSaved={navigateToSavedAnalyses}
                  onClearLocal={handleClearLocalSession}
                  />
                  </div>
                )}

                <DataCoverage
                  items={parsedData.coverage}
                  expanded={dataCoverageExpanded}
                  onExpandedChange={setDataCoverageExpanded}
                />

                <div
                  ref={dashboardRef}
                  id="dashboard"
                  className="scroll-mt-24 space-y-4"
                >
                  {!dashboardBanner.visible && (
                    <p className="text-xs text-emerald-400/80">
                      ✓ Export loaded — explore your dashboard below
                    </p>
                  )}
                  <DashboardTabs
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                  />

                  <div ref={tabPanelRef} className="scroll-mt-28">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm sm:p-6"
                  >
                    {(() => {
                      if (!parsedData || !insights) return null;
                      if (
                        presentationMode &&
                        !PRESENTATION_SAFE_TABS.has(activeTab)
                      ) {
                        return <PresentationPrivacyGuard />;
                      }
                      const showAccountNames = !presentationMode;
                      const effectiveShowThreadNames =
                        dmShowThreadNames && !presentationMode;
                      const effectiveShowFirstMessagePreview =
                        dmShowFirstMessagePreview && !presentationMode;

                      return (
                        <>
                    {activeTab === "overview" && (
                      <OverviewTab
                        data={parsedData}
                        fileName={presentationMode ? null : fileName}
                        linkedinProgress={linkedinProgress}
                        overviewAiSummary={overviewAiSummary}
                        onOverviewAiSummaryChange={setOverviewAiSummary}
                        currentSavedId={
                          presentationMode ? null : currentSavedId
                        }
                        onOpenStory={() => setStoryOpen(true)}
                        onOpenChat={
                          presentationMode ? undefined : () => setChatOpen(true)
                        }
                        hideShareNames={presentationMode}
                        onNavigateTab={handleTabChange}
                        onScrollToSave={
                          presentationMode
                            ? undefined
                            : () => {
                                savePanelRef.current?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "center",
                                });
                              }
                        }
                      />
                    )}
                    {activeTab === "actionplan" && (
                      <ActionPlanTab
                        parsed={parsedData}
                        insights={insights}
                        isDemoMode={isDemoMode}
                        onNavigate={handleTabChange}
                      />
                    )}
                    {activeTab === "network" && (
                      <NetworkManagerTab
                        network={parsedData.network}
                        linkedinProgress={linkedinProgress}
                        onOpenAccount={accountDetail.openAccount}
                      />
                    )}
                    {activeTab === "social" && (
                      <SocialGraphTab
                        insights={insights}
                        network={parsedData.network}
                        onOpenAccount={accountDetail.openAccount}
                        defaultSubTab="leaderboards"
                      />
                    )}
                    {activeTab === "cleanup" && (
                      <SocialGraphTab
                        insights={insights}
                        network={parsedData.network}
                        onOpenAccount={accountDetail.openAccount}
                        defaultSubTab="cleanup"
                        showSubNav={false}
                        showUnfollowImpact
                      />
                    )}
                    {activeTab === "realones" && (
                      <SocialGraphTab
                        insights={insights}
                        network={parsedData.network}
                        onOpenAccount={accountDetail.openAccount}
                        defaultSubTab="realones"
                        showSubNav={false}
                      />
                    )}
                    {activeTab === "wrapped" && (
                      <WrappedInsightsTab
                        wrapped={parsedData.wrapped}
                        network={parsedData.network}
                        mostActiveEra={resolveMostActiveEra(parsedData)}
                        contentDiet={insights.contentDiet}
                        adsInsights={insights.adsInsights}
                      />
                    )}
                    {activeTab === "funstats" && (
                      <FunStatsTab
                        network={parsedData.network}
                        wrapped={parsedData.wrapped}
                        messages={parsedData.messages}
                        ads={parsedData.ads}
                        mostActiveEra={resolveMostActiveEra(parsedData)}
                        showNames={showAccountNames}
                        dmAwards={insights.dmAwards}
                        replyPatterns={insights.replyPatterns}
                        hallOfFame={insights.hallOfFame}
                        burnoutMeter={insights.burnoutMeter ?? undefined}
                        socialAudit={insights.socialAudit}
                        onOpenAccount={accountDetail.openAccount}
                      />
                    )}
                    {activeTab === "yearbook" && (
                      <YearbookTab
                        cards={insights.yearbook ?? []}
                        showNames={showAccountNames}
                        onOpenAccount={accountDetail.openAccount}
                      />
                    )}
                    {activeTab === "eras" && (
                      <ErasTab
                        insights={insights}
                        mostActiveEra={resolveMostActiveEra(parsedData)}
                      />
                    )}
                    {activeTab === "personality" && (
                      <PersonalityTab insights={insights} />
                    )}
                    {activeTab === "dms" && (
                      <DmsTab
                        messages={parsedData.messages}
                        showThreadNames={effectiveShowThreadNames}
                        onShowThreadNamesChange={setDmShowThreadNames}
                        showFirstMessagePreview={effectiveShowFirstMessagePreview}
                        onShowFirstMessagePreviewChange={
                          setDmShowFirstMessagePreview
                        }
                        dmAiSummaries={dmAiSummaries}
                        onDmAiSummariesChange={setDmAiSummaries}
                        isLoadedFromCloud={isLoadedFromCloud}
                        dmHeatmap={insights.dmHeatmap}
                        replyPatterns={insights.replyPatterns}
                        dmRelationshipInsights={insights.dmRelationshipInsights}
                        onOpenAccount={accountDetail.openAccount}
                        dmAccountKeyByThreadId={dmAccountKeyByThreadId}
                      />
                    )}
                    {activeTab === "groups" && (
                      <GroupChatsTab insights={insights} />
                    )}
                    {activeTab === "ads" && (
                      <AdsPrivacyTab
                        ads={parsedData.ads}
                        adsInsights={insights.adsInsights}
                        adRoast={insights.adRoast}
                      />
                    )}
                    {activeTab === "security" && (
                      <SecurityTab
                        security={parsedData.security}
                        securityAudit={insights.securityAudit}
                      />
                    )}
                    {activeTab === "search" && (
                      <SearchWrappedTab
                        insights={insights}
                        hidden={presentationMode}
                      />
                    )}
                    {activeTab === "explorer" && (
                      <DataExplorerTab insights={insights} />
                    )}
                    {activeTab === "linkedin" && (
                      <LinkedInHelperTab
                        key={fileFingerprint || fileName}
                        network={parsedData.network}
                        fingerprint={fileFingerprint}
                        canonicalAccounts={insights.canonicalAccounts ?? []}
                        directDmIndex={directDmIndex}
                        entries={linkedinProgress}
                        onEntriesChange={setLinkedinProgress}
                        onOpenAccount={accountDetail.openAccount}
                        schoolContext={linkedInSchoolContext}
                      />
                    )}
                    {activeTab === "compare" && (
                      <CompareTab current={parsedData} />
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
                    {!presentationMode && <AccountDetailDrawer
                      open={accountDetail.isOpen}
                      onClose={accountDetail.closeAccount}
                      username={drawerUsername ?? null}
                      network={parsedData.network}
                      linkedinEntry={linkedinForAccount}
                      unifiedAccount={unifiedAccount}
                      receipt={drawerReceipt}
                      insights={insights}
                      fileFingerprint={fileFingerprint}
                    />}
                        </>
                      );
                    })()}
                  </motion.div>
                  </div>
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

      {parsedData && !presentationMode && (
        <AnalysisChatPanel
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          parsed={parsedData}
          linkedinProgress={linkedinProgress}
        />
      )}
      {parsedData && insights && (
        <StoryModeModal
          open={storyOpen}
          onClose={() => setStoryOpen(false)}
          data={parsedData}
          insights={insights}
          hideNames={presentationMode || storyHideNames}
          onHideNamesChange={setStoryHideNames}
        />
      )}

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
