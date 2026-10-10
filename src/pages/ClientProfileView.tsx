import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  FolderOpen,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  CheckSquare,
  MessageSquare,
  Clock,
  ExternalLink,
  Loader2,
  Send,
  User,
  MapPin,
  Briefcase,
  Phone,
  Mail,
  AlertCircle,
  Sparkles,
  Image as ImageIcon,
  CheckCircle2,
  Eye,
  Upload,
  Building2,
  BedDouble,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import { ClientProfileDetails, ApplicationStatus, Country, HotelBooking } from '../types';
import { STATUS_CONFIG, getPriorityBadge } from '../utils/status';
import { CountrySelectSearch } from '../components/CountrySelectSearch';
import { ClientAvatar } from '../components/ClientAvatar';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { getGoogleDriveDirectImageUrl, isGoogleDriveLink } from '../utils/image';
import { NewHotelBookingModal } from '../components/NewHotelBookingModal';
import { HotelBookingDetailModal } from '../components/HotelBookingDetailModal';
import { Hotel } from '../types';

interface ClientProfileViewProps {
  clientId: number;
  refreshTrigger?: number;
  onBack: () => void;
  onOpenNewApplication: (clientId: number, clientName: string) => void;
  onOpenNewTask: (clientId: number, clientName: string) => void;
  onOpenStatusModal: (applicationId: number) => void;
  onClientDeleted: () => void;
  onOpenBookHotel?: (clientId: number, clientName: string) => void;
  onRefreshData?: () => void;
}

