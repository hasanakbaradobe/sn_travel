import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  MessageCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Menu,
  X,
  Wifi,
  Car,
  Utensils,
  Coffee,
  ShieldCheck,
  Dumbbell,
  Waves,
  Sparkles,
  Plane,
  Briefcase,
  BedDouble,
  Maximize2,
  Users,
  ArrowLeft,
  Star,
  Search,
  Calendar,
  SlidersHorizontal,
  Columns,
  Check,
  Share2,
  Grid,
  Camera,
  Eye,
  ArrowUpRight,
} from 'lucide-react';
import {
  PublicWebsiteSnapshot,
  PublicSnapshotHotel,
  PublicSnapshotRoom,
} from '../types';

interface PublicHotelWebsiteRendererProps {
  snapshot: PublicWebsiteSnapshot | null;
  isPreview?: boolean;
  onExitPreview?: () => void;
}

const FACILITY_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Wifi,
  Car,
  Utensils,
  Coffee,
  ShieldCheck,
  Dumbbell,
  Waves,
  Sparkles,
  Plane,
  Briefcase,
  Building2,
};

function renderFacilityIcon(iconName: string, className = 'w-4 h-4') {
  const IconComp = FACILITY_ICON_MAP[iconName] || Sparkles;
  return <IconComp className={className} />;
}

function getFacilityIconByKeyword(label: string, className = 'w-4 h-4') {
  const lower = label.toLowerCase();
  if (lower.includes('wi-fi') || lower.includes('wifi') || lower.includes('internet')) {
    return <Wifi className={className} />;
  }
  if (lower.includes('pool') || lower.includes('swim') || lower.includes('spa')) {
    return <Waves className={className} />;
  }
  if (lower.includes('park') || lower.includes('shuttle') || lower.includes('transfer')) {
    return <Car className={className} />;
  }
  if (lower.includes('fitness') || lower.includes('gym')) {
    return <Dumbbell className={className} />;
  }
  if (lower.includes('restaurant') || lower.includes('kitchen') || lower.includes('dining')) {
    return <Utensils className={className} />;
  }
  if (lower.includes('bar') || lower.includes('coffee') || lower.includes('breakfast') || lower.includes('lounge')) {
    return <Coffee className={className} />;
  }
  if (lower.includes('airport')) {
    return <Plane className={className} />;
  }
  if (lower.includes('family') || lower.includes('guest')) {
    return <Users className={className} />;
  }
  if (lower.includes('24-hour') || lower.includes('front desk') || lower.includes('security')) {
    return <ShieldCheck className={className} />;
  }
  return <Check className={className} />;
}

function getDefaultDates() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const checkOut = new Date();
  checkOut.setDate(checkOut.getDate() + 4);
  return {
    checkIn: tomorrow.toISOString().slice(0, 10),
    checkOut: checkOut.toISOString().slice(0, 10),
  };
}

function calculateNightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 1;
  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return 1;
  return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface ExtractedHotelMeta {
  district: string;
  landmarkDistance: string;
  reviewScore: string | null;
  reviewLabel: string | null;
  reviewCount: string | null;
  perk: string | null;
  highlights: string[];
}

function extractHotelMeta(h: PublicSnapshotHotel): ExtractedHotelMeta {
  const combined = `${h.address || ''} | ${h.short_description || ''} | ${h.full_description || ''}`;
  let district = h.city || 'City Center';
  if (/KLCC|Kuala Lumpur City-Centre/i.test(combined)) {
    district = 'KLCC';
  } else if (/Bukit Bintang/i.test(combined)) {
    district = 'Bukit Bintang';
  } else if (/Chow Kit/i.test(combined)) {
    district = 'Chow Kit';
  } else if (/KL Sentral|Brickfields/i.test(combined)) {
    district = 'KL Sentral';
  }

  let landmarkDistance = '';
  const distMatch = (h.address || '').match(/\(([^)]+)\)/);
  if (distMatch && distMatch[1]) {
    landmarkDistance = distMatch[1].trim();
  }

  let reviewScore: string | null = null;
  let reviewLabel: string | null = null;
  let reviewCount: string | null = null;
  const scoreMatch = combined.match(
    /Score:\s*(\d+(?:\.\d+)?)\s*([A-Za-z ]+?)\s*\(([\d,]+)\s*reviews?\)/i
  );
  if (scoreMatch) {
    reviewScore = scoreMatch[1];
    reviewLabel = scoreMatch[2].trim();
    reviewCount = `${scoreMatch[3]} reviews`;
  }

  let perk: string | null = null;
  if (/Free cancellation/i.test(combined)) {
    perk = 'Free cancellation';
  } else if (/No prepayment needed/i.test(combined)) {
    perk = 'Pay at property';
  }

  const highlights: string[] =
    Array.isArray(h.amenities) && h.amenities.length > 0 ? [...h.amenities] : [];
  if (highlights.length === 0) {
    const knownAmenities = [
      'Free Wi-Fi',
      'Swimming pool',
      'Parking',
      'Fitness centre',
      'Restaurant',
      'Kitchen',
      'Airport shuttle',
      'Family rooms',
      '24-hour front desk',
      'Spa',
      'Bar',
      'Non-smoking rooms',
    ];
    knownAmenities.forEach((am) => {
      if (combined.toLowerCase().includes(am.toLowerCase())) {
        highlights.push(am);
      }
    });
  }

  return {
    district,
    landmarkDistance,
    reviewScore,
    reviewLabel,
    reviewCount,
    perk,
    highlights: highlights.slice(0, 6),
  };
}

function collectHotelPhotos(
  hotel: PublicSnapshotHotel,
  hotelRooms: PublicSnapshotRoom[],
  brokenUrls: Set<string>
): Array<{ url: string; caption: string; category: 'Hotel' | 'Rooms'; roomName?: string }> {
  const seen = new Set<string>();
  const list: Array<{ url: string; caption: string; category: 'Hotel' | 'Rooms'; roomName?: string }> = [];

  const pushPhoto = (
    url: string | undefined,
    caption: string,
    category: 'Hotel' | 'Rooms',
    roomName?: string
  ) => {
    const clean = normalizeGoogleShareUrl(url);
    if (!clean || seen.has(clean) || brokenUrls.has(clean)) return;
    seen.add(clean);
    list.push({ url: clean, caption, category, roomName });
  };

  pushPhoto(hotel.featured_image_url, `${hotel.name} — Exterior & Overview`, 'Hotel');
  (hotel.gallery_images || []).forEach((img, i) =>
    pushPhoto(img, `${hotel.name} — Property Photo ${i + 1}`, 'Hotel')
  );
  hotelRooms.forEach((rm) => {
    pushPhoto(rm.featured_image_url, `${rm.name} — ${hotel.name}`, 'Rooms', rm.name);
    (rm.gallery_images || []).forEach((img, i) =>
      pushPhoto(img, `${rm.name} (Photo ${i + 2})`, 'Rooms', rm.name)
    );
  });

  return list;
}

const DEFAULT_BRAND_LOGO_URL =
  'https://lh3.googleusercontent.com/d/1wJCY1RJCq0hASsYGGRnScbXDOW9YdPsM';

function extractDriveFileId(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const m1 = trimmed.match(/(?:drive|docs)\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (m1 && m1[1]) return m1[1];
  const m2 = trimmed.match(
    /(?:drive|docs|drive\.usercontent)\.google\.com\/(?:open|uc|thumbnail|download)\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)/i
  );
  if (m2 && m2[1]) return m2[1];
  const m3 = trimmed.match(/lh3\.googleusercontent\.com\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/i);
  if (m3 && m3[1]) return m3[1];
  return null;
}

function normalizeGoogleShareUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  const driveId = extractDriveFileId(trimmed);
  if (driveId) {
    return `https://lh3.googleusercontent.com/d/${driveId}`;
  }

  if (/google\.com\/imgres\?/i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const imgurl = parsed.searchParams.get('imgurl');
      if (imgurl && /^https?:\/\//i.test(imgurl)) {
        return imgurl.trim();
      }
    } catch {}
  }

  if (/dropbox\.com\/.+/i.test(trimmed) && trimmed.includes('dl=0')) {
    return trimmed.replace('dl=0', 'raw=1');
  }

  return trimmed;
}

function getResilientImageCandidates(rawUrl?: string | null): string[] {
  const raw = (rawUrl || '').trim();
  if (!raw) return [];
  if (raw.startsWith('data:image/')) return [raw];

  const fileId = extractDriveFileId(raw);
  if (fileId) {
    return [
      `https://lh3.googleusercontent.com/d/${fileId}=w1920`,
      `https://lh3.googleusercontent.com/d/${fileId}`,
      `/api/proxy-image?url=${encodeURIComponent(raw)}&fallback=404`,
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`,
      `https://drive.google.com/uc?export=view&id=${fileId}`,
    ];
  }

  if (
    /photos\.app\.goo\.gl|photos\.google\.com\/share|images\.app\.goo\.gl|goo\.gl\/images|drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\//i.test(
      raw
    )
  ) {
    return [`/api/proxy-image?url=${encodeURIComponent(raw)}&fallback=404`, raw];
  }

  if (/^https?:\/\//i.test(raw)) {
    return [raw, `/api/proxy-image?url=${encodeURIComponent(raw)}&fallback=404`];
  }

  return [raw];
}

const ResilientPublicImage: React.FC<{
  url: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  onClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
  onAllFailed?: (url: string) => void;
}> = ({ url, alt, className = 'w-full h-full object-cover', loading, onClick, onAllFailed }) => {
  const candidates = useMemo(() => getResilientImageCandidates(url), [url]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [url]);

  if (candidates.length === 0) return null;

  return (
    <img
      src={candidates[idx]}
      alt={alt}
      referrerPolicy="no-referrer"
      loading={loading}
      onClick={onClick}
      onError={() => {
        if (idx + 1 < candidates.length) {
          setIdx((prev) => prev + 1);
        } else {
          onAllFailed?.(url);
        }
      }}
      className={className}
    />
  );
};

function getLogoCandidateUrls(logoUrl?: string | null): string[] {
  const raw =
    logoUrl && typeof logoUrl === 'string' && logoUrl.trim()
      ? logoUrl.trim()
      : DEFAULT_BRAND_LOGO_URL;

  return getResilientImageCandidates(raw);
}

