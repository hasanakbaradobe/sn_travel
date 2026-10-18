import React, { useState, useEffect } from 'react';
import {
  Globe,
  Eye,
  Send,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  Trash2,
  Edit3,
  ArrowUp,
  ArrowDown,
  Save,
  RefreshCw,
  Building2,
  Layout,
  BedDouble,
  Sparkles,
  Image as ImageIcon,
  FileText,
  HelpCircle,
  Search,
  History,
  ShieldCheck,
  X,
  EyeOff,
} from 'lucide-react';
import { api } from '../services/api';
import {
  PublicSiteBootstrapResponse,
  PublicSiteSettings,
  PublicSitePage,
  PublicSiteRoom,
  PublicSiteFacility,
  PublicSiteGalleryItem,
  PublicSiteFaq,
  PublicWebsiteSnapshot,
  User,
} from '../types';
import { PublicHotelWebsiteRenderer } from '../components/PublicHotelWebsiteRenderer';

interface PublicWebsiteManagementViewProps {
  currentUser: User;
}

type CmsSectionTab =
  | 'dashboard'
  | 'general'
  | 'homepage'
  | 'rooms'
  | 'facilities'
  | 'gallery'
  | 'pages'
  | 'faqs'
  | 'seo'
  | 'history';

const AVAILABLE_ICONS = [
  { value: 'Sparkles', label: 'General / Highlight' },
  { value: 'Wifi', label: 'Wi-Fi / Connectivity' },
  { value: 'Car', label: 'Parking / Transport' },
  { value: 'Utensils', label: 'Restaurant / Dining' },
  { value: 'Coffee', label: 'Breakfast / Lounge' },
  { value: 'ShieldCheck', label: '24h Security / Reception' },
  { value: 'Dumbbell', label: 'Fitness / Gym' },
  { value: 'Waves', label: 'Pool / Spa' },
  { value: 'Plane', label: 'Airport Shuttle' },
  { value: 'Briefcase', label: 'Business Center' },
  { value: 'Building2', label: 'Concierge / Hotel' },
];

