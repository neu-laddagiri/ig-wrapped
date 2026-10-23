"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Bookmark, Cloud, EyeOff, FlaskConical } from "lucide-react";
import { AuthModal } from "@/components/AuthModal";
import { SaveFullAnalysisPanel } from "@/components/SaveFullAnalysisPanel";
import { ExportGuideModal } from "@/components/ExportGuide";
import {
  normalizeTabId,
  PROFILE_TABS,
  TOOL_TABS,
  type DashboardTabId,
} from "@/components/DashboardTabs";
import { DmsTab } from "@/components/DmsTab";
import { ExploreView } from "@/components/explore/ExploreView";
import { SecurityTab } from "@/components/SecurityTab";
import { LinkedInHelperTab } from "@/components/LinkedInHelperTab";
import { ExportDataTab } from "@/components/ExportDataTab";
import { SavedAnalysesTab } from "@/components/SavedAnalysesTab";
import { parseInstagramZip } from "@/lib/zipParser";
import { resolveMostActiveEra } from "@/lib/mostActiveEra";
import {
  applyLinkedInProgress,
  INSIGHTS_BUNDLE_VERSION,
  resolveInsightsBundle,
} from "@/lib/insightsEngine";
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
import { DataExplorerTab } from "@/components/DataExplorerTab";
import { DataCoverage } from "@/components/DataCoverage";
import { SearchWrappedTab } from "@/components/SearchWrappedTab";
import { StoryModeModal, type StoryChapter } from "@/components/StoryModeModal";
import { AnalysisChatPanel } from "@/components/AnalysisChatPanel";
import { CompareTab } from "@/components/CompareTab";
import { ActionPlanTab } from "@/components/ActionPlanTab";
import { OverviewAiSection } from "@/components/OverviewAiSection";
import { TabErrorBoundary } from "@/components/TabErrorBoundary";
import { PresentationPrivacyGuard } from "@/components/PresentationPrivacyGuard";
import { SideNav } from "@/components/ig/SideNav";
import { Modal } from "@/components/ig/Modal";
import { BrandAvatar } from "@/components/ig/Avatar";
import { HomeFeed } from "@/components/feed/HomeFeed";
import { ShareSheet } from "@/components/feed/ShareSheet";
import { ProfileView } from "@/components/profile/ProfileView";
import {
  FollowListModal,
  type FollowListTab,
} from "@/components/profile/FollowListModal";
import { UploadDropzone } from "@/components/upload/UploadDropzone";
import { LandingView } from "@/components/LandingView";
import { generateDemoData, DEMO_FILE_FINGERPRINT } from "@/lib/demoData";
import { repairMojibakeDeep } from "@/lib/instagramText";
import { resolveProfileOwner } from "@/lib/profileOwner";
import { usePresentationMode } from "@/contexts/PresentationContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  computeFileFingerprint,
  normalizeLinkedInEntries,
  saveLinkedInProgress,
} from "@/lib/linkedinStorage";
import type { SavedAnalysisRow } from "@/types/analysis";
import type { DmAiSummariesMap } from "@/types/dmAiSummary";
import type { OverviewAiSummaryResult } from "@/types/overviewAiSummary";
import type { LinkedInHelperEntry, ParsedExportData } from "@/types/instagram";

/**
 * Sections that are mostly raw data or lists of people with private notes
 * stay fully hidden while presenting; every other section masks identities.
 */
const PRESENTATION_GUARDED_TABS = new Set<DashboardTabId>([
  "linkedin",
  "explorer",
  "export",
  "saved",
  "compare",
]);