const BrandLogo: React.FC<{
  logoUrl?: string | null;
  brandName: string;
  size?: 'sm' | 'md';
}> = ({ logoUrl, brandName, size = 'md' }) => {
  const candidates = useMemo(() => getLogoCandidateUrls(logoUrl), [logoUrl]);
  const [candidateIdx, setCandidateIdx] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  useEffect(() => {
    setCandidateIdx(0);
    setAllFailed(false);
  }, [logoUrl]);

  const sizeClasses =
    size === 'sm' ? 'h-8 sm:h-9 w-auto max-w-[120px]' : 'h-9 sm:h-10 w-auto max-w-[140px]';

  if (allFailed || candidates.length === 0) {
    return (
      <div
        className={`${
          size === 'sm' ? 'w-8 h-8 text-sm' : 'w-9 h-9 sm:w-10 sm:h-10 text-base'
        } rounded-xl bg-zinc-900 text-white flex items-center justify-center font-display font-bold shadow-xs shrink-0`}
      >
        {(brandName || 'S').charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={candidates[candidateIdx]}
      alt={brandName}
      referrerPolicy="no-referrer"
      className={`${sizeClasses} object-contain shrink-0 rounded-lg`}
      onError={() => {
        if (candidateIdx + 1 < candidates.length) {
          setCandidateIdx((prev) => prev + 1);
        } else {
          setAllFailed(true);
        }
      }}
    />
  );
};

// Minimalist Architectural Visual Fallback Canvas when a hotel or room has no uploaded photos yet
const ArchitecturalHotelCanvas: React.FC<{
  hotel: PublicSnapshotHotel;
  meta: ExtractedHotelMeta;
  roomCount: number;
  variant?: 'card' | 'banner';
}> = ({ hotel, meta, roomCount, variant = 'card' }) => {
  const palettes = [
    'from-zinc-900 via-zinc-800 to-stone-900',
    'from-slate-900 via-zinc-900 to-neutral-800',
    'from-neutral-900 via-stone-900 to-zinc-800',
    'from-zinc-950 via-neutral-900 to-slate-900',
  ];
  const bgGradient = palettes[hotel.id % palettes.length];

  return (
    <div
      className={`w-full h-full bg-gradient-to-br ${bgGradient} text-white relative overflow-hidden flex flex-col justify-between ${
        variant === 'banner' ? 'p-6 sm:p-10' : 'p-5'
      }`}
    >
      {/* Subtle Minimalist Architectural Line Grid SVG */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.07] pointer-events-none"
        viewBox="0 0 400 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <path d="M0 60H400M0 120H400M0 180H400M0 240H400" stroke="currentColor" strokeWidth="1" />
        <path d="M80 0V300M160 0V300M240 0V300M320 0V300" stroke="currentColor" strokeWidth="1" />
        <rect x="110" y="70" width="70" height="230" stroke="currentColor" strokeWidth="1.5" />
        <rect x="195" y="40" width="95" height="260" stroke="currentColor" strokeWidth="1.5" />
        <rect x="60" y="130" width="45" height="170" stroke="currentColor" strokeWidth="1.2" />
      </svg>

      {/* Top Row: District & Star Rating */}
      <div className="relative z-10 flex items-center justify-between gap-2 text-xs text-zinc-300">
        <span className="font-medium tracking-wide">{meta.district}</span>
        <span className="font-mono text-[11px] text-zinc-400">
          {hotel.star_rating || 4}★ Property
        </span>
      </div>

      {/* Bottom Row: Architectural Label & Highlights */}
      <div className="relative z-10 space-y-2 mt-auto pt-8">
        <div className="w-8 h-px bg-zinc-500" />
        <p className="font-display font-semibold text-white text-sm sm:text-base leading-snug line-clamp-2">
          {hotel.name}
        </p>
        <p className="text-[11px] text-zinc-400 truncate">
          {roomCount > 0
            ? `${roomCount} Room Categor${roomCount === 1 ? 'y' : 'ies'} Available`
            : meta.landmarkDistance || `${hotel.city || 'Kuala Lumpur'}`}
        </p>
      </div>
    </div>
  );
};

export const PublicHotelWebsiteRenderer: React.FC<PublicHotelWebsiteRendererProps> = ({
  snapshot,
  isPreview = false,
  onExitPreview,
}) => {
  const defaultDates = useMemo(() => getDefaultDates(), []);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileDatesDrawerOpen, setMobileDatesDrawerOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [activeGalleryCategory, setActiveGalleryCategory] = useState<string>('All');
  const [hotelPagePhotoTab, setHotelPagePhotoTab] = useState<'All' | 'Rooms' | 'Hotel'>('All');
  const [brokenImageUrls, setBrokenImageUrls] = useState<Set<string>>(() => new Set());

  const markImageBroken = (url: string) => {
    if (!url) return;
    setBrokenImageUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  };

  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    title: string;
    caption: string;
    list?: Array<{ url: string; caption: string; category?: string; roomName?: string }>;
    index?: number;
  } | null>(null);

  // Interactive Search & Directory Filter State
  const [hotelSearchQuery, setHotelSearchQuery] = useState('');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('All');
  const [selectedStarFilter, setSelectedStarFilter] = useState<number | 'All'>('All');
  const [selectedBudgetBracket, setSelectedBudgetBracket] = useState<
    'all' | 'tier1' | 'tier2' | 'tier3'
  >('all');
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'stars_desc'>(
    'featured'
  );

  // Stay Dates & Guests State
  const [checkInDate, setCheckInDate] = useState<string>(defaultDates.checkIn);
  const [checkOutDate, setCheckOutDate] = useState<string>(defaultDates.checkOut);
  const [guestsCount, setGuestsCount] = useState<number>(2);
  const [roomsCount, setRoomsCount] = useState<number>(1);
  const [specialRequests, setSpecialRequests] = useState<string>('');

  // Card Carousel Index Map (hotelId -> current photo index)
  const [cardPhotoIndices, setCardPhotoIndices] = useState<Record<number, number>>({});

  // Mobile Hotel Header Active Photo Index
  const [mobileHeroPhotoIdx, setMobileHeroPhotoIdx] = useState<number>(0);

  // Selected Hotel Page Slug
  const [activeHotelSlug, setActiveHotelSlug] = useState<string | null>(null);

  // Room Comparison State inside a Hotel Page
  const [compareRoomIds, setCompareRoomIds] = useState<number[]>([]);
  const [showComparisonMatrix, setShowComparisonMatrix] = useState<boolean>(false);

  // Selected Room Type for the Sticky Booking / WhatsApp Calculator on Hotel Page
  const [bookingRoomId, setBookingRoomId] = useState<number | null>(null);

  // Room Detail Modal State
  const [activeRoomModal, setActiveRoomModal] = useState<{
    room: PublicSnapshotRoom;
    hotel?: PublicSnapshotHotel | null;
    activePhotoIdx: number;
  } | null>(null);

  // Per-room active photo index on hotel detail page
  const [roomPhotoIndices, setRoomPhotoIndices] = useState<Record<number, number>>({});

  // Share link feedback
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  // Touch swipe coordinate ref for mobile carousels
  const touchStartXRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches && e.touches.length > 0) {
      touchStartXRef.current = e.touches[0].clientX;
    }
  };

  const handleTouchEnd = (
    e: React.TouchEvent,
    onSwipeLeftNext: () => void,
    onSwipeRightPrev: () => void
  ) => {
    if (touchStartXRef.current === null || !e.changedTouches || e.changedTouches.length === 0) {
      return;
    }
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(deltaX) > 35) {
      if (deltaX < 0) {
        onSwipeLeftNext();
      } else {
        onSwipeRightPrev();
      }
    }
  };

  const stayNights = useMemo(
    () => calculateNightsBetween(checkInDate, checkOutDate),
    [checkInDate, checkOutDate]
  );

  // Sync URL hash `#hotel/<slug>` for automatic dedicated hotel pages
  useEffect(() => {
    const readHash = () => {
      const hash = window.location.hash || '';
      if (hash.startsWith('#hotel/')) {
        const slug = decodeURIComponent(hash.replace('#hotel/', '').trim());
        if (slug) {
          setActiveHotelSlug(slug);
          setMobileHeroPhotoIdx(0);
          setHotelPagePhotoTab('All');
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }
      setActiveHotelSlug(null);
    };

    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, []);

  const navigateToHotelPage = (slug: string | null) => {
    setActiveHotelSlug(slug);
    setCompareRoomIds([]);
    setShowComparisonMatrix(false);
    setBookingRoomId(null);
    setMobileHeroPhotoIdx(0);
    setHotelPagePhotoTab('All');
    if (typeof window !== 'undefined') {
      if (slug) {
        window.location.hash = `#hotel/${slug}`;
      } else {
        if (window.location.hash.startsWith('#hotel/')) {
          window.history.pushState(null, '', window.location.pathname + window.location.search);
        }
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (!snapshot || !snapshot.is_configured) {
    return (
      <div className="public-site-modern min-h-screen bg-zinc-50 text-zinc-900 flex flex-col items-center justify-center p-6 text-center">
        {isPreview && onExitPreview && (
          <div className="fixed top-4 right-4 z-50">
            <button
              onClick={onExitPreview}
              className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-medium shadow-sm hover:bg-zinc-800 transition cursor-pointer"
            >
              Exit Preview
            </button>
          </div>
        )}
        <div className="max-w-md space-y-4 bg-white p-8 rounded-2xl border border-zinc-200/80 shadow-xs">
          <div className="w-11 h-11 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mx-auto text-zinc-800">
            <Building2 className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-display font-bold tracking-tight text-zinc-900">
            Public Hotel Directory Setup Pending
          </h1>
          <p className="text-sm text-zinc-500 leading-relaxed">
            This public hotel showcase has not yet been configured or published. Open{' '}
            <strong className="text-zinc-800">Public Website</strong> in your CRM dashboard, sync or add your hotels, and publish your first snapshot.
          </p>
        </div>
      </div>
    );
  }

  const { hotel, homepage, navigation, pages, rooms, facilities, gallery, faqs } = snapshot;
  const hotels: PublicSnapshotHotel[] = Array.isArray(snapshot.hotels) ? snapshot.hotels : [];

  const getPage = (slug: string) => pages.find((p) => p.slug === slug);

  // Compute lowest room price for a hotel
  const getHotelStartingPrice = (
    h: PublicSnapshotHotel
  ): { price: number | null; currency: string } => {
    const hRooms = rooms.filter(
      (r) => r.hotel_id === h.id && r.optional_price !== null && r.optional_price > 0
    );
    if (hRooms.length > 0) {
      const minRoom = hRooms.reduce((min, r) =>
        (r.optional_price ?? Infinity) < (min.optional_price ?? Infinity) ? r : min
      );
      return { price: minRoom.optional_price, currency: minRoom.currency || h.currency || 'MYR' };
    }
    return { price: h.starting_price, currency: h.currency || 'MYR' };
  };

  // Detect primary currency across hotels for smart price filter labels
  const primaryCurrency = useMemo(() => {
    for (const h of hotels) {
      const { currency } = getHotelStartingPrice(h);
      if (currency) return currency;
    }
    return 'MYR';
  }, [hotels, rooms]);

  // Unique areas / cities for quick filtering (includes both cities and KL districts like KLCC, Bukit Bintang)
  const areaFilters = useMemo(() => {
    const set = new Set<string>();
    hotels.forEach((h) => {
      if (h.city && h.city.trim()) set.add(h.city.trim());
      const meta = extractHotelMeta(h);
      if (meta.district && meta.district !== h.city) {
        set.add(meta.district);
      }
    });
    return ['All', ...Array.from(set)];
  }, [hotels]);

  // Filtered & Sorted Hotels
  const filteredHotels = useMemo(() => {
    const list = hotels.filter((h) => {
      const meta = extractHotelMeta(h);
      if (selectedAreaFilter !== 'All') {
        const matchesCity = h.city.trim().toLowerCase() === selectedAreaFilter.toLowerCase();
        const matchesDistrict = meta.district.toLowerCase() === selectedAreaFilter.toLowerCase();
        if (!matchesCity && !matchesDistrict) return false;
      }
      if (selectedStarFilter !== 'All' && (h.star_rating || 4) < selectedStarFilter) {
        return false;
      }
      const { price } = getHotelStartingPrice(h);
      if (selectedBudgetBracket !== 'all') {
        if (price === null) return false;
        if (selectedBudgetBracket === 'tier1' && price > 110) return false;
        if (selectedBudgetBracket === 'tier2' && (price <= 110 || price > 200)) return false;
        if (selectedBudgetBracket === 'tier3' && price <= 200) return false;
      }
      if (!hotelSearchQuery.trim()) return true;
      const q = hotelSearchQuery.toLowerCase().trim();
      const hotelRooms = rooms.filter((r) => r.hotel_id === h.id);
      const roomMatch = hotelRooms.some(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.short_description.toLowerCase().includes(q)
      );
      return (
        h.name.toLowerCase().includes(q) ||
        h.city.toLowerCase().includes(q) ||
        meta.district.toLowerCase().includes(q) ||
        h.country.toLowerCase().includes(q) ||
        h.address.toLowerCase().includes(q) ||
        h.short_description.toLowerCase().includes(q) ||
        roomMatch
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'price_asc') {
        const pa = getHotelStartingPrice(a).price ?? Number.MAX_SAFE_INTEGER;
        const pb = getHotelStartingPrice(b).price ?? Number.MAX_SAFE_INTEGER;
        return pa - pb;
      }
      if (sortBy === 'price_desc') {
        const pa = getHotelStartingPrice(a).price ?? 0;
        const pb = getHotelStartingPrice(b).price ?? 0;
        return pb - pa;
      }
      if (sortBy === 'stars_desc') {
        return (b.star_rating || 4) - (a.star_rating || 4);
      }
      if (a.is_featured !== b.is_featured) {
        return b.is_featured ? 1 : -1;
      }
      return a.display_order - b.display_order;
    });
  }, [
    hotels,
    rooms,
    selectedAreaFilter,
    selectedStarFilter,
    selectedBudgetBracket,
    hotelSearchQuery,
    sortBy,
  ]);

  // Currently selected hotel for dedicated Hotel Detail Page
  const activeHotel = useMemo(() => {
    if (!activeHotelSlug) return null;
    return (
      hotels.find(
        (h) =>
          h.slug.toLowerCase() === activeHotelSlug.toLowerCase() ||
          String(h.id) === activeHotelSlug
      ) || null
    );
  }, [hotels, activeHotelSlug]);

  // Rooms belonging to the active hotel
  const activeHotelRooms = useMemo(() => {
    if (!activeHotel) return [];
    return rooms.filter((r) => r.hotel_id === activeHotel.id);
  }, [rooms, activeHotel]);

  const galleryCategories = useMemo(() => {
    const cats = new Set<string>();
    gallery.forEach((item) => {
      if (item.category && item.category.trim()) cats.add(item.category.trim());
    });
    return ['All', ...Array.from(cats)];
  }, [gallery]);

  const filteredGallery = useMemo(() => {
    const validGallery = gallery.filter((g) => g.image_url && !brokenImageUrls.has(g.image_url));
    if (activeGalleryCategory === 'All') return validGallery;
    return validGallery.filter((g) => g.category === activeGalleryCategory);
  }, [gallery, activeGalleryCategory, brokenImageUrls]);

  // Helper to build a pre-filled WhatsApp or Email booking URL
  const buildWhatsAppBookingUrl = (opts: {
    targetHotel?: PublicSnapshotHotel | null;
    targetRoom?: PublicSnapshotRoom | null;
    customNotes?: string;
  }) => {
    const h = opts.targetHotel;
    const r = opts.targetRoom;
    const rawWa = (
      h?.whatsapp_number ||
      h?.contact_phone ||
      hotel.whatsapp_number ||
      hotel.contact_phone ||
      ''
    ).replace(/[^0-9]/g, '');

    const unitPrice = r?.optional_price ?? (h ? getHotelStartingPrice(h).price : null);
    const currency = r?.currency || h?.currency || primaryCurrency;
    const estimatedTotal =
      unitPrice !== null
        ? `${currency} ${(unitPrice * stayNights * roomsCount).toLocaleString()}`
        : 'Please quote rate';

    const lines = [
      `Hello ${hotel.name || 'Reservations Team'}, I would like to enquire about a hotel booking:`,
      '',
      h ? `*Hotel:* ${h.name}${h.city ? ` (${h.city})` : ''}` : `*Collection:* ${hotel.name}`,
      h?.address ? `*Location:* ${h.address}` : '',
      r
        ? `*Room Type:* ${r.name}${r.bed_type ? ` (${r.bed_type})` : ''}`
        : '*Room Type:* Best Available Room',
      unitPrice !== null ? `*Nightly Rate:* ${currency} ${unitPrice} / night` : '',
      `*Check-In:* ${checkInDate}`,
      `*Check-Out:* ${checkOutDate} (${stayNights} Night${stayNights === 1 ? '' : 's'})`,
      `*Rooms & Guests:* ${roomsCount} Room${roomsCount === 1 ? '' : 's'}, ${guestsCount} Guest${
        guestsCount === 1 ? '' : 's'
      }`,
      unitPrice !== null ? `*Estimated Total:* ${estimatedTotal}` : '',
      opts.customNotes || specialRequests
        ? `*Special Requests:* ${opts.customNotes || specialRequests}`
        : '',
    ].filter(Boolean);

    const encodedText = encodeURIComponent(lines.join('\n'));

    if (rawWa) {
      return `https://wa.me/${rawWa}?text=${encodedText}`;
    }

    const emailTarget = h?.contact_email || hotel.contact_email;
    if (emailTarget) {
      const subject = encodeURIComponent(
        `Hotel Booking Enquiry: ${h ? h.name : hotel.name}${
          r ? ` - ${r.name}` : ''
        } (${checkInDate} to ${checkOutDate})`
      );
      return `mailto:${emailTarget}?subject=${subject}&body=${encodedText}`;
    }

    return '#contact';
  };

  const toggleRoomCompare = (roomId: number) => {
    setCompareRoomIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId]
    );
  };

  const handleShareHotelPage = (h: PublicSnapshotHotel) => {
    if (typeof window === 'undefined') return;
    const shareUrl = `${window.location.origin}${window.location.pathname}#hotel/${h.slug}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopiedShareLink(true);
        setTimeout(() => setCopiedShareLink(false), 3000);
      });
    }
  };

  // Build concise header links (strict 3-zone top bar contract: max 5 concise single-line links)
  const visibleHeaderLinks = useMemo(() => {
    const baseLinks = navigation.header_links.filter((l) => l.visible);
    if (hotels.length > 0 && !baseLinks.some((l) => l.href === '#hotels')) {
      const result = [...baseLinks];
      const roomsIdx = result.findIndex((l) => l.href === '#rooms');
      if (roomsIdx !== -1) {
        result[roomsIdx] = { label: 'Hotels', href: '#hotels', visible: true };
      } else {
        result.splice(1, 0, { label: 'Hotels', href: '#hotels', visible: true });
      }
      return result.slice(0, 5);
    }
    return baseLinks.slice(0, 5);
  }, [navigation.header_links, hotels.length]);

  const hasActiveFilters =
    selectedAreaFilter !== 'All' ||
    selectedStarFilter !== 'All' ||
    selectedBudgetBracket !== 'all' ||
    hotelSearchQuery.trim() !== '';

  const resetAllFilters = () => {
    setSelectedAreaFilter('All');
    setSelectedStarFilter('All');
    setSelectedBudgetBracket('all');
    setHotelSearchQuery('');
  };

  // ============================================================================
  // SHARED LIGHTBOX & ROOM MODAL RENDERERS (MINIMAL MODERN + TOUCH SWIPE)
  // ============================================================================
  const renderRoomDetailModal = (targetHotelFallback?: PublicSnapshotHotel | null) => {
    if (!activeRoomModal) return null;
    const rm = activeRoomModal.room;
    const modalHotel = activeRoomModal.hotel || targetHotelFallback || null;
    const rmPhotos = Array.from(
      new Set(
        [rm.featured_image_url, ...(rm.gallery_images || [])]
          .map((u) => normalizeGoogleShareUrl(u))
          .filter((u) => Boolean(u) && !brokenImageUrls.has(u))
      )
    );
    const activeIdx = Math.min(activeRoomModal.activePhotoIdx, Math.max(0, rmPhotos.length - 1));
    const curPhoto = rmPhotos[activeIdx] || rmPhotos[0] || '';

    const goNext = () => {
      if (rmPhotos.length <= 1) return;
      setActiveRoomModal({
        ...activeRoomModal,
        activePhotoIdx: (activeIdx + 1) % rmPhotos.length,
      });
    };

    const goPrev = () => {
      if (rmPhotos.length <= 1) return;
      setActiveRoomModal({
        ...activeRoomModal,
        activePhotoIdx: (activeIdx - 1 + rmPhotos.length) % rmPhotos.length,
      });
    };

    const metaParts = [rm.capacity, rm.bed_type, rm.room_size].filter(Boolean);

    return (
      <div
        className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4"
        onClick={() => setActiveRoomModal(null)}
      >
        <div
          className="bg-white rounded-t-2xl sm:rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto border border-zinc-200 shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sticky Header */}
          <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-5 py-3.5 flex items-center justify-between border-b border-zinc-200/80">
            <div className="min-w-0 pr-3">
              {modalHotel && (
                <span className="text-xs text-zinc-500 block truncate">{modalHotel.name}</span>
              )}
              <h3 className="text-base font-display font-bold text-zinc-900 truncate">{rm.name}</h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveRoomModal(null)}
              className="w-9 h-9 rounded-full bg-zinc-100 text-zinc-700 hover:bg-zinc-200 flex items-center justify-center cursor-pointer shrink-0"
              aria-label="Close room details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Swipeable Room Image Viewer */}
          {curPhoto && (
            <div
              className="relative aspect-[4/3] sm:aspect-[16/10] bg-zinc-950 overflow-hidden select-none"
              onTouchStart={handleTouchStart}
              onTouchEnd={(e) => handleTouchEnd(e, goNext, goPrev)}
            >
              <ResilientPublicImage
                url={curPhoto}
                alt={`${rm.name} photo ${activeIdx + 1}`}
                onAllFailed={markImageBroken}
                className="w-full h-full object-contain"
              />

              {rmPhotos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-zinc-900 flex items-center justify-center hover:bg-white shadow-md cursor-pointer"
                    aria-label="Previous room photo"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-zinc-900 flex items-center justify-center hover:bg-white shadow-md cursor-pointer"
                    aria-label="Next room photo"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-md bg-zinc-950/75 text-white text-xs font-mono tabular-nums">
                    {activeIdx + 1} / {rmPhotos.length}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Room Photo Thumbnail Strip */}
          {rmPhotos.length > 1 && (
            <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-200/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
              {rmPhotos.map((u, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() =>
                    setActiveRoomModal({ ...activeRoomModal, activePhotoIdx: idx })
                  }
                  className={`w-16 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition cursor-pointer ${
                    activeIdx === idx
                      ? 'border-zinc-900 opacity-100'
                      : 'border-transparent opacity-60 hover:opacity-90'
                  }`}
                >
                  <ResilientPublicImage
                    url={u}
                    alt={`${rm.name} thumb ${idx + 1}`}
                    onAllFailed={markImageBroken}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Room Details & Instant WhatsApp Booking Footer */}
          <div className="p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h4 className="text-xl font-display font-bold text-zinc-900">{rm.name}</h4>
                {metaParts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 mt-1">
                    {metaParts.map((part, idx) => (
                      <React.Fragment key={idx}>
                        {idx > 0 && <span aria-hidden="true">·</span>}
                        <span>{part}</span>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>

              {rm.optional_price !== null && (
                <div className="text-left sm:text-right">
                  <span className="text-xl font-display font-bold text-zinc-900 font-mono tabular-nums">
                    {rm.currency} {rm.optional_price}
                  </span>
                  <span className="text-xs text-zinc-500"> / night</span>
                  <span className="block text-xs text-zinc-500 font-mono tabular-nums">
                    {stayNights}N total: {rm.currency}{' '}
                    {(rm.optional_price * stayNights * roomsCount).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {(rm.full_description || rm.short_description) && (
              <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-line">
                {rm.full_description || rm.short_description}
              </p>
            )}

            {rm.amenities && rm.amenities.length > 0 && (
              <div className="space-y-2.5 pt-4 border-t border-zinc-200/80">
                <span className="text-xs font-semibold text-zinc-900 block">Room Amenities</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {rm.amenities.map((am, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-zinc-600">
                      <Check className="w-3.5 h-3.5 text-zinc-900 shrink-0" />
                      <span>{am}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-zinc-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setActiveRoomModal(null)}
                className="px-4 py-2.5 rounded-xl border border-zinc-300 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer"
              >
                Close
              </button>
              <a
                href={buildWhatsAppBookingUrl({
                  targetHotel: modalHotel,
                  targetRoom: rm,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Book {rm.name} on WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFullLightboxModal = () => {
    if (!lightboxImage) return null;
    const hasList =
      lightboxImage.list &&
      lightboxImage.list.length > 1 &&
      typeof lightboxImage.index === 'number';

    const goNext = () => {
      if (!hasList) return;
      const list = lightboxImage.list!;
      const nextIdx = (lightboxImage.index! + 1) % list.length;
      setLightboxImage({
        ...lightboxImage,
        url: list[nextIdx].url,
        caption: list[nextIdx].caption,
        index: nextIdx,
      });
    };

    const goPrev = () => {
      if (!hasList) return;
      const list = lightboxImage.list!;
      const nextIdx = (lightboxImage.index! - 1 + list.length) % list.length;
      setLightboxImage({
        ...lightboxImage,
        url: list[nextIdx].url,
        caption: list[nextIdx].caption,
        index: nextIdx,
      });
    };

    return (
      <div
        className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-xs flex flex-col justify-between p-4 sm:p-6"
        onClick={() => setLightboxImage(null)}
      >
        <div
          className="max-w-5xl w-full mx-auto flex items-center justify-between text-white gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="min-w-0">
            <span className="text-xs sm:text-sm font-medium text-white block truncate">
              {lightboxImage.caption || lightboxImage.title}
            </span>
            {hasList && (
              <span className="text-xs font-mono text-zinc-400 tabular-nums">
                {lightboxImage.index! + 1} / {lightboxImage.list!.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="w-9 h-9 rounded-full bg-zinc-800 text-white hover:bg-zinc-700 flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Close gallery"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          className="relative max-w-5xl w-full mx-auto my-auto flex items-center justify-center select-none"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={handleTouchStart}
          onTouchEnd={(e) => handleTouchEnd(e, goNext, goPrev)}
        >
          <ResilientPublicImage
            url={lightboxImage.url}
            alt={lightboxImage.title}
            onAllFailed={markImageBroken}
            className="w-full max-h-[72vh] sm:max-h-[76vh] object-contain rounded-xl"
          />

          {hasList && (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-zinc-900 flex items-center justify-center hover:bg-white shadow-lg cursor-pointer"
                aria-label="Previous photo"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 text-zinc-900 flex items-center justify-center hover:bg-white shadow-lg cursor-pointer"
                aria-label="Next photo"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {hasList && (
          <div
            className="max-w-5xl w-full mx-auto pt-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 overflow-x-auto py-1.5 no-scrollbar">
              {lightboxImage.list!.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() =>
                    setLightboxImage({
                      ...lightboxImage,
                      url: item.url,
                      caption: item.caption,
                      index: idx,
                    })
                  }
                  className={`w-14 h-10 sm:w-16 sm:h-12 rounded-lg overflow-hidden shrink-0 border-2 transition cursor-pointer ${
                    lightboxImage.index === idx
                      ? 'border-white opacity-100'
                      : 'border-transparent opacity-45 hover:opacity-80'
                  }`}
                >
                  <ResilientPublicImage
                    url={item.url}
                    alt={item.caption}
                    onAllFailed={markImageBroken}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // DEDICATED INDIVIDUAL HOTEL PAGE VIEW (#hotel/<slug>)
  // ============================================================================
  if (activeHotel) {
    const allHotelPhotos = collectHotelPhotos(activeHotel, activeHotelRooms, brokenImageUrls);
    const filteredHotelPhotos =
      hotelPagePhotoTab === 'All'
        ? allHotelPhotos
        : allHotelPhotos.filter((p) => p.category === hotelPagePhotoTab);
    const displayPhotos =
      filteredHotelPhotos.length > 0 ? filteredHotelPhotos : allHotelPhotos;

    const safeMobileIdx = Math.min(mobileHeroPhotoIdx, Math.max(0, displayPhotos.length - 1));
    const currentMobileHeroPhoto = displayPhotos[safeMobileIdx] || displayPhotos[0];

    const hotelMeta = extractHotelMeta(activeHotel);
    const hotelPhone = activeHotel.contact_phone || hotel.contact_phone;
    const hotelEmail = activeHotel.contact_email || hotel.contact_email;
    const hotelCheckIn = activeHotel.check_in_time || hotel.check_in_time || '14:00';
    const hotelCheckOut = activeHotel.check_out_time || hotel.check_out_time || '12:00';
    const hotelMapsUrl = activeHotel.google_maps_url || hotel.google_maps_url;
    const hotelMapsEmbed = activeHotel.google_maps_embed_url || hotel.google_maps_embed_url;

    const selectedBookingRoom =
      activeHotelRooms.find((r) => r.id === bookingRoomId) || activeHotelRooms[0] || null;
    const selectedUnitPrice =
      selectedBookingRoom?.optional_price ?? getHotelStartingPrice(activeHotel).price;
    const selectedCurrency =
      selectedBookingRoom?.currency || activeHotel.currency || primaryCurrency;

    const roomsToCompare =
      compareRoomIds.length > 0
        ? activeHotelRooms.filter((r) => compareRoomIds.includes(r.id))
        : activeHotelRooms;

    const roomPhotoCount = allHotelPhotos.filter((p) => p.category === 'Rooms').length;
    const propertyPhotoCount = allHotelPhotos.filter((p) => p.category === 'Hotel').length;

    return (
      <div className="public-site-modern min-h-screen bg-white text-zinc-900 selection:bg-zinc-900 selection:text-white pb-24 lg:pb-0">
        {/* Preview Mode Banner */}
        {isPreview && (
          <div className="sticky top-0 z-50 bg-zinc-900 text-zinc-100 px-4 py-2 text-xs flex items-center justify-between gap-2 border-b border-zinc-800">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-zinc-400 shrink-0">Draft Preview</span>
              <span aria-hidden="true">·</span>
              <span className="text-zinc-200 truncate">{activeHotel.name}</span>
            </div>
            {onExitPreview && (
              <button
                onClick={onExitPreview}
                className="px-2.5 py-1 rounded-md bg-white text-zinc-900 font-semibold hover:bg-zinc-100 transition cursor-pointer shrink-0"
              >
                Exit Preview
              </button>
            )}
          </div>
        )}

        {/* Strict 3-Zone Top Bar */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
            {/* Zone 1: Back to Directory + Brand Logo & Tagline */}
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button
                onClick={() => navigateToHotelPage(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200/80 text-xs sm:text-sm font-display font-semibold text-zinc-900 transition cursor-pointer whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>All Hotels ({hotels.length})</span>
              </button>

              <a
                href="#home"
                onClick={(e) => {
                  e.preventDefault();
                  navigateToHotelPage(null);
                }}
                className="hidden sm:flex items-center gap-2.5 min-w-0 border-l border-zinc-200 pl-3 sm:pl-4"
              >
                <BrandLogo logoUrl={hotel.logo_url} brandName={hotel.name} size="sm" />
                <div className="min-w-0 leading-tight">
                  <span className="block text-sm font-display font-bold tracking-tight text-zinc-900 truncate">
                    {hotel.name}
                  </span>
                  <span className="block text-[11px] font-medium text-zinc-500 truncate">
                    {hotel.tagline
                      ? `${hotel.tagline} · ${hotels.length} Partner Hotels Directory`
                      : `${hotels.length} Partner Hotels Directory`}
                  </span>
                </div>
              </a>
            </div>

            {/* Zone 2: Section Jump Links */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-600">
              <a
                href="#hotel-rooms"
                className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0"
              >
                Rooms & Rates
              </a>
              <a
                href="#hotel-overview"
                className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0"
              >
                Overview & Amenities
              </a>
              <button
                type="button"
                onClick={() => handleShareHotelPage(activeHotel)}
                className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedShareLink ? 'Link Copied' : 'Share Hotel'}
              </button>
            </nav>

            {/* Zone 3: Primary CTA */}
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={buildWhatsAppBookingUrl({
                  targetHotel: activeHotel,
                  targetRoom: selectedBookingRoom,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition whitespace-nowrap shrink-0"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>WhatsApp Booking</span>
              </a>
            </div>
          </div>
        </header>

        {/* Hotel Title, Unboxed Metadata & Photo Gallery Header */}
        <section className="border-b border-zinc-200/80 pt-6 sm:pt-8 pb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            {/* Title & Clean Unboxed Metadata Row */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="space-y-2 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span className="font-medium text-zinc-900">
                    {activeHotel.star_rating || 4}★ Hotel
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{hotelMeta.district}</span>
                  {activeHotel.city && hotelMeta.district !== activeHotel.city && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{activeHotel.city}</span>
                    </>
                  )}
                  {hotelMeta.reviewScore && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-semibold text-zinc-900">
                        ★ {hotelMeta.reviewScore} {hotelMeta.reviewLabel}
                      </span>
                      {hotelMeta.reviewCount && <span>({hotelMeta.reviewCount})</span>}
                    </>
                  )}
                  {hotelMeta.perk && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-emerald-700 font-medium">{hotelMeta.perk}</span>
                    </>
                  )}
                </div>

                <h1 className="text-2xl sm:text-4xl font-display font-bold text-zinc-900 tracking-tight text-balance">
                  {activeHotel.name}
                </h1>

                {activeHotel.address && (
                  <p className="text-xs sm:text-sm text-zinc-500 flex flex-wrap items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span>{activeHotel.address}</span>
                    {hotelMapsUrl && (
                      <a
                        href={hotelMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-zinc-900 underline underline-offset-2 inline-flex items-center gap-1 ml-1"
                      >
                        <span>Map</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </a>
                    )}
                  </p>
                )}
              </div>

              {/* Starting Price Summary */}
              {selectedUnitPrice !== null && (
                <div className="flex items-center justify-between lg:items-end gap-4 pt-2 lg:pt-0 border-t lg:border-t-0 border-zinc-100 shrink-0">
                  <div className="lg:text-right">
                    <span className="text-xs text-zinc-500 block">From</span>
                    <div className="text-2xl font-display font-bold text-zinc-900 font-mono tabular-nums">
                      {selectedCurrency} {selectedUnitPrice}
                      <span className="text-xs font-normal text-zinc-500"> / night</span>
                    </div>
                    <span className="text-xs text-zinc-500 font-mono tabular-nums block">
                      {stayNights} night{stayNights === 1 ? '' : 's'} total: {selectedCurrency}{' '}
                      {(selectedUnitPrice * stayNights * roomsCount).toLocaleString()}
                    </span>
                  </div>
                  <a
                    href="#hotel-rooms"
                    className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition whitespace-nowrap shrink-0"
                  >
                    See Rooms
                  </a>
                </div>
              )}
            </div>

            {/* Photo Filter Bar when both Hotel & Room photos exist */}
            {allHotelPhotos.length > 1 && roomPhotoCount > 0 && propertyPhotoCount > 0 && (
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1 p-1 bg-zinc-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setHotelPagePhotoTab('All');
                      setMobileHeroPhotoIdx(0);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer whitespace-nowrap shrink-0 ${
                      hotelPagePhotoTab === 'All'
                        ? 'bg-white text-zinc-900 shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    All Photos ({allHotelPhotos.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHotelPagePhotoTab('Rooms');
                      setMobileHeroPhotoIdx(0);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer whitespace-nowrap shrink-0 ${
                      hotelPagePhotoTab === 'Rooms'
                        ? 'bg-white text-zinc-900 shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Room Photos ({roomPhotoCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHotelPagePhotoTab('Hotel');
                      setMobileHeroPhotoIdx(0);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer whitespace-nowrap shrink-0 ${
                      hotelPagePhotoTab === 'Hotel'
                        ? 'bg-white text-zinc-900 shadow-2xs'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Hotel Views ({propertyPhotoCount})
                  </button>
                </div>
              </div>
            )}

            {/* PHOTO GALLERY: MOBILE SWIPEABLE + DESKTOP 5-PHOTO BENTO OR ARCHITECTURAL BANNER */}
            {displayPhotos.length > 0 ? (
              <div className="space-y-3">
                {/* Mobile Touch-Swipe Gallery (< md) */}
                <div className="md:hidden space-y-2">
                  <div
                    className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-200/80 select-none"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={(e) =>
                      handleTouchEnd(
                        e,
                        () => setMobileHeroPhotoIdx((safeMobileIdx + 1) % displayPhotos.length),
                        () =>
                          setMobileHeroPhotoIdx(
                            (safeMobileIdx - 1 + displayPhotos.length) % displayPhotos.length
                          )
                      )
                    }
                  >
                    <ResilientPublicImage
                      url={currentMobileHeroPhoto.url}
                      alt={currentMobileHeroPhoto.caption}
                      onAllFailed={markImageBroken}
                      onClick={() =>
                        setLightboxImage({
                          url: currentMobileHeroPhoto.url,
                          title: activeHotel.name,
                          caption: currentMobileHeroPhoto.caption,
                          list: displayPhotos,
                          index: safeMobileIdx,
                        })
                      }
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

                    {/* Subtle Top Counter */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                      <span className="text-xs font-medium text-white drop-shadow-xs truncate max-w-[75%]">
                        {currentMobileHeroPhoto.roomName
                          ? `Room: ${currentMobileHeroPhoto.roomName}`
                          : currentMobileHeroPhoto.caption}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-black/65 text-white text-[11px] font-mono tabular-nums">
                        {safeMobileIdx + 1} / {displayPhotos.length}
                      </span>
                    </div>

                    {displayPhotos.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMobileHeroPhotoIdx(
                              (safeMobileIdx - 1 + displayPhotos.length) % displayPhotos.length
                            );
                          }}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-zinc-900 flex items-center justify-center shadow-sm active:scale-95"
                          aria-label="Previous photo"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMobileHeroPhotoIdx((safeMobileIdx + 1) % displayPhotos.length);
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 text-zinc-900 flex items-center justify-center shadow-sm active:scale-95"
                          aria-label="Next photo"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setLightboxImage({
                          url: currentMobileHeroPhoto.url,
                          title: activeHotel.name,
                          caption: currentMobileHeroPhoto.caption,
                          list: displayPhotos,
                          index: safeMobileIdx,
                        })
                      }
                      className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/95 text-zinc-900 text-xs font-semibold shadow-sm"
                    >
                      <Grid className="w-3.5 h-3.5" />
                      <span>All {displayPhotos.length} Photos</span>
                    </button>
                  </div>

                  {/* Mobile Thumbnail Strip */}
                  {displayPhotos.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {displayPhotos.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setMobileHeroPhotoIdx(idx)}
                          className={`relative w-16 h-11 rounded-lg overflow-hidden shrink-0 border-2 transition ${
                            safeMobileIdx === idx
                              ? 'border-zinc-900 opacity-100'
                              : 'border-transparent opacity-60'
                          }`}
                        >
                          <ResilientPublicImage
                            url={p.url}
                            alt={p.caption}
                            onAllFailed={markImageBroken}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Desktop 5-Photo Bento Gallery (md+) */}
                <div className="hidden md:block relative rounded-2xl overflow-hidden border border-zinc-200/80 bg-zinc-100">
                  {displayPhotos.length === 1 ? (
                    <div
                      onClick={() =>
                        setLightboxImage({
                          url: displayPhotos[0].url,
                          title: activeHotel.name,
                          caption: displayPhotos[0].caption,
                          list: displayPhotos,
                          index: 0,
                        })
                      }
                      className="aspect-[21/9] max-h-[440px] w-full overflow-hidden cursor-pointer group"
                    >
                      <ResilientPublicImage
                        url={displayPhotos[0].url}
                        alt={activeHotel.name}
                        onAllFailed={markImageBroken}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition duration-500"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[420px]">
                      <div
                        onClick={() =>
                          setLightboxImage({
                            url: displayPhotos[0].url,
                            title: activeHotel.name,
                            caption: displayPhotos[0].caption,
                            list: displayPhotos,
                            index: 0,
                          })
                        }
                        className="col-span-2 row-span-2 relative overflow-hidden cursor-pointer group bg-zinc-900"
                      >
                        <ResilientPublicImage
                          url={displayPhotos[0].url}
                          alt={displayPhotos[0].caption}
                          onAllFailed={markImageBroken}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <span className="absolute bottom-3 left-3 text-white text-xs font-medium">
                          {displayPhotos[0].caption}
                        </span>
                      </div>

                      {[1, 2, 3, 4].map((slotIdx) => {
                        const item =
                          displayPhotos[slotIdx] || displayPhotos[slotIdx % displayPhotos.length];
                        const realIdx = displayPhotos[slotIdx]
                          ? slotIdx
                          : slotIdx % displayPhotos.length;
                        return (
                          <div
                            key={slotIdx}
                            onClick={() =>
                              setLightboxImage({
                                url: item.url,
                                title: activeHotel.name,
                                caption: item.caption,
                                list: displayPhotos,
                                index: realIdx,
                              })
                            }
                            className="relative overflow-hidden cursor-pointer group bg-zinc-900"
                          >
                            <ResilientPublicImage
                              url={item.url}
                              alt={item.caption}
                              onAllFailed={markImageBroken}
                              className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
                            <span className="absolute bottom-2.5 left-2.5 right-2.5 text-white text-[11px] font-medium truncate">
                              {item.roomName ? `Room: ${item.roomName}` : item.caption}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setLightboxImage({
                        url: displayPhotos[0].url,
                        title: activeHotel.name,
                        caption: displayPhotos[0].caption,
                        list: displayPhotos,
                        index: 0,
                      })
                    }
                    className="absolute bottom-4 right-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/95 hover:bg-white text-zinc-900 text-xs font-semibold shadow-md border border-zinc-200 transition cursor-pointer"
                  >
                    <Grid className="w-3.5 h-3.5" />
                    <span>Show all {displayPhotos.length} photos</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Minimalist Architectural Showcase Banner when photos haven't been uploaded yet */
              <div className="rounded-2xl overflow-hidden border border-zinc-200/80 h-56 sm:h-72">
                <ArchitecturalHotelCanvas
                  hotel={activeHotel}
                  meta={hotelMeta}
                  roomCount={activeHotelRooms.length}
                  variant="banner"
                />
              </div>
            )}

            {/* Quick Room Photo Filmstrip on Hotel Page when rooms exist */}
            {activeHotelRooms.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-zinc-900">
                    Room Categories — Tap any room to inspect photos
                  </span>
                  <span className="text-xs text-zinc-500">
                    {activeHotelRooms.length} room types
                  </span>
                </div>
                <div className="flex items-stretch gap-3 overflow-x-auto pb-1 no-scrollbar">
                  {activeHotelRooms.map((rm) => {
                    const rmPhotos = Array.from(
                      new Set(
                        [rm.featured_image_url, ...(rm.gallery_images || [])].filter(
                          (u) => Boolean(u) && !brokenImageUrls.has(u)
                        )
                      )
                    );
                    const thumb = rmPhotos[0] || allHotelPhotos[0]?.url || '';
                    return (
                      <button
                        key={rm.id}
                        type="button"
                        onClick={() =>
                          setActiveRoomModal({
                            room: rm,
                            hotel: activeHotel,
                            activePhotoIdx: 0,
                          })
                        }
                        className="group w-44 sm:w-52 shrink-0 bg-zinc-50 hover:bg-zinc-100/80 rounded-xl border border-zinc-200/80 overflow-hidden cursor-pointer transition text-left flex flex-col justify-between"
                      >
                        <div className="aspect-[16/10] bg-zinc-900 relative overflow-hidden w-full">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={rm.name}
                              referrerPolicy="no-referrer"
                              onError={() => markImageBroken(thumb)}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-500">
                              <BedDouble className="w-5 h-5" />
                            </div>
                          )}
                          {rmPhotos.length > 0 && (
                            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-mono tabular-nums">
                              {rmPhotos.length} photos
                            </span>
                          )}
                        </div>
                        <div className="p-2.5 w-full">
                          <span className="text-xs font-display font-semibold text-zinc-900 block truncate">
                            {rm.name}
                          </span>
                          <span className="text-[11px] text-zinc-500 font-mono tabular-nums block mt-0.5">
                            {rm.optional_price !== null
                              ? `${rm.currency} ${rm.optional_price} / night`
                              : 'View room'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Main 2-Column Content: Left 8 Cols (Overview, Amenities & Rooms) + Right 4 Cols (Sticky Booking Calculator) */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* LEFT 8 COLUMNS */}
            <div className="lg:col-span-8 space-y-10">
              {/* Property Overview & Key Amenities */}
              <div id="hotel-overview" className="space-y-6 pb-8 border-b border-zinc-200/80">
                <div className="space-y-2">
                  <h2 className="text-xl font-display font-bold text-zinc-900">
                    About {activeHotel.name}
                  </h2>
                  <p className="text-sm sm:text-base text-zinc-600 leading-relaxed whitespace-pre-line">
                    {activeHotel.full_description ||
                      activeHotel.short_description ||
                      `Experience modern comfort at ${activeHotel.name} in ${hotelMeta.district}, ${activeHotel.city}. Contact our reservations concierge on WhatsApp for instant availability and tailored stay packages.`}
                  </p>
                </div>

                {hotelMeta.highlights.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      Included Property Amenities
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {hotelMeta.highlights.map((am, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2.5 text-xs sm:text-sm text-zinc-700 py-1"
                        >
                          <span className="text-zinc-900 shrink-0">
                            {getFacilityIconByKeyword(am, 'w-4 h-4')}
                          </span>
                          <span>{am}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ROOMS & RATES SECTION */}
              <div id="hotel-rooms" className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-display font-bold text-zinc-900">
                      {activeHotelRooms.length > 0
                        ? `Room Categories (${activeHotelRooms.length})`
                        : 'Room Rates & Availability'}
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
                      Rates shown for {stayNights} night{stayNights === 1 ? '' : 's'} (
                      {formatShortDate(checkInDate)} – {formatShortDate(checkOutDate)})
                    </p>
                  </div>

                  {activeHotelRooms.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setShowComparisonMatrix((prev) => !prev)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer whitespace-nowrap shrink-0 ${
                        showComparisonMatrix
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'bg-white text-zinc-800 border-zinc-300 hover:bg-zinc-50'
                      }`}
                    >
                      <Columns className="w-3.5 h-3.5" />
                      <span>
                        {showComparisonMatrix
                          ? 'Hide Comparison'
                          : compareRoomIds.length > 0
                          ? `Compare Selected (${compareRoomIds.length})`
                          : `Compare All ${activeHotelRooms.length} Rooms`}
                      </span>
                    </button>
                  )}
                </div>

                {/* Side-by-Side Room Comparison Table */}
                {showComparisonMatrix && activeHotelRooms.length > 1 && (
                  <div className="bg-white rounded-2xl border border-zinc-200/90 overflow-hidden">
                    <div className="px-5 py-3.5 bg-zinc-50 border-b border-zinc-200/80 flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-900">
                        Room Comparison ({roomsToCompare.length} categories)
                      </span>
                      {compareRoomIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setCompareRoomIds([])}
                          className="text-xs font-medium text-zinc-600 hover:text-zinc-900 underline cursor-pointer"
                        >
                          Show All
                        </button>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-zinc-200/80">
                            <th className="p-4 font-medium text-zinc-500 w-36">Specification</th>
                            {roomsToCompare.map((rm) => (
                              <th
                                key={rm.id}
                                className="p-4 min-w-[200px] align-top border-l border-zinc-200/70 font-display font-bold text-zinc-900 text-sm"
                              >
                                {rm.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200/70">
                          <tr>
                            <td className="p-4 text-zinc-500">Nightly Rate</td>
                            {roomsToCompare.map((rm) => (
                              <td
                                key={rm.id}
                                className="p-4 border-l border-zinc-200/70 font-mono tabular-nums font-semibold text-zinc-900"
                              >
                                {rm.optional_price !== null
                                  ? `${rm.currency} ${rm.optional_price} / night`
                                  : 'On request'}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="p-4 text-zinc-500">
                              Total ({stayNights}N × {roomsCount}R)
                            </td>
                            {roomsToCompare.map((rm) => (
                              <td
                                key={rm.id}
                                className="p-4 border-l border-zinc-200/70 font-mono tabular-nums font-semibold text-emerald-700"
                              >
                                {rm.optional_price !== null
                                  ? `${rm.currency} ${(
                                      rm.optional_price *
                                      stayNights *
                                      roomsCount
                                    ).toLocaleString()}`
                                  : 'Quote on WhatsApp'}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="p-4 text-zinc-500">Occupancy & Bed</td>
                            {roomsToCompare.map((rm) => (
                              <td
                                key={rm.id}
                                className="p-4 border-l border-zinc-200/70 text-zinc-700"
                              >
                                {[rm.capacity, rm.bed_type, rm.room_size]
                                  .filter(Boolean)
                                  .join(' · ') || 'Standard Occupancy'}
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className="p-4 text-zinc-500">Action</td>
                            {roomsToCompare.map((rm) => (
                              <td key={rm.id} className="p-4 border-l border-zinc-200/70">
                                <a
                                  href={buildWhatsAppBookingUrl({
                                    targetHotel: activeHotel,
                                    targetRoom: rm,
                                  })}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-semibold transition w-full"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Book Room</span>
                                </a>
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Room List OR Clean Direct Rate Card when rooms haven't been added yet */}
                {activeHotelRooms.length === 0 ? (
                  <div className="bg-zinc-50/70 rounded-2xl border border-zinc-200/90 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="space-y-2 max-w-lg">
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span className="font-semibold text-zinc-900">Best Available Room</span>
                        <span aria-hidden="true">·</span>
                        <span>{guestsCount} Guests</span>
                        {hotelMeta.perk && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-emerald-700 font-medium">{hotelMeta.perk}</span>
                          </>
                        )}
                      </div>
                      <h3 className="text-lg font-display font-bold text-zinc-900">
                        Standard Room & Suite Reservations at {activeHotel.name}
                      </h3>
                      <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                        Send a quick WhatsApp message with your check-in dates ({checkInDate} to{' '}
                        {checkOutDate}) to receive current room photos and instant booking confirmation.
                      </p>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 pt-4 sm:pt-0 border-t sm:border-t-0 border-zinc-200/80 shrink-0">
                      {selectedUnitPrice !== null && (
                        <div className="sm:text-right">
                          <span className="text-2xl font-display font-bold text-zinc-900 font-mono tabular-nums">
                            {selectedCurrency} {selectedUnitPrice}
                          </span>
                          <span className="text-xs text-zinc-500"> / night</span>
                          <span className="block text-xs text-zinc-500 font-mono tabular-nums">
                            {stayNights}N total: {selectedCurrency}{' '}
                            {(selectedUnitPrice * stayNights * roomsCount).toLocaleString()}
                          </span>
                        </div>
                      )}
                      <a
                        href={buildWhatsAppBookingUrl({
                          targetHotel: activeHotel,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition whitespace-nowrap"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>Check Availability on WhatsApp</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {activeHotelRooms.map((room) => {
                      const roomPhotos = Array.from(
                        new Set(
                          [room.featured_image_url, ...(room.gallery_images || [])]
                            .map((u) => normalizeGoogleShareUrl(u))
                            .filter((u) => Boolean(u) && !brokenImageUrls.has(u))
                        )
                      );
                      const currentPhotoIdx = roomPhotoIndices[room.id] || 0;
                      const displayedPhoto = roomPhotos[currentPhotoIdx] || roomPhotos[0] || '';
                      const isComparing = compareRoomIds.includes(room.id);
                      const roomSpecs = [room.capacity, room.bed_type, room.room_size].filter(
                        Boolean
                      );

                      const nextRoomPhoto = () => {
                        if (roomPhotos.length <= 1) return;
                        setRoomPhotoIndices((prev) => ({
                          ...prev,
                          [room.id]: (currentPhotoIdx + 1) % roomPhotos.length,
                        }));
                      };

                      const prevRoomPhoto = () => {
                        if (roomPhotos.length <= 1) return;
                        setRoomPhotoIndices((prev) => ({
                          ...prev,
                          [room.id]:
                            (currentPhotoIdx - 1 + roomPhotos.length) % roomPhotos.length,
                        }));
                      };

                      return (
                        <article
                          id={`room-card-${room.id}`}
                          key={room.id}
                          className="bg-white rounded-2xl border border-zinc-200/90 overflow-hidden transition hover:border-zinc-300"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-12">
                            {/* Room Photo Gallery (5 cols) */}
                            <div className="md:col-span-5 bg-zinc-100 flex flex-col justify-between relative">
                              {displayedPhoto ? (
                                <div
                                  className="relative aspect-[4/3] w-full overflow-hidden group select-none"
                                  onTouchStart={handleTouchStart}
                                  onTouchEnd={(e) =>
                                    handleTouchEnd(e, nextRoomPhoto, prevRoomPhoto)
                                  }
                                >
                                  <ResilientPublicImage
                                    url={displayedPhoto}
                                    alt={room.name}
                                    onAllFailed={markImageBroken}
                                    onClick={() =>
                                      setActiveRoomModal({
                                        room,
                                        hotel: activeHotel,
                                        activePhotoIdx: currentPhotoIdx,
                                      })
                                    }
                                    className="w-full h-full object-cover cursor-pointer group-hover:scale-[1.03] transition duration-500"
                                  />
                                  {roomPhotos.length > 1 && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          prevRoomPhoto();
                                        }}
                                        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-zinc-900 flex items-center justify-center shadow-sm cursor-pointer"
                                        aria-label="Previous room photo"
                                      >
                                        <ChevronLeft className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          nextRoomPhoto();
                                        }}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-zinc-900 flex items-center justify-center shadow-sm cursor-pointer"
                                        aria-label="Next room photo"
                                      >
                                        <ChevronRight className="w-4 h-4" />
                                      </button>
                                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-black/65 text-white text-[10px] font-mono tabular-nums">
                                        {currentPhotoIdx + 1} / {roomPhotos.length}
                                      </span>
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveRoomModal({
                                        room,
                                        hotel: activeHotel,
                                        activePhotoIdx: currentPhotoIdx,
                                      })
                                    }
                                    className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/95 text-zinc-900 text-[11px] font-semibold shadow-xs cursor-pointer"
                                  >
                                    <Maximize2 className="w-3 h-3" />
                                    <span>Photos ({roomPhotos.length})</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="aspect-[4/3] w-full flex flex-col items-center justify-center text-zinc-400 p-6 text-center bg-zinc-100">
                                  <BedDouble className="w-7 h-7 mb-1.5 stroke-[1.5]" />
                                  <span className="text-xs text-zinc-500">{room.name}</span>
                                </div>
                              )}

                              {roomPhotos.length > 1 && (
                                <div className="p-2 bg-zinc-50 border-t border-zinc-200/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                                  {roomPhotos.map((pUrl, pIdx) => (
                                    <button
                                      key={pIdx}
                                      type="button"
                                      onClick={() =>
                                        setRoomPhotoIndices((prev) => ({
                                          ...prev,
                                          [room.id]: pIdx,
                                        }))
                                      }
                                      className={`w-12 h-9 rounded overflow-hidden shrink-0 border-2 transition cursor-pointer ${
                                        currentPhotoIdx === pIdx
                                          ? 'border-zinc-900 opacity-100'
                                          : 'border-transparent opacity-55 hover:opacity-90'
                                      }`}
                                    >
                                      <ResilientPublicImage
                                        url={pUrl}
                                        alt={`${room.name} ${pIdx + 1}`}
                                        onAllFailed={markImageBroken}
                                        className="w-full h-full object-cover"
                                      />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Room Info & CTA (7 cols) */}
                            <div className="md:col-span-7 p-5 sm:p-6 flex flex-col justify-between gap-4">
                              <div className="space-y-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <h3 className="text-lg font-display font-bold text-zinc-900">
                                      {room.name}
                                    </h3>
                                    {roomSpecs.length > 0 && (
                                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 mt-1">
                                        {roomSpecs.map((spec, i) => (
                                          <React.Fragment key={i}>
                                            {i > 0 && <span aria-hidden="true">·</span>}
                                            <span>{spec}</span>
                                          </React.Fragment>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  <div className="text-left sm:text-right">
                                    {room.optional_price !== null ? (
                                      <div>
                                        <span className="text-xl font-display font-bold text-zinc-900 font-mono tabular-nums">
                                          {room.currency} {room.optional_price}
                                        </span>
                                        <span className="text-xs text-zinc-500"> / night</span>
                                        <span className="block text-xs text-zinc-500 font-mono tabular-nums">
                                          {stayNights}N total: {room.currency}{' '}
                                          {(
                                            room.optional_price *
                                            stayNights *
                                            roomsCount
                                          ).toLocaleString()}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-xs font-medium text-zinc-500">
                                        Rate on enquiry
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {(room.full_description || room.short_description) && (
                                  <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                                    {room.full_description || room.short_description}
                                  </p>
                                )}

                                {room.amenities && room.amenities.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 pt-1">
                                    {room.amenities.map((am, idx) => (
                                      <span key={idx} className="inline-flex items-center gap-1">
                                        <Check className="w-3 h-3 text-zinc-900" />
                                        <span>{am}</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="pt-4 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-4">
                                  {roomPhotos.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setActiveRoomModal({
                                          room,
                                          hotel: activeHotel,
                                          activePhotoIdx: currentPhotoIdx,
                                        })
                                      }
                                      className="text-xs font-semibold text-zinc-900 hover:underline cursor-pointer"
                                    >
                                      Inspect room ({roomPhotos.length} photos)
                                    </button>
                                  )}

                                  {activeHotelRooms.length > 1 && (
                                    <label className="inline-flex items-center gap-1.5 text-xs text-zinc-600 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={isComparing}
                                        onChange={() => {
                                          toggleRoomCompare(room.id);
                                          setShowComparisonMatrix(true);
                                        }}
                                        className="rounded border-zinc-300 text-zinc-900"
                                      />
                                      <span>Compare</span>
                                    </label>
                                  )}
                                </div>

                                <a
                                  href={buildWhatsAppBookingUrl({
                                    targetHotel: activeHotel,
                                    targetRoom: room,
                                  })}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Book via WhatsApp</span>
                                </a>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT 4 COLUMNS: CONTIGUOUS STICKY BOOKING CALCULATOR MODULE */}
            <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
              <div className="bg-white rounded-2xl border border-zinc-200/90 shadow-sm p-6 space-y-5">
                <div className="flex items-baseline justify-between border-b border-zinc-100 pb-4">
                  <div>
                    {selectedUnitPrice !== null ? (
                      <div>
                        <span className="text-2xl font-display font-bold text-zinc-900 font-mono tabular-nums">
                          {selectedCurrency} {selectedUnitPrice}
                        </span>
                        <span className="text-xs text-zinc-500"> / night</span>
                      </div>
                    ) : (
                      <span className="text-lg font-display font-bold text-zinc-900">
                        Direct Reservation
                      </span>
                    )}
                    <span className="text-xs text-zinc-500 block mt-0.5">
                      Instant WhatsApp confirmation
                    </span>
                  </div>
                  {hotelMeta.reviewScore && (
                    <span className="text-xs font-semibold text-zinc-900">
                      ★ {hotelMeta.reviewScore}
                    </span>
                  )}
                </div>

                <div className="space-y-3.5">
                  {activeHotelRooms.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Room Category
                      </label>
                      <select
                        value={selectedBookingRoom?.id ?? ''}
                        onChange={(e) => setBookingRoomId(Number(e.target.value))}
                        className="w-full px-3 py-2.5 text-xs font-medium bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-900"
                      >
                        {activeHotelRooms.map((rm) => (
                          <option key={rm.id} value={rm.id}>
                            {rm.name}{' '}
                            {rm.optional_price !== null
                              ? `(${rm.currency} ${rm.optional_price}/night)`
                              : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Check-In
                      </label>
                      <input
                        type="date"
                        value={checkInDate}
                        onChange={(e) => setCheckInDate(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-900 font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Check-Out
                      </label>
                      <input
                        type="date"
                        value={checkOutDate}
                        min={checkInDate}
                        onChange={(e) => setCheckOutDate(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-900 font-mono tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">Rooms</label>
                      <select
                        value={roomsCount}
                        onChange={(e) => setRoomsCount(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-900"
                      >
                        {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                          <option key={n} value={n}>
                            {n} Room{n === 1 ? '' : 's'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">Guests</label>
                      <select
                        value={guestsCount}
                        onChange={(e) => setGuestsCount(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-900"
                      >
                        {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                          <option key={n} value={n}>
                            {n} Guest{n === 1 ? '' : 's'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Special Requests
                    </label>
                    <input
                      type="text"
                      value={specialRequests}
                      onChange={(e) => setSpecialRequests(e.target.value)}
                      placeholder="Airport transfer, high floor, early check-in..."
                      className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-900"
                    />
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/70 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-zinc-500">
                      <span>
                        {stayNights} night{stayNights === 1 ? '' : 's'} × {roomsCount} room
                        {roomsCount === 1 ? '' : 's'}
                      </span>
                      <span className="font-mono tabular-nums text-zinc-800">
                        {formatShortDate(checkInDate)} – {formatShortDate(checkOutDate)}
                      </span>
                    </div>
                    {selectedUnitPrice !== null && (
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-200/80">
                        <span className="font-semibold text-zinc-900">Estimated Total</span>
                        <span className="text-base font-display font-bold text-zinc-900 font-mono tabular-nums">
                          {selectedCurrency}{' '}
                          {(selectedUnitPrice * stayNights * roomsCount).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <a
                    href={buildWhatsAppBookingUrl({
                      targetHotel: activeHotel,
                      targetRoom: selectedBookingRoom,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Reserve via WhatsApp</span>
                  </a>
                </div>

                <div className="pt-3 border-t border-zinc-100 space-y-2 text-xs text-zinc-500">
                  <div className="flex items-center justify-between">
                    <span>Check-in / Check-out</span>
                    <span className="font-mono tabular-nums text-zinc-800">
                      {hotelCheckIn} / {hotelCheckOut}
                    </span>
                  </div>
                  {hotelPhone && (
                    <div className="flex items-center justify-between">
                      <span>Telephone</span>
                      <a
                        href={`tel:${hotelPhone}`}
                        className="font-mono tabular-nums text-zinc-900 hover:underline"
                      >
                        {hotelPhone}
                      </a>
                    </div>
                  )}
                  {hotelEmail && (
                    <div className="flex items-center justify-between">
                      <span>Email</span>
                      <a
                        href={`mailto:${hotelEmail}`}
                        className="text-zinc-900 hover:underline truncate max-w-[180px]"
                      >
                        {hotelEmail}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {(activeHotel.address || hotelMapsUrl || hotelMapsEmbed) && (
                <div className="bg-zinc-50/70 rounded-2xl border border-zinc-200/80 p-5 space-y-3">
                  <h3 className="text-sm font-display font-bold text-zinc-900">Location</h3>
                  {activeHotel.address && (
                    <p className="text-xs text-zinc-600 leading-relaxed">{activeHotel.address}</p>
                  )}
                  {hotelMapsEmbed && (
                    <div className="aspect-[4/3] w-full rounded-xl overflow-hidden border border-zinc-200 bg-zinc-100">
                      <iframe
                        src={hotelMapsEmbed}
                        title={`${activeHotel.name} Map`}
                        className="w-full h-full border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    </div>
                  )}
                  {hotelMapsUrl && (
                    <a
                      href={hotelMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-900 hover:underline"
                    >
                      <span>Open in Google Maps</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}
            </aside>
          </div>
        </div>

        {/* Slim Mobile Sticky Bottom Booking Bar (<= 15% viewport height) */}
        <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white/95 backdrop-blur-md border-t border-zinc-200 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-sm font-display font-bold text-zinc-900 font-mono tabular-nums block">
              {selectedUnitPrice !== null
                ? `${selectedCurrency} ${selectedUnitPrice} / night`
                : activeHotel.name}
            </span>
            <span className="text-[11px] text-zinc-500 block truncate">
              {formatShortDate(checkInDate)} – {formatShortDate(checkOutDate)} ({stayNights}N)
            </span>
          </div>
          <a
            href={buildWhatsAppBookingUrl({
              targetHotel: activeHotel,
              targetRoom: selectedBookingRoom,
            })}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold whitespace-nowrap shrink-0"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Book on WhatsApp</span>
          </a>
        </div>

        {renderRoomDetailModal(activeHotel)}
        {renderFullLightboxModal()}
      </div>
    );
  }

  // ============================================================================
  // MAIN DIRECTORY & HOMEPAGE VIEW (MINIMAL & MODERN)
  // ============================================================================
  const heroHeading = homepage.hero_heading || hotel.name;
  const heroSubtitle = homepage.hero_subtitle || hotel.tagline || hotel.short_description;
  const rawHeroBgUrl =
    homepage.hero_image_url ||
    hotels.find((h) => h.featured_image_url)?.featured_image_url ||
    gallery.find((g) => g.image_url)?.image_url ||
    '';
  const heroBgImageUrl = normalizeGoogleShareUrl(rawHeroBgUrl);

  return (
    <div className="public-site-modern min-h-screen bg-white text-zinc-900 selection:bg-zinc-900 selection:text-white pb-20 md:pb-0">
      {/* Preview Mode Banner */}
      {isPreview && (
        <div className="sticky top-0 z-50 bg-zinc-900 text-zinc-100 px-4 py-2 text-xs flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-zinc-400 shrink-0">Draft Preview</span>
            <span aria-hidden="true" className="hidden sm:inline">
              ·
            </span>
            <span className="text-zinc-200 truncate hidden sm:inline">
              Minimal & Modern Public Website — Click any hotel card to open its dedicated page.
            </span>
          </div>
          {onExitPreview && (
            <button
              onClick={onExitPreview}
              className="px-3 py-1 rounded-md bg-white text-zinc-900 font-semibold hover:bg-zinc-100 transition cursor-pointer shrink-0"
            >
              Return to Editor
            </button>
          )}
        </div>
      )}

      {/* Top Navigation Bar with Website Logo & Partner Hotels Directory Tagline */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-zinc-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-[68px] flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand Logo + Brand Name + '9 Partner Hotels Directory' Tagline */}
          <a
            href="#home"
            onClick={(e) => {
              e.preventDefault();
              navigateToHotelPage(null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-2.5 sm:gap-3 min-w-0 group shrink-0"
          >
            <BrandLogo logoUrl={hotel.logo_url} brandName={hotel.name} size="md" />
            <div className="min-w-0 leading-tight">
              <span className="block text-sm sm:text-base font-display font-bold tracking-tight text-zinc-900 group-hover:text-zinc-700 transition-colors truncate">
                {hotel.name}
              </span>
              <span className="block text-[11px] sm:text-xs font-medium text-zinc-500 truncate mt-0.5">
                {hotel.tagline
                  ? `${hotel.tagline} · ${hotels.length} Partner Hotels Directory`
                  : `${hotels.length} Partner Hotels Directory`}
              </span>
            </div>
          </a>

          {/* Zone 2: 4-5 Concise Single-Line Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600">
            {visibleHeaderLinks.map((link, idx) => (
              <a
                key={idx}
                href={link.href}
                className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="hidden md:flex items-center shrink-0">
            <a
              href={buildWhatsAppBookingUrl({})}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition whitespace-nowrap shrink-0"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>{hotel.reservation_button_text || 'WhatsApp Concierge'}</span>
            </a>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-zinc-700 hover:text-zinc-950 cursor-pointer"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-zinc-200 px-4 pt-2 pb-5 space-y-1 shadow-lg">
            {visibleHeaderLinks.map((link, idx) => (
              <a
                key={idx}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2.5 text-sm font-medium text-zinc-800 border-b border-zinc-100"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-2">
              <a
                href={buildWhatsAppBookingUrl({})}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp Concierge</span>
              </a>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* MINIMAL & MODERN HERO WITH BACKGROUND PICTURE + UNIFIED SEARCH & STAY BAR */}
        <section
          id="home"
          className="relative bg-zinc-950 text-white border-b border-zinc-900 overflow-hidden pt-9 pb-9 sm:pt-16 sm:pb-14"
        >
          {/* Hero Background Picture Layer */}
          {heroBgImageUrl && !brokenImageUrls.has(heroBgImageUrl) ? (
            <div className="absolute inset-0 z-0">
              <ResilientPublicImage
                url={heroBgImageUrl}
                alt={heroHeading}
                onAllFailed={markImageBroken}
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/75 via-zinc-950/65 to-zinc-950/85" />
            </div>
          ) : (
            <div className="absolute inset-0 z-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-stone-900">
              <svg
                className="absolute inset-0 w-full h-full opacity-[0.06] pointer-events-none"
                viewBox="0 0 800 400"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                preserveAspectRatio="xMidYMid slice"
              >
                <path
                  d="M0 80H800M0 160H800M0 240H800M0 320H800"
                  stroke="currentColor"
                  strokeWidth="1"
                />
                <path
                  d="M160 0V400M320 0V400M480 0V400M640 0V400"
                  stroke="currentColor"
                  strokeWidth="1"
                />
              </svg>
            </div>
          )}

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
            <div className="max-w-3xl space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300">
                <span className="font-semibold text-white">
                  {hotels.length} Partner Hotels Directory
                </span>
                {hotel.tagline && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-zinc-200">{hotel.tagline}</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span>Direct WhatsApp Reservations</span>
                <span aria-hidden="true">·</span>
                <span>Verified Rates in {primaryCurrency}</span>
              </div>

              <h1
                className="font-display font-bold text-white tracking-tight text-balance leading-[1.1]"
                style={{ fontSize: 'clamp(1.875rem, 3.6vw, 3.25rem)' }}
              >
                {heroHeading}
              </h1>

              {heroSubtitle && (
                <p className="text-sm sm:text-base text-zinc-200 leading-relaxed max-w-2xl">
                  {heroSubtitle}
                </p>
              )}
            </div>

            {/* UNIFIED SEARCH, DATES & FILTER BAR (Responsive Desktop + Compact Mobile) */}
            {hotels.length > 0 && (
              <div className="bg-white text-zinc-900 rounded-2xl border border-zinc-200/90 shadow-xl p-3 sm:p-4 space-y-3">
                {/* Desktop Full Row / Mobile Compact Search + Stay Trigger */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-center">
                  {/* Search Input */}
                  <div className="lg:col-span-4 relative">
                    <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={hotelSearchQuery}
                      onChange={(e) => setHotelSearchQuery(e.target.value)}
                      placeholder="Search hotel, KLCC, Bukit Bintang..."
                      className="w-full pl-10 pr-8 py-2.5 text-xs sm:text-sm bg-zinc-50 border border-zinc-200/90 rounded-xl text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-zinc-900 focus:outline-none"
                    />
                    {hotelSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setHotelSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                        aria-label="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Mobile Compact Stay Dates & Filter Toggle Button */}
                  <div className="flex lg:hidden items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMobileDatesDrawerOpen((prev) => !prev)}
                      className="flex-1 inline-flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200/90 text-xs text-zinc-800 font-medium cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-1.5 truncate">
                        <Calendar className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span className="font-mono tabular-nums">
                          {formatShortDate(checkInDate)} – {formatShortDate(checkOutDate)} (
                          {stayNights}N)
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{guestsCount}G</span>
                      </span>
                      <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    </button>
                  </div>

                  {/* Desktop Inline Date Pickers & Filters (Hidden on mobile unless expanded) */}
                  <div
                    className={`${
                      mobileDatesDrawerOpen ? 'grid' : 'hidden'
                    } lg:grid grid-cols-2 sm:grid-cols-4 lg:col-span-8 gap-2.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-zinc-100`}
                  >
                    <div>
                      <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1 lg:sr-only">
                        Check-In
                      </label>
                      <input
                        type="date"
                        value={checkInDate}
                        onChange={(e) => setCheckInDate(e.target.value)}
                        title="Check-in date"
                        className="w-full px-3 py-2.5 text-xs font-mono tabular-nums bg-zinc-50 border border-zinc-200/90 rounded-xl text-zinc-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1 lg:sr-only">
                        Check-Out ({stayNights}N)
                      </label>
                      <input
                        type="date"
                        value={checkOutDate}
                        min={checkInDate}
                        onChange={(e) => setCheckOutDate(e.target.value)}
                        title="Check-out date"
                        className="w-full px-3 py-2.5 text-xs font-mono tabular-nums bg-zinc-50 border border-zinc-200/90 rounded-xl text-zinc-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1 lg:sr-only">
                        Rate Range
                      </label>
                      <select
                        value={selectedBudgetBracket}
                        onChange={(e) => setSelectedBudgetBracket(e.target.value as any)}
                        className="w-full px-3 py-2.5 text-xs font-medium bg-zinc-50 border border-zinc-200/90 rounded-xl text-zinc-900"
                      >
                        <option value="all">All Prices ({primaryCurrency})</option>
                        <option value="tier1">Under {primaryCurrency} 110 / night</option>
                        <option value="tier2">
                          {primaryCurrency} 110 – 200 / night
                        </option>
                        <option value="tier3">{primaryCurrency} 200+ / night</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1 lg:sr-only">
                        Sort By
                      </label>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="w-full px-3 py-2.5 text-xs font-medium bg-zinc-50 border border-zinc-200/90 rounded-xl text-zinc-900"
                      >
                        <option value="featured">Sort: Recommended</option>
                        <option value="price_asc">Price: Low to High</option>
                        <option value="price_desc">Price: High to Low</option>
                        <option value="stars_desc">Star Rating: High to Low</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Single-Line Scrollable Quick Filter Bar (Districts/Cities + Star Filter) */}
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-zinc-100">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    {areaFilters.map((area) => (
                      <button
                        key={area}
                        type="button"
                        onClick={() => setSelectedAreaFilter(area)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
                          selectedAreaFilter === area
                            ? 'bg-zinc-900 text-white'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-900'
                        }`}
                      >
                        {area === 'All' ? `All Locations (${hotels.length})` : area}
                      </button>
                    ))}

                    <div className="h-4 w-px bg-zinc-200 mx-1 shrink-0" />

                    {([5, 4, 3] as const).map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() =>
                          setSelectedStarFilter(selectedStarFilter === star ? 'All' : star)
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
                          selectedStarFilter === star
                            ? 'bg-zinc-900 text-white'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-900'
                        }`}
                      >
                        {star === 5 ? '5★ Only' : `${star}★ & Up`}
                      </button>
                    ))}
                  </div>

                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="text-xs font-semibold text-zinc-900 hover:underline cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Reset ({filteredHotels.length})
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* HOTEL DIRECTORY GRID (Minimal & Modern 3-Column Desktop / Full-Width Mobile) */}
        {hotels.length > 0 && (
          <section id="hotels" className="py-10 sm:py-14 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-display font-bold text-zinc-900">
                    {selectedAreaFilter === 'All'
                      ? `Available Hotels (${filteredHotels.length})`
                      : `${selectedAreaFilter} Hotels (${filteredHotels.length})`}
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Showing rates for {stayNights} night{stayNights === 1 ? '' : 's'} ·{' '}
                    {formatShortDate(checkInDate)} – {formatShortDate(checkOutDate)}
                  </p>
                </div>
              </div>

              {filteredHotels.length === 0 ? (
                <div className="p-12 text-center bg-zinc-50 rounded-2xl border border-zinc-200/80 space-y-3">
                  <Building2 className="w-7 h-7 text-zinc-400 mx-auto stroke-[1.5]" />
                  <p className="text-sm font-medium text-zinc-800">
                    No properties match your active filters.
                  </p>
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs font-semibold cursor-pointer"
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                  {filteredHotels.map((h) => {
                    const hRooms = rooms.filter((r) => r.hotel_id === h.id);
                    const cardPhotos = collectHotelPhotos(h, hRooms, brokenImageUrls);
                    const curCardIdx = cardPhotoIndices[h.id] || 0;
                    const currentCardPhotoObj = cardPhotos[curCardIdx] || cardPhotos[0];
                    const currentCardPhoto = currentCardPhotoObj?.url || '';
                    const { price: startingPrice, currency: priceCurrency } =
                      getHotelStartingPrice(h);
                    const meta = extractHotelMeta(h);

                    return (
                      <article
                        key={h.id}
                        onClick={() => navigateToHotelPage(h.slug)}
                        className="group bg-white rounded-2xl border border-zinc-200/85 overflow-hidden flex flex-col justify-between transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-zinc-300 cursor-pointer"
                      >
                        <div>
                          {/* 4:3 Visual Header: Photo Carousel or Minimalist Architectural Cover */}
                          <div
                            className="aspect-[4/3] bg-zinc-900 overflow-hidden relative select-none"
                            onTouchStart={handleTouchStart}
                            onTouchEnd={(e) => {
                              if (cardPhotos.length <= 1) return;
                              e.stopPropagation();
                              handleTouchEnd(
                                e,
                                () =>
                                  setCardPhotoIndices((prev) => ({
                                    ...prev,
                                    [h.id]: (curCardIdx + 1) % cardPhotos.length,
                                  })),
                                () =>
                                  setCardPhotoIndices((prev) => ({
                                    ...prev,
                                    [h.id]:
                                      (curCardIdx - 1 + cardPhotos.length) % cardPhotos.length,
                                  }))
                              );
                            }}
                          >
                            {currentCardPhoto ? (
                              <>
                                <ResilientPublicImage
                                  url={currentCardPhoto}
                                  alt={currentCardPhotoObj?.caption || h.name}
                                  onAllFailed={markImageBroken}
                                  className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-500"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/15 pointer-events-none" />

                                {currentCardPhotoObj?.roomName && (
                                  <span className="absolute bottom-3 left-3 text-[11px] font-medium text-white drop-shadow-xs truncate max-w-[70%]">
                                    Room: {currentCardPhotoObj.roomName}
                                  </span>
                                )}

                                {cardPhotos.length > 1 && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCardPhotoIndices((prev) => ({
                                          ...prev,
                                          [h.id]:
                                            (curCardIdx - 1 + cardPhotos.length) %
                                            cardPhotos.length,
                                        }));
                                      }}
                                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-zinc-900 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition cursor-pointer shadow-xs"
                                      aria-label="Previous photo"
                                    >
                                      <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCardPhotoIndices((prev) => ({
                                          ...prev,
                                          [h.id]: (curCardIdx + 1) % cardPhotos.length,
                                        }));
                                      }}
                                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-zinc-900 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition cursor-pointer shadow-xs"
                                      aria-label="Next photo"
                                    >
                                      <ChevronRight className="w-4 h-4" />
                                    </button>
                                    <span className="absolute top-3 right-3 px-2 py-0.5 rounded bg-black/65 text-white text-[10px] font-mono tabular-nums">
                                      {curCardIdx + 1} / {cardPhotos.length}
                                    </span>
                                  </>
                                )}
                              </>
                            ) : (
                              <ArchitecturalHotelCanvas
                                hotel={h}
                                meta={meta}
                                roomCount={hRooms.length}
                                variant="card"
                              />
                            )}
                          </div>

                          {/* Card Body: Unboxed Metadata, Title, Location & Room Strip / Highlights */}
                          <div className="p-5 space-y-3">
                            {/* Zero-Pill Metadata Line */}
                            <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="font-medium text-zinc-800">
                                  {h.star_rating || 4}★ Hotel
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="truncate">{meta.district}</span>
                                {meta.perk && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-emerald-700 font-medium truncate">
                                      {meta.perk}
                                    </span>
                                  </>
                                )}
                              </div>

                              {meta.reviewScore && (
                                <span className="font-mono tabular-nums font-semibold text-zinc-900 shrink-0">
                                  ★ {meta.reviewScore}
                                </span>
                              )}
                            </div>

                            {/* Hotel Name & Landmark Distance */}
                            <div>
                              <h3 className="text-base sm:text-lg font-display font-bold text-zinc-900 group-hover:text-zinc-700 transition leading-snug line-clamp-2">
                                {h.name}
                              </h3>
                              {(meta.landmarkDistance || h.address) && (
                                <p className="text-xs text-zinc-500 truncate mt-1">
                                  {meta.landmarkDistance || h.address}
                                </p>
                              )}
                            </div>

                            {/* Interactive Room Photo Strip (if rooms exist) OR Clean Amenities Text */}
                            {hRooms.length > 0 ? (
                              <div className="pt-2 border-t border-zinc-100 space-y-1.5">
                                <span className="text-[11px] font-medium text-zinc-500 block">
                                  {hRooms.length} Room Categor{hRooms.length === 1 ? 'y' : 'ies'} — Tap to view room
                                </span>
                                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                                  {hRooms.map((r) => {
                                    const rThumb = normalizeGoogleShareUrl(
                                      r.featured_image_url ||
                                        (Array.isArray(r.gallery_images) && r.gallery_images[0]) ||
                                        currentCardPhoto
                                    );
                                    return (
                                      <button
                                        key={r.id}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveRoomModal({
                                            room: r,
                                            hotel: h,
                                            activePhotoIdx: 0,
                                          });
                                        }}
                                        className="flex items-center gap-2 p-1 pr-2.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 border border-zinc-200/80 transition shrink-0 text-left cursor-pointer"
                                      >
                                        <div className="w-9 h-7 rounded overflow-hidden bg-zinc-200 shrink-0">
                                          {rThumb && !brokenImageUrls.has(rThumb) ? (
                                            <ResilientPublicImage
                                              url={rThumb}
                                              alt={r.name}
                                              onAllFailed={markImageBroken}
                                              className="w-full h-full object-cover"
                                            />
                                          ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-500">
                                              <BedDouble className="w-3.5 h-3.5" />
                                            </div>
                                          )}
                                        </div>
                                        <div className="min-w-0 max-w-[110px]">
                                          <span className="text-[11px] font-medium text-zinc-900 block truncate">
                                            {r.name}
                                          </span>
                                          {r.optional_price !== null && r.optional_price > 0 && (
                                            <span className="text-[10px] font-mono tabular-nums text-zinc-500 block">
                                              {r.currency || priceCurrency} {r.optional_price}/n
                                            </span>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              meta.highlights.length > 0 && (
                                <p className="text-xs text-zinc-500 truncate pt-2 border-t border-zinc-100">
                                  {meta.highlights.slice(0, 4).join(' · ')}
                                </p>
                              )
                            )}
                          </div>
                        </div>

                        {/* Card Footer: Tabular Price & Actions */}
                        <div className="px-5 py-3.5 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between gap-3">
                          <div>
                            {startingPrice !== null && startingPrice > 0 ? (
                              <div>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-base font-display font-bold text-zinc-900 font-mono tabular-nums">
                                    {priceCurrency} {startingPrice}
                                  </span>
                                  <span className="text-xs text-zinc-500">/ night</span>
                                </div>
                                <span className="text-[11px] text-zinc-500 font-mono tabular-nums block">
                                  {stayNights}N total: {priceCurrency}{' '}
                                  {(startingPrice * stayNights * roomsCount).toLocaleString()}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs font-medium text-zinc-600">
                                Rates on request
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={buildWhatsAppBookingUrl({
                                targetHotel: h,
                                targetRoom: hRooms[0] || null,
                              })}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center justify-center transition"
                              title="Direct WhatsApp Enquiry"
                              aria-label="WhatsApp Enquiry"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                            <span className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-zinc-900 group-hover:bg-zinc-800 text-white text-xs font-semibold transition whitespace-nowrap">
                              <span>View Hotel</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* FACILITIES & SERVICES SECTION */}
        {facilities.length > 0 && (
          <section id="facilities" className="py-12 sm:py-16 bg-zinc-50/70 border-t border-zinc-200/80">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              <div className="max-w-2xl space-y-1.5">
                <span className="text-xs font-medium text-zinc-500">Hospitality Standards</span>
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-zinc-900">
                  {getPage('facilities')?.heading || 'Guest Services & Amenities'}
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {facilities.map((fac) => (
                  <div
                    key={fac.id}
                    className="p-5 rounded-2xl bg-white border border-zinc-200/80 space-y-2.5"
                  >
                    <div className="w-9 h-9 rounded-xl bg-zinc-100 text-zinc-900 flex items-center justify-center">
                      {renderFacilityIcon(fac.icon_name)}
                    </div>
                    <h3 className="text-base font-display font-bold text-zinc-900">{fac.name}</h3>
                    {fac.description && (
                      <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
                        {fac.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* GALLERY SECTION (Only rendered if valid gallery photos exist) */}
        {filteredGallery.length > 0 && (
          <section id="gallery" className="py-12 sm:py-16 bg-white border-t border-zinc-200/80">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-zinc-500">Visual Tour</span>
                  <h2 className="text-2xl sm:text-3xl font-display font-bold text-zinc-900">
                    {getPage('gallery')?.heading || 'Photo Gallery'}
                  </h2>
                </div>

                {galleryCategories.length > 2 && (
                  <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl overflow-x-auto no-scrollbar">
                    {galleryCategories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveGalleryCategory(cat)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer whitespace-nowrap shrink-0 ${
                          activeGalleryCategory === cat
                            ? 'bg-white text-zinc-900 shadow-2xs'
                            : 'text-zinc-600 hover:text-zinc-900'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredGallery.map((item) => {
                  const normalizedUrl = normalizeGoogleShareUrl(item.image_url);
                  return (
                    <div
                      key={item.id}
                      onClick={() =>
                        setLightboxImage({
                          url: normalizedUrl,
                          title: item.title || item.alt_text,
                          caption: item.caption,
                        })
                      }
                      className="group cursor-pointer rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200/80 aspect-[4/3] relative"
                    >
                      <ResilientPublicImage
                        url={normalizedUrl}
                        alt={item.alt_text || item.title}
                        onAllFailed={markImageBroken}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-500"
                        loading="lazy"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ABOUT & POLICIES SECTION */}
        {(hotel.about_content ||
          getPage('about')?.content_body ||
          hotel.short_description ||
          hotel.check_in_time) && (
          <section id="about" className="py-12 sm:py-16 bg-zinc-50/70 border-t border-zinc-200/80">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-7 space-y-3">
                  <span className="text-xs font-medium text-zinc-500">About Our Collection</span>
                  <h2 className="text-2xl sm:text-3xl font-display font-bold text-zinc-900">
                    {hotel.about_title || getPage('about')?.heading || `About ${hotel.name}`}
                  </h2>
                  <p className="text-zinc-600 text-sm sm:text-base leading-relaxed whitespace-pre-line">
                    {hotel.about_content ||
                      getPage('about')?.content_body ||
                      hotel.short_description}
                  </p>
                </div>

                <div className="lg:col-span-5 bg-white rounded-2xl border border-zinc-200/80 p-6 space-y-4">
                  <h3 className="text-base font-display font-bold text-zinc-900">
                    Standard Stay Policies
                  </h3>
                  {(hotel.check_in_time || hotel.check_out_time) && (
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-100">
                      {hotel.check_in_time && (
                        <div>
                          <span className="text-xs text-zinc-500 block">Check-In</span>
                          <span className="text-sm font-semibold text-zinc-900 font-mono tabular-nums">
                            {hotel.check_in_time}
                          </span>
                        </div>
                      )}
                      {hotel.check_out_time && (
                        <div>
                          <span className="text-xs text-zinc-500 block">Check-Out</span>
                          <span className="text-sm font-semibold text-zinc-900 font-mono tabular-nums">
                            {hotel.check_out_time}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {hotel.cancellation_policy && (
                    <div className="pt-3 border-t border-zinc-100 space-y-1">
                      <span className="text-xs font-semibold text-zinc-900 block">
                        Reservation & Cancellation
                      </span>
                      <p className="text-xs text-zinc-600 leading-relaxed whitespace-pre-line">
                        {hotel.cancellation_policy}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* FAQ SECTION */}
        {faqs.length > 0 && (
          <section id="faq" className="py-12 sm:py-16 bg-white border-t border-zinc-200/80">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
              <div className="space-y-1">
                <span className="text-xs font-medium text-zinc-500">Support</span>
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-zinc-900">
                  {getPage('faq')?.heading || 'Frequently Asked Questions'}
                </h2>
              </div>

              <div className="divide-y divide-zinc-200/80 border-y border-zinc-200/80">
                {faqs.map((faq, idx) => {
                  const isOpen = openFaqIndex === idx;
                  return (
                    <div key={faq.id} className="py-3.5">
                      <button
                        onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                        className="w-full flex items-center justify-between text-left gap-4 py-1.5 cursor-pointer"
                      >
                        <span className="text-sm sm:text-base font-medium text-zinc-900">
                          {faq.question}
                        </span>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-zinc-500 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
                        )}
                      </button>
                      {isOpen && (
                        <div className="pt-2 pb-2 text-xs sm:text-sm text-zinc-600 leading-relaxed whitespace-pre-line">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* DIRECT CONTACT SECTION */}
        {(hotel.contact_phone || hotel.contact_email || hotel.whatsapp_number) && (
          <section id="contact" className="py-12 sm:py-16 bg-zinc-900 text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7 space-y-2.5">
                  <span className="text-xs font-medium text-zinc-400">Direct Concierge</span>
                  <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">
                    {getPage('contact')?.heading || 'Reservations & Enquiries'}
                  </h2>
                  <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
                    Connect with our reservations team via WhatsApp, phone, or email for instant room availability and corporate group stays.
                  </p>
                </div>

                <div className="lg:col-span-5 grid grid-cols-1 gap-3">
                  {hotel.whatsapp_number && (
                    <a
                      href={buildWhatsAppBookingUrl({})}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition"
                    >
                      <div className="flex items-center gap-3">
                        <MessageCircle className="w-5 h-5 shrink-0" />
                        <div>
                          <span className="text-xs text-emerald-100 block">WhatsApp Concierge</span>
                          <span className="text-sm font-semibold font-mono tabular-nums">
                            {hotel.whatsapp_number}
                          </span>
                        </div>
                      </div>
                      <ArrowUpRight className="w-4 h-4" />
                    </a>
                  )}

                  {hotel.contact_phone && (
                    <a
                      href={`tel:${hotel.contact_phone}`}
                      className="flex items-center justify-between p-4 rounded-xl bg-zinc-800/90 hover:bg-zinc-800 border border-zinc-700/80 transition"
                    >
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-zinc-400 shrink-0" />
                        <div>
                          <span className="text-xs text-zinc-400 block">Telephone</span>
                          <span className="text-sm font-semibold font-mono tabular-nums">
                            {hotel.contact_phone}
                          </span>
                        </div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-zinc-400" />
                    </a>
                  )}

                  {hotel.contact_email && (
                    <a
                      href={`mailto:${hotel.contact_email}`}
                      className="flex items-center justify-between p-4 rounded-xl bg-zinc-800/90 hover:bg-zinc-800 border border-zinc-700/80 transition"
                    >
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-zinc-400 shrink-0" />
                        <div>
                          <span className="text-xs text-zinc-400 block">Email</span>
                          <span className="text-sm font-semibold">{hotel.contact_email}</span>
                        </div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-zinc-400" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Shared Modals */}
      {renderRoomDetailModal()}
      {renderFullLightboxModal()}

      {/* Slim Mobile Sticky Bottom Bar (<= 15% viewport height) */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-zinc-200 px-4 py-2.5 flex items-center justify-between gap-2">
        <a
          href="#hotels"
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-zinc-900 text-white text-xs font-semibold whitespace-nowrap"
        >
          <span>Hotels ({filteredHotels.length})</span>
        </a>
        <a
          href={buildWhatsAppBookingUrl({})}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold whitespace-nowrap"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span>WhatsApp Us</span>
        </a>
      </div>

      {/* Minimalist Footer */}
      <footer className="bg-zinc-950 text-zinc-400 py-10 border-t border-zinc-900 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-1 rounded-lg bg-white/95 shrink-0">
                <BrandLogo logoUrl={hotel.logo_url} brandName={hotel.name} size="sm" />
              </div>
              <div className="min-w-0 leading-tight">
                <span className="font-display font-bold text-sm text-white block truncate">
                  {hotel.name}
                </span>
                <span className="text-[11px] font-medium text-zinc-400 block truncate mt-0.5">
                  {hotel.tagline
                    ? `${hotel.tagline} · ${hotels.length} Partner Hotels Directory`
                    : `${hotels.length} Partner Hotels Directory`}
                </span>
              </div>
            </div>
            <p className="text-zinc-500">
              {hotel.copyright_text ||
                `© ${new Date().getFullYear()} ${hotel.name}. All rights reserved.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            {navigation.footer_links
              .filter((l) => l.visible)
              .map((link, idx) => (
                <a key={idx} href={link.href} className="hover:text-white transition">
                  {link.label}
                </a>
              ))}
          </div>
        </div>
      </footer>
    </div>
  );
};
