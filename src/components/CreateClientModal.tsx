import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  AlertTriangle,
  FolderOpen,
  UserCheck,
  ChevronRight,
  ExternalLink,
  Loader2,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  Sparkles,
  Upload,
  Camera,
} from 'lucide-react';
import { api } from '../services/api';
import { CustomField, Client, Country, ScannedPassportData } from '../types';
import { CountrySelectSearch } from './CountrySelectSearch';
import { ClientAvatar } from './ClientAvatar';
import { getGoogleDriveDirectImageUrl, isGoogleDriveLink } from '../utils/image';

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClientCreated: (client: Client) => void;
  onOpenExistingClient: (clientId: number) => void;
  initialPassportData?: ScannedPassportData | null;
  onOpenPassportScanner?: () => void;
}

export const CreateClientModal: React.FC<CreateClientModalProps> = ({
  isOpen,
  onClose,
  onClientCreated,
  onOpenExistingClient,
  initialPassportData,
  onOpenPassportScanner,
}) => {
  // Mandatory fields
  const [customClientId, setCustomClientId] = useState('');
  const [loadingNextSerial, setLoadingNextSerial] = useState(false);
  const [lastServerSerial, setLastServerSerial] = useState<number | null>(null);
  const [fullName, setFullName] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [country, setCountry] = useState('United Arab Emirates');

  const fetchNextSerial = async () => {
    try {
      setLoadingNextSerial(true);
      const res = await api.getNextClientSerial();
      if (res?.next_client_id) {
        setCustomClientId(res.next_client_id);
      }
      if (typeof res?.last_serial_number === 'number') {
        setLastServerSerial(res.last_serial_number);
      }
    } catch (err) {
      console.error('Failed to fetch next client serial', err);
    } finally {
      setLoadingNextSerial(false);
    }
  };

  // Optional fields
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [occupation, setOccupation] = useState('');
  const [notes, setNotes] = useState('');
  const [googleDriveUrl, setGoogleDriveUrl] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoError, setPhotoError] = useState(false);

  // Custom fields
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<number, string>>({});

  // Countries
  const [countries, setCountries] = useState<Country[]>([]);

  // Duplicate Check State
  const [duplicateMatches, setDuplicateMatches] = useState<Array<{
    id: number;
    client_id: string;
    full_name: string;
    passport_number: string;
    country: string;
  }>>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [ignoreDuplicateWarning, setIgnoreDuplicateWarning] = useState(false);

  // Form State
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline Passport Scanner State
  const [inlineScanning, setInlineScanning] = useState(false);
  const [inlineScanStatus, setInlineScanStatus] = useState('');
  const [inlineScanSuccess, setInlineScanSuccess] = useState<ScannedPassportData | null>(null);
  const inlinePassportInputRef = useRef<HTMLInputElement | null>(null);

  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load custom fields and countries when opened
  useEffect(() => {
    if (isOpen) {
      api.getCustomFields(true)
        .then((fields) => setCustomFields(fields))
        .catch((err) => console.error('Failed to load custom fields', err));
      api.getCountries(true)
        .then((ctrs) => setCountries(ctrs))
        .catch((err) => console.error('Failed to load countries', err));

      fetchNextSerial();

      if (initialPassportData) {
        applyPassportData(initialPassportData);
      } else {
        resetForm();
      }
    }
  }, [isOpen, initialPassportData]);

  const cleanNameOnClient = (raw: string) => {
    if (!raw) return '';
    let cleaned = raw
      .split(/\s+/)
      .map((w) => {
        let s = w.trim();
        // Strip country codes or MRZ prefixes erroneously glued to name tokens
        // e.g. "DNMOHAMED" -> "MOHAMED", "SDNMOHAMED" -> "MOHAMED", "DNMUNTASIR" -> "MUNTASIR", "DNELKHALIFA" -> "ELKHALIFA"
        s = s.replace(/^(PCSDN|PASDN|PCS|PAS|SDN|DN|ARE|EGY|SAU|PAK|GBR|IND|USA|CAN|AUS|OMN|QAT|KWT|BHR|JOR|SYR|LBN|IRQ|IRN|TUR|YEM|SOM|ETH|KEN|NGA|MAR|DZA|TUN|LBY|MRT|SEN|BGD|PHL|MYS|SGP|IDN|THA|VNM|KOR|JPN|RUS|UKR|BLR|POL|DEU|FRA|ITA|ESP|PRT|GRC|AUT|CHE|NLD|BEL|SWE|NOR|DNK|FIN|IRL|NZL|BRA|ARG|MEX|COL|VEN|BOL)(?=[B-DF-HJ-NP-TV-Z]|EL|AL|AB|AH|OM|OS)/i, '');
        return s;
      })
      .filter((s) => {
        if (!s) return false;
        // Remove isolated chevron noise tokens (Lk, Kl, Kk, Ll, Lc, Cl, Ck, Kc, Cc, K, L, C, X, 1, I)
        if (/^[LKCX1I]{1,2}$/i.test(s)) return false;
        // Remove OCR noise artifacts (length >= 3 with no vowels, or 3+ repeated characters)
        if (s.length >= 3 && !/[aeiouy]/i.test(s)) return false;
        if (/(.)\1{2,}/i.test(s)) return false;
        // Filter out isolated standalone country codes or MRZ prefixes
        if (/^(SDN|DN|ARE|EGY|SAU|PAK|GBR|IND|USA|CAN|AUS|OMN|QAT|KWT|BHR|JOR|SYR|LBN|IRQ|IRN|TUR|YEM|SOM|ETH|KEN|NGA|MAR|DZA|TUN|LBY|MRT|SEN|BGD|PHL|MYS|SGP|IDN|THA|VNM|KOR|JPN|RUS|UKR|BLR|POL|DEU|FRA|ITA|ESP|PRT|GRC|AUT|CHE|NLD|BEL|SWE|NOR|DNK|FIN|IRL|NZL|BRA|ARG|MEX|COL|VEN|BOL|PCS|PAS|PC|PA)$/i.test(s)) return false;
        return true;
      })
      .join(' ');

    // Recombine split names caused by OCR chevron/gap cuts
    cleaned = cleaned.replace(/\b(AL)\s+(I)\b/gi, 'Ali');
    cleaned = cleaned.replace(/\b(EL)\s+(I)\b/gi, 'Eli');
    cleaned = cleaned.replace(/\b(MOH)\s+(AMED)\b/gi, 'Mohamed');
    cleaned = cleaned.replace(/\b(AH)\s+(MED)\b/gi, 'Ahmed');
    cleaned = cleaned.replace(/\b(HAM)\s+(ZA)\b/gi, 'Hamza');
    cleaned = cleaned.replace(/\b(Elkhali)\s+(Fa)\b/gi, 'Elkhalifa');
    cleaned = cleaned.replace(/\b(Khali)\s+(Fa)\b/gi, 'Khalifa');
    cleaned = cleaned.replace(/\b(Musta)\s+(Fa)\b/gi, 'Mustafa');
    cleaned = cleaned.replace(/\b(Hudai|Hodai)\s+(Fa)\b/gi, 'Hudaifa');
    cleaned = cleaned.replace(/\b(Morta)\s+(Da)\b/gi, 'Mortada');
    return cleaned;
  };

  const applyPassportData = (data: ScannedPassportData) => {
    const sanitizedName = cleanNameOnClient(data.fullName);
    if (sanitizedName) setFullName(sanitizedName);
    else if (data.fullName) setFullName(data.fullName);
    if (data.passportNumber) setPassportNumber(data.passportNumber);
    if (data.country) setCountry(data.country);
    if (data.dateOfBirth) {
      setDateOfBirth(data.dateOfBirth);
      setShowOptionalFields(true);
    }
    setInlineScanSuccess(data);

    // Instant duplicate check with new passport number
    if (data.passportNumber) {
      api.checkDuplicateClient(data.passportNumber, data.fullName)
        .then((res) => {
          if (res.has_duplicate) {
            setDuplicateMatches(res.matches);
            setShowDuplicateWarning(true);
          } else {
            setShowDuplicateWarning(false);
            setDuplicateMatches([]);
          }
        })
        .catch(() => {});
    }
  };

  const runInlineScan = async (imageData: string, mimeType?: string) => {
    setInlineScanning(true);
    setInlineScanStatus('Analyzing passport with ICAO 9303 MRZ Engine...');
    setError(null);
    try {
      const scanned = await api.scanPassport(imageData, mimeType, 'tesseract', (msg) => {
        setInlineScanStatus(msg);
      });
      scanned.imagePreview = imageData.startsWith('data:') ? imageData : undefined;
      applyPassportData(scanned);
    } catch (err: any) {
      console.error('Passport scan failed:', err);
      setError(err.message || 'Passport scan failed. Please verify the image or enter details manually.');
    } finally {
      setInlineScanning(false);
      setInlineScanStatus('');
    }
  };

  const handleInlinePassportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setError('Passport image file is too large (max 15MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      runInlineScan(dataUrl, file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleInlinePassportDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      runInlineScan(dataUrl, file.type);
    };
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    fetchNextSerial();
    setFullName('');
    setPassportNumber('');
    setCountry('United Arab Emirates');
    setPhone('');
    setWhatsapp('');
    setEmail('');
    setDateOfBirth('');
    setAddress('');
    setOccupation('');
    setNotes('');
    setGoogleDriveUrl('');
    setPhotoUrl('');
    setPhotoError(false);
    setCustomFieldValues({});
    setDuplicateMatches([]);
    setShowDuplicateWarning(false);
    setIgnoreDuplicateWarning(false);
    setShowOptionalFields(false);
    setInlineScanSuccess(null);
    setError(null);
  };

  // Perform instant duplicate check on passport blur / change
  const handlePassportBlur = async () => {
    if (!passportNumber.trim()) return;
    try {
      const res = await api.checkDuplicateClient(passportNumber, fullName);
      if (res.has_duplicate) {
        setDuplicateMatches(res.matches);
        setShowDuplicateWarning(true);
      } else {
        setShowDuplicateWarning(false);
        setDuplicateMatches([]);
      }
    } catch (err) {
      // Ignore background check failure
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert('Photo file is too large. Please select an image under 8MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        setPhotoUrl(evt.target.result as string);
        setPhotoError(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !passportNumber.trim() || !country.trim()) {
      setError('Full Name, Passport Number, and Country are mandatory fields.');
      return;
    }

    // Check duplicates if not yet verified or ignored
    if (!ignoreDuplicateWarning) {
      try {
        const dupCheck = await api.checkDuplicateClient(passportNumber, fullName);
        if (dupCheck.has_duplicate) {
          setDuplicateMatches(dupCheck.matches);
          setShowDuplicateWarning(true);
          return;
        }
      } catch (err) {
        // Proceed
      }
    }

    setSubmitting(true);
    try {
      const newClient = await api.createClient({
        client_id: customClientId.trim() || undefined,
        full_name: fullName.trim(),
        passport_number: passportNumber.trim(),
        country: country.trim(),
        phone: phone || undefined,
        whatsapp: whatsapp || undefined,
        email: email || undefined,
        date_of_birth: dateOfBirth || undefined,
        address: address || undefined,
        occupation: occupation || undefined,
        notes: notes || undefined,
        google_drive_url: googleDriveUrl || undefined,
        photo_url: photoUrl || undefined,
        ignore_duplicate: ignoreDuplicateWarning,
        custom_fields: customFieldValues,
      });

      onClientCreated(newClient);
      onClose();
    } catch (err: any) {
      if (err.status === 409 && err.data?.matches) {
        setDuplicateMatches(err.data.matches);
        setShowDuplicateWarning(true);
      } else {
        setError(err.message || 'Failed to create client');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto cursor-pointer"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" />

      {/* Modal Card */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-lg">Create New Client</h2>
            <p className="text-xs text-sky-400">
              SN Travels Agency • Fast client registration for China visa processing
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Duplicate Warning Banner */}
        {showDuplicateWarning && (
          <div className="bg-amber-50 border-b border-amber-200 p-4 shrink-0">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-sm">
                <div className="font-semibold text-amber-900">
                  Possible existing client found
                </div>
                <div className="text-xs text-amber-700 mt-1">
                  A client with passport number <span className="font-mono font-bold">{passportNumber}</span> or matching details already exists in the system:
                </div>
                <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto">
                  {duplicateMatches.map((match) => (
                    <div
                      key={match.id}
                      className="bg-white border border-amber-300 rounded-lg p-2.5 flex items-center justify-between shadow-xs"
                    >
                      <div>
                        <div className="font-medium text-slate-900 text-xs">
                          {match.full_name} ({match.client_id})
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Passport: <span className="font-mono">{match.passport_number}</span> • {match.country}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenExistingClient(match.id);
                          onClose();
                        }}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium flex items-center gap-1 transition"
                      >
                        <span>Open Existing</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-amber-900 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={ignoreDuplicateWarning}
                      onChange={(e) => setIgnoreDuplicateWarning(e.target.checked)}
                      className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    <span>This is a different person or renewal case, continue creating</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* ICAO 9303 Passport Scanner Card */}
          <div className="bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-md border border-sky-800/40 space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-white flex items-center gap-2">
                    <span>ICAO 9303 Passport Scanner &amp; Autofill</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-400/30 uppercase tracking-wide">
                      100% Verified MRZ
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Local OCR &amp; Modulo-10 Checksums • Extracts Name, Passport Number, Country, Date of Birth, and Photo
                  </p>
                </div>
              </div>

              {onOpenPassportScanner && (
                <button
                  type="button"
                  onClick={onOpenPassportScanner}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow-xs transition shrink-0"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Open Camera</span>
                </button>
              )}
            </div>

            {inlineScanSuccess ? (
              <div className="bg-emerald-950/70 border border-emerald-500/40 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-300">Autofilled from Passport: </span>
                    <span className="text-white font-medium">{inlineScanSuccess.fullName}</span>
                    <span className="text-emerald-300 font-mono"> • {inlineScanSuccess.passportNumber}</span>
                    <span className="text-slate-300"> • {inlineScanSuccess.country}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInlineScanSuccess(null);
                    inlinePassportInputRef.current?.click();
                  }}
                  className="px-2.5 py-1 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-600/40 rounded-lg text-[11px] font-semibold transition self-end sm:self-auto"
                >
                  Scan Another
                </button>
              </div>
            ) : (
              <div
                onDrop={handleInlinePassportDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={() => inlinePassportInputRef.current?.click()}
                className="border-2 border-dashed border-sky-500/40 hover:border-sky-400 bg-slate-900/60 hover:bg-slate-900/90 rounded-xl p-3.5 text-center cursor-pointer transition flex flex-col sm:flex-row items-center justify-between gap-3"
              >
                <input
                  ref={inlinePassportInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleInlinePassportFileSelect}
                  className="hidden"
                />

                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                    {inlineScanning ? (
                      <Loader2 className="w-4 h-4 animate-spin text-sky-300" />
                    ) : (
                      <Upload className="w-4 h-4 text-sky-400" />
                    )}
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold text-white">
                      {inlineScanning ? inlineScanStatus : 'Drop passport photo here, or click to upload'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Supports JPG, PNG, WEBP, or phone camera
                    </div>
                  </div>
                </div>

                {onOpenPassportScanner && (
                  <div className="flex items-center gap-1.5 self-stretch sm:self-auto justify-end">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPassportScanner();
                      }}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Live Camera</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mandatory Section */}
          <div className="bg-sky-50/50 p-4 rounded-xl border border-sky-100 space-y-4">
            <div className="text-xs font-bold text-sky-900 uppercase tracking-wide flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-sky-700" />
              Mandatory Fields (Fast Entry)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Client Serial Number / ID
                    </label>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 border border-sky-200">
                      Auto-increment (+1)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {lastServerSerial !== null && (
                      <span className="text-[11px] text-slate-500">
                        Highest: <strong className="text-slate-800 font-mono">#{lastServerSerial}</strong> → Next: <strong className="text-sky-700 font-mono font-bold">#{Number(lastServerSerial) + 1}</strong>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={fetchNextSerial}
                      title="Reload next available serial number"
                      className="text-[11px] text-sky-600 hover:text-sky-800 font-medium hover:underline cursor-pointer"
                    >
                      {loadingNextSerial ? 'Checking...' : 'Auto-fill Next'}
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={customClientId}
                  onChange={(e) => setCustomClientId(e.target.value)}
                  placeholder="e.g. 22 or CL-000022..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Auto-filled with the next sequential serial number. You can also edit or customize this number directly.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ahmed Mohamed Al-Mansoor"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Passport Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={passportNumber}
                  onChange={(e) => setPassportNumber(e.target.value)}
                  onBlur={handlePassportBlur}
                  placeholder="e.g. P98421054"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
                />
              </div>

              <div>
                <CountrySelectSearch
                  countries={countries}
                  selectedCountry={country}
                  onSelectCountry={(c) => setCountry(c)}
                  required={true}
                  label="Country"
                  placeholder="Search country by name (e.g. UAE, Pakistan, Russia)..."
                />
              </div>
            </div>
          </div>

          {/* Toggle Optional Fields Button */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => setShowOptionalFields(!showOptionalFields)}
              className="text-xs text-sky-700 hover:text-sky-900 font-semibold flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{showOptionalFields ? 'Hide' : 'Add'} Optional Details & Google Drive Link</span>
            </button>
            <span className="text-[11px] text-slate-400">Can also be added later in profile</span>
          </div>

          {/* Optional Standard Fields */}
          {showOptionalFields && (
            <div className="space-y-4 pt-2 border-t border-slate-100 animate-in fade-in duration-100">
              {/* Google Drive Folder URL - Core Purpose */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="block text-xs font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-amber-600" />
                  Google Drive Folder URL
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Paste the manually created Google Drive folder link where client passport copies, visa photos, and invitation docs are stored.
                </p>
                <input
                  type="url"
                  value={googleDriveUrl}
                  onChange={(e) => setGoogleDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
                />
              </div>

              {/* Client Profile Photo / Visa Photo (Google Drive Shareable Link or Image URL) */}
              <div className="p-3.5 bg-sky-50/60 border border-sky-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-sky-950 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-sky-700" />
                    <span>Client Profile Picture / Visa Photo</span>
                  </label>
                  {isGoogleDriveLink(photoUrl) && (
                    <span className="text-[10px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Google Drive Link Auto-Detected
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-sky-900 leading-relaxed">
                  Paste any Google Drive shareable link (e.g. <code className="bg-white/80 px-1 py-0.5 rounded font-mono text-slate-700">https://drive.google.com/file/d/.../view?usp=sharing</code>) or direct image URL. The website will automatically render and preview the photo!
                </p>

                <div className="flex flex-col sm:flex-row gap-3 items-start">
                  <div className="flex-1 w-full space-y-2">
                    <input
                      type="url"
                      value={photoUrl}
                      onChange={(e) => {
                        setPhotoUrl(e.target.value);
                        setPhotoError(false);
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

                      {photoUrl.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setPhotoUrl('');
                            setPhotoError(false);
                          }}
                          className="text-red-600 hover:underline text-[11px]"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Live Photo Preview Box */}
                  {photoUrl.trim() && (
                    <div className="shrink-0 flex items-center gap-2.5 bg-white p-2 rounded-xl border border-sky-200 shadow-2xs">
                      <ClientAvatar
                        photoUrl={photoUrl}
                        fullName={fullName || 'Client'}
                        size="md"
                        allowPreview={true}
                        className="rounded-lg shadow-2xs"
                      />
                      <div className="text-left text-xs space-y-0.5">
                        <div className="font-bold text-slate-900 flex items-center gap-1 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Live Preview</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {isGoogleDriveLink(photoUrl)
                            ? 'Google Drive Image'
                            : photoUrl.startsWith('data:')
                            ? 'Uploaded Image'
                            : 'Web Image'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+971 50 123 4567"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    WhatsApp Number
                  </label>
                  <input
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="+971 50 123 4567"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Occupation
                  </label>
                  <input
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="e.g. Managing Director, Engineer"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Address / Residence
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="City, Residence area"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Internal Notes / Client Remarks
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Special requirements, urgent timeline, previous travel issues..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800"
                  />
                </div>
              </div>

              {/* Dynamic Custom Fields Section */}
              {customFields.length > 0 && (
                <div className="pt-3 border-t border-slate-200">
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3">
                    Configured Custom Profile Fields
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {customFields.map((field) => {
                      const val = customFieldValues[field.id] || '';

                      return (
                        <div
                          key={field.id}
                          className={field.field_type === 'long_text' ? 'sm:col-span-2' : ''}
                        >
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            {field.field_label} {field.is_required ? <span className="text-red-500">*</span> : null}
                          </label>

                          {field.field_type === 'dropdown' ? (
                            <select
                              value={val}
                              onChange={(e) =>
                                setCustomFieldValues({
                                  ...customFieldValues,
                                  [field.id]: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800"
                            >
                              <option value="">-- Select Option --</option>
                              {field.field_options?.split(',').map((opt, i) => (
                                <option key={i} value={opt.trim()}>
                                  {opt.trim()}
                                </option>
                              ))}
                            </select>
                          ) : field.field_type === 'long_text' ? (
                            <textarea
                              rows={2}
                              value={val}
                              onChange={(e) =>
                                setCustomFieldValues({
                                  ...customFieldValues,
                                  [field.id]: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800"
                            />
                          ) : field.field_type === 'checkbox' ? (
                            <label className="flex items-center gap-2 text-sm text-slate-700 mt-2">
                              <input
                                type="checkbox"
                                checked={val === 'Yes' || val === 'true'}
                                onChange={(e) =>
                                  setCustomFieldValues({
                                    ...customFieldValues,
                                    [field.id]: e.target.checked ? 'Yes' : 'No',
                                  })
                                }
                                className="rounded text-sky-600 focus:ring-sky-500"
                              />
                              <span>Yes</span>
                            </label>
                          ) : (
                            <input
                              type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                              value={val}
                              onChange={(e) =>
                                setCustomFieldValues({
                                  ...customFieldValues,
                                  [field.id]: e.target.value,
                                })
                              }
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Modal Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-sky-700 hover:bg-sky-800 disabled:bg-slate-300 text-white font-semibold text-sm rounded-lg shadow-sm transition flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Client...</span>
                </>
              ) : (
                <span>Create Client</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