const SECTION_TITLES: Partial<Record<DashboardTabId, { title: string; subtitle: string }>> = {
  search: { title: "Search", subtitle: "What you looked up on Instagram" },
  explore: { title: "Explore", subtitle: "What Instagram and its advertisers think you're into" },
  activity: { title: "Notifications", subtitle: "Logins, devices and account changes from your export" },
  eras: { title: "Your eras", subtitle: "Month by month, what you did most on Instagram" },
  ...Object.fromEntries(TOOL_TABS.map((t) => [t.id, { title: t.label, subtitle: t.description }])),
};

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
  const [activeTab, setActiveTab] = useState<DashboardTabId>("home");
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

  // The expensive bundle depends only on the export; LinkedIn edits are a cheap overlay.
  const baseInsights = useMemo(
    () => (parsedData ? resolveInsightsBundle(parsedData) : null),
    [parsedData]
  );
  const insights = useMemo(
    () =>
      baseInsights ? applyLinkedInProgress(baseInsights, linkedinProgress) : null,
    [baseInsights, linkedinProgress]
  );

  const canonicalIndex = useMemo(
    () => indexFromCanonicalList(insights?.canonicalAccounts ?? []),
    [insights?.canonicalAccounts]
  );

  const directDmThreadRecords = insights?.directDmThreadRecords;
  const parsedMessages = parsedData?.messages ?? null;
  const parsedNetwork = parsedData?.network ?? null;
  const directDmIndex = useMemo(() => {
    if (directDmThreadRecords?.length) {
      return indexFromDirectDmRecords(directDmThreadRecords);
    }
    if (parsedMessages) {
      return buildDirectDmIndexFromMessages(parsedMessages, {
        network: parsedNetwork,
      });
    }
    return indexFromDirectDmRecords([]);
  }, [directDmThreadRecords, parsedMessages, parsedNetwork]);

  const mostActiveEra = useMemo(
    () => (parsedData ? resolveMostActiveEra(parsedData) : null),
    [parsedData]
  );

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

  const [isDemoMode, setIsDemoMode] = useState(false);
  /** Dashboard came from a cloud save (not this device's ZIP). */
  const [openedFromCloud, setOpenedFromCloud] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [storyStart, setStoryStart] = useState<StoryChapter>("welcome");
  // Public-safe by default — names in Story Mode are opt-in.
  const [storyHideNames, setStoryHideNames] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [savedListOpen, setSavedListOpen] = useState(false);
  const [followList, setFollowList] = useState<FollowListTab | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const { presentationMode, setPresentationMode } = usePresentationMode();
  const { user, isConfigured: isAuthConfigured } = useAuth();
  const closeAccountDetail = accountDetail.closeAccount;
  /** The in-flight parse; any new load, clear or Cancel aborts it so it can't overwrite newer state. */
  const parseAbortRef = useRef<AbortController | null>(null);
  const abortActiveParse = useCallback(() => {
    parseAbortRef.current?.abort();
    parseAbortRef.current = null;
  }, []);

  const showToast = useCallback((message: string) => {
    setToast({ id: Date.now(), message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Saved-analysis ids belong to the account that was signed in; a cloud
  // snapshot shouldn't stay on screen after that account signs out.
  const userId = user?.id ?? null;
  const [sessionUserId, setSessionUserId] = useState(userId);
  if (userId !== sessionUserId) {
    setSessionUserId(userId);
    setCurrentSavedId(null);
    if (sessionUserId && openedFromCloud) {
      setParsedData(null);
      setFileName(null);
      setFileFingerprint("");
      setLinkedinProgress([]);
      setDmAiSummaries({});
      setOverviewAiSummary(null);
      setIsLoadedFromCloud(false);
      setOpenedFromCloud(false);
      setActiveTab("home");
      closeAccountDetail();
    }
  }

  const navigate = useCallback((tab: DashboardTabId) => {
    // Followers live in a modal on the profile, like Instagram.
    if (tab === "network") {
      setActiveTab("profile");
      setFollowList("notFollowingBack");
    } else {
      setActiveTab(tab);
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const openStory = useCallback((chapter: StoryChapter = "welcome") => {
    setStoryStart(chapter);
    setStoryOpen(true);
  }, []);

  const resetSessionState = useCallback(() => {
    setLinkedinProgress([]);
    setDmShowThreadNames(true);
    setDmShowFirstMessagePreview(false);
    setExpandedGroupThreads([]);
    setDmAiSummaries({});
    setOverviewAiSummary(null);
    setActiveTab("home");
    setFollowList(null);
    setCreateOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

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

      // Name, fingerprint and data change together, only once parsing succeeded.
      closeAccountDetail();
      setParsedData(data);
      setFileName(file.name);
      setFileFingerprint(fingerprint);
      setIsLoadedFromCloud(false);
      setOpenedFromCloud(false);
      setCurrentSavedId(null);
      setIsDemoMode(false);
      resetSessionState();
      showToast("Your export is ready");
    } catch (err) {
      if (parseAbortRef.current !== controller) return;
      // Keep whatever was already loaded; just explain what went wrong.
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
  }, [closeAccountDetail, resetSessionState, showToast]);

  const handleCancelParsing = useCallback(() => {
    parseAbortRef.current?.abort();
    setLoadingText("Canceling…");
  }, []);

  const handleTryDemo = useCallback(() => {
    abortActiveParse();
    closeAccountDetail();
    setIsLoading(false);
    setLoadingProgress(0);
    setError(null);
    setOpenedFromCloud(false);
    setParsedData(generateDemoData());
    setFileName("demo-synthetic-export.zip");
    setFileFingerprint(DEMO_FILE_FINGERPRINT);
    setIsDemoMode(true);
    setIsLoadedFromCloud(false);
    setCurrentSavedId(null);
    resetSessionState();
  }, [abortActiveParse, closeAccountDetail, resetSessionState]);

  const handleLoadSavedAnalysis = useCallback((row: SavedAnalysisRow) => {
    if (!row.full_analysis_json?.parsed) {
      setError("This saved analysis is incomplete and can't be opened.");
      return;
    }
    abortActiveParse();
    closeAccountDetail();
    setIsLoading(false);
    setIsDemoMode(false);
    setOpenedFromCloud(true);
    setSavedListOpen(false);
    // Saves made before export text was decoded at upload hold mojibake names.
    const snapshot = repairMojibakeDeep(row.full_analysis_json);
    // Older saves may predate the current entry shape (missing notes, etc.).
    const linkedinProgressFromCloud = normalizeLinkedInEntries(
      repairMojibakeDeep(row.linkedin_progress_json ?? [])
    );
    setParsedData(restoreParsedFromSnapshot(snapshot.parsed));
    setFileName(row.export_name ?? snapshot.exportName);
    setFileFingerprint(
      row.file_fingerprint ?? snapshot.fileFingerprint ?? ""
    );
    setLinkedinProgress(linkedinProgressFromCloud);
    setDmShowThreadNames(snapshot.dmShowThreadNames ?? true);
    setDmShowFirstMessagePreview(
      snapshot.dmShowFirstMessagePreview ?? false
    );
    setExpandedGroupThreads(snapshot.expandedGroupThreads ?? []);
    setDmAiSummaries(snapshot.dmAiSummaries ?? {});
    setOverviewAiSummary(snapshot.overviewAiSummary ?? null);
    setActiveTab(normalizeTabId(snapshot.activeTab));
    setCurrentSavedId(row.id);
    setIsLoadedFromCloud(true);
    setError(null);
    setFollowList(null);
    showToast("Saved analysis opened");

    const fp = row.file_fingerprint ?? snapshot.fileFingerprint;
    if (fp && linkedinProgressFromCloud.length) {
      saveLinkedInProgress(fp, linkedinProgressFromCloud);
    }
  }, [abortActiveParse, closeAccountDetail, showToast]);

  // Deleting the snapshot this session saved to means the next save is a new row.
  const handleSavedAnalysisDeleted = useCallback((id: string) => {
    setCurrentSavedId((current) => (current === id ? null : current));
  }, []);

  const handleClearLocalSession = useCallback(() => {
    if (
      !confirm(
        "Clear the current analysis from this session? Unsaved local progress will be lost."
      )
    ) {
      return;
    }
    abortActiveParse();
    closeAccountDetail();
    setIsLoading(false);
    setOpenedFromCloud(false);
    setParsedData(null);
    setIsDemoMode(false);
    setFileName(null);
    setFileFingerprint("");
    setCurrentSavedId(null);
    setIsLoadedFromCloud(false);
    setError(null);
    setPresentationMode(false);
    resetSessionState();
  }, [abortActiveParse, closeAccountDetail, resetSessionState, setPresentationMode]);

  const savedList = (
    <SavedAnalysesTab
      onSignIn={() => setAuthOpen(true)}
      onLoadAnalysis={handleLoadSavedAnalysis}
      onDeleted={handleSavedAnalysisDeleted}
    />
  );

  const overlays = (
    <>
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => setAuthOpen(false)}
      />
      <ExportGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
      <Modal open={savedListOpen} onClose={() => setSavedListOpen(false)} title="Saved analyses" size="md" bodyClassName="p-4">
        {savedList}
      </Modal>
      {toast && (
        <div
          key={toast.id}
          role="status"
          className="ig-fade-up fixed bottom-[66px] left-1/2 z-[95] -translate-x-1/2 rounded-lg bg-[#262626] px-4 py-3 text-sm text-white shadow-lg md:bottom-6"
        >
          {toast.message}
        </div>
      )}
    </>
  );

  if (!parsedData || !insights) {
    return (
      <>
        <LandingView
          onFileSelect={handleFileSelect}
          onTryDemo={handleTryDemo}
          onShowGuide={() => setGuideOpen(true)}
          onSignIn={() => setAuthOpen(true)}
          onOpenSaved={() => setSavedListOpen(true)}
          isLoading={isLoading}
          loadingText={loadingText}
          loadingProgress={loadingProgress}
          onCancel={handleCancelParsing}
          error={error}
        />
        {overlays}
      </>
    );
  }

  const showNames = !presentationMode;
  const effectiveShowThreadNames = dmShowThreadNames && !presentationMode;
  const effectiveShowFirstMessagePreview =
    dmShowFirstMessagePreview && !presentationMode;
  const needsReupload =
    parsedData.insights && (parsedData.insights.version ?? 0) < INSIGHTS_BUNDLE_VERSION;
  const askAi = presentationMode ? undefined : () => setChatOpen(true);

  const notices = (
    <Notices
      isDemoMode={isDemoMode}
      presentationMode={presentationMode}
      cloudName={isLoadedFromCloud && !isDemoMode ? (presentationMode ? "your saved export" : fileName) : null}
      needsReupload={Boolean(needsReupload)}
      errors={parsedData.errors}
      onUpload={() => setCreateOpen(true)}
      onClearDemo={handleClearLocalSession}
      onStopPresenting={() => setPresentationMode(false)}
    />
  );

  const savedContent = presentationMode ? (
    <PresentationPrivacyGuard />
  ) : isAuthConfigured && !user ? (
    <div className="flex flex-col items-center py-12 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-fg">
        <Bookmark className="h-8 w-8" strokeWidth={1.5} />
      </span>
      <p className="mt-4 text-2xl font-extrabold">Save this analysis</p>
      <p className="mt-2 max-w-sm text-sm text-ig-muted">
        Log in to keep your Wrapped and open it on any device. Saves hold the parsed
        stats — never your ZIP, full message history or search history.
      </p>
      <button
        type="button"
        onClick={() => setAuthOpen(true)}
        className="mt-5 rounded-lg bg-ig-blue px-5 py-2 text-sm font-semibold text-white hover:bg-ig-blue-hover"
      >
        Log in
      </button>
    </div>
  ) : (
    <div className="mx-auto max-w-[614px] space-y-6">
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
          showToast("Analysis saved");
        }}
        onDeleted={() => setCurrentSavedId(null)}
        onLoadSaved={() => setSavedListOpen(true)}
        onClearLocal={handleClearLocalSession}
      />
      {savedList}
    </div>
  );

  const section = (): ReactNode => {
    if (presentationMode && PRESENTATION_GUARDED_TABS.has(activeTab) && activeTab !== "saved") {
      return <PresentationPrivacyGuard />;
    }
    switch (activeTab) {
      case "home":
        return (
          <HomeFeed
            data={parsedData}
            insights={insights}
            mostActiveEra={mostActiveEra}
            showNames={showNames}
            onOpenStory={openStory}
            onOpenFollowList={setFollowList}
            onNavigate={navigate}
            onOpenAccount={accountDetail.openAccount}
            onAsk={askAi}
            onShare={() => setShareOpen(true)}
            onCreate={() => setCreateOpen(true)}
            onToast={showToast}
            notices={notices}
            aiRecap={
              presentationMode ? null : (
                <section className="rounded-lg border border-ig-border p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <BrandAvatar size={32} />
                    <div className="leading-tight">
                      <p className="text-sm font-semibold">ig.wrapped</p>
                      <p className="text-xs text-ig-muted">AI recap · optional</p>
                    </div>
                  </div>
                  <OverviewAiSection
                    parsed={parsedData}
                    linkedinProgress={linkedinProgress}
                    summary={overviewAiSummary}
                    onSummaryChange={setOverviewAiSummary}
                  />
                </section>
              )
            }
          />
        );
      case "profile":
      case "people":
      case "saved":
        return (
          <>
            <div className="mx-auto max-w-[935px] px-4 pt-4">{notices}</div>
            <ProfileView
              tab={activeTab}
              onTabChange={navigate}
              data={parsedData}
              insights={insights}
              showNames={showNames}
              onOpenStory={() => openStory("welcome")}
              onShare={() => setShareOpen(true)}
              onOpenFollowList={setFollowList}
              onToast={showToast}
              peopleContent={
                <SocialGraphTab
                  insights={insights}
                  network={parsedData.network}
                  onOpenAccount={accountDetail.openAccount}
                  defaultSubTab="realones"
                  showUnfollowImpact
                />
              }
              savedContent={savedContent}
            />
          </>
        );
      case "messages":
        return (
          <DmsTab
            messages={parsedData.messages}
            showThreadNames={effectiveShowThreadNames}
            onShowThreadNamesChange={setDmShowThreadNames}
            showFirstMessagePreview={effectiveShowFirstMessagePreview}
            onShowFirstMessagePreviewChange={setDmShowFirstMessagePreview}
            dmAiSummaries={dmAiSummaries}
            onDmAiSummariesChange={setDmAiSummaries}
            isLoadedFromCloud={isLoadedFromCloud}
            dmHeatmap={insights.dmHeatmap}
            replyPatterns={insights.replyPatterns}
            dmRelationshipInsights={insights.dmRelationshipInsights}
            groupChats={insights.groupChats}
            onOpenAccount={accountDetail.openAccount}
            dmAccountKeyByThreadId={dmAccountKeyByThreadId}
            ownerHandle={resolveProfileOwner(insights, showNames).handle}
            notices={notices}
          />
        );
      case "search":
        return (
          <SectionPage {...SECTION_TITLES.search!} notices={notices} narrow>
            <SearchWrappedTab insights={insights} hidden={presentationMode} />
          </SectionPage>
        );
      case "explore":
        return (
          <SectionPage {...SECTION_TITLES.explore!} notices={notices}>
            <ExploreView
              ads={parsedData.ads}
              adsInsights={insights.adsInsights}
              adRoast={insights.adRoast}
              contentDiet={insights.contentDiet}
              onNavigate={navigate}
            />
          </SectionPage>
        );
      case "activity":
        return (
          <SectionPage {...SECTION_TITLES.activity!} notices={notices} narrow>
            <SecurityTab security={parsedData.security} securityAudit={insights.securityAudit} />
          </SectionPage>
        );
      case "eras":
        return (
          <SectionPage {...SECTION_TITLES.eras!} notices={notices} narrow>
            <ErasTab insights={insights} mostActiveEra={mostActiveEra} />
          </SectionPage>
        );
      case "actionplan":
        return (
          <SectionPage {...SECTION_TITLES.actionplan!} notices={notices} narrow>
            <ActionPlanTab
              parsed={parsedData}
              insights={insights}
              isDemoMode={isDemoMode}
              onNavigate={navigate}
              storageKey={fileFingerprint}
            />
          </SectionPage>
        );
      case "linkedin":
        return (
          <SectionPage {...SECTION_TITLES.linkedin!} notices={notices} wide>
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
          </SectionPage>
        );
      case "compare":
        return (
          <SectionPage {...SECTION_TITLES.compare!} notices={notices}>
            <CompareTab current={parsedData} />
          </SectionPage>
        );
      case "export":
        return (
          <SectionPage {...SECTION_TITLES.export!} notices={notices}>
            <ExportDataTab data={parsedData} network={parsedData.network} />
          </SectionPage>
        );
      case "explorer":
        return (
          <SectionPage {...SECTION_TITLES.explorer!} notices={notices} wide>
            <div className="space-y-8">
              <DataCoverage items={parsedData.coverage} expanded onExpandedChange={() => {}} />
              <DataExplorerTab insights={insights} />
            </div>
          </SectionPage>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div className="min-h-screen bg-ig-bg text-fg">
        <SideNav
          active={activeTab}
          onNavigate={navigate}
          onCreate={() => setCreateOpen(true)}
          onOpenStory={() => openStory("welcome")}
          onSignIn={() => setAuthOpen(true)}
          onClearSession={handleClearLocalSession}
        />
        <main className="pb-[60px] pt-[60px] md:ml-[72px] md:pb-0 md:pt-0 xl:ml-[244px]">
          <TabErrorBoundary key={PROFILE_TABS.has(activeTab) ? "profile" : activeTab}>
            {section()}
          </TabErrorBoundary>
        </main>
      </div>

      <AccountDetailDrawer
        open={accountDetail.isOpen}
        onClose={accountDetail.closeAccount}
        username={drawerUsername ?? null}
        network={parsedData.network}
        linkedinEntry={linkedinForAccount}
        unifiedAccount={unifiedAccount}
        receipt={drawerReceipt}
        insights={insights}
        fileFingerprint={fileFingerprint}
      />
      <FollowListModal
        open={followList !== null}
        onClose={() => setFollowList(null)}
        network={parsedData.network}
        insights={insights}
        initialTab={followList ?? "followers"}
        showNames={showNames}
        onOpenAccount={accountDetail.openAccount}
      />
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Upload a new export" size="md">
        <UploadDropzone
          onFileSelect={handleFileSelect}
          onTryDemo={isDemoMode ? undefined : handleTryDemo}
          onShowGuide={() => setGuideOpen(true)}
          isLoading={isLoading}
          loadingText={loadingText}
          loadingProgress={loadingProgress}
          onCancel={handleCancelParsing}
          error={error}
        />
      </Modal>
      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        insights={insights}
        presentationMode={presentationMode}
      />
      {!presentationMode && (
        <AnalysisChatPanel
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          parsed={parsedData}
          linkedinProgress={linkedinProgress}
        />
      )}
      <StoryModeModal
        open={storyOpen}
        onClose={() => setStoryOpen(false)}
        data={parsedData}
        insights={insights}
        hideNames={presentationMode || storyHideNames}
        onHideNamesChange={setStoryHideNames}
        startAt={storyStart}
        onShare={() => setShareOpen(true)}
      />
      {overlays}
    </>
  );
}

function SectionPage({
  title,
  subtitle,
  notices,
  wide,
  narrow,
  children,
}: {
  title: string;
  subtitle: string;
  notices?: ReactNode;
  wide?: boolean;
  /** Single-column lists (search, notifications) use Instagram's 614px column. */
  narrow?: boolean;
  children: ReactNode;
}) {
  const width = wide ? "max-w-[1100px]" : narrow ? "max-w-[646px]" : "max-w-[935px]";
  return (
    <div className={`mx-auto px-4 pb-16 pt-6 sm:pt-10 ${width}`}>
      {notices}
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-ig-muted">{subtitle}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Notices({
  isDemoMode,
  presentationMode,
  cloudName,
  needsReupload,
  errors,
  onUpload,
  onClearDemo,
  onStopPresenting,
}: {
  isDemoMode: boolean;
  presentationMode: boolean;
  cloudName: string | null;
  needsReupload: boolean;
  errors: string[];
  onUpload: () => void;
  onClearDemo: () => void;
  onStopPresenting: () => void;
}) {
  const [showErrors, setShowErrors] = useState(false);
  const rows: ReactNode[] = [];

  if (presentationMode) {
    rows.push(
      <Notice key="presenting" icon={EyeOff} text="Presentation mode — names, DMs and searches are hidden.">
        <NoticeButton onClick={onStopPresenting}>Turn off</NoticeButton>
      </Notice>
    );
  }
  if (isDemoMode) {
    rows.push(
      <Notice key="demo" icon={FlaskConical} text="Demo data — none of these accounts are real.">
        <NoticeButton onClick={onUpload}>Upload yours</NoticeButton>
        <NoticeButton onClick={onClearDemo} muted>
          Clear
        </NoticeButton>
      </Notice>
    );
  }
  if (cloudName) {
    rows.push(<Notice key="cloud" icon={Cloud} text={`Viewing your saved analysis of ${cloudName}.`} />);
  }
  if (needsReupload) {
    rows.push(
      <Notice key="reupload" icon={AlertCircle} text="This save predates newer insights. Re-upload the ZIP to unlock them.">
        <NoticeButton onClick={onUpload}>Upload</NoticeButton>
      </Notice>
    );
  }
  if (errors.length > 0) {
    rows.push(
      <div key="errors">
        <Notice icon={AlertCircle} text={`${errors.length === 1 ? "One part" : `${errors.length} parts`} of your export couldn't be read.`}>
          <NoticeButton onClick={() => setShowErrors((v) => !v)}>{showErrors ? "Hide" : "Details"}</NoticeButton>
        </Notice>
        {showErrors && (
          <ul className="mb-2 list-disc space-y-1 pl-10 text-xs text-ig-muted">
            {errors.map((e, i) => (
              <li key={`${i}-${e}`}>{e}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (rows.length === 0) return null;
  return <div className="mb-4 space-y-2 px-3 sm:px-0">{rows}</div>;
}

function Notice({
  icon: Icon,
  text,
  children,
}: {
  icon: typeof Cloud;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-ig-border px-3 py-2.5 text-sm">
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
      <p className="min-w-0 flex-1">{text}</p>
      {children && <div className="flex shrink-0 items-center gap-3">{children}</div>}
    </div>
  );
}

function NoticeButton({
  onClick,
  muted,
  children,
}: {
  onClick: () => void;
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-sm font-semibold ${muted ? "text-ig-muted hover:text-fg" : "text-ig-blue hover:text-ig-link"}`}
    >
      {children}
    </button>
  );
}