export const ClientProfileView: React.FC<ClientProfileViewProps> = ({
  clientId,
  refreshTrigger,
  onBack,
  onOpenNewApplication,
  onOpenNewTask,
  onOpenStatusModal,
  onClientDeleted,
  onOpenBookHotel,
  onRefreshData,
}) => {
  const [client, setClient] = useState<ClientProfileDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'applications' | 'hotels' | 'tasks' | 'comments' | 'activity'>('overview');
  const [commentMessage, setCommentMessage] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [editingClient, setEditingClient] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [hotelsList, setHotelsList] = useState<Hotel[]>([]);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedBookingForDetail, setSelectedBookingForDetail] = useState<HotelBooking | null>(null);
  const [bookingDetailModalOpen, setBookingDetailModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingClient, setDeletingClient] = useState(false);
  const [appToDelete, setAppToDelete] = useState<{ id: number; application_id: string } | null>(null);
  const [deletingApp, setDeletingApp] = useState(false);
  const [profileScanLoading, setProfileScanLoading] = useState(false);
  const [profileScanMsg, setProfileScanMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const profilePassportInputRef = useRef<HTMLInputElement | null>(null);

  // Serial Number / Client ID editing state
  const [isEditingClientId, setIsEditingClientId] = useState(false);
  const [tempClientId, setTempClientId] = useState('');
  const [savingClientId, setSavingClientId] = useState(false);

  const handleSaveClientId = async () => {
    if (!client || !tempClientId.trim()) return;
    setSavingClientId(true);
    setProfileError(null);
    try {
      await api.updateClient(client.id, { client_id: tempClientId.trim() });
      setIsEditingClientId(false);
      fetchClientData(true);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setProfileError('Failed to update serial number: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingClientId(false);
    }
  };

  const handleProfilePassportScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileScanLoading(true);
    setProfileScanMsg('Scanning passport on local device browser...');
    setProfileError(null);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const dataUrl = evt.target?.result as string;
        try {
          const scanned = await api.scanPassport(dataUrl, file.type, 'auto', (msg) => {
            setProfileScanMsg(msg);
          });
          setEditFormData((prev: any) => ({
            ...prev,
            full_name: scanned.fullName || prev.full_name,
            passport_number: scanned.passportNumber || prev.passport_number,
            country: scanned.country || prev.country,
            date_of_birth: scanned.dateOfBirth || prev.date_of_birth,
            photo_url: dataUrl || prev.photo_url,
          }));
          setProfileScanMsg(`Updated from passport: ${scanned.fullName} (${scanned.passportNumber})`);
          setTimeout(() => setProfileScanMsg(null), 5000);
        } catch (err: any) {
          setProfileScanMsg('Passport scan failed: ' + err.message);
        } finally {
          setProfileScanLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (e: any) {
      setProfileScanLoading(false);
    }
  };

  const fetchClientData = async (silent: boolean = false) => {
    try {
      if (!silent && !client) {
        setLoading(true);
      }
      const [data, ctrs, htls] = await Promise.all([
        api.getClientById(clientId),
        api.getCountries(true).catch(() => []),
        api.getHotels(false).catch(() => []),
      ]);
      setClient(data);
      setCountries(ctrs);
      setHotelsList(htls);
      setTempClientId(data.client_id || '');
      setEditFormData({
        client_id: data.client_id || '',
        full_name: data.full_name,
        passport_number: data.passport_number,
        country: data.country,
        phone: data.phone || '',
        whatsapp: data.whatsapp || '',
        email: data.email || '',
        date_of_birth: data.date_of_birth ? String(data.date_of_birth).slice(0, 10) : '',
        address: data.address || '',
        occupation: data.occupation || '',
        notes: data.notes || '',
        google_drive_url: data.google_drive_url || '',
        photo_url: data.photo_url || '',
      });
    } catch (err) {
      console.error('Failed to load client profile', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientData(false);
  }, [clientId]);

  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchClientData(true);
    }
  }, [refreshTrigger]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentMessage.trim() || !client) return;

    setSubmittingComment(true);
    try {
      await api.addComment(client.id, commentMessage.trim());
      setCommentMessage('');
      fetchClientData(true);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Failed to add comment', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleToggleTask = async (taskId: number) => {
    try {
      await api.toggleTaskStatus(taskId);
      fetchClientData(true);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Failed to toggle task', err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setProfileError('Photo file is too large. Please select an image under 8MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        setEditFormData({ ...editFormData, photo_url: evt.target.result as string });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    setSavingEdit(true);
    setProfileError(null);
    try {
      await api.updateClient(client.id, editFormData);
      setEditingClient(false);
      fetchClientData(true);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Failed to save client update', err);
      setProfileError('Failed to save client update: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!client) return;
    setDeletingClient(true);
    setProfileError(null);
    try {
      await api.deleteClient(client.id);
      setDeleteConfirmOpen(false);
      onClientDeleted();
    } catch (err: any) {
      console.error('Failed to delete client', err);
      setProfileError(err.message || 'Failed to delete client record');
    } finally {
      setDeletingClient(false);
    }
  };

  const handleDeleteApplication = async () => {
    if (!appToDelete) return;
    setDeletingApp(true);
    setProfileError(null);
    try {
      await api.deleteApplication(appToDelete.id);
      setAppToDelete(null);
      fetchClientData(true);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      console.error('Failed to delete application', err);
      setProfileError(err.message || 'Failed to delete application');
    } finally {
      setDeletingApp(false);
    }
  };

  if (loading && !client) {
    return (
      <div className="p-8 space-y-6 max-w-7xl mx-auto animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-24"></div>
        <div className="h-32 bg-slate-200 rounded-2xl"></div>
        <div className="h-64 bg-slate-200 rounded-2xl"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-8 sm:p-12 max-w-xl mx-auto text-center space-y-5 animate-in fade-in duration-150">
        <div className="w-20 h-20 rounded-3xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
          <User className="w-10 h-10" />
        </div>
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">404 • Not Found</div>
          <h2 className="text-xl font-bold text-slate-900">Client Record Not Found</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            The requested client profile (ID #{clientId}) does not exist in the database or may have been deleted.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Clients Directory</span>
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Clients Directory</span>
      </button>

      {profileError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
          <span>{profileError}</span>
          <button onClick={() => setProfileError(null)} className="font-bold underline ml-2">Dismiss</button>
        </div>
      )}

      {/* Main Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="relative group">
              <ClientAvatar
                name={client.full_name}
                photoUrl={client.photo_url}
                size="xl"
                allowPreview={true}
                className="shadow-md ring-2 ring-slate-100"
              />
              {client.photo_url ? (
                <span className="absolute -bottom-1 -right-1 bg-sky-700 text-white p-1 rounded-full text-[9px] shadow-xs" title="Click to view full photo">
                  <Eye className="w-3 h-3" />
                </span>
              ) : null}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {client.full_name}
                </h1>
                {isEditingClientId ? (
                  <div className="inline-flex items-center gap-1.5 bg-sky-50 p-1 rounded-lg border border-sky-300 shadow-2xs">
                    <input
                      type="text"
                      value={tempClientId}
                      onChange={(e) => setTempClientId(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveClientId();
                        } else if (e.key === 'Escape') {
                          setTempClientId(client.client_id);
                          setIsEditingClientId(false);
                        }
                      }}
                      placeholder="e.g. CL-000001"
                      className="px-2 py-0.5 text-xs font-mono font-bold bg-white text-slate-900 border border-sky-300 rounded focus:outline-none focus:ring-2 focus:ring-sky-500 w-32"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveClientId}
                      disabled={savingClientId || !tempClientId.trim()}
                      className="px-2 py-1 bg-sky-700 hover:bg-sky-800 text-white rounded text-xs font-semibold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                      title="Save Serial Number"
                    >
                      {savingClientId ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      <span className="text-[10px]">Save</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTempClientId(client.client_id);
                        setIsEditingClientId(false);
                      }}
                      className="p-1 bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 rounded transition cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <span
                    onClick={() => {
                      setTempClientId(client.client_id);
                      setIsEditingClientId(true);
                    }}
                    className="group/serial font-mono text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 hover:bg-sky-50 hover:text-sky-900 hover:border-sky-300 transition cursor-pointer inline-flex items-center gap-1.5"
                    title="Click to edit Serial Number / Client ID"
                  >
                    <span>{client.client_id}</span>
                    <Edit2 className="w-3 h-3 text-slate-400 group-hover/serial:text-sky-600 transition" />
                  </span>
                )}
                {client.photo_url && (
                  <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Photo Verified</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                <span className="font-mono text-slate-700 font-medium">
                  Passport: {client.passport_number}
                </span>
                <span>•</span>
                <span className="text-slate-700">{client.country}</span>
                {client.occupation && (
                  <>
                    <span>•</span>
                    <span className="text-slate-600">{client.occupation}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {client.google_drive_url ? (
              <a
                href={client.google_drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
              >
                <FolderOpen className="w-4 h-4 text-amber-700" />
                <span>Open Google Drive Folder</span>
                <ExternalLink className="w-3 h-3 text-amber-600" />
              </a>
            ) : (
              <button
                onClick={() => setEditingClient(true)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5"
              >
                <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
                <span>+ Add Drive Link</span>
              </button>
            )}

            <button
              onClick={() => onOpenNewApplication(client.id, client.full_name)}
              className="px-3.5 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Application</span>
            </button>

            <button
              onClick={() => setBookingModalOpen(true)}
              className="px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Book Hotel</span>
            </button>

            <button
              onClick={() => onOpenNewTask(client.id, client.full_name)}
              className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Task</span>
            </button>

            <button
              onClick={() => setEditingClient(!editingClient)}
              className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg transition"
              title="Edit Client Details"
            >
              <Edit2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setDeleteConfirmOpen(true);
              }}
              className="p-2 border border-slate-200 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition"
              title="Delete Client Profile"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 overflow-x-auto text-xs font-semibold text-slate-600">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2 px-3 border-b-2 transition whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-sky-700 text-sky-800'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Client Information & Custom Fields
          </button>
          <button
            onClick={() => setActiveTab('applications')}
            className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'applications'
                ? 'border-sky-700 text-sky-800'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <span>Visa Applications</span>
            <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded-full font-bold">
              {client.applications.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('hotels')}
            className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'hotels'
                ? 'border-teal-700 text-teal-800 font-bold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-teal-700" />
            <span>Hotels</span>
            <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded-full font-bold">
              {client.hotel_bookings ? client.hotel_bookings.length : 0}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'tasks'
                ? 'border-sky-700 text-sky-800'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <span>Tasks</span>
            <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded-full font-bold">
              {client.tasks.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('comments')}
            className={`pb-2 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'comments'
                ? 'border-sky-700 text-sky-800'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            <span>Comments & Notes</span>
            <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded-full font-bold">
              {client.comments.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`pb-2 px-3 border-b-2 transition whitespace-nowrap ${
              activeTab === 'activity'
                ? 'border-sky-700 text-sky-800'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Activity Timeline
          </button>
        </div>
      </div>

      {/* Edit Form Modal/Drawer if active */}
      {editingClient && (
        <div className="bg-white rounded-2xl border border-sky-200 shadow-md p-6 space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="font-bold text-base text-slate-900">Edit Client Profile</h3>
            <button
              onClick={() => setEditingClient(false)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSaveEdit} className="space-y-4">
            {/* Quick Passport Scanner */}
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-700 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-sky-950">Passport Scanner (Local OCR): </span>
                  <span className="text-sky-800">Upload a new passport page to automatically update Name, Passport #, Country, and DOB.</span>
                </div>
              </div>
              <input
                ref={profilePassportInputRef}
                type="file"
                accept="image/*"
                onChange={handleProfilePassportScan}
                className="hidden"
              />
              <button
                type="button"
                disabled={profileScanLoading}
                onClick={() => profilePassportInputRef.current?.click()}
                className="px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition self-start sm:self-auto shrink-0"
              >
                {profileScanLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Scanning...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Scan Passport</span>
                  </>
                )}
              </button>
            </div>
            {profileScanMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{profileScanMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Serial Number / ID</label>
                <input
                  type="text"
                  required
                  value={editFormData.client_id || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, client_id: e.target.value })}
                  placeholder="e.g. CL-000001"
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editFormData.full_name}
                  onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Passport Number</label>
                <input
                  type="text"
                  required
                  value={editFormData.passport_number}
                  onChange={(e) => setEditFormData({ ...editFormData, passport_number: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono text-slate-900 uppercase"
                />
              </div>
              <div>
                <CountrySelectSearch
                  countries={countries}
                  selectedCountry={editFormData.country}
                  onSelectCountry={(c) => setEditFormData({ ...editFormData, country: c })}
                  required={true}
                  label="Country"
                  placeholder="Search country by name..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">WhatsApp</label>
                <input
                  type="text"
                  value={editFormData.whatsapp}
                  onChange={(e) => setEditFormData({ ...editFormData, whatsapp: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Occupation</label>
                <input
                  type="text"
                  value={editFormData.occupation}
                  onChange={(e) => setEditFormData({ ...editFormData, occupation: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Google Drive Folder URL</label>
                <input
                  type="url"
                  value={editFormData.google_drive_url}
                  onChange={(e) => setEditFormData({ ...editFormData, google_drive_url: e.target.value })}
                  placeholder="https://drive.google.com/..."
                  className="w-full px-3 py-2 border rounded-lg text-xs font-mono text-slate-900"
                />
              </div>
            </div>

            {/* Profile Photo / Visa Photo URL with Live Google Drive Converter */}
            <div className="p-3.5 bg-sky-50/60 border border-sky-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-sky-950 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-sky-700" />
                  <span>Profile Photo / Visa Photo (Google Drive Link or Image URL)</span>
                </label>
                {isGoogleDriveLink(editFormData.photo_url) && (
                  <span className="text-[10px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Google Drive Link Auto-Detected
                  </span>
                )}
              </div>
              <p className="text-[11px] text-sky-900 leading-relaxed">
                Paste any Google Drive shareable link (e.g. <code className="bg-white px-1 py-0.5 rounded font-mono text-slate-700">https://drive.google.com/file/d/.../view?usp=sharing</code>).
              </p>

              <div className="flex flex-col sm:flex-row gap-3 items-start">
                <div className="flex-1 w-full space-y-2">
                  <input
                    type="url"
                    value={editFormData.photo_url}
                    onChange={(e) => {
                      setEditFormData({ ...editFormData, photo_url: e.target.value });
                    }}
                    placeholder="Paste Google Drive share link or image URL..."
                    className="w-full px-3 py-2 bg-white border border-sky-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-600"
                  />

                  <div className="flex items-center justify-between gap-2 text-xs">
                    <label className="cursor-pointer px-3 py-1.5 bg-white hover:bg-sky-100 text-sky-800 border border-sky-300 rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition">
                      <Upload className="w-3.5 h-3.5 text-sky-700" />
                      <span>Or Select Image File from Computer</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>

                    {editFormData.photo_url?.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditFormData({ ...editFormData, photo_url: '' });
                        }}
                        className="text-red-600 hover:underline text-[11px]"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Preview Box */}
                {editFormData.photo_url?.trim() && (
                  <div className="shrink-0 flex items-center gap-2.5 bg-white p-2 rounded-xl border border-sky-200 shadow-2xs">
                    <ClientAvatar
                      photoUrl={editFormData.photo_url}
                      fullName={editFormData.full_name || 'Client'}
                      size="md"
                      allowPreview={true}
                      className="rounded-lg shadow-2xs"
                    />
                    <div className="text-left text-xs space-y-0.5">
                      <div className="font-bold text-slate-900 flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Photo Preview</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {isGoogleDriveLink(editFormData.photo_url)
                          ? 'Google Drive'
                          : editFormData.photo_url.startsWith('data:')
                          ? 'Uploaded Image'
                          : 'Web Image'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingClient(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="px-5 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
              >
                {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab: Overview (Client info + Custom fields) */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Standard Information */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            {/* Client Profile Photo Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-sky-700" />
                  <span>China Visa Photo</span>
                </span>
                {client.photo_url ? (
                  <span className="text-[10px] text-sky-800 font-semibold bg-sky-100 px-2 py-0.5 rounded-full">
                    Linked
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">
                    No Photo
                  </span>
                )}
              </div>

              <div className="flex flex-col items-center justify-center">
                <div className="relative group cursor-pointer" onClick={() => setEditingClient(true)}>
                  <ClientAvatar
                    name={client.full_name}
                    photoUrl={client.photo_url}
                    size="xl"
                    allowPreview={true}
                    className="w-24 h-24 rounded-2xl shadow-md ring-4 ring-white"
                  />
                  {client.photo_url && (
                    <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold gap-1">
                      <Eye className="w-4 h-4" />
                      <span>Zoom</span>
                    </div>
                  )}
                </div>
                <div className="mt-2 text-xs text-slate-600">
                  {client.photo_url ? (
                    <span className="text-emerald-700 font-medium flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Google Drive Image Live
                    </span>
                  ) : (
                    <button
                      onClick={() => setEditingClient(true)}
                      className="text-sky-700 hover:text-sky-900 font-semibold underline text-xs mt-1"
                    >
                      + Add Google Drive Photo Link
                    </button>
                  )}
                </div>
              </div>
            </div>

            <h2 className="font-bold text-sm text-slate-900 uppercase tracking-wide flex items-center gap-2 pt-2 border-t border-slate-100">
              <User className="w-4 h-4 text-sky-700" />
              Standard Client Details
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex items-start justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400">Client ID</span>
                <span className="font-mono font-semibold text-slate-800">{client.client_id}</span>
              </div>
              <div className="flex items-start justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400">Passport Number</span>
                <span className="font-mono font-bold text-slate-900">{client.passport_number}</span>
              </div>
              <div className="flex items-start justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400">Nationality / Country</span>
                <span className="font-medium text-slate-800">{client.country}</span>
              </div>
              <div className="flex items-start justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400">Phone Number</span>
                <span className="text-slate-800">{client.phone || '—'}</span>
              </div>
              <div className="flex items-start justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400">WhatsApp</span>
                <span className="text-slate-800">{client.whatsapp || '—'}</span>
              </div>
              <div className="flex items-start justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400">Email</span>
                <span className="text-slate-800">{client.email || '—'}</span>
              </div>
              <div className="flex items-start justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400">Date of Birth</span>
                <span className="text-slate-800">{client.date_of_birth || '—'}</span>
              </div>
              <div className="flex items-start justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-400">Address</span>
                <span className="text-slate-800 text-right max-w-[200px]">{client.address || '—'}</span>
              </div>
              <div className="flex items-start justify-between py-1.5">
                <span className="text-slate-400">Registered On</span>
                <span className="text-slate-600">{new Date(client.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            {client.notes && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <span className="font-semibold text-slate-700 block">Staff Remarks / Case Notes</span>
                <p className="text-slate-600 whitespace-pre-wrap">{client.notes}</p>
              </div>
            )}
          </div>

          {/* Custom Profile Fields (Configured in Settings) */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="font-bold text-sm text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-sky-700" />
                Custom Profile Attributes (Configured Fields)
              </h2>
              <span className="text-[11px] text-slate-400">
                Customizable by Super Admin
              </span>
            </div>

            {client.custom_values.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                No custom attribute values recorded for this client yet. Super Admin can manage custom fields under Settings → Client Fields.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {client.custom_values.map((cv) => (
                  <div key={cv.field_id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      {cv.field_label}
                    </span>
                    <span className="text-sm font-medium text-slate-900 block break-words">
                      {cv.field_value || '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Google Drive Banner */}
            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 flex items-center justify-between gap-4 mt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0">
                  <FolderOpen className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-amber-950">
                    Google Drive Client Repository
                  </h4>
                  <p className="text-xs text-amber-800">
                    {client.google_drive_url
                      ? 'Secure link to client photos, passports, flight bookings & invitation letters.'
                      : 'No Google Drive folder URL linked yet.'}
                  </p>
                </div>
              </div>

              {client.google_drive_url ? (
                <a
                  href={client.google_drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition shrink-0"
                >
                  <span>Open Drive</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <button
                  onClick={() => setEditingClient(true)}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs shrink-0"
                >
                  Link Folder
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Visa Applications */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-900">
              China Visa Applications ({client.applications.length})
            </h2>
            <button
              onClick={() => onOpenNewApplication(client.id, client.full_name)}
              className="px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Application</span>
            </button>
          </div>

          <div className="space-y-3">
            {client.applications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
                No visa applications recorded yet. Click [New Application] to create one.
              </div>
            ) : (
              client.applications.map((app) => {
                const statusConf = STATUS_CONFIG[app.status];
                return (
                  <div
                    key={app.id}
                    className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-500">
                            {app.application_id}
                          </span>
                          <span className="font-bold text-slate-900 text-base">
                            {app.visa_type_name}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Assigned Officer: <span className="text-slate-700 font-medium">{app.assigned_user_name || 'Unassigned'}</span> • Created {new Date(app.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-3 py-1 rounded-full border font-semibold flex items-center gap-1.5 ${statusConf.bgClass} ${statusConf.textClass} ${statusConf.borderClass}`}
                        >
                          <span className={`w-2 h-2 rounded-full ${statusConf.dotClass}`} />
                          {app.status}
                        </span>

                        <button
                          onClick={() => onOpenStatusModal(app.id)}
                          className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-semibold transition"
                        >
                          Change Status
                        </button>

                        <button
                          onClick={() => setAppToDelete({ id: app.id, application_id: app.application_id })}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete Application"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Delivery Date Notification Banner */}
                    {app.delivery_date && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs flex items-center justify-between text-emerald-950">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-emerald-700" />
                          <span>
                            Delivery Scheduled on:{' '}
                            <strong className="font-bold">{app.delivery_date}</strong>
                          </span>
                        </div>
                        <span className="text-[11px] text-emerald-800 font-medium">
                          Auto-linked to Calendar Task
                        </span>
                      </div>
                    )}

                    {app.notes && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        {app.notes}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab: Hotels */}
      {activeTab === 'hotels' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-sm text-slate-900">
                Hotel Reservations for {client.full_name} ({client.hotel_bookings ? client.hotel_bookings.length : 0})
              </h2>
              <p className="text-xs text-slate-500">
                Assigned hotels, room categories, check-in/out dates and comments. Check-out dates are automatically scheduled to the calendar & tasks.
              </p>
            </div>
            <button
              onClick={() => setBookingModalOpen(true)}
              className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Assign Hotel</span>
            </button>
          </div>

          <div className="space-y-3">
            {(!client.hotel_bookings || client.hotel_bookings.length === 0) ? (
              <div className="p-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-dashed border-slate-200">
                <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                No hotel bookings recorded for this client yet. Click &quot;Assign Hotel&quot; to book a room.
              </div>
            ) : (
              client.hotel_bookings.map((booking) => {
                const isCheckedOut = booking.status === 'Checked Out';
                const isCancelled = booking.status === 'Cancelled';

                return (
                  <div
                    key={booking.id}
                    className="p-5 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-teal-300 transition space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            {booking.booking_reference}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              booking.status === 'Checked In'
                                ? 'bg-sky-50 text-sky-800 border-sky-200'
                                : booking.status === 'Confirmed'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : booking.status === 'Checked Out'
                                ? 'bg-slate-100 text-slate-700 border-slate-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            {booking.status}
                          </span>
                        </div>
                        <h3 className="font-bold text-base text-slate-900 mt-1 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-teal-700" />
                          <span>{booking.hotel_name}</span>
                          {booking.hotel_city && (
                            <span className="text-xs font-normal text-slate-500">
                              • {booking.hotel_city}
                            </span>
                          )}
                        </h3>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <BedDouble className="w-3.5 h-3.5 text-slate-400" />
                          <span>Room: <strong className="text-slate-800">{booking.room_type_name || 'Standard'}</strong></span>
                          <span>•</span>
                          <span>Guests: {booking.guest_count}</span>
                          {booking.room_count > 1 && <span>• Rooms: {booking.room_count}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start">
                        <button
                          onClick={() => {
                            setSelectedBookingForDetail(booking);
                            setBookingDetailModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>View / Edit</span>
                        </button>
                      </div>
                    </div>

                    {/* Stay Dates Box */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-bold">Check-In</span>
                          <span className="font-semibold text-slate-900">{booking.check_in_date}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-slate-700">
                        <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase font-bold">Check-Out (Auto Calendar)</span>
                          <span className="font-bold text-amber-900">{booking.check_out_date}</span>
                        </div>
                      </div>
                    </div>

                    {/* Staff Comment */}
                    {booking.comment && (
                      <div className="p-3 bg-teal-50/50 border border-teal-100 rounded-lg text-xs text-teal-950">
                        <strong className="font-semibold text-teal-900 block mb-0.5">Booking Comment:</strong>
                        <p className="whitespace-pre-wrap">{booking.comment}</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab: Tasks */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-900">
              Tasks Linked to {client.full_name} ({client.tasks.length})
            </h2>
            <button
              onClick={() => onOpenNewTask(client.id, client.full_name)}
              className="px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Task</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100">
            {client.tasks.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No tasks assigned for this client.
              </div>
            ) : (
              client.tasks.map((task) => {
                const priorityBadge = getPriorityBadge(task.priority);
                const isCompleted = task.status === 'Completed';

                return (
                  <div
                    key={task.id}
                    className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleTask(task.id)}
                        className={`w-5 h-5 rounded border flex items-center justify-center transition ${
                          isCompleted
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 hover:border-sky-600'
                        }`}
                      >
                        {isCompleted && <CheckSquare className="w-3.5 h-3.5" />}
                      </button>

                      <div>
                        <div
                          className={`font-semibold text-sm ${
                            isCompleted ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {task.title}
                        </div>
                        {task.description && (
                          <div className="text-xs text-slate-500 mt-0.5">{task.description}</div>
                        )}
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                          <span>Due: {task.due_date}</span>
                          <span>•</span>
                          <span>Assigned: {task.assigned_user_name || 'Staff'}</span>
                          {task.is_delivery_task === 1 && (
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              Delivery Task
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityBadge.bg}`}
                    >
                      {task.priority}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab: Comments / Notes */}
      {activeTab === 'comments' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <h2 className="font-bold text-sm text-slate-900">Add Internal Staff Note</h2>
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                required
                value={commentMessage}
                onChange={(e) => setCommentMessage(e.target.value)}
                placeholder="Write internal note (e.g. 'Client will provide missing bank statement tomorrow')..."
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
              />
              <button
                type="submit"
                disabled={submittingComment}
                className="px-4 py-2 bg-sky-700 hover:bg-sky-800 disabled:bg-slate-300 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
              >
                {submittingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Post Note</span>
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100 p-4">
            {client.comments.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No internal notes left on this client profile yet.
              </div>
            ) : (
              client.comments.map((comm) => (
                <div key={comm.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span className="font-semibold text-slate-800">{comm.user_name}</span>
                    <span>{new Date(comm.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap">{comm.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: Activity Timeline */}
      {activeTab === 'activity' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
          <h2 className="font-bold text-sm text-slate-900 mb-2">Audit & Activity Log</h2>
          <div className="divide-y divide-slate-100">
            {client.activity.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No activity records found.
              </div>
            ) : (
              client.activity.map((act) => (
                <div key={act.id} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3 text-xs">
                  <div>
                    <span className="font-medium text-slate-900 block">{act.details}</span>
                    <span className="text-slate-400 text-[11px]">Logged by {act.user_name || 'Staff'}</span>
                  </div>
                  <span className="text-slate-400 shrink-0 text-[11px]">
                    {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(act.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Delete Client Confirm Modal */}
      <ConfirmDeleteModal
        isOpen={deleteConfirmOpen}
        title={`Delete Client ${client.full_name}?`}
        message={`Are you sure you want to permanently delete client profile ${client.full_name} (${client.client_id})? This will also remove all linked visa applications, internal tasks, and comments.`}
        confirmLabel="Delete Client Profile"
        loading={deletingClient}
        onConfirm={handleDeleteClient}
        onClose={() => setDeleteConfirmOpen(false)}
      />

      {/* Delete Application Confirm Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(appToDelete)}
        title={`Delete Application ${appToDelete?.application_id || ''}?`}
        message={`Are you sure you want to permanently delete application ${appToDelete?.application_id || ''} for ${client.full_name}? This will also remove linked tasks, comments, and audit history.`}
        confirmLabel="Delete Application"
        loading={deletingApp}
        onConfirm={handleDeleteApplication}
        onClose={() => setAppToDelete(null)}
      />

      {/* Hotel Modals */}
      <NewHotelBookingModal
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        clientId={client.id}
        clientName={client.full_name}
        clients={[client]}
        hotels={hotelsList}
        onBookingCreated={() => {
          fetchClientData(true);
          if (onRefreshData) onRefreshData();
        }}
      />

      <HotelBookingDetailModal
        isOpen={bookingDetailModalOpen}
        onClose={() => {
          setBookingDetailModalOpen(false);
          setSelectedBookingForDetail(null);
        }}
        booking={selectedBookingForDetail}
        onUpdated={() => {
          fetchClientData(true);
          if (onRefreshData) onRefreshData();
        }}
      />
    </div>
  );
};