export const PublicWebsiteManagementView: React.FC<PublicWebsiteManagementViewProps> = ({
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<CmsSectionTab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // CMS Data State
  const [cmsData, setCmsData] = useState<PublicSiteBootstrapResponse | null>(null);
  const [settingsForm, setSettingsForm] = useState<PublicSiteSettings | null>(null);

  // Draft Preview State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState<PublicWebsiteSnapshot | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Publish Modal State
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishNotes, setPublishNotes] = useState('');

  // Room Modal / Editor State
  const [editingRoom, setEditingRoom] = useState<Partial<PublicSiteRoom> | null>(null);
  const [roomAmenitiesInput, setRoomAmenitiesInput] = useState('');
  const [roomGalleryInput, setRoomGalleryInput] = useState('');

  // Facility Editor State
  const [editingFacility, setEditingFacility] = useState<Partial<PublicSiteFacility> | null>(null);

  // Gallery Editor State
  const [editingGallery, setEditingGallery] = useState<Partial<PublicSiteGalleryItem> | null>(null);

  // FAQ Editor State
  const [editingFaq, setEditingFaq] = useState<Partial<PublicSiteFaq> | null>(null);

  // Page Editor State
  const [selectedPageSlug, setSelectedPageSlug] = useState<string>('about');
  const [pageForm, setPageForm] = useState<Partial<PublicSitePage> | null>(null);

  const isAuthorized = currentUser.role === 'super_admin' || currentUser.role === 'admin';

  const loadBootstrap = async (silent = false) => {
    if (!isAuthorized) return;
    try {
      if (!silent) setLoading(true);
      const res = await api.getPublicSiteBootstrap();
      setCmsData(res);
      setSettingsForm(res.settings);
      const foundPage = res.pages.find((p) => p.slug === selectedPageSlug) || res.pages[0];
      if (foundPage) {
        setPageForm({ ...foundPage });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load Public Website CMS data' });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void loadBootstrap();
  }, []);

  useEffect(() => {
    if (!cmsData) return;
    const found = cmsData.pages.find((p) => p.slug === selectedPageSlug);
    if (found) setPageForm({ ...found });
  }, [selectedPageSlug, cmsData]);

  if (!isAuthorized) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-white border border-rose-200 rounded-xl p-6 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Administrator Access Required</h2>
          <p className="text-sm text-slate-600">
            Only Administrator and Super Admin users are authorized to manage or publish the public hotel website.
          </p>
        </div>
      </div>
    );
  }

  const showNotice = (type: 'success' | 'error' | 'info', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 7000);
  };

  const handleOpenPreview = async () => {
    try {
      setLoadingPreview(true);
      const res = await api.getPublicSitePreviewSnapshot();
      setPreviewSnapshot(res.snapshot);
      setPreviewOpen(true);
    } catch (err: any) {
      showNotice('error', err.message || 'Failed to generate draft preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!settingsForm) return;
    try {
      setSaving(true);
      const updated = await api.updatePublicSiteSettings(settingsForm);
      setSettingsForm(updated);
      await loadBootstrap(true);
      showNotice('success', 'Draft website settings saved to MySQL.');
    } catch (err: any) {
      showNotice('error', err.message || 'Failed to save website settings');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    try {
      setPublishing(true);
      const res = await api.publishPublicWebsite(publishNotes);
      setPublishModalOpen(false);
      setPublishNotes('');
      await loadBootstrap(true);
      showNotice(
        res.publication.deployment_status === 'Deployment Failed' ? 'error' : 'info',
        res.message
      );
    } catch (err: any) {
      showNotice('error', err.message || 'Failed to publish website');
    } finally {
      setPublishing(false);
    }
  };

  const handleVerifyDeployment = async (pubId: number) => {
    try {
      setVerifyingId(pubId);
      const res = await api.verifyPublicWebsiteDeployment(pubId);
      await loadBootstrap(true);
      showNotice(res.verified ? 'success' : 'info', res.message);
    } catch (err: any) {
      showNotice('error', err.message || 'Could not verify deployment status');
    } finally {
      setVerifyingId(null);
    }
  };

  // Room Handlers
  const openRoomModal = (room?: PublicSiteRoom) => {
    if (room) {
      setEditingRoom({ ...room });
      setRoomAmenitiesInput((room.amenities || []).join(', '));
      setRoomGalleryInput((room.gallery_images || []).join('\n'));
    } else {
      setEditingRoom({
        name: '',
        short_description: '',
        full_description: '',
        featured_image_url: '',
        capacity: '',
        bed_type: '',
        room_size: '',
        optional_price: null,
        currency: 'USD',
        price_note: 'per night (indicative)',
        enquiry_url: '',
        is_featured: 1,
        is_visible: 1,
      });
      setRoomAmenitiesInput('');
      setRoomGalleryInput('');
    }
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom || !editingRoom.name?.trim()) {
      showNotice('error', 'Room name is required');
      return;
    }
    try {
      setSaving(true);
      const payload: Partial<PublicSiteRoom> = {
        ...editingRoom,
        amenities: roomAmenitiesInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        gallery_images: roomGalleryInput
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      };

      if (editingRoom.id) {
        await api.updatePublicSiteRoom(editingRoom.id, payload);
        showNotice('success', 'Room updated in draft.');
      } else {
        await api.createPublicSiteRoom(payload);
        showNotice('success', 'New room added to draft.');
      }
      setEditingRoom(null);
      await loadBootstrap(true);
    } catch (err: any) {
      showNotice('error', err.message || 'Failed to save room');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveItem = async (
    type: 'rooms' | 'facilities' | 'gallery' | 'faqs',
    index: number,
    direction: 'up' | 'down'
  ) => {
    if (!cmsData) return;
    const list = [...cmsData[type]];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    const orderedIds = list.map((item) => item.id);

    try {
      if (type === 'rooms') await api.reorderPublicSiteRooms(orderedIds);
      if (type === 'facilities') await api.reorderPublicSiteFacilities(orderedIds);
      if (type === 'gallery') await api.reorderPublicSiteGallery(orderedIds);
      if (type === 'faqs') await api.reorderPublicSiteFaqs(orderedIds);
      await loadBootstrap(true);
    } catch (err: any) {
      showNotice('error', err.message || 'Failed to reorder items');
    }
  };

  // Full-screen Draft Preview Mode
  if (previewOpen) {
    return (
      <PublicHotelWebsiteRenderer
        snapshot={previewSnapshot}
        isPreview={true}
        onExitPreview={() => setPreviewOpen(false)}
      />
    );
  }

  if (loading || !cmsData || !settingsForm) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-slate-200 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="h-28 bg-slate-100 rounded-xl" />
          <div className="h-28 bg-slate-100 rounded-xl" />
          <div className="h-28 bg-slate-100 rounded-xl" />
          <div className="h-28 bg-slate-100 rounded-xl" />
        </div>
        <div className="h-96 bg-white border border-slate-200 rounded-xl" />
      </div>
    );
  }

  const latestPub = cmsData.latest_publication;
  const envStatus = cmsData.env_status;

  const tabs: Array<{ id: CmsSectionTab; label: string; icon: React.ReactNode }> = [
    { id: 'dashboard', label: 'Overview', icon: <Globe className="w-4 h-4" /> },
    { id: 'general', label: 'Hotel Info', icon: <Building2 className="w-4 h-4" /> },
    { id: 'homepage', label: 'Homepage', icon: <Layout className="w-4 h-4" /> },
    { id: 'rooms', label: `Rooms (${cmsData.rooms.length})`, icon: <BedDouble className="w-4 h-4" /> },
    { id: 'facilities', label: `Facilities (${cmsData.facilities.length})`, icon: <Sparkles className="w-4 h-4" /> },
    { id: 'gallery', label: `Gallery (${cmsData.gallery.length})`, icon: <ImageIcon className="w-4 h-4" /> },
    { id: 'pages', label: 'Pages & Nav', icon: <FileText className="w-4 h-4" /> },
    { id: 'faqs', label: `FAQs (${cmsData.faqs.length})`, icon: <HelpCircle className="w-4 h-4" /> },
    { id: 'seo', label: 'SEO & Domain', icon: <Search className="w-4 h-4" /> },
    { id: 'history', label: 'Publish History', icon: <History className="w-4 h-4" /> },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header & Primary Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <span>Public Website Management</span>
            <span aria-hidden="true">·</span>
            <span>Isolated Static Netlify Architecture</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {settingsForm.hotel_name || 'Public Hotel Website CMS'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleOpenPreview}
            disabled={loadingPreview}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <Eye className="w-4 h-4 text-slate-500" />
            <span>{loadingPreview ? 'Loading Preview...' : 'Preview Draft'}</span>
          </button>

          {settingsForm.public_site_url && (
            <a
              href={settingsForm.public_site_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition whitespace-nowrap shrink-0"
            >
              <span>View Public Website</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          )}

          <button
            onClick={() => setPublishModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Publish Changes</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            feedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-sky-50 border-sky-200 text-sky-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ==================================================================
          5.1 WEBSITE DASHBOARD
      ================================================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Status Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <span className="text-xs text-slate-500">Publication Status</span>
              <div className="text-base font-bold text-slate-900 flex items-center gap-2 pt-1">
                <span>{settingsForm.site_status || 'Unpublished'}</span>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                {settingsForm.has_unpublished_changes
                  ? 'Draft has unpublished edits'
                  : 'Draft matches latest snapshot'}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <span className="text-xs text-slate-500">Last Content Update</span>
              <div className="text-sm font-semibold text-slate-900 font-mono tabular-nums pt-1">
                {settingsForm.last_edited_at
                  ? new Date(settingsForm.last_edited_at).toLocaleString()
                  : 'Never'}
              </div>
              <p className="text-xs text-slate-500 pt-1">Saved in AlwaysData MySQL</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <span className="text-xs text-slate-500">Latest Published Snapshot</span>
              <div className="text-sm font-semibold text-slate-900 font-mono tabular-nums pt-1">
                {cmsData.latest_snapshot_meta
                  ? `v${cmsData.latest_snapshot_meta.version_number} (${new Date(
                      cmsData.latest_snapshot_meta.created_at
                    ).toLocaleDateString()})`
                  : 'None published yet'}
              </div>
              <p className="text-xs text-slate-500 pt-1">
                {cmsData.latest_snapshot_meta
                  ? `By ${cmsData.latest_snapshot_meta.published_by_name}`
                  : 'Click Publish to create v1'}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1">
              <span className="text-xs text-slate-500">Last Deployment Request</span>
              <div className="text-sm font-semibold text-slate-900 pt-1">
                {latestPub ? latestPub.deployment_status : 'No build requested'}
              </div>
              <p className="text-xs text-slate-500 font-mono tabular-nums pt-1">
                {latestPub
                  ? new Date(latestPub.created_at).toLocaleString()
                  : 'Awaiting first publication'}
              </p>
            </div>
          </div>

          {/* Honest Deployment & Environment Configuration Status */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Quick Actions & Content Summary</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Manage public hotel information without exposing any private CRM records.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('general')}
                  className="px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Edit Website Content
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                <button
                  onClick={() => setActiveTab('rooms')}
                  className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 text-left transition cursor-pointer"
                >
                  <span className="text-xs text-slate-500 block">Public Rooms</span>
                  <span className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1 block">
                    {cmsData.rooms.filter((r) => r.is_visible === 1).length} / {cmsData.rooms.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('facilities')}
                  className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 text-left transition cursor-pointer"
                >
                  <span className="text-xs text-slate-500 block">Facilities</span>
                  <span className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1 block">
                    {cmsData.facilities.filter((f) => f.is_visible === 1).length} / {cmsData.facilities.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('gallery')}
                  className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 text-left transition cursor-pointer"
                >
                  <span className="text-xs text-slate-500 block">Gallery Photos</span>
                  <span className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1 block">
                    {cmsData.gallery.filter((g) => g.is_visible === 1).length} / {cmsData.gallery.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('faqs')}
                  className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 text-left transition cursor-pointer"
                >
                  <span className="text-xs text-slate-500 block">Published FAQs</span>
                  <span className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1 block">
                    {cmsData.faqs.filter((q) => q.is_visible === 1).length} / {cmsData.faqs.length}
                  </span>
                </button>
              </div>

              {latestPub && (
                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <span className="font-semibold text-slate-800 block">
                      Latest Publication: Snapshot v{latestPub.version_number} · {latestPub.deployment_status}
                    </span>
                    <span className="text-slate-500 block">
                      {latestPub.verified_at
                        ? `Verified at ${new Date(latestPub.verified_at).toLocaleString()}`
                        : latestPub.build_hook_triggered
                        ? 'Deployment requested; completion has not yet been verified.'
                        : latestPub.error_message || 'Snapshot saved in MySQL.'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleVerifyDeployment(latestPub.id)}
                      disabled={verifyingId === latestPub.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${verifyingId === latestPub.id ? 'animate-spin' : ''}`} />
                      <span>Verify Status</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('history')}
                      className="px-3 py-1.5 font-medium text-sky-700 hover:underline cursor-pointer whitespace-nowrap"
                    >
                      History
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Server Environment Readiness Card */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Publishing & Netlify Integration Status</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Server-side environment variables required for automated Netlify builds.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div>
                    <span className="font-mono font-semibold text-slate-800 block">
                      PUBLIC_SITE_EXPORT_TOKEN
                    </span>
                    <span className="text-slate-500">
                      Protects <code className="font-mono">GET /api/public-site/export</code> for Netlify builds
                    </span>
                  </div>
                  <span
                    className={`font-semibold whitespace-nowrap ${
                      envStatus.export_token_configured ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {envStatus.export_token_configured ? 'Configured' : 'Not Set'}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div>
                    <span className="font-mono font-semibold text-slate-800 block">
                      NETLIFY_BUILD_HOOK_URL
                    </span>
                    <span className="text-slate-500">
                      Triggers Netlify static rebuild when you click Publish
                    </span>
                  </div>
                  <span
                    className={`font-semibold whitespace-nowrap ${
                      envStatus.netlify_build_hook_configured ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {envStatus.netlify_build_hook_configured ? 'Configured' : 'Not Set'}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div>
                    <span className="font-mono font-semibold text-slate-800 block">
                      NETLIFY_SITE_ID & NETLIFY_API_TOKEN
                    </span>
                    <span className="text-slate-500">
                      Optional: Enables live build completion verification in dashboard
                    </span>
                  </div>
                  <span
                    className={`font-semibold whitespace-nowrap ${
                      envStatus.netlify_status_api_configured ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {envStatus.netlify_status_api_configured ? 'Configured' : 'Optional'}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                See <code className="font-mono text-slate-700">PUBLIC-WEBSITE-DEPLOYMENT.md</code> in the project root for step-by-step Render, Netlify, and custom domain DNS setup instructions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================
          5.2 GENERAL HOTEL INFORMATION
      ================================================================== */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-xl p-6 space-y-8">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">General Hotel Information</h2>
              <p className="text-xs text-slate-500">
                Enter your official hotel brand details, contact numbers, check-in timings, and policies.
              </p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save General Info'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hotel Name *</label>
              <input
                type="text"
                value={settingsForm.hotel_name}
                onChange={(e) => setSettingsForm({ ...settingsForm, hotel_name: e.target.value })}
                placeholder="e.g., Grand Horizon Hotel"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tagline / Subtitle</label>
              <input
                type="text"
                value={settingsForm.tagline}
                onChange={(e) => setSettingsForm({ ...settingsForm, tagline: e.target.value })}
                placeholder="e.g., Boutique City-Center Hospitality"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Short Main Description
              </label>
              <textarea
                rows={2}
                value={settingsForm.short_description}
                onChange={(e) => setSettingsForm({ ...settingsForm, short_description: e.target.value })}
                placeholder="Concise introduction shown on the homepage and meta summary..."
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">About Section Heading</label>
              <input
                type="text"
                value={settingsForm.about_title}
                onChange={(e) => setSettingsForm({ ...settingsForm, about_title: e.target.value })}
                placeholder="e.g., About Our Hotel"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Live Public Website URL (Custom Domain or Netlify URL)
              </label>
              <input
                type="url"
                value={settingsForm.public_site_url}
                onChange={(e) => setSettingsForm({ ...settingsForm, public_site_url: e.target.value })}
                placeholder="https://www.yourhoteldomain.com"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                About the Hotel (Full Story & Overview)
              </label>
              <textarea
                rows={4}
                value={settingsForm.about_content}
                onChange={(e) => setSettingsForm({ ...settingsForm, about_content: e.target.value })}
                placeholder="Detailed description of the property, architecture, and guest experience..."
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Logo URL</label>
              <input
                type="url"
                value={settingsForm.logo_url}
                onChange={(e) => setSettingsForm({ ...settingsForm, logo_url: e.target.value })}
                placeholder="https://.../logo.png"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Favicon URL</label>
              <input
                type="url"
                value={settingsForm.favicon_url}
                onChange={(e) => setSettingsForm({ ...settingsForm, favicon_url: e.target.value })}
                placeholder="https://.../favicon.png"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Contact & Location */}
          <div className="pt-6 border-t border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Contact Details & Location</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Main Contact Phone</label>
                <input
                  type="text"
                  value={settingsForm.contact_phone}
                  onChange={(e) => setSettingsForm({ ...settingsForm, contact_phone: e.target.value })}
                  placeholder="+1 234 567 8900"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp Number</label>
                <input
                  type="text"
                  value={settingsForm.whatsapp_number}
                  onChange={(e) => setSettingsForm({ ...settingsForm, whatsapp_number: e.target.value })}
                  placeholder="+1 234 567 8900"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={settingsForm.contact_email}
                  onChange={(e) => setSettingsForm({ ...settingsForm, contact_email: e.target.value })}
                  placeholder="reservations@example.com"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address</label>
                <input
                  type="text"
                  value={settingsForm.address_line}
                  onChange={(e) => setSettingsForm({ ...settingsForm, address_line: e.target.value })}
                  placeholder="Full street address"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={settingsForm.city}
                  onChange={(e) => setSettingsForm({ ...settingsForm, city: e.target.value })}
                  placeholder="City"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
                <input
                  type="text"
                  value={settingsForm.country}
                  onChange={(e) => setSettingsForm({ ...settingsForm, country: e.target.value })}
                  placeholder="Country"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Postal Code</label>
                <input
                  type="text"
                  value={settingsForm.postal_code}
                  onChange={(e) => setSettingsForm({ ...settingsForm, postal_code: e.target.value })}
                  placeholder="Postal code"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Google Maps Link URL</label>
                <input
                  type="url"
                  value={settingsForm.google_maps_url}
                  onChange={(e) => setSettingsForm({ ...settingsForm, google_maps_url: e.target.value })}
                  placeholder="https://maps.google.com/..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Google Maps Embed Iframe URL (Optional)
                </label>
                <input
                  type="url"
                  value={settingsForm.google_maps_embed_url}
                  onChange={(e) => setSettingsForm({ ...settingsForm, google_maps_embed_url: e.target.value })}
                  placeholder="https://www.google.com/maps/embed?pb=..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Reservation CTA, Timings & Policies */}
          <div className="pt-6 border-t border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Reservations, Check-In/Out & Policies</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Main Reservation / Enquiry Link URL
                </label>
                <input
                  type="text"
                  value={settingsForm.reservation_url}
                  onChange={(e) => setSettingsForm({ ...settingsForm, reservation_url: e.target.value })}
                  placeholder="https://... or leave blank to scroll to Contact section"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">CTA Button Label</label>
                <input
                  type="text"
                  value={settingsForm.reservation_button_text}
                  onChange={(e) => setSettingsForm({ ...settingsForm, reservation_button_text: e.target.value })}
                  placeholder="Enquire Now"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Check-in</label>
                  <input
                    type="text"
                    value={settingsForm.check_in_time}
                    onChange={(e) => setSettingsForm({ ...settingsForm, check_in_time: e.target.value })}
                    placeholder="14:00"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Check-out</label>
                  <input
                    type="text"
                    value={settingsForm.check_out_time}
                    onChange={(e) => setSettingsForm({ ...settingsForm, check_out_time: e.target.value })}
                    placeholder="12:00"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cancellation Policy</label>
                <textarea
                  rows={3}
                  value={settingsForm.cancellation_policy}
                  onChange={(e) => setSettingsForm({ ...settingsForm, cancellation_policy: e.target.value })}
                  placeholder="Enter official cancellation terms..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">General Hotel Policies</label>
                <textarea
                  rows={3}
                  value={settingsForm.general_policies}
                  onChange={(e) => setSettingsForm({ ...settingsForm, general_policies: e.target.value })}
                  placeholder="ID requirements, smoking policy, pets, quiet hours..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Social & Footer */}
          <div className="pt-6 border-t border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Social Media & Footer Text</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Facebook URL</label>
                <input
                  type="url"
                  value={settingsForm.social_links?.facebook || ''}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      social_links: { ...settingsForm.social_links, facebook: e.target.value },
                    })
                  }
                  placeholder="https://facebook.com/..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Instagram URL</label>
                <input
                  type="url"
                  value={settingsForm.social_links?.instagram || ''}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      social_links: { ...settingsForm.social_links, instagram: e.target.value },
                    })
                  }
                  placeholder="https://instagram.com/..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">TripAdvisor URL</label>
                <input
                  type="url"
                  value={settingsForm.social_links?.tripadvisor || ''}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      social_links: { ...settingsForm.social_links, tripadvisor: e.target.value },
                    })
                  }
                  placeholder="https://tripadvisor.com/..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Website Footer Text</label>
                <input
                  type="text"
                  value={settingsForm.footer_text}
                  onChange={(e) => setSettingsForm({ ...settingsForm, footer_text: e.target.value })}
                  placeholder="Brief footer summary text..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Copyright Notice</label>
                <input
                  type="text"
                  value={settingsForm.copyright_text}
                  onChange={(e) => setSettingsForm({ ...settingsForm, copyright_text: e.target.value })}
                  placeholder="© 2026 Hotel Name. All rights reserved."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ==================================================================
          5.3 HOMEPAGE EDITOR
      ================================================================== */}
      {activeTab === 'homepage' && (
        <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-xl p-6 space-y-8">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Homepage Editor & Section Order</h2>
              <p className="text-xs text-slate-500">
                Configure your hero banner, welcome introduction, and control which homepage sections are shown.
              </p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Homepage'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hero Heading</label>
              <input
                type="text"
                value={settingsForm.hero_heading}
                onChange={(e) => setSettingsForm({ ...settingsForm, hero_heading: e.target.value })}
                placeholder="Main headline displayed on the homepage hero"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hero Background Image URL</label>
              <input
                type="url"
                value={settingsForm.hero_image_url}
                onChange={(e) => setSettingsForm({ ...settingsForm, hero_image_url: e.target.value })}
                placeholder="https://.../hero.jpg"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hero Subtitle</label>
              <textarea
                rows={2}
                value={settingsForm.hero_subtitle}
                onChange={(e) => setSettingsForm({ ...settingsForm, hero_subtitle: e.target.value })}
                placeholder="Supporting subtitle under the hero heading..."
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Primary CTA Button Text</label>
              <input
                type="text"
                value={settingsForm.hero_cta_text}
                onChange={(e) => setSettingsForm({ ...settingsForm, hero_cta_text: e.target.value })}
                placeholder="Explore Rooms"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Primary CTA Link</label>
              <input
                type="text"
                value={settingsForm.hero_cta_link}
                onChange={(e) => setSettingsForm({ ...settingsForm, hero_cta_link: e.target.value })}
                placeholder="#rooms"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="md:col-span-2 pt-4 border-t border-slate-200">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Welcome Section Heading</label>
              <input
                type="text"
                value={settingsForm.welcome_heading}
                onChange={(e) => setSettingsForm({ ...settingsForm, welcome_heading: e.target.value })}
                placeholder="e.g., Welcome to Refined Comfort"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg mb-3"
              />
              <label className="block text-xs font-semibold text-slate-700 mb-1">Welcome Section Body</label>
              <textarea
                rows={3}
                value={settingsForm.welcome_body}
                onChange={(e) => setSettingsForm({ ...settingsForm, welcome_body: e.target.value })}
                placeholder="Introductory paragraph welcoming guests to your property..."
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Section Visibility & Reordering */}
          <div className="pt-6 border-t border-slate-200 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Homepage Section Order & Visibility</h3>
            <p className="text-xs text-slate-500">
              Show or hide homepage sections and change the order in which they appear to visitors.
            </p>
            <div className="space-y-2">
              {settingsForm.homepage_sections
                .sort((a, b) => a.order - b.order)
                .map((sec, idx, arr) => (
                  <div
                    key={sec.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/60"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={sec.enabled}
                        onChange={(e) => {
                          const updated = settingsForm.homepage_sections.map((s) =>
                            s.id === sec.id ? { ...s, enabled: e.target.checked } : s
                          );
                          setSettingsForm({ ...settingsForm, homepage_sections: updated });
                        }}
                        className="rounded border-slate-300"
                      />
                      <span className="text-xs font-semibold text-slate-800">
                        {idx + 1}. {sec.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => {
                          const sorted = [...arr];
                          const temp = sorted[idx - 1];
                          sorted[idx - 1] = sorted[idx];
                          sorted[idx] = temp;
                          setSettingsForm({
                            ...settingsForm,
                            homepage_sections: sorted.map((s, i) => ({ ...s, order: i + 1 })),
                          });
                        }}
                        className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === arr.length - 1}
                        onClick={() => {
                          const sorted = [...arr];
                          const temp = sorted[idx + 1];
                          sorted[idx + 1] = sorted[idx];
                          sorted[idx] = temp;
                          setSettingsForm({
                            ...settingsForm,
                            homepage_sections: sorted.map((s, i) => ({ ...s, order: i + 1 })),
                          });
                        }}
                        className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </form>
      )}

      {/* ==================================================================
          5.4 ROOMS & ACCOMMODATION MANAGEMENT
      ================================================================== */}
      {activeTab === 'rooms' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-base font-bold text-slate-900">Rooms & Accommodation Management</h2>
                <p className="text-xs text-slate-500">
                  Manage public room cards. Isolated from confidential CRM client hotel bookings.
                </p>
              </div>
              <button
                onClick={() => openRoomModal()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Room Type</span>
              </button>
            </div>

            {cmsData.rooms.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <BedDouble className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-medium text-slate-700">No public room types added yet</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Add your room categories with capacities, bed types, amenities, and optional indicative rates.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 mt-4">
                {cmsData.rooms.map((room, idx) => (
                  <div key={room.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-20 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                        {room.featured_image_url ? (
                          <img
                            src={room.featured_image_url}
                            alt={room.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <BedDouble className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{room.name}</h3>
                          <span className="text-xs text-slate-500">
                            · {room.is_visible ? 'Visible' : 'Hidden'}
                            {room.is_featured ? ' · Featured' : ''}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {[
                            room.capacity,
                            room.bed_type,
                            room.room_size,
                            room.optional_price !== null
                              ? `${room.currency} ${room.optional_price} (${room.price_note})`
                              : 'Rate on enquiry',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleMoveItem('rooms', idx, 'up')}
                        disabled={idx === 0}
                        className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMoveItem('rooms', idx, 'down')}
                        disabled={idx === cmsData.rooms.length - 1}
                        className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          await api.updatePublicSiteRoom(room.id, { is_visible: room.is_visible ? 0 : 1 });
                          await loadBootstrap(true);
                        }}
                        className="px-2.5 py-1 text-xs font-medium border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
                      >
                        {room.is_visible ? 'Hide' : 'Show'}
                      </button>
                      <button
                        onClick={() => openRoomModal(room)}
                        className="p-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          await api.deletePublicSiteRoom(room.id);
                          await loadBootstrap(true);
                          showNotice('info', 'Room deleted from draft.');
                        }}
                        className="p-1.5 text-rose-600 hover:text-rose-800 cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Room Editor Modal */}
          {editingRoom && (
            <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
              <form
                onSubmit={handleSaveRoom}
                className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 p-6 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="text-base font-bold text-slate-900">
                    {editingRoom.id ? 'Edit Room Type' : 'Add Room Type'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingRoom(null)}
                    className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Room Name *</label>
                    <input
                      type="text"
                      required
                      value={editingRoom.name || ''}
                      onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
                      placeholder="e.g., Deluxe King Suite"
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Capacity</label>
                    <input
                      type="text"
                      value={editingRoom.capacity || ''}
                      onChange={(e) => setEditingRoom({ ...editingRoom, capacity: e.target.value })}
                      placeholder="e.g., Up to 2 Guests"
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Bed Type</label>
                    <input
                      type="text"
                      value={editingRoom.bed_type || ''}
                      onChange={(e) => setEditingRoom({ ...editingRoom, bed_type: e.target.value })}
                      placeholder="e.g., 1 King Bed"
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Room Size</label>
                    <input
                      type="text"
                      value={editingRoom.room_size || ''}
                      onChange={(e) => setEditingRoom({ ...editingRoom, room_size: e.target.value })}
                      placeholder="e.g., 38 m²"
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Featured Image URL</label>
                    <input
                      type="url"
                      value={editingRoom.featured_image_url || ''}
                      onChange={(e) => setEditingRoom({ ...editingRoom, featured_image_url: e.target.value })}
                      placeholder="https://.../room.jpg"
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Optional Indicative Price (Leave blank if not shown)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingRoom.optional_price ?? ''}
                      onChange={(e) =>
                        setEditingRoom({
                          ...editingRoom,
                          optional_price: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      placeholder="Optional"
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Currency</label>
                      <input
                        type="text"
                        value={editingRoom.currency || 'USD'}
                        onChange={(e) => setEditingRoom({ ...editingRoom, currency: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Price Note</label>
                      <input
                        type="text"
                        value={editingRoom.price_note || ''}
                        onChange={(e) => setEditingRoom({ ...editingRoom, price_note: e.target.value })}
                        placeholder="per night"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Short Summary</label>
                    <input
                      type="text"
                      value={editingRoom.short_description || ''}
                      onChange={(e) => setEditingRoom({ ...editingRoom, short_description: e.target.value })}
                      placeholder="1-2 sentence room summary for card view"
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Room Description</label>
                    <textarea
                      rows={3}
                      value={editingRoom.full_description || ''}
                      onChange={(e) => setEditingRoom({ ...editingRoom, full_description: e.target.value })}
                      placeholder="Detailed room description..."
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Room Amenities (Comma-separated)
                    </label>
                    <input
                      type="text"
                      value={roomAmenitiesInput}
                      onChange={(e) => setRoomAmenitiesInput(e.target.value)}
                      placeholder="e.g., High-Speed Wi-Fi, Work Desk, Rain Shower, Minibar"
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Optional Enquiry / Booking Link
                    </label>
                    <input
                      type="url"
                      value={editingRoom.enquiry_url || ''}
                      onChange={(e) => setEditingRoom({ ...editingRoom, enquiry_url: e.target.value })}
                      placeholder="https://... (Leave blank to use default hotel contact/reservation link)"
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div className="flex items-center gap-4 sm:col-span-2 pt-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(editingRoom.is_visible)}
                        onChange={(e) => setEditingRoom({ ...editingRoom, is_visible: e.target.checked ? 1 : 0 })}
                      />
                      <span>Visible on Public Website</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(editingRoom.is_featured)}
                        onChange={(e) => setEditingRoom({ ...editingRoom, is_featured: e.target.checked ? 1 : 0 })}
                      />
                      <span>Featured on Homepage</span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEditingRoom(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                  >
                    {saving ? 'Saving...' : 'Save Room'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================
          5.5 FACILITIES & AMENITIES
      ================================================================== */}
      {activeTab === 'facilities' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">Hotel Facilities & Amenities</h2>
              <p className="text-xs text-slate-500">
                Only facilities you add and enable here will be claimed on the public website.
              </p>
            </div>
            <button
              onClick={() =>
                setEditingFacility({
                  name: '',
                  category: 'General',
                  description: '',
                  icon_name: 'Sparkles',
                  image_url: '',
                  is_featured: 1,
                  is_visible: 1,
                })
              }
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Facility</span>
            </button>
          </div>

          {editingFacility && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editingFacility.name?.trim()) return;
                try {
                  setSaving(true);
                  if (editingFacility.id) {
                    await api.updatePublicSiteFacility(editingFacility.id, editingFacility);
                  } else {
                    await api.createPublicSiteFacility(editingFacility);
                  }
                  setEditingFacility(null);
                  await loadBootstrap(true);
                  showNotice('success', 'Facility saved to draft.');
                } catch (err: any) {
                  showNotice('error', err.message || 'Failed to save facility');
                } finally {
                  setSaving(false);
                }
              }}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Facility Name *</label>
                  <input
                    type="text"
                    required
                    value={editingFacility.name || ''}
                    onChange={(e) => setEditingFacility({ ...editingFacility, name: e.target.value })}
                    placeholder="e.g., 24-Hour Front Desk"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={editingFacility.category || ''}
                    onChange={(e) => setEditingFacility({ ...editingFacility, category: e.target.value })}
                    placeholder="e.g., Guest Services, Dining, Wellness"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Icon</label>
                  <select
                    value={editingFacility.icon_name || 'Sparkles'}
                    onChange={(e) => setEditingFacility({ ...editingFacility, icon_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  >
                    {AVAILABLE_ICONS.map((ic) => (
                      <option key={ic.value} value={ic.value}>
                        {ic.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={editingFacility.description || ''}
                    onChange={(e) => setEditingFacility({ ...editingFacility, description: e.target.value })}
                    placeholder="Brief details about this facility..."
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Optional Image URL</label>
                  <input
                    type="url"
                    value={editingFacility.image_url || ''}
                    onChange={(e) => setEditingFacility({ ...editingFacility, image_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingFacility(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg cursor-pointer"
                >
                  Save Facility
                </button>
              </div>
            </form>
          )}

          {cmsData.facilities.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              No facilities added yet. Click "Add Facility" to list verified hotel amenities.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {cmsData.facilities.map((fac, idx) => (
                <div key={fac.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {fac.name}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        · {fac.category} · {fac.is_visible ? 'Visible' : 'Hidden'}
                      </span>
                    </div>
                    {fac.description && <p className="text-xs text-slate-500 mt-0.5">{fac.description}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleMoveItem('facilities', idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveItem('facilities', idx, 'down')}
                      disabled={idx === cmsData.facilities.length - 1}
                      className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => {
                        await api.updatePublicSiteFacility(fac.id, { is_visible: fac.is_visible ? 0 : 1 });
                        await loadBootstrap(true);
                      }}
                      className="px-2.5 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50 cursor-pointer"
                    >
                      {fac.is_visible ? 'Hide' : 'Show'}
                    </button>
                    <button
                      onClick={() => setEditingFacility(fac)}
                      className="p-1 text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => {
                        await api.deletePublicSiteFacility(fac.id);
                        await loadBootstrap(true);
                      }}
                      className="p-1 text-rose-600 hover:text-rose-800 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================
          5.6 PHOTO GALLERY
      ================================================================== */}
      {activeTab === 'gallery' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">Photo Gallery Manager</h2>
              <p className="text-xs text-slate-500">
                Use durable hosted image URLs (CDN, Cloudinary, S3, or public web URLs). Ephemeral local disk or large Base64 blobs are avoided.
              </p>
            </div>
            <button
              onClick={() =>
                setEditingGallery({
                  title: '',
                  caption: '',
                  alt_text: '',
                  category: 'Hotel',
                  image_url: '',
                  is_featured: 0,
                  is_visible: 1,
                })
              }
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Photo</span>
            </button>
          </div>

          {editingGallery && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editingGallery.image_url?.trim()) return;
                try {
                  setSaving(true);
                  if (editingGallery.id) {
                    await api.updatePublicSiteGalleryItem(editingGallery.id, editingGallery);
                  } else {
                    await api.createPublicSiteGalleryItem(editingGallery);
                  }
                  setEditingGallery(null);
                  await loadBootstrap(true);
                  showNotice('success', 'Gallery photo saved.');
                } catch (err: any) {
                  showNotice('error', err.message || 'Failed to save gallery photo');
                } finally {
                  setSaving(false);
                }
              }}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Image URL *</label>
                  <input
                    type="url"
                    required
                    value={editingGallery.image_url || ''}
                    onChange={(e) => setEditingGallery({ ...editingGallery, image_url: e.target.value })}
                    placeholder="https://.../photo.jpg"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={editingGallery.title || ''}
                    onChange={(e) => setEditingGallery({ ...editingGallery, title: e.target.value })}
                    placeholder="e.g., Lobby Lounge"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Alt Text (Accessibility) *</label>
                  <input
                    type="text"
                    required
                    value={editingGallery.alt_text || ''}
                    onChange={(e) => setEditingGallery({ ...editingGallery, alt_text: e.target.value })}
                    placeholder="Descriptive text for screen readers"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={editingGallery.category || ''}
                    onChange={(e) => setEditingGallery({ ...editingGallery, category: e.target.value })}
                    placeholder="e.g., Rooms, Dining, Exterior"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Caption</label>
                  <input
                    type="text"
                    value={editingGallery.caption || ''}
                    onChange={(e) => setEditingGallery({ ...editingGallery, caption: e.target.value })}
                    placeholder="Optional caption"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingGallery(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg cursor-pointer"
                >
                  Save Photo
                </button>
              </div>
            </form>
          )}

          {cmsData.gallery.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              No gallery images added yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cmsData.gallery.map((item, idx) => (
                <div key={item.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white flex flex-col justify-between">
                  <div>
                    <div className="aspect-[4/3] bg-slate-900 overflow-hidden">
                      <img
                        src={item.image_url}
                        alt={item.alt_text}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-3.5">
                      <span className="text-[11px] text-slate-500">
                        {item.category} · {item.is_visible ? 'Published' : 'Hidden'}
                      </span>
                      <h4 className="text-sm font-semibold text-slate-900 truncate">
                        {item.title || item.alt_text}
                      </h4>
                      {item.caption && <p className="text-xs text-slate-500 truncate mt-0.5">{item.caption}</p>}
                    </div>
                  </div>
                  <div className="px-3.5 py-2.5 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMoveItem('gallery', idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveItem('gallery', idx, 'down')}
                        disabled={idx === cmsData.gallery.length - 1}
                        className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={async () => {
                          await api.updatePublicSiteGalleryItem(item.id, { is_visible: item.is_visible ? 0 : 1 });
                          await loadBootstrap(true);
                        }}
                        className="px-2 py-0.5 text-xs border border-slate-200 rounded cursor-pointer"
                      >
                        {item.is_visible ? 'Hide' : 'Show'}
                      </button>
                      <button
                        onClick={() => setEditingGallery(item)}
                        className="p-1 text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          await api.deletePublicSiteGalleryItem(item.id);
                          await loadBootstrap(true);
                        }}
                        className="p-1 text-rose-600 hover:text-rose-800 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================
          5.7 WEBSITE PAGES & NAVIGATION
      ================================================================== */}
      {activeTab === 'pages' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-bold text-slate-900 px-2 pb-2 border-b border-slate-100">
              Website Pages
            </h3>
            {cmsData.pages.map((p) => (
              <button
                key={p.slug}
                onClick={() => setSelectedPageSlug(p.slug)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between transition cursor-pointer ${
                  selectedPageSlug === p.slug
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>{p.title} (/{p.slug})</span>
                <span className="text-[11px] opacity-75">{p.is_visible ? 'Visible' : 'Hidden'}</span>
              </button>
            ))}
          </div>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6">
            {pageForm && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    setSaving(true);
                    await api.updatePublicSitePage(selectedPageSlug, pageForm);
                    await loadBootstrap(true);
                    showNotice('success', `Saved "${pageForm.title}" page settings.`);
                  } catch (err: any) {
                    showNotice('error', err.message || 'Failed to update page');
                  } finally {
                    setSaving(false);
                  }
                }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="text-base font-bold text-slate-900">
                    Edit Page: {pageForm.title}
                  </h3>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg cursor-pointer"
                  >
                    {saving ? 'Saving...' : 'Save Page'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Page Title</label>
                    <input
                      type="text"
                      value={pageForm.title || ''}
                      onChange={(e) => setPageForm({ ...pageForm, title: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Main Section Heading</label>
                    <input
                      type="text"
                      value={pageForm.heading || ''}
                      onChange={(e) => setPageForm({ ...pageForm, heading: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Subheading / Lead Text</label>
                    <input
                      type="text"
                      value={pageForm.subheading || ''}
                      onChange={(e) => setPageForm({ ...pageForm, subheading: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Structured Page Content / Additional Notes
                    </label>
                    <textarea
                      rows={4}
                      value={pageForm.content_body || ''}
                      onChange={(e) => setPageForm({ ...pageForm, content_body: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="flex items-center gap-4 sm:col-span-2 pt-2">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(pageForm.is_visible)}
                        onChange={(e) => setPageForm({ ...pageForm, is_visible: e.target.checked ? 1 : 0 })}
                      />
                      <span>Page Enabled</span>
                    </label>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================
          5.8 FREQUENTLY ASKED QUESTIONS (FAQ)
      ================================================================== */}
      {activeTab === 'faqs' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">Frequently Asked Questions</h2>
              <p className="text-xs text-slate-500">
                Create, edit, reorder, or hide guest questions and answers.
              </p>
            </div>
            <button
              onClick={() =>
                setEditingFaq({
                  question: '',
                  answer: '',
                  category: 'General',
                  is_visible: 1,
                })
              }
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Question</span>
            </button>
          </div>

          {editingFaq && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editingFaq.question?.trim() || !editingFaq.answer?.trim()) return;
                try {
                  setSaving(true);
                  if (editingFaq.id) {
                    await api.updatePublicSiteFaq(editingFaq.id, editingFaq);
                  } else {
                    await api.createPublicSiteFaq(editingFaq);
                  }
                  setEditingFaq(null);
                  await loadBootstrap(true);
                  showNotice('success', 'FAQ saved to draft.');
                } catch (err: any) {
                  showNotice('error', err.message || 'Failed to save FAQ');
                } finally {
                  setSaving(false);
                }
              }}
              className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Question *</label>
                <input
                  type="text"
                  required
                  value={editingFaq.question || ''}
                  onChange={(e) => setEditingFaq({ ...editingFaq, question: e.target.value })}
                  placeholder="e.g., What are the check-in and check-out times?"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Answer *</label>
                <textarea
                  rows={3}
                  required
                  value={editingFaq.answer || ''}
                  onChange={(e) => setEditingFaq({ ...editingFaq, answer: e.target.value })}
                  placeholder="Provide a clear, accurate answer..."
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingFaq(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg cursor-pointer"
                >
                  Save FAQ
                </button>
              </div>
            </form>
          )}

          {cmsData.faqs.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">No FAQs added yet.</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {cmsData.faqs.map((faq, idx) => (
                <div key={faq.id} className="py-4 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-slate-900">
                      {faq.question}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        · {faq.is_visible ? 'Published' : 'Hidden'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 whitespace-pre-line">{faq.answer}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleMoveItem('faqs', idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveItem('faqs', idx, 'down')}
                      disabled={idx === cmsData.faqs.length - 1}
                      className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => {
                        await api.updatePublicSiteFaq(faq.id, { is_visible: faq.is_visible ? 0 : 1 });
                        await loadBootstrap(true);
                      }}
                      className="px-2.5 py-1 text-xs border border-slate-200 rounded cursor-pointer"
                    >
                      {faq.is_visible ? 'Hide' : 'Show'}
                    </button>
                    <button
                      onClick={() => setEditingFaq(faq)}
                      className="p-1 text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={async () => {
                        await api.deletePublicSiteFaq(faq.id);
                        await loadBootstrap(true);
                      }}
                      className="p-1 text-rose-600 hover:text-rose-800 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================
          5.9 SEO & WEBSITE SETTINGS
      ================================================================== */}
      {activeTab === 'seo' && (
        <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">SEO, OpenGraph & Domain Settings</h2>
              <p className="text-xs text-slate-500">
                Configure search engine metadata, social sharing cards, canonical domain, and robots indexing.
              </p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save SEO Settings'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Website SEO Title</label>
              <input
                type="text"
                value={settingsForm.seo_title}
                onChange={(e) => setSettingsForm({ ...settingsForm, seo_title: e.target.value })}
                placeholder="Defaults to Hotel Name if blank"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Canonical Domain URL (Do not hardcode until live)
              </label>
              <input
                type="url"
                value={settingsForm.canonical_domain}
                onChange={(e) => setSettingsForm({ ...settingsForm, canonical_domain: e.target.value })}
                placeholder="https://www.yourhoteldomain.com"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Meta Description</label>
              <textarea
                rows={2}
                value={settingsForm.seo_description}
                onChange={(e) => setSettingsForm({ ...settingsForm, seo_description: e.target.value })}
                placeholder="150–160 character summary for search results..."
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Social Sharing (OG) Title</label>
              <input
                type="text"
                value={settingsForm.og_title}
                onChange={(e) => setSettingsForm({ ...settingsForm, og_title: e.target.value })}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Social Sharing Image URL</label>
              <input
                type="url"
                value={settingsForm.og_image_url}
                onChange={(e) => setSettingsForm({ ...settingsForm, og_image_url: e.target.value })}
                placeholder="https://.../og-share.jpg"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Social Sharing Description</label>
              <textarea
                rows={2}
                value={settingsForm.og_description}
                onChange={(e) => setSettingsForm({ ...settingsForm, og_description: e.target.value })}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Robots Indexing Directive</label>
              <select
                value={settingsForm.robots_indexing}
                onChange={(e) => setSettingsForm({ ...settingsForm, robots_indexing: e.target.value })}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              >
                <option value="index,follow">index, follow (Allow search engines)</option>
                <option value="noindex,nofollow">noindex, nofollow (Hide from search engines)</option>
              </select>
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(settingsForm.sitemap_enabled)}
                  onChange={(e) => setSettingsForm({ ...settingsForm, sitemap_enabled: e.target.checked ? 1 : 0 })}
                />
                <span>Generate sitemap.xml during Netlify build</span>
              </label>
            </div>
          </div>
        </form>
      )}

      {/* ==================================================================
          5.11 PUBLICATION HISTORY
      ================================================================== */}
      {activeTab === 'history' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Publication & Deployment Audit Log</h2>
            <p className="text-xs text-slate-500">
              Records every publication snapshot, administrator, build hook trigger, and verified deployment status.
            </p>
          </div>

          {cmsData.publications.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              No publication events recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-3 px-3 font-semibold">Version</th>
                    <th className="py-3 px-3 font-semibold">Timestamp</th>
                    <th className="py-3 px-3 font-semibold">Initiated By</th>
                    <th className="py-3 px-3 font-semibold">Status</th>
                    <th className="py-3 px-3 font-semibold">Build Hook</th>
                    <th className="py-3 px-3 font-semibold">Details / Notes</th>
                    <th className="py-3 px-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cmsData.publications.map((pub) => (
                    <tr key={pub.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 tabular-nums">
                        v{pub.version_number}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                        {new Date(pub.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-slate-800">{pub.initiated_by_name}</td>
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {pub.deployment_status}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 tabular-nums">
                        {pub.build_hook_triggered
                          ? `HTTP ${pub.build_hook_http_status || 200}`
                          : pub.build_hook_configured
                          ? `Failed (${pub.build_hook_http_status || 'Error'})`
                          : 'Not Configured'}
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-md">
                        {pub.error_message ? (
                          <span className="text-rose-700 block">{pub.error_message}</span>
                        ) : null}
                        {pub.notes ? <span className="block">{pub.notes}</span> : null}
                        {pub.verified_at ? (
                          <span className="text-emerald-700 block font-mono tabular-nums">
                            Verified: {new Date(pub.verified_at).toLocaleString()}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleVerifyDeployment(pub.id)}
                          disabled={verifyingId === pub.id}
                          className="px-2.5 py-1 border border-slate-200 rounded hover:bg-slate-100 text-slate-700 font-medium cursor-pointer whitespace-nowrap"
                        >
                          {verifyingId === pub.id ? 'Checking...' : 'Check Status'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Publish Confirmation Modal */}
      {publishModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Publish Public Hotel Website</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Creates an allowlisted public snapshot in MySQL and triggers your Netlify Build Hook.
                </p>
              </div>
              <button
                onClick={() => setPublishModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Release Notes (Optional)
              </label>
              <input
                type="text"
                value={publishNotes}
                onChange={(e) => setPublishNotes(e.target.value)}
                placeholder="e.g., Updated seasonal room descriptions and contact phone"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            {!envStatus.netlify_build_hook_configured && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                <strong>Note:</strong> <code className="font-mono">NETLIFY_BUILD_HOOK_URL</code> is not yet configured on the server. Publishing will save the new snapshot version in MySQL for export, but will not automatically trigger a remote Netlify build until configured.
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPublishModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing}
                className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg cursor-pointer"
              >
                {publishing ? 'Publishing...' : 'Confirm & Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
