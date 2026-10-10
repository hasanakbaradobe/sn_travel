import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Shield,
  Users,
  FileCode,
  Database,
  ArrowUp,
  ArrowDown,
  ToggleLeft,
  ToggleRight,
  Loader2,
  AlertCircle,
  HelpCircle,
  Globe,
  Building2,
  BedDouble,
  MapPin,
  Eye,
  EyeOff,
  KeyRound,
  Calendar,
  CheckSquare,
  Square,
  History,
  HardDrive,
  ShieldCheck,
  Copy,
  RotateCcw,
  FileText,
  Layers,
  Sparkles,
  AlertTriangle,
  Download,
  Link2,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../services/api';
import {
  CustomField,
  CustomFieldType,
  VisaType,
  User,
  UserRole,
  DatabaseStatus,
  Country,
  Hotel,
  HotelRoom,
  PurgeTargets,
  PurgePreviewResult,
  PurgeExecuteResult,
} from '../types';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';

interface SettingsViewProps {
  currentUser: User | null;
  dbStatus: DatabaseStatus | null;
  onOpenDbModal?: () => void;
  initialTab?: 'fields' | 'visatypes' | 'countries' | 'hotels' | 'users' | 'cleanup' | 'security';
  onTabChange?: (tab: 'fields' | 'visatypes' | 'countries' | 'hotels' | 'users' | 'cleanup' | 'security') => void;
  onHotelsUpdated?: () => void;
  onDataPurged?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  dbStatus,
  onOpenDbModal,
  initialTab = 'fields',
  onTabChange,
  onHotelsUpdated,
  onDataPurged,
}) => {
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const [activeTab, setActiveTab] = useState<'fields' | 'visatypes' | 'countries' | 'hotels' | 'users' | 'cleanup' | 'security'>(
    initialTab === ('database' as any) ? 'fields' : initialTab
  );

  const prevInitialTabRef = React.useRef(initialTab);
  useEffect(() => {
    if (initialTab && initialTab !== prevInitialTabRef.current) {
      prevInitialTabRef.current = initialTab;
      setActiveTab(initialTab === ('database' as any) ? 'fields' : initialTab);
    }
  }, [initialTab]);

  const handleSelectTab = (tab: 'fields' | 'visatypes' | 'countries' | 'hotels' | 'users' | 'cleanup' | 'security') => {
    setActiveTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  // Custom Fields State
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [newFieldModalOpen, setNewFieldModalOpen] = useState(false);
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState<CustomFieldType>('text');
  const [fieldOptions, setFieldOptions] = useState('');
  const [fieldRequired, setFieldRequired] = useState(false);

  // Visa Types State
  const [visaTypes, setVisaTypes] = useState<VisaType[]>([]);
  const [newVisaName, setNewVisaName] = useState('');
  const [newVisaDesc, setNewVisaDesc] = useState('');

  // Countries State
  const [countries, setCountries] = useState<Country[]>([]);
  const [newCountryName, setNewCountryName] = useState('');
  const [newCountryCode, setNewCountryCode] = useState('');
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [editCountryName, setEditCountryName] = useState('');
  const [editCountryCode, setEditCountryCode] = useState('');

  // Hotels State
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [hotelModalOpen, setHotelModalOpen] = useState(false);
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null);
  const [hotelName, setHotelName] = useState('');
  const [hotelCity, setHotelCity] = useState('');
  const [hotelAddress, setHotelAddress] = useState('');
  const [hotelStarRating, setHotelStarRating] = useState(5);
  const [hotelPhone, setHotelPhone] = useState('');
  const [hotelEmail, setHotelEmail] = useState('');
  const [hotelNotes, setHotelNotes] = useState('');

  // Room Types State
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [roomTargetHotelId, setRoomTargetHotelId] = useState<number | null>(null);
  const [editingRoom, setEditingRoom] = useState<HotelRoom | null>(null);
  const [roomName, setRoomName] = useState('');
  const [roomPrice, setRoomPrice] = useState('');
  const [roomCurrency, setRoomCurrency] = useState('USD');
  const [roomCapacity, setRoomCapacity] = useState(2);
  const [roomDesc, setRoomDesc] = useState('');

  // Expanded hotels for room view
  const [expandedHotelIds, setExpandedHotelIds] = useState<number[]>([]);

  // Users State
  const [users, setUsers] = useState<User[]>([]);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('staff');
  const [newUserActive, setNewUserActive] = useState<number>(1);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPasswordInModal, setShowPasswordInModal] = useState(false);
  const [userModalError, setUserModalError] = useState<string | null>(null);
  const [savingUser, setSavingUser] = useState(false);

  // Data Cleanup & Storage Optimization State (Preserves Clients)
  const [cleanupStartDate, setCleanupStartDate] = useState('');
  const [cleanupEndDate, setCleanupEndDate] = useState('');
  const [cleanupTargets, setCleanupTargets] = useState<PurgeTargets>({
    applications: true,
    hotel_bookings: true,
    tasks: true,
    status_history: true,
    activity_logs: false,
  });
  const [cleanupPreview, setCleanupPreview] = useState<PurgePreviewResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [purgeModalOpen, setPurgeModalOpen] = useState(false);
  const [purgeConfirmationText, setPurgeConfirmationText] = useState('');
  const [purgingData, setPurgingData] = useState(false);
  const [purgeSuccessResult, setPurgeSuccessResult] = useState<PurgeExecuteResult | null>(null);
  const [showSqlScript, setShowSqlScript] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // 1-Click SQL Backup & Disaster Recovery State
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [pendingRestoreText, setPendingRestoreText] = useState<string | null>(null);
  const [pendingRestoreFileName, setPendingRestoreFileName] = useState<string>('');
  const [backupSuccessMsg, setBackupSuccessMsg] = useState<string | null>(null);
  const [restoreErrorMsg, setRestoreErrorMsg] = useState<string | null>(null);

  // Secret Login URL & Gatekeeper State
  const [secretConfig, setSecretConfig] = useState<{ enabled: boolean; secretKey: string; loginPath: string } | null>(null);
  const [loadingSecretConfig, setLoadingSecretConfig] = useState(false);
  const [savingSecretConfig, setSavingSecretConfig] = useState(false);
  const [secretEnabled, setSecretEnabled] = useState(true);
  const [secretKeyInput, setSecretKeyInput] = useState('');
  const [secretSaveMsg, setSecretSaveMsg] = useState<string | null>(null);
  const [secretSaveError, setSecretSaveError] = useState<string | null>(null);
  const [copiedSecretUrl, setCopiedSecretUrl] = useState(false);

  const loadSecretConfig = useCallback(async () => {
    try {
      setLoadingSecretConfig(true);
      setSecretSaveError(null);
      const res = await api.getSecretLoginSettings();
      setSecretConfig(res);
      setSecretEnabled(res.enabled);
      setSecretKeyInput(res.secretKey);
    } catch (err: any) {
      console.error('Failed to load secret login settings:', err);
    } finally {
      setLoadingSecretConfig(false);
    }
  }, []);

  useEffect(() => {
    if ((activeTab === 'security' || isSuperAdmin) && !secretConfig) {
      loadSecretConfig();
    }
  }, [activeTab, isSuperAdmin, secretConfig, loadSecretConfig]);

  const handleGenerateRandomKey = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let rand = '';
    for (let i = 0; i < 8; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const newKey = `staff-${rand}`;
    setSecretKeyInput(newKey);
    setSecretSaveMsg(null);
  };

  const handleCopySecretUrl = () => {
    const key = secretKeyInput.trim() || secretConfig?.secretKey || 'sn-secure-staff-2026';
    const fullUrl = `${window.location.origin}/access/${key}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedSecretUrl(true);
    setTimeout(() => setCopiedSecretUrl(false), 2500);
  };

  const handleSaveSecretConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanKey = secretKeyInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '');
    if (secretEnabled && cleanKey.length < 3) {
      setSecretSaveError('Secret URL slug must be at least 3 characters long.');
      return;
    }

    try {
      setSavingSecretConfig(true);
      setSecretSaveMsg(null);
      setSecretSaveError(null);

      const res = await api.updateSecretLoginSettings({
        enabled: secretEnabled,
        secretKey: cleanKey || 'sn-secure-staff-2026',
      });

      setSecretConfig(res);
      setSecretEnabled(res.enabled);
      setSecretKeyInput(res.secretKey);
      setSecretSaveMsg('Secret Login URL settings updated successfully! All staff must use this link to access the login page.');
      setTimeout(() => setSecretSaveMsg(null), 5000);
    } catch (err: any) {
      setSecretSaveError(err.message || 'Failed to update Secret Login URL settings.');
    } finally {
      setSavingSecretConfig(false);
    }
  };

  const handleDownloadBackupFile = async () => {
    try {
      setDownloadingBackup(true);
      setBackupSuccessMsg(null);
      const blob = await api.downloadSqlBackup();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sn_travels_full_backup_${new Date().toISOString().slice(0, 10)}.sql`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setBackupSuccessMsg('Full SQL Database Backup file generated & downloaded successfully!');
      setTimeout(() => setBackupSuccessMsg(null), 5000);
    } catch (err: any) {
      alert('Failed to generate database backup: ' + (err.message || 'Unknown error'));
    } finally {
      setDownloadingBackup(false);
    }
  };

  const handleBackupFileUploaded = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingRestoreFileName(file.name);
    setRestoreErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setPendingRestoreText(text);
      setRestoreModalOpen(true);
    };
    reader.onerror = () => {
      alert('Failed to read selected backup file.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExecuteRestoreDatabase = async () => {
    if (!pendingRestoreText) return;
    try {
      setRestoringBackup(true);
      setRestoreErrorMsg(null);
      const res = await api.restoreSqlBackup(pendingRestoreText);
      setRestoreModalOpen(false);
      setPendingRestoreText(null);
      setBackupSuccessMsg(`Database successfully restored! Preserved ${res.restored?.clients || 0} clients, ${res.restored?.applications || 0} applications.`);
      if (onDataPurged) onDataPurged();
      if (onHotelsUpdated) onHotelsUpdated();
      setTimeout(() => setBackupSuccessMsg(null), 7000);
    } catch (err: any) {
      setRestoreErrorMsg(err.message || 'Failed to restore database from backup file.');
    } finally {
      setRestoringBackup(false);
    }
  };

  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'field' | 'visatype' | 'country' | 'user' | 'hotel' | 'hotelroom'; id: number; name: string } | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);

  const loadData = async () => {
    try {
      setLoadingFields(true);
      const [flds, vts, ctrs, usrs, htls] = await Promise.all([
        api.getCustomFields(false),
        api.getVisaTypes(false),
        api.getCountries(false),
        api.getUsers(),
        api.getHotels(false),
      ]);
      setCustomFields(flds);
      setVisaTypes(vts);
      setCountries(ctrs);
      setUsers(usrs);
      setHotels(htls);
      // Auto-expand first hotel by default
      if (htls.length > 0 && expandedHotelIds.length === 0) {
        setExpandedHotelIds([htls[0].id]);
      }
    } catch (err) {
      console.error('Failed to load settings data', err);
    } finally {
      setLoadingFields(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Custom field actions
  const handleCreateCustomField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldLabel.trim()) return;

    try {
      const generatedName = fieldName.trim() || fieldLabel.toLowerCase().replace(/[^a-z0-9]/g, '_');
      await api.createCustomField({
        field_label: fieldLabel.trim(),
        field_name: generatedName,
        field_type: fieldType,
        field_options: fieldType === 'dropdown' ? fieldOptions.trim() : null,
        is_required: fieldRequired ? 1 : 0,
      });

      setFieldLabel('');
      setFieldName('');
      setFieldOptions('');
      setFieldRequired(false);
      setNewFieldModalOpen(false);
      showFeedback('Custom client profile field created successfully');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create field');
    }
  };

  const handleToggleFieldActive = async (field: CustomField) => {
    try {
      await api.updateCustomField(field.id, {
        is_active: field.is_active === 1 ? 0 : 1,
      });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddVisaType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVisaName.trim()) return;
    try {
      await api.createVisaType({
        name: newVisaName.trim(),
        description: newVisaDesc.trim() || undefined,
      });
      setNewVisaName('');
      setNewVisaDesc('');
      showFeedback('Visa category added');
      loadData();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCreateCountry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCountryName.trim()) return;
    try {
      await api.createCountry({
        name: newCountryName.trim(),
        code: newCountryCode.trim() || undefined,
      });
      setNewCountryName('');
      setNewCountryCode('');
      showFeedback('Country added successfully');
      loadData();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleUpdateCountry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCountry || !editCountryName.trim()) return;
    try {
      await api.updateCountry(editingCountry.id, {
        name: editCountryName.trim(),
        code: editCountryCode.trim() || undefined,
      });
      setEditingCountry(null);
      showFeedback('Country updated');
      loadData();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleToggleCountryActive = async (country: Country) => {
    try {
      await api.updateCountry(country.id, {
        is_active: country.is_active === 1 ? 0 : 1,
      });
      loadData();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserModalError(null);

    const trimmedName = newUserName.trim();
    const trimmedEmail = newUserEmail.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail) {
      setUserModalError('Full name and email address are required.');
      return;
    }

    if (!editingUser) {
      if (!newUserPassword) {
        setUserModalError('Password is required for new accounts.');
        return;
      }
      if (newUserPassword.length < 8) {
        setUserModalError('Password must be at least 8 characters long for security.');
        return;
      }
    } else {
      if (newUserPassword && newUserPassword.length < 8) {
        setUserModalError('New password must be at least 8 characters long.');
        return;
      }
    }

    // Prevent deactivating own account
    if (editingUser && editingUser.id === currentUser?.id && newUserActive === 0) {
      setUserModalError('You cannot deactivate your own Super Admin account.');
      return;
    }

    // Prevent removing super_admin from own account
    if (editingUser && editingUser.id === currentUser?.id && newUserRole !== 'super_admin') {
      setUserModalError('You cannot remove the Super Admin role from your currently active account.');
      return;
    }

    setSavingUser(true);
    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, {
          name: trimmedName,
          email: trimmedEmail,
          role: newUserRole,
          is_active: newUserActive,
          password: newUserPassword.trim() ? newUserPassword : undefined,
        });
        showFeedback(`User account "${trimmedName}" updated successfully`);
      } else {
        await api.createUser({
          name: trimmedName,
          email: trimmedEmail,
          password: newUserPassword,
          role: newUserRole,
        });
        showFeedback(`New user account "${trimmedName}" created successfully`);
      }
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setEditingUser(null);
      setShowAddUserModal(false);
      loadData();
    } catch (err: any) {
      setUserModalError(err.message || 'Failed to save user account.');
    } finally {
      setSavingUser(false);
    }
  };

  const handleOpenEditUser = (user: User) => {
    setEditingUser(user);
    setNewUserName(user.name);
    setNewUserEmail(user.email);
    setNewUserRole(user.role);
    setNewUserActive(user.is_active !== undefined ? user.is_active : 1);
    setNewUserPassword('');
    setShowPasswordInModal(false);
    setUserModalError(null);
    setShowAddUserModal(true);
  };

  const handleOpenAddUser = () => {
    setEditingUser(null);
    setNewUserName('');
    setNewUserEmail('');
    setNewUserRole('staff');
    setNewUserActive(1);
    setNewUserPassword('');
    setShowPasswordInModal(false);
    setUserModalError(null);
    setShowAddUserModal(true);
  };

  const handleToggleUserActive = async (user: User) => {
    if (user.id === currentUser?.id) {
      alert('You cannot deactivate your own account.');
      return;
    }
    try {
      await api.updateUser(user.id, {
        is_active: user.is_active === 1 ? 0 : 1,
      });
      showFeedback(`User "${user.name}" status updated`);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update user status');
    }
  };

  // Hotel actions
  const handleOpenAddHotel = () => {
    setEditingHotel(null);
    setHotelName('');
    setHotelCity('');
    setHotelAddress('');
    setHotelStarRating(5);
    setHotelPhone('');
    setHotelEmail('');
    setHotelNotes('');
    setHotelModalOpen(true);
  };

  const handleOpenEditHotel = (h: Hotel) => {
    setEditingHotel(h);
    setHotelName(h.name);
    setHotelCity(h.city || '');
    setHotelAddress(h.address || '');
    setHotelStarRating(h.star_rating || 5);
    setHotelPhone(h.phone || '');
    setHotelEmail(h.email || '');
    setHotelNotes(h.notes || '');
    setHotelModalOpen(true);
  };

  const handleSaveHotel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotelName.trim()) return;

    try {
      if (editingHotel) {
        await api.updateHotel(editingHotel.id, {
          name: hotelName.trim(),
          city: hotelCity.trim() || undefined,
          address: hotelAddress.trim() || undefined,
          star_rating: hotelStarRating,
          phone: hotelPhone.trim() || undefined,
          email: hotelEmail.trim() || undefined,
          notes: hotelNotes.trim() || undefined,
        });
        showFeedback(`Updated hotel "${hotelName}"`);
      } else {
        await api.createHotel({
          name: hotelName.trim(),
          city: hotelCity.trim() || undefined,
          address: hotelAddress.trim() || undefined,
          star_rating: hotelStarRating,
          phone: hotelPhone.trim() || undefined,
          email: hotelEmail.trim() || undefined,
          notes: hotelNotes.trim() || undefined,
        });
        showFeedback(`Added hotel partner "${hotelName}"`);
      }
      setHotelModalOpen(false);
      loadData();
      if (onHotelsUpdated) onHotelsUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to save hotel');
    }
  };

  const handleToggleHotelActive = async (h: Hotel) => {
    try {
      await api.updateHotel(h.id, {
        is_active: h.is_active === 1 ? 0 : 1,
      });
      loadData();
      if (onHotelsUpdated) onHotelsUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleExpandHotel = (hotelId: number) => {
    setExpandedHotelIds((prev) =>
      prev.includes(hotelId) ? prev.filter((id) => id !== hotelId) : [...prev, hotelId]
    );
  };

  // Room Type actions
  const handleOpenAddRoom = (hotelId: number) => {
    setRoomTargetHotelId(hotelId);
    setEditingRoom(null);
    setRoomName('');
    setRoomPrice('');
    setRoomCurrency('USD');
    setRoomCapacity(2);
    setRoomDesc('');
    setRoomModalOpen(true);
  };

  const handleOpenEditRoom = (hotelId: number, r: HotelRoom) => {
    setRoomTargetHotelId(hotelId);
    setEditingRoom(r);
    setRoomName(r.name);
    setRoomPrice(r.price_per_night !== null && r.price_per_night !== undefined ? String(r.price_per_night) : '');
    setRoomCurrency(r.currency || 'USD');
    setRoomCapacity(r.capacity || 2);
    setRoomDesc(r.description || '');
    setRoomModalOpen(true);
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim() || !roomTargetHotelId) return;

    try {
      if (editingRoom) {
        await api.updateHotelRoom(editingRoom.id, {
          name: roomName.trim(),
          price_per_night: roomPrice ? parseFloat(roomPrice) : undefined,
          currency: roomCurrency,
          capacity: roomCapacity,
          description: roomDesc.trim() || undefined,
        });
        showFeedback(`Updated room type "${roomName}"`);
      } else {
        await api.createHotelRoom(roomTargetHotelId, {
          name: roomName.trim(),
          price_per_night: roomPrice ? parseFloat(roomPrice) : undefined,
          currency: roomCurrency,
          capacity: roomCapacity,
          description: roomDesc.trim() || undefined,
        });
        showFeedback(`Added room type "${roomName}"`);
      }
      setRoomModalOpen(false);
      loadData();
      if (onHotelsUpdated) onHotelsUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to save room type');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingItem(true);
    try {
      if (deleteTarget.type === 'field') {
        await api.deleteCustomField(deleteTarget.id);
        showFeedback('Custom field removed');
      } else if (deleteTarget.type === 'visatype') {
        await api.deleteVisaType(deleteTarget.id);
        showFeedback('Visa category removed');
      } else if (deleteTarget.type === 'country') {
        await api.deleteCountry(deleteTarget.id);
        showFeedback('Country removed from list');
      } else if (deleteTarget.type === 'user') {
        await api.deleteUser(deleteTarget.id);
        showFeedback('User account removed');
      } else if (deleteTarget.type === 'hotel') {
        await api.deleteHotel(deleteTarget.id);
        showFeedback('Hotel removed successfully');
        if (onHotelsUpdated) onHotelsUpdated();
      } else if (deleteTarget.type === 'hotelroom') {
        await api.deleteHotelRoom(deleteTarget.id);
        showFeedback('Room type removed');
        if (onHotelsUpdated) onHotelsUpdated();
      }
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      console.error(err);
      setDeleteTarget(null);
    } finally {
      setDeletingItem(false);
    }
  };

  // Data Cleanup Preview & Actions
  const loadCleanupPreview = useCallback(
    async (start?: string, end?: string, targets?: PurgeTargets) => {
      try {
        setLoadingPreview(true);
        const res = await api.previewDataCleanup({
          startDate: start !== undefined ? start : cleanupStartDate,
          endDate: end !== undefined ? end : cleanupEndDate,
          targets: targets || cleanupTargets,
        });
        setCleanupPreview(res);
      } catch (err: any) {
        console.error('Failed to preview cleanup:', err);
      } finally {
        setLoadingPreview(false);
      }
    },
    [cleanupStartDate, cleanupEndDate, cleanupTargets]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (newFieldModalOpen) setNewFieldModalOpen(false);
        if (showAddUserModal) setShowAddUserModal(false);
        if (hotelModalOpen) setHotelModalOpen(false);
        if (roomModalOpen) setRoomModalOpen(false);
        if (purgeModalOpen && !purgingData) setPurgeModalOpen(false);
        if (deleteTarget) setDeleteTarget(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    newFieldModalOpen,
    showAddUserModal,
    hotelModalOpen,
    roomModalOpen,
    purgeModalOpen,
    purgingData,
    deleteTarget,
  ]);

  useEffect(() => {
    if (activeTab === 'cleanup' && isSuperAdmin) {
      loadCleanupPreview();
    }
  }, [activeTab, isSuperAdmin, loadCleanupPreview]);

  const handlePresetDate = (days: number | null) => {
    setCleanupStartDate('');
    if (days === null) {
      // All historical records
      setCleanupEndDate('');
      loadCleanupPreview('', '', cleanupTargets);
    } else {
      const targetDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
      setCleanupEndDate(targetDate);
      loadCleanupPreview('', targetDate, cleanupTargets);
    }
  };

  const handleToggleTarget = (key: keyof PurgeTargets) => {
    const updated = {
      ...cleanupTargets,
      [key]: !cleanupTargets[key],
    };
    setCleanupTargets(updated);
    loadCleanupPreview(cleanupStartDate, cleanupEndDate, updated);
  };

  const handleSelectAllTargets = (selectAll: boolean) => {
    const updated: PurgeTargets = {
      applications: selectAll,
      hotel_bookings: selectAll,
      tasks: selectAll,
      status_history: selectAll,
      activity_logs: selectAll,
    };
    setCleanupTargets(updated);
    loadCleanupPreview(cleanupStartDate, cleanupEndDate, updated);
  };

  const handleOpenPurgeModal = () => {
    setPurgeConfirmationText('');
    setPurgeModalOpen(true);
  };

  const handleExecutePurge = async () => {
    const trimmed = purgeConfirmationText.trim().toUpperCase();
    if (trimmed !== 'PURGE' && trimmed !== 'DELETE') {
      alert('Please type PURGE in the confirmation box to authorize permanent deletion.');
      return;
    }

    setPurgingData(true);
    try {
      const res = await api.purgeHistoricalData({
        startDate: cleanupStartDate || undefined,
        endDate: cleanupEndDate || undefined,
        targets: cleanupTargets,
        confirmation: 'PURGE',
      });
      setPurgeSuccessResult(res);
      setPurgeModalOpen(false);
      showFeedback(`Successfully purged ${res.purged_counts.total} historical records. Customer profiles preserved.`);
      loadData();
      loadCleanupPreview();
      if (onDataPurged) onDataPurged();
      if (onHotelsUpdated) onHotelsUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to purge data');
    } finally {
      setPurgingData(false);
    }
  };

  const getGeneratedSql = () => {
    const lines: string[] = ['-- ========================================================'];
    lines.push('-- SN Travels Agency — MySQL / phpMyAdmin Data Purge Script');
    lines.push('-- Preserves ALL client profile & identity records');
    lines.push('-- ========================================================');
    lines.push('USE `sn_travels_visa`;');
    lines.push('');

    const dateCondition = (field: string) => {
      if (cleanupStartDate && cleanupEndDate) {
        return `${field} >= '${cleanupStartDate} 00:00:00' AND ${field} <= '${cleanupEndDate} 23:59:59'`;
      } else if (cleanupStartDate) {
        return `${field} >= '${cleanupStartDate} 00:00:00'`;
      } else if (cleanupEndDate) {
        return `${field} <= '${cleanupEndDate} 23:59:59'`;
      }
      return '1=1';
    };

    if (cleanupTargets.applications) {
      lines.push('-- 1. Purge Historical Visa Applications & cascaded status logs');
      lines.push(`DELETE FROM visa_applications WHERE ${dateCondition('created_at')};`);
      lines.push(`DELETE FROM application_status_history WHERE ${dateCondition('created_at')};`);
      lines.push('');
    }

    if (cleanupTargets.hotel_bookings) {
      lines.push('-- 2. Purge Past Hotel Stays & Reservations (Preserves Hotels & Clients)');
      lines.push(`DELETE FROM hotel_bookings WHERE ${dateCondition('created_at')};`);
      lines.push('');
    }

    if (cleanupTargets.tasks) {
      lines.push('-- 3. Purge Completed / Old Calendar & Operational Tasks');
      lines.push(`DELETE FROM tasks WHERE ${dateCondition('created_at')};`);
      lines.push('');
    }

    if (cleanupTargets.status_history && !cleanupTargets.applications) {
      lines.push('-- 4. Purge Status Audit History');
      lines.push(`DELETE FROM application_status_history WHERE ${dateCondition('created_at')};`);
      lines.push('');
    }

    if (cleanupTargets.activity_logs) {
      lines.push('-- 5. Purge System Activity Logs');
      lines.push(`DELETE FROM activity_logs WHERE ${dateCondition('created_at')};`);
      lines.push('');
    }

    return lines.join('\n');
  };

  const handleCopySql = () => {
    const sql = getGeneratedSql();
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleDownloadSql = () => {
    const sql = getGeneratedSql();
    const blob = new Blob([sql], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sn_travels_purge_${new Date().toISOString().split('T')[0]}.sql`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-sky-700" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Settings</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            SN Travels Agency • Configure custom fields, China visa categories, staff accounts & database.
          </p>
        </div>

        {feedbackMsg && (
          <div className="px-3.5 py-1.5 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 animate-in fade-in">
            <Check className="w-3.5 h-3.5" />
            <span>{feedbackMsg}</span>
          </div>
        )}
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => handleSelectTab('fields')}
          className={`pb-3 px-3.5 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'fields'
              ? 'border-sky-700 text-sky-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Client Profile Fields</span>
          <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded-full font-bold">
            {customFields.length}
          </span>
        </button>

        <button
          onClick={() => handleSelectTab('visatypes')}
          className={`pb-3 px-3.5 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'visatypes'
              ? 'border-sky-700 text-sky-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>China Visa Types</span>
          <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded-full font-bold">
            {visaTypes.length}
          </span>
        </button>

        <button
          onClick={() => handleSelectTab('countries')}
          className={`pb-3 px-3.5 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'countries'
              ? 'border-sky-700 text-sky-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-sky-600" />
          <span>Countries & Nationalities</span>
          <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded-full font-bold">
            {countries.length}
          </span>
        </button>

        <button
          onClick={() => handleSelectTab('hotels')}
          className={`pb-3 px-3.5 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'hotels'
              ? 'border-teal-700 text-teal-800 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-3.5 h-3.5 text-teal-700" />
          <span>Hotels & Room Types</span>
          <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded-full font-bold">
            {hotels.length}
          </span>
        </button>

        {isSuperAdmin && (
          <>
            <button
              onClick={() => handleSelectTab('users')}
              className={`pb-3 px-3.5 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'users'
                  ? 'border-sky-700 text-sky-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-sky-700" />
              <span>User Management</span>
              <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded-full font-bold">
                {users.length}
              </span>
            </button>

            <button
              onClick={() => handleSelectTab('cleanup')}
              className={`pb-3 px-3.5 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'cleanup'
                  ? 'border-rose-700 text-rose-800 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5 text-rose-600" />
              <span>Data Cleanup &amp; Storage</span>
              <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.2 rounded-full font-bold">
                Storage
              </span>
            </button>

            <button
              onClick={() => handleSelectTab('security')}
              className={`pb-3 px-3.5 border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'security'
                  ? 'border-indigo-700 text-indigo-800 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
              <span>Secret Login URL &amp; Gate</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold border ${
                secretEnabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {secretEnabled ? 'Active' : 'Off'}
              </span>
            </button>
          </>
        )}
      </div>

      {/* Non-Admin Warning for Admin-Only Tabs */}
      {!isSuperAdmin && (activeTab === 'users' || activeTab === 'cleanup' || activeTab === 'security') && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>This administrative feature requires Super Admin privileges. Please log in as Super Admin to manage users, data storage, and secret login access URLs.</span>
        </div>
      )}

      {/* Tab: Client Custom Fields */}
      {activeTab === 'fields' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-sky-50/60 p-4 rounded-xl border border-sky-100">
            <div>
              <h3 className="font-bold text-sm text-sky-950">
                Dynamic Client Profile Custom Fields
              </h3>
              <p className="text-xs text-sky-800">
                Super Admin can add, edit, reorder or toggle fields (Employer, Travel History, Chinese Contact, etc.) without code changes.
              </p>
            </div>
            {isSuperAdmin && (
              <button
                onClick={() => setNewFieldModalOpen(true)}
                className="px-3.5 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition self-start sm:self-auto shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Custom Field</span>
              </button>
            )}
          </div>

          {/* Fields Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Field Label</th>
                  <th className="py-3 px-4">Identifier</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Options (if dropdown)</th>
                  <th className="py-3 px-4">Required</th>
                  <th className="py-3 px-4">Status</th>
                  {isSuperAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customFields.map((field) => (
                  <tr key={field.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {field.field_label}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">
                      {field.field_name}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                        {field.field_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                      {field.field_options || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      {field.is_required ? (
                        <span className="text-red-700 font-bold">Yes *</span>
                      ) : (
                        <span className="text-slate-400">Optional</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {field.is_active ? (
                        <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded">
                          Active
                        </span>
                      ) : (
                        <span className="text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          Inactive
                        </span>
                      )}
                    </td>
                    {isSuperAdmin && (
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleFieldActive(field)}
                            className="p-1 text-slate-400 hover:text-slate-700"
                            title="Toggle Active"
                          >
                            {field.is_active ? (
                              <ToggleRight className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <ToggleLeft className="w-5 h-5 text-slate-400" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({ type: 'field', id: field.id, name: field.field_label });
                            }}
                            className="p-1 text-slate-400 hover:text-red-600"
                            title="Delete Field"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Field Modal */}
      {newFieldModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setNewFieldModalOpen(false)}
        >
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" />
          <div
            className="relative bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900">Add Custom Client Field</h3>
              <button onClick={() => setNewFieldModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomField} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Field Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fieldLabel}
                  onChange={(e) => setFieldLabel(e.target.value)}
                  placeholder="e.g. Employer / Company Name"
                  className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Field Type
                </label>
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value as CustomFieldType)}
                  className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900"
                >
                  <option value="text">Text (Single line)</option>
                  <option value="long_text">Long Text (Multi-line textarea)</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="dropdown">Dropdown (Select list)</option>
                  <option value="checkbox">Checkbox (Yes / No)</option>
                </select>
              </div>

              {fieldType === 'dropdown' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dropdown Options (comma-separated)
                  </label>
                  <input
                    type="text"
                    required
                    value={fieldOptions}
                    onChange={(e) => setFieldOptions(e.target.value)}
                    placeholder="Option A, Option B, Option C"
                    className="w-full px-3 py-2 border rounded-lg text-sm text-slate-900"
                  />
                </div>
              )}

              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldRequired}
                    onChange={(e) => setFieldRequired(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span>Make field required during client creation</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setNewFieldModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Save Field
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab: Visa Types */}
      {activeTab === 'visatypes' && (
        <div className="space-y-4">
          {isSuperAdmin && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <h3 className="font-bold text-sm text-slate-900 mb-3">Add China Visa Category</h3>
              <form onSubmit={handleAddVisaType} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  required
                  value={newVisaName}
                  onChange={(e) => setNewVisaName(e.target.value)}
                  placeholder="Visa Category Name (e.g. S1 - Private Visit)"
                  className="flex-1 px-3.5 py-2 border rounded-lg text-sm text-slate-900"
                />
                <input
                  type="text"
                  value={newVisaDesc}
                  onChange={(e) => setNewVisaDesc(e.target.value)}
                  placeholder="Description..."
                  className="flex-1 px-3.5 py-2 border rounded-lg text-sm text-slate-900"
                />
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs font-semibold shrink-0"
                >
                  Add Visa Type
                </button>
              </form>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
            {visaTypes.map((vt) => (
              <div key={vt.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">{vt.name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{vt.description || 'No description provided'}</p>
                </div>
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({ type: 'visatype', id: vt.id, name: vt.name });
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition"
                    title="Delete Visa Type"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Countries & Nationalities */}
      {activeTab === 'countries' && (
        <div className="space-y-4">
          {/* Add Country Form */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <h3 className="font-bold text-sm text-slate-900 mb-1 flex items-center gap-2">
              <Globe className="w-4 h-4 text-sky-700" />
              <span>Add New Country / Nationality</span>
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Countries added here will immediately appear in the searchable client registration dropdown.
            </p>
            <form onSubmit={handleCreateCountry} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                required
                value={newCountryName}
                onChange={(e) => setNewCountryName(e.target.value)}
                placeholder="Country Name (e.g. Saudi Arabia, Canada, Kazakhstan)"
                className="flex-1 px-3.5 py-2 border rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
              />
              <input
                type="text"
                value={newCountryCode}
                onChange={(e) => setNewCountryCode(e.target.value)}
                placeholder="Code (e.g. SA, CA, KZ)"
                className="w-full sm:w-32 px-3.5 py-2 border rounded-lg text-sm font-mono uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
              />
              <button
                type="submit"
                className="px-5 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs font-semibold shrink-0 shadow-xs transition"
              >
                Add Country
              </button>
            </form>
          </div>

          {/* Edit Country Modal / Inline */}
          {editingCountry && (
            <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-sky-950 uppercase tracking-wide">
                  Edit Country: {editingCountry.name}
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingCountry(null)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>
              <form onSubmit={handleUpdateCountry} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  required
                  value={editCountryName}
                  onChange={(e) => setEditCountryName(e.target.value)}
                  className="flex-1 px-3.5 py-1.5 bg-white border border-sky-300 rounded-lg text-xs text-slate-900"
                />
                <input
                  type="text"
                  value={editCountryCode}
                  onChange={(e) => setEditCountryCode(e.target.value)}
                  placeholder="Code"
                  className="w-full sm:w-28 px-3.5 py-1.5 bg-white border border-sky-300 rounded-lg text-xs font-mono uppercase text-slate-900"
                />
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs font-semibold shadow-xs"
                >
                  Save Changes
                </button>
              </form>
            </div>
          )}

          {/* Countries List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs text-slate-600 flex items-center justify-between">
              <span className="font-semibold">Configured Countries ({countries.length})</span>
              <span className="text-[11px] text-slate-400">Controls the searchable dropdown in client creation</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto no-scrollbar">
              {countries.map((c) => (
                <div key={c.id} className="p-3.5 hover:bg-slate-50 transition flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="font-semibold text-xs text-slate-900">{c.name}</span>
                      {c.code && (
                        <span className="ml-2 font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                          {c.code}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleCountryActive(c)}
                      className="p-1 text-slate-400 hover:text-slate-700"
                      title={c.is_active ? 'Deactivate country' : 'Activate country'}
                    >
                      {c.is_active ? (
                        <ToggleRight className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setEditingCountry(c);
                        setEditCountryName(c.name);
                        setEditCountryCode(c.code || '');
                      }}
                      className="p-1.5 text-slate-400 hover:text-sky-700 rounded-lg hover:bg-slate-100 transition"
                      title="Edit Country"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget({ type: 'country', id: c.id, name: c.name });
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                      title="Delete Country"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Hotels & Room Types */}
      {activeTab === 'hotels' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-teal-700" />
                <span>Partner Hotels & Room Types ({hotels.length})</span>
              </h3>
              <p className="text-xs text-slate-500">
                Manage hotel names, cities, ratings, and configure different room types for customer bookings.
              </p>
            </div>
            <button
              onClick={handleOpenAddHotel}
              className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 self-start sm:self-auto transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Hotel</span>
            </button>
          </div>

          {/* Hotels List */}
          {hotels.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto">
                <Building2 className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">No Hotels Configured</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Add your partner hotels and room categories to start assigning them to customers.
              </p>
              <button
                onClick={handleOpenAddHotel}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First Hotel</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {hotels.map((h) => {
                const isExpanded = expandedHotelIds.includes(h.id);
                const rooms = h.rooms || [];

                return (
                  <div
                    key={h.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition"
                  >
                    {/* Hotel Main Header Bar */}
                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60 border-b border-slate-100">
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-slate-900 text-sm sm:text-base">{h.name}</h4>
                            {h.city && (
                              <span className="text-[11px] bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-500" />
                                {h.city}
                              </span>
                            )}
                            {h.star_rating && (
                              <span className="text-xs text-amber-500 font-bold flex items-center">
                                {'★'.repeat(h.star_rating)}
                              </span>
                            )}
                          </div>
                          {(h.address || h.phone) && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {h.address ? `${h.address} • ` : ''}
                              {h.phone || ''}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Hotel Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          onClick={() => handleToggleHotelActive(h)}
                          className="p-1 text-slate-400 hover:text-slate-700"
                          title={h.is_active ? 'Deactivate hotel' : 'Activate hotel'}
                        >
                          {h.is_active ? (
                            <ToggleRight className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-slate-400" />
                          )}
                        </button>

                        <button
                          onClick={() => handleOpenEditHotel(h)}
                          className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 text-slate-700 hover:text-teal-800 hover:border-teal-400 rounded-lg font-medium flex items-center gap-1 transition shadow-2xs"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => setDeleteTarget({ type: 'hotel', id: h.id, name: h.name })}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          title="Delete Hotel"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => toggleExpandHotel(h.id)}
                          className="px-3 py-1.5 text-xs bg-teal-50 border border-teal-200 text-teal-800 hover:bg-teal-100 rounded-lg font-semibold flex items-center gap-1.5 transition"
                        >
                          <BedDouble className="w-3.5 h-3.5 text-teal-700" />
                          <span>{isExpanded ? 'Hide Rooms' : 'Rooms'}</span>
                          <span className="bg-teal-700 text-white px-1.5 py-0.2 rounded-full text-[10px]">
                            {rooms.length}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Room Types Section (Collapsible) */}
                    {isExpanded && (
                      <div className="p-4 sm:p-5 bg-white border-t border-slate-100 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <div>
                            <h5 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                              <BedDouble className="w-3.5 h-3.5 text-teal-700" />
                              <span>Room Types for {h.name}</span>
                            </h5>
                            <p className="text-[11px] text-slate-400">
                              Define different room classes and nightly rates for this hotel.
                            </p>
                          </div>

                          <button
                            onClick={() => handleOpenAddRoom(h.id)}
                            className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1 transition"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Room Type</span>
                          </button>
                        </div>

                        {rooms.length === 0 ? (
                          <div className="p-6 text-center bg-slate-50/70 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                            No room types configured for this hotel yet. Click "+ Add Room Type" to create standard,
                            deluxe, or suite rooms.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {rooms.map((r) => (
                              <div
                                key={r.id}
                                className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-200 hover:border-teal-300 transition flex flex-col justify-between"
                              >
                                <div>
                                  <div className="flex items-start justify-between gap-1 mb-1">
                                    <h6 className="font-bold text-xs text-slate-900">{r.name}</h6>
                                    {r.price_per_night !== null && r.price_per_night !== undefined && (
                                      <span className="text-xs font-bold text-teal-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                                        ${r.price_per_night}
                                        <span className="text-[10px] text-slate-500 font-normal">/night</span>
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mb-2">
                                    Capacity: <span className="font-semibold text-slate-700">{r.capacity || 2} Guests</span>
                                  </div>
                                  {r.description && (
                                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed mb-2">
                                      {r.description}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-200/80">
                                  <button
                                    onClick={() => handleOpenEditRoom(h.id, r)}
                                    className="p-1 text-slate-400 hover:text-teal-700 rounded-md hover:bg-white transition"
                                    title="Edit Room Type"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      setDeleteTarget({
                                        type: 'hotelroom',
                                        id: r.id,
                                        name: `${r.name} (${h.name})`,
                                      })
                                    }
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-white transition"
                                    title="Delete Room Type"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Users (Super Admin) */}
      {activeTab === 'users' && isSuperAdmin && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <span>Agency Staff & Access Management</span>
                <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-bold">
                  {users.length} Total Users
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Super Admins can add accounts, set roles (Super Admin, Admin, Staff), and control system access.
              </p>
            </div>
            <button
              onClick={handleOpenAddUser}
              className="px-3.5 py-2 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add User Account</span>
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role &amp; Permissions</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4">Last Activity</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const isSelf = currentUser?.id === u.id;
                    const formatLastLogin = u.last_login_at
                      ? new Date(u.last_login_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Never logged in';

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                              {u.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                <span>{u.name}</span>
                                {isSelf && (
                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-normal">
                                    You
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">{u.email}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                              u.role === 'super_admin'
                                ? 'bg-sky-100 text-sky-800'
                                : u.role === 'admin'
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            <Shield className="w-2.5 h-2.5" />
                            {u.role === 'super_admin' ? 'Super Admin' : u.role === 'admin' ? 'Administrator' : 'Staff / Visa Officer'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {u.is_active ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded text-[11px] font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                              Deactivated
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                          {formatLastLogin}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditUser(u)}
                              className="px-2.5 py-1 text-xs text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-md font-semibold flex items-center gap-1 transition"
                              title="Edit user details, role & password"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            {!isSelf && (
                              <button
                                onClick={() => handleToggleUserActive(u)}
                                className={`px-2 py-1 text-xs rounded-md transition font-medium ${
                                  u.is_active
                                    ? 'text-slate-600 hover:text-amber-800 hover:bg-amber-50'
                                    : 'text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50'
                                }`}
                              >
                                {u.is_active ? 'Deactivate' : 'Activate'}
                              </button>
                            )}
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTarget({ type: 'user', id: u.id, name: u.name });
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                                title="Delete user account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Historical Data Cleanup & Storage Optimization */}
      {activeTab === 'cleanup' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Main Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-rose-950 text-white p-6 rounded-2xl shadow-md border border-slate-700/60">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-rose-500/20 border border-rose-500/30 rounded-xl text-rose-300">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-white">
                    Data Retention &amp; Storage Cleanup
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/30 text-rose-200 border border-rose-400/40">
                    Storage Manager
                  </span>
                </div>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  Purge old operational history records (Visa Applications, Hotel Bookings, Calendar Tasks &amp; Audit Logs) by date range to free database storage while keeping client profiles intact.
                </p>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-3 self-start md:self-auto bg-slate-950/60 border border-slate-700/80 px-4 py-2.5 rounded-xl">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                    Client Profiles Safe
                  </div>
                  <div className="text-xs text-slate-300">
                    <strong className="text-white font-semibold">{cleanupPreview ? cleanupPreview.clients_preserved : 'All'}</strong> clients permanently preserved
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Client Safety Assurance Box */}
          <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-start gap-3">
            <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-800 shrink-0 mt-0.5">
              <Shield className="w-4 h-4" />
            </div>
            <div className="text-xs text-emerald-950 space-y-0.5">
              <p className="font-bold">Important Data Safety Guarantee:</p>
              <p className="text-emerald-800">
                This deletion tool <span className="font-semibold underline">NEVER</span> removes client profiles, passport numbers, names, phone numbers, custom fields, or Google Drive attachments. It only purges past operational tracking history records according to your selected date range.
              </p>
            </div>
          </div>

          {/* 💾 1-CLICK DATABASE BACKUP & RESTORE TOOL */}
          <div className="bg-white rounded-2xl border border-sky-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-sky-100 text-sky-800 rounded-xl">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Database Backup &amp; Disaster Recovery</h3>
                  <p className="text-xs text-slate-500">1-click full SQL database exports and instant disaster restore</p>
                </div>
              </div>

              {backupSuccessMsg && (
                <div className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 animate-in fade-in">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{backupSuccessMsg}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option A: Download Full SQL Backup */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900 mb-1">
                    <Download className="w-4 h-4 text-sky-700" />
                    <span>Download Full SQL Backup (.sql)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Generates a complete, phpMyAdmin-compatible `.sql` database backup file containing all clients, applications, hotel bookings, tasks, users, and audit logs.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadBackupFile}
                  disabled={downloadingBackup}
                  className="w-full py-2.5 bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
                >
                  {downloadingBackup ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating SQL Dump...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Download SQL Backup File</span>
                    </>
                  )}
                </button>
              </div>

              {/* Option B: Restore from Backup */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-900 mb-1">
                    <RotateCcw className="w-4 h-4 text-amber-700" />
                    <span>Restore Database from SQL Backup File</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Upload a previously generated SN Travels `.sql` backup file to restore all clients, visa applications, and settings to that exact point in time.
                  </p>
                </div>

                <label className="w-full py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold shadow-2xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-98">
                  <HardDrive className="w-4 h-4 text-slate-600" />
                  <span>Upload &amp; Restore .sql File</span>
                  <input
                    type="file"
                    accept=".sql,.txt,.json"
                    onChange={handleBackupFileUploaded}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Date Range Selector & Presets */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-700" />
                <h3 className="font-bold text-sm text-slate-900">1. Select Historical Date Range</h3>
              </div>
              <span className="text-xs text-slate-500">
                Filter records created or due within this range
              </span>
            </div>

            {/* Quick Presets */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                Quick Date Presets
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePresetDate(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                    !cleanupStartDate && !cleanupEndDate
                      ? 'bg-rose-50 border-rose-300 text-rose-800 ring-2 ring-rose-200'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  ⚡ All Records (Entire History)
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetDate(30)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition"
                >
                  Older than 30 Days
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetDate(60)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition"
                >
                  Older than 60 Days
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetDate(90)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition"
                >
                  Older than 90 Days (3 Months)
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetDate(180)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition"
                >
                  Older than 180 Days (6 Months)
                </button>
                <button
                  type="button"
                  onClick={() => handlePresetDate(365)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition"
                >
                  Older than 1 Year (365 Days)
                </button>
              </div>
            </div>

            {/* Custom Date Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Start Date (From)
                </label>
                <input
                  type="date"
                  value={cleanupStartDate}
                  onChange={(e) => {
                    setCleanupStartDate(e.target.value);
                    loadCleanupPreview(e.target.value, cleanupEndDate, cleanupTargets);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-white"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Leave empty to include from start</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  End Date (Up to)
                </label>
                <input
                  type="date"
                  value={cleanupEndDate}
                  onChange={(e) => {
                    setCleanupEndDate(e.target.value);
                    loadCleanupPreview(cleanupStartDate, e.target.value, cleanupTargets);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-white"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Records on or before this date</span>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setCleanupStartDate('');
                    setCleanupEndDate('');
                    loadCleanupPreview('', '', cleanupTargets);
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center justify-center gap-1.5 h-[38px]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Date Filters</span>
                </button>
              </div>
            </div>
          </div>

          {/* Multiple Select Options (Categories) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-700" />
                <h3 className="font-bold text-sm text-slate-900">2. Select Data Categories to Delete</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectAllTargets(true)}
                  className="px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50 rounded-lg transition"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => handleSelectAllTargets(false)}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Target Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Option 1: Applications */}
              <div
                onClick={() => handleToggleTarget('applications')}
                className={`p-4 rounded-xl border-2 transition cursor-pointer flex items-start gap-3 select-none ${
                  cleanupTargets.applications
                    ? 'border-rose-500 bg-rose-50/40'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="pt-0.5">
                  {cleanupTargets.applications ? (
                    <CheckSquare className="w-5 h-5 text-rose-600" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-slate-700" />
                      <span className="font-bold text-xs text-slate-900">Visa Applications History</span>
                    </div>
                    {cleanupPreview && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        cleanupTargets.applications && cleanupPreview.counts.applications > 0
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {cleanupPreview.counts.applications} records
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Purges visa applications created/dated in range, application notes, and status steps. Preserves client master profiles.
                  </p>
                </div>
              </div>

              {/* Option 2: Hotel Bookings */}
              <div
                onClick={() => handleToggleTarget('hotel_bookings')}
                className={`p-4 rounded-xl border-2 transition cursor-pointer flex items-start gap-3 select-none ${
                  cleanupTargets.hotel_bookings
                    ? 'border-rose-500 bg-rose-50/40'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="pt-0.5">
                  {cleanupTargets.hotel_bookings ? (
                    <CheckSquare className="w-5 h-5 text-rose-600" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-teal-700" />
                      <span className="font-bold text-xs text-slate-900">Hotel Bookings &amp; Stays History</span>
                    </div>
                    {cleanupPreview && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        cleanupTargets.hotel_bookings && cleanupPreview.counts.hotel_bookings > 0
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {cleanupPreview.counts.hotel_bookings} records
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Purges hotel stay reservations and guest booking history in date range. Preserves partner hotel listings &amp; client profiles.
                  </p>
                </div>
              </div>

              {/* Option 3: Calendar & Tasks */}
              <div
                onClick={() => handleToggleTarget('tasks')}
                className={`p-4 rounded-xl border-2 transition cursor-pointer flex items-start gap-3 select-none ${
                  cleanupTargets.tasks
                    ? 'border-rose-500 bg-rose-50/40'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="pt-0.5">
                  {cleanupTargets.tasks ? (
                    <CheckSquare className="w-5 h-5 text-rose-600" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-sky-700" />
                      <span className="font-bold text-xs text-slate-900">Calendar &amp; Task History</span>
                    </div>
                    {cleanupPreview && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        cleanupTargets.tasks && cleanupPreview.counts.tasks > 0
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {cleanupPreview.counts.tasks} records
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Purges past calendar tasks, embassy submission deadlines, pickup reminders, and delivery logs in date range.
                  </p>
                </div>
              </div>

              {/* Option 4: Status History Audit */}
              <div
                onClick={() => handleToggleTarget('status_history')}
                className={`p-4 rounded-xl border-2 transition cursor-pointer flex items-start gap-3 select-none ${
                  cleanupTargets.status_history
                    ? 'border-rose-500 bg-rose-50/40'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="pt-0.5">
                  {cleanupTargets.status_history ? (
                    <CheckSquare className="w-5 h-5 text-rose-600" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <History className="w-4 h-4 text-slate-700" />
                      <span className="font-bold text-xs text-slate-900">Application Status Change Logs</span>
                    </div>
                    {cleanupPreview && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        cleanupTargets.status_history && cleanupPreview.counts.status_history > 0
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {cleanupPreview.counts.status_history} records
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Purges individual step-by-step status transition timestamp records in date range.
                  </p>
                </div>
              </div>

              {/* Option 5: Activity Logs */}
              <div
                onClick={() => handleToggleTarget('activity_logs')}
                className={`p-4 rounded-xl border-2 transition cursor-pointer flex items-start gap-3 select-none ${
                  cleanupTargets.activity_logs
                    ? 'border-rose-500 bg-rose-50/40'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="pt-0.5">
                  {cleanupTargets.activity_logs ? (
                    <CheckSquare className="w-5 h-5 text-rose-600" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span className="font-bold text-xs text-slate-900">System Activity &amp; Audit Logs</span>
                    </div>
                    {cleanupPreview && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        cleanupTargets.activity_logs && cleanupPreview.counts.activity_logs > 0
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {cleanupPreview.counts.activity_logs} records
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Purges staff action audit logs, login event history, and system change notifications in date range.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Live Preview & Action Execution Box */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <span>3. Review Impact &amp; Execute Deletion</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Range: <span className="text-slate-200 font-semibold">{cleanupStartDate || 'Beginning of time'}</span> → <span className="text-slate-200 font-semibold">{cleanupEndDate || 'Latest date'}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => loadCleanupPreview(cleanupStartDate, cleanupEndDate, cleanupTargets)}
                disabled={loadingPreview}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition self-start sm:self-auto"
              >
                {loadingPreview ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>Refresh Preview Counts</span>
              </button>
            </div>

            {/* Preview Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-slate-800/80 border border-slate-700/60 p-3.5 rounded-xl">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Applications</div>
                <div className="text-xl font-black text-white mt-1">
                  {cleanupPreview ? cleanupPreview.counts.applications : '...'}
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/60 p-3.5 rounded-xl">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Hotel Bookings</div>
                <div className="text-xl font-black text-white mt-1">
                  {cleanupPreview ? cleanupPreview.counts.hotel_bookings : '...'}
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/60 p-3.5 rounded-xl">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tasks &amp; Calendar</div>
                <div className="text-xl font-black text-white mt-1">
                  {cleanupPreview ? cleanupPreview.counts.tasks : '...'}
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/60 p-3.5 rounded-xl">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Status History</div>
                <div className="text-xl font-black text-white mt-1">
                  {cleanupPreview ? cleanupPreview.counts.status_history : '...'}
                </div>
              </div>

              <div className="bg-rose-950/60 border border-rose-800/80 p-3.5 rounded-xl">
                <div className="text-[10px] uppercase font-bold text-rose-300 tracking-wider">Total To Purge</div>
                <div className="text-xl font-black text-rose-400 mt-1">
                  {cleanupPreview ? cleanupPreview.counts.total : '0'}
                </div>
              </div>

              <div className="bg-emerald-950/60 border border-emerald-800/80 p-3.5 rounded-xl">
                <div className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">Clients Kept</div>
                <div className="text-xl font-black text-emerald-400 mt-1">
                  {cleanupPreview ? cleanupPreview.clients_preserved : '0'}
                </div>
              </div>
            </div>

            {/* Execution Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSqlScript(!showSqlScript)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <Database className="w-3.5 h-3.5 text-sky-400" />
                <span>{showSqlScript ? 'Hide phpMyAdmin SQL Script' : 'View phpMyAdmin SQL Script'}</span>
              </button>

              <button
                type="button"
                onClick={handleOpenPurgeModal}
                disabled={!cleanupPreview || cleanupPreview.counts.total === 0 || loadingPreview}
                className="px-6 py-3 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition active:scale-98 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Selected History Data ({cleanupPreview ? cleanupPreview.counts.total : 0} Records)</span>
              </button>
            </div>

            {/* phpMyAdmin SQL Preview Box */}
            {showSqlScript && (
              <div className="mt-4 p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-bold text-slate-200">MySQL / phpMyAdmin Query Equivalent</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopySql}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                    >
                      {copiedSql ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSql ? 'Copied to Clipboard!' : 'Copy SQL'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadSql}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                    >
                      <Download className="w-3 h-3 text-sky-400" />
                      <span>Download .sql</span>
                    </button>
                  </div>
                </div>
                <pre className="p-3 bg-black/50 rounded-lg text-[11px] font-mono text-emerald-400 overflow-x-auto whitespace-pre leading-relaxed border border-slate-800">
                  {getGeneratedSql()}
                </pre>
                <p className="text-[10px] text-slate-400">
                  You can execute the queries above directly in phpMyAdmin under the SQL tab if running against a remote MySQL database.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Secret Login Access URL & System Gatekeeper (Super Admin) */}
      {activeTab === 'security' && isSuperAdmin && (
        <div className="space-y-6 animate-in fade-in">
          {/* Top Hero Banner */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-md border border-slate-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-300">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-white">
                    Secret Login URL &amp; Portal Gatekeeper
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                      secretEnabled
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {secretEnabled ? 'Gatekeeper Active' : 'Gatekeeper Disabled'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                  Protect your internal agency workspace with a private, secret URL. Anyone navigating directly to root or unauthenticated paths will receive a standard 404 Not Found error. Only staff who use this designated link can reach the login screen and authenticate.
                </p>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-3 self-start md:self-auto bg-slate-950/70 border border-slate-800 px-4 py-2.5 rounded-xl">
                <ShieldCheck
                  className={`w-5 h-5 shrink-0 ${secretEnabled ? 'text-emerald-400' : 'text-amber-400'}`}
                />
                <div>
                  <div
                    className={`text-[11px] font-bold uppercase tracking-wider ${
                      secretEnabled ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {secretEnabled ? 'Portal Concealed' : 'Public Discovery Open'}
                  </div>
                  <div className="text-xs text-slate-300">
                    {secretEnabled ? 'Direct logins blocked' : 'Standard login visible'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feedback messages */}
          {secretSaveMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-900 text-xs font-semibold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{secretSaveMsg}</div>
            </div>
          )}

          {secretSaveError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-900 text-xs font-semibold animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{secretSaveError}</div>
            </div>
          )}

          {/* Active Secret Link Live Card */}
          <div className="bg-white rounded-2xl border border-indigo-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <Link2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Active Secret Staff Login Link</h3>
                  <p className="text-xs text-slate-500">
                    Send this link securely to your visa officers and agency employees.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySecretUrl}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  {copiedSecretUrl ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-200" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Secret Link</span>
                    </>
                  )}
                </button>

                <a
                  href={`/access/${secretKeyInput.trim() || secretConfig?.secretKey || 'sn-secure-staff-2026'}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                  title="Test login page in new window"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Test Link</span>
                </a>
              </div>
            </div>

            {/* Display Box */}
            <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="font-mono text-xs sm:text-sm text-slate-300 break-all select-all flex items-center gap-1">
                <span className="text-slate-500">{window.location.origin}/access/</span>
                <span className="text-emerald-400 font-bold">
                  {secretKeyInput.trim() || secretConfig?.secretKey || 'sn-secure-staff-2026'}
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 bg-slate-800 px-2.5 py-1 rounded-md">
                100% Unique Entry Point
              </span>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>
                Tip: Instruct staff to bookmark this link on their work browsers so they can access their desk seamlessly every day.
              </span>
            </div>
          </div>

          {/* Configuration Form Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Configure Secret Access Rules</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Customize your secret access slug and choose whether to strictly enforce the unique URL requirement.
              </p>
            </div>

            <form onSubmit={handleSaveSecretConfig} className="space-y-6">
              {/* Toggle Gatekeeper */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span>Enforce Secret URL for Staff Logins</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        secretEnabled
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {secretEnabled ? 'Strict Mode (Recommended)' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 max-w-xl">
                    When enabled, anyone visiting root or attempting standard login without this unique URL is shown a 404 Not Found error. Direct API login attempts without the secret key are blocked with 403 Forbidden.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSecretEnabled(!secretEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    secretEnabled ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}
                  role="switch"
                  aria-checked={secretEnabled}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      secretEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Secret Slug Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    Secret Access Slug / Key
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Allowed: lowercase letters, numbers, and dashes (-)
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 pointer-events-none select-none">
                      /access/
                    </span>
                    <input
                      type="text"
                      required
                      value={secretKeyInput}
                      onChange={(e) => {
                        const sanitized = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
                        setSecretKeyInput(sanitized);
                        setSecretSaveMsg(null);
                        setSecretSaveError(null);
                      }}
                      placeholder="e.g. sn-secure-staff-2026"
                      className="w-full pl-20 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateRandomKey}
                    className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                    title="Generate a cryptographically random, hard-to-guess key"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Generate Random Key</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-400">
                  Example custom slugs: <code className="text-slate-600 font-mono">dubai-desk-77</code>,{' '}
                  <code className="text-slate-600 font-mono">china-visa-office</code>, or randomized{' '}
                  <code className="text-slate-600 font-mono">staff-k8m9x2</code>
                </p>
              </div>

              {/* Form Action */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={loadSecretConfig}
                  disabled={loadingSecretConfig || savingSecretConfig}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
                >
                  Reset / Reload
                </button>

                <button
                  type="submit"
                  disabled={savingSecretConfig}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
                >
                  {savingSecretConfig ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Security Settings</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Security Architecture & Behavior Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Unauthorized Persona */}
            <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <span>Unauthorized Visitor / Scanner / Hacker Bot</span>
              </div>
              <div className="space-y-1.5 text-xs text-rose-800">
                <div className="p-2.5 bg-white/80 rounded-xl border border-rose-200 font-mono text-[11px]">
                  Navigates to: <strong className="text-rose-900">/</strong> or <strong className="text-rose-900">/login</strong>
                </div>
                <p className="text-[11px] leading-relaxed">
                  🛡️ <strong>Behavior</strong>: Receives an authentic <strong>HTTP 404 (Resource Not Found)</strong> page. The existence of the management portal is completely concealed.
                </p>
                <p className="text-[11px] leading-relaxed">
                  🚫 <strong>Direct API Exploits</strong>: Attempting direct HTTP POST requests to <code className="bg-rose-100 px-1 py-0.5 rounded font-mono">/api/auth/login</code> is rejected by the server with <strong>403 Forbidden</strong>.
                </p>
              </div>
            </div>

            {/* Authorized Staff Persona */}
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Authorized Agency Staff Member</span>
              </div>
              <div className="space-y-1.5 text-xs text-emerald-800">
                <div className="p-2.5 bg-white/80 rounded-xl border border-emerald-200 font-mono text-[11px]">
                  Navigates to: <strong className="text-emerald-900">/access/{secretKeyInput.trim() || secretConfig?.secretKey || 'sn-secure-staff-2026'}</strong>
                </div>
                <p className="text-[11px] leading-relaxed">
                  ✅ <strong>Behavior</strong>: Secret key is validated instantly. The official agency login screen appears with a green <em>Secret Gate Verified</em> badge.
                </p>
                <p className="text-[11px] leading-relaxed">
                  🔐 <strong>Seamless Daily Work</strong>: Staff can enter credentials or click remember to manage visas, clients, tasks, and hotel bookings uninterrupted.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit User Modal */}
      {showAddUserModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setShowAddUserModal(false)}
        >
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" />
          <div
            className="relative bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-100 text-sky-700">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    {editingUser ? `Edit Account: ${editingUser.name}` : 'Create Staff Account'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingUser ? 'Manage permissions, role & security' : 'Add new authorized agency personnel'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {userModalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{userModalError}</div>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Tariq Mehmood"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="staff@sn-travelsagency.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600 font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    {editingUser ? 'Reset Password (optional)' : 'Account Password'}{' '}
                    {!editingUser && <span className="text-rose-500">*</span>}
                  </label>
                  <span className="text-[10px] text-slate-400">Min. 8 characters</span>
                </div>
                <div className="relative">
                  <input
                    type={showPasswordInModal ? 'text' : 'password'}
                    required={!editingUser}
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder={editingUser ? '•••••••• (leave blank to keep unchanged)' : 'Enter strong password (8+ chars)'}
                    className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordInModal(!showPasswordInModal)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPasswordInModal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role &amp; Permissions</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
                >
                  <option value="super_admin">Super Admin (Full Authority, User Accounts, Delete &amp; Database)</option>
                  <option value="admin">Administrator (Operations Management, Records, Bookings)</option>
                  <option value="staff">Staff / Visa Officer (Clients, Visa Applications, Hotels, Tasks)</option>
                </select>
              </div>

              {editingUser && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Account Active Status</label>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="active_status"
                        checked={newUserActive === 1}
                        onChange={() => setNewUserActive(1)}
                        className="text-sky-600"
                      />
                      <span>Active</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="active_status"
                        checked={newUserActive === 0}
                        onChange={() => setNewUserActive(0)}
                        disabled={editingUser.id === currentUser?.id}
                        className="text-sky-600"
                      />
                      <span>Deactivated {editingUser.id === currentUser?.id && '(Cannot self-deactivate)'}</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="px-5 py-2.5 bg-sky-700 hover:bg-sky-800 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  {savingUser ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingUser ? 'Save User Changes' : 'Create Account'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hotel Add/Edit Modal */}
      {hotelModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in cursor-pointer"
          onClick={() => setHotelModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-teal-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-teal-200" />
                <h3 className="font-bold text-sm">
                  {editingHotel ? `Edit Hotel: ${editingHotel.name}` : 'Add Partner Hotel'}
                </h3>
              </div>
              <button
                onClick={() => setHotelModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-teal-200 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveHotel} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hotel Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={hotelName}
                  onChange={(e) => setHotelName(e.target.value)}
                  placeholder="e.g. Grand Hyatt Shanghai"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City / Region</label>
                  <input
                    type="text"
                    value={hotelCity}
                    onChange={(e) => setHotelCity(e.target.value)}
                    placeholder="e.g. Shanghai, Beijing"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Star Rating</label>
                  <select
                    value={hotelStarRating}
                    onChange={(e) => setHotelStarRating(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900"
                  >
                    <option value={5}>5 Stars ★★★★★</option>
                    <option value={4}>4 Stars ★★★★</option>
                    <option value={3}>3 Stars ★★★</option>
                    <option value={2}>2 Stars ★★</option>
                    <option value={1}>1 Star ★</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={hotelAddress}
                  onChange={(e) => setHotelAddress(e.target.value)}
                  placeholder="e.g. 88 Century Avenue, Pudong New Area"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={hotelPhone}
                    onChange={(e) => setHotelPhone(e.target.value)}
                    placeholder="+86 21 5049 1234"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={hotelEmail}
                    onChange={(e) => setHotelEmail(e.target.value)}
                    placeholder="reservations@hotel.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Description</label>
                <textarea
                  rows={2}
                  value={hotelNotes}
                  onChange={(e) => setHotelNotes(e.target.value)}
                  placeholder="Agency contract notes, special rates, manager contact..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setHotelModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  {editingHotel ? 'Save Changes' : 'Add Hotel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Room Type Add/Edit Modal */}
      {roomModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in cursor-pointer"
          onClick={() => setRoomModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-teal-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BedDouble className="w-4 h-4 text-teal-200" />
                <h3 className="font-bold text-sm">
                  {editingRoom ? `Edit Room: ${editingRoom.name}` : 'Add Room Type'}
                </h3>
              </div>
              <button
                onClick={() => setRoomModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-teal-200 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRoom} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Room Type Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g. Deluxe King Room, Executive Suite"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Price per Night ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={roomPrice}
                    onChange={(e) => setRoomPrice(e.target.value)}
                    placeholder="e.g. 220.00"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Guest Capacity</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={roomCapacity}
                    onChange={(e) => setRoomCapacity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Bed Setup</label>
                <textarea
                  rows={2}
                  value={roomDesc}
                  onChange={(e) => setRoomDesc(e.target.value)}
                  placeholder="e.g. 1 King bed, 40 sqm, Bund view, marble bath, free breakfast..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRoomModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold shadow-xs"
                >
                  {editingRoom ? 'Save Changes' : 'Add Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settings Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        title={`Delete ${deleteTarget?.name || 'Item'}?`}
        message={`Are you sure you want to permanently remove this ${deleteTarget?.type || 'item'}? This action cannot be undone.`}
        confirmLabel="Confirm Delete"
        loading={deletingItem}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />

      {/* Historical Data Purge Confirmation Modal */}
      {purgeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => !purgingData && setPurgeModalOpen(false)}
        >
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl border border-rose-200 max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 overflow-hidden cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-rose-100 text-rose-700 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Confirm Historical Data Deletion
                  </h3>
                  <p className="text-xs text-rose-600 font-medium">
                    Permanent action • Cannot be undone
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={purgingData}
                onClick={() => setPurgeModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scope Summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between font-semibold text-slate-800 border-b border-slate-200 pb-2">
                <span>Date Range:</span>
                <span className="font-mono text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {cleanupStartDate || 'Beginning of time'} → {cleanupEndDate || 'Latest date'}
                </span>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Records to be deleted from database:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {cleanupTargets.applications && (
                    <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-600">Visa Applications:</span>
                      <strong className="text-rose-600 font-bold">{cleanupPreview?.counts.applications || 0}</strong>
                    </div>
                  )}
                  {cleanupTargets.hotel_bookings && (
                    <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-600">Hotel Bookings:</span>
                      <strong className="text-rose-600 font-bold">{cleanupPreview?.counts.hotel_bookings || 0}</strong>
                    </div>
                  )}
                  {cleanupTargets.tasks && (
                    <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-600">Tasks &amp; Calendar:</span>
                      <strong className="text-rose-600 font-bold">{cleanupPreview?.counts.tasks || 0}</strong>
                    </div>
                  )}
                  {cleanupTargets.status_history && (
                    <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-600">Status History:</span>
                      <strong className="text-rose-600 font-bold">{cleanupPreview?.counts.status_history || 0}</strong>
                    </div>
                  )}
                  {cleanupTargets.activity_logs && (
                    <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200">
                      <span className="text-slate-600">Activity Logs:</span>
                      <strong className="text-rose-600 font-bold">{cleanupPreview?.counts.activity_logs || 0}</strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200 font-bold">
                <span className="text-slate-800">Total Records to Purge:</span>
                <span className="text-sm text-rose-600 font-extrabold font-mono">
                  {cleanupPreview?.counts.total || 0} records
                </span>
              </div>
            </div>

            {/* Client Protection Callout */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-900">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <strong className="font-bold text-emerald-950">Client records are 100% safe:</strong>
                <p className="text-emerald-800 text-[11px]">
                  All {cleanupPreview?.clients_preserved || 'client'} customer profiles will remain untouched in your database.
                </p>
              </div>
            </div>

            {/* Confirmation Input */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                To confirm, type <span className="font-mono font-bold text-rose-600">PURGE</span> in the box below:
              </label>
              <input
                type="text"
                value={purgeConfirmationText}
                onChange={(e) => setPurgeConfirmationText(e.target.value)}
                placeholder="Type PURGE to confirm"
                className="w-full px-3.5 py-2.5 border border-rose-300 rounded-xl text-sm font-mono tracking-wider text-rose-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 uppercase bg-rose-50/30"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={purgingData}
                onClick={() => setPurgeModalOpen(false)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecutePurge}
                disabled={
                  purgingData ||
                  (purgeConfirmationText.trim().toUpperCase() !== 'PURGE' &&
                    purgeConfirmationText.trim().toUpperCase() !== 'DELETE')
                }
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-2 transition active:scale-95 cursor-pointer"
              >
                {purgingData ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Purging Records...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Permanently Purge Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
