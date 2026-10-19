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
  DollarSign,
  Send,
  Grid,
  Camera,
  Eye,
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

function renderFacilityIcon(iconName: string, className = 'w-5 h-5') {
  const IconComp = FACILITY_ICON_MAP[iconName] || Sparkles;
  return <IconComp className={className} />;
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

function collectHotelPhotos(
  hotel: PublicSnapshotHotel,
  hotelRooms: PublicSnapshotRoom[]
): Array<{ url: string; caption: string; category: string; roomName?: string }> {
  const seen = new Set<string>();
  const list: Array<{ url: string; caption: string; category: string; roomName?: string }> = [];

  const pushPhoto = (
    url: string | undefined,
    caption: string,
    category: string,
    roomName?: string
  ) => {
    const clean = (url || '').trim();
    if (!clean || seen.has(clean)) return;
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

export const PublicHotelWebsiteRenderer: React.FC<PublicHotelWebsiteRendererProps> = ({
  snapshot,
  isPreview = false,
  onExitPreview,
}) => {
  const defaultDates = useMemo(() => getDefaultDates(), []);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [activeGalleryCategory, setActiveGalleryCategory] = useState<string>('All');
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    title: string;
    caption: string;
    list?: Array<{ url: string; caption: string; category?: string; roomName?: string }>;
    index?: number;
  } | null>(null);

  // Interactive Hero Search & Directory Filter State
  const [hotelSearchQuery, setHotelSearchQuery] = useState('');
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('All');
  const [selectedStarFilter, setSelectedStarFilter] = useState<number | 'All'>('All');
  const [selectedBudgetFilter, setSelectedBudgetFilter] = useState<
    'all' | 'under_60' | '60_120' | '120_200' | 'over_200'
  >('all');
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'stars_desc'>(
    'featured'
  );

  // Stay Dates & Guests State (shared across Hero Search, Directory, Hotel Page & WhatsApp Enquiry)
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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        {isPreview && onExitPreview && (
          <div className="fixed top-4 right-4 z-50">
            <button
              onClick={onExitPreview}
              className="px-4 py-2 rounded-lg bg-white text-slate-900 text-xs font-semibold shadow-md hover:bg-slate-100 transition cursor-pointer"
            >
              Exit Preview
            </button>
          </div>
        )}
        <div className="max-w-md space-y-4">
          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-amber-500">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-serif font-semibold tracking-tight">
            Public Hotel Directory Setup Pending
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            This public hotel showcase has not yet been configured or published. Please open{' '}
            <strong className="text-slate-200">Public Website</strong> in your CRM dashboard, sync or add your hotels and rooms, and publish your first snapshot.
          </p>
        </div>
      </div>
    );
  }

  const { hotel, homepage, navigation, pages, rooms, facilities, gallery, faqs } = snapshot;
  const hotels: PublicSnapshotHotel[] = Array.isArray(snapshot.hotels) ? snapshot.hotels : [];

  const getPage = (slug: string) => pages.find((p) => p.slug === slug);

  // Compute lowest room price for a hotel
  const getHotelStartingPrice = (h: PublicSnapshotHotel): { price: number | null; currency: string } => {
    const hRooms = rooms.filter((r) => r.hotel_id === h.id && r.optional_price !== null && r.optional_price > 0);
    if (hRooms.length > 0) {
      const minRoom = hRooms.reduce((min, r) =>
        (r.optional_price ?? Infinity) < (min.optional_price ?? Infinity) ? r : min
      );
      return { price: minRoom.optional_price, currency: minRoom.currency || h.currency || 'USD' };
    }
    return { price: h.starting_price, currency: h.currency || 'USD' };
  };

  // Unique cities for filtering
  const hotelCities = useMemo(() => {
    const set = new Set<string>();
    hotels.forEach((h) => {
      if (h.city && h.city.trim()) set.add(h.city.trim());
    });
    return ['All', ...Array.from(set)];
  }, [hotels]);

  // Filtered & Sorted Hotels
  const filteredHotels = useMemo(() => {
    const list = hotels.filter((h) => {
      if (selectedCityFilter !== 'All' && h.city.trim() !== selectedCityFilter) {
        return false;
      }
      if (selectedStarFilter !== 'All' && (h.star_rating || 5) < selectedStarFilter) {
        return false;
      }
      const { price } = getHotelStartingPrice(h);
      if (selectedBudgetFilter !== 'all') {
        if (price === null) return false;
        if (selectedBudgetFilter === 'under_60' && price >= 60) return false;
        if (selectedBudgetFilter === '60_120' && (price < 60 || price > 120)) return false;
        if (selectedBudgetFilter === '120_200' && (price <= 120 || price > 200)) return false;
        if (selectedBudgetFilter === 'over_200' && price <= 200) return false;
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
        return (b.star_rating || 5) - (a.star_rating || 5);
      }
      if (a.is_featured !== b.is_featured) {
        return b.is_featured ? 1 : -1;
      }
      return a.display_order - b.display_order;
    });
  }, [hotels, rooms, selectedCityFilter, selectedStarFilter, selectedBudgetFilter, hotelSearchQuery, sortBy]);

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
    if (activeGalleryCategory === 'All') return gallery;
    return gallery.filter((g) => g.category === activeGalleryCategory);
  }, [gallery, activeGalleryCategory]);

  // Helper to build a pre-filled WhatsApp or Email booking URL
  const buildWhatsAppBookingUrl = (opts: {
    targetHotel?: PublicSnapshotHotel | null;
    targetRoom?: PublicSnapshotRoom | null;
    customNotes?: string;
  }) => {
    const h = opts.targetHotel;
    const r = opts.targetRoom;
    const rawWa = (h?.whatsapp_number || h?.contact_phone || hotel.whatsapp_number || hotel.contact_phone || '').replace(
      /[^0-9]/g,
      ''
    );

    const unitPrice = r?.optional_price ?? (h ? getHotelStartingPrice(h).price : null);
    const currency = r?.currency || h?.currency || 'USD';
    const estimatedTotal =
      unitPrice !== null ? `${currency} ${(unitPrice * stayNights * roomsCount).toLocaleString()}` : 'Please quote rate';

    const lines = [
      `Hello ${hotel.name || 'Reservations Team'}, I would like to enquire about a hotel booking:`,
      '',
      h ? `*Hotel:* ${h.name}${h.city ? ` (${h.city})` : ''}` : `*Brand:* ${hotel.name}`,
      h?.address ? `*Address:* ${h.address}` : '',
      r ? `*Room Type:* ${r.name}${r.bed_type ? ` (${r.bed_type})` : ''}` : '*Room Type:* Best Available Room',
      unitPrice !== null ? `*Indicative Rate:* ${currency} ${unitPrice} / night` : '',
      `*Check-In:* ${checkInDate}`,
      `*Check-Out:* ${checkOutDate} (${stayNights} Night${stayNights === 1 ? '' : 's'})`,
      `*Rooms & Guests:* ${roomsCount} Room${roomsCount === 1 ? '' : 's'}, ${guestsCount} Guest${guestsCount === 1 ? '' : 's'}`,
      unitPrice !== null ? `*Estimated Total:* ${estimatedTotal}` : '',
      opts.customNotes || specialRequests ? `*Special Requests:* ${opts.customNotes || specialRequests}` : '',
    ].filter(Boolean);

    const encodedText = encodeURIComponent(lines.join('\n'));

    if (rawWa) {
      return `https://wa.me/${rawWa}?text=${encodedText}`;
    }

    const emailTarget = h?.contact_email || hotel.contact_email;
    if (emailTarget) {
      const subject = encodeURIComponent(
        `Hotel Booking Enquiry: ${h ? h.name : hotel.name}${r ? ` - ${r.name}` : ''} (${checkInDate} to ${checkOutDate})`
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

  // Build dynamic header links
  const visibleHeaderLinks = useMemo(() => {
    const baseLinks = navigation.header_links.filter((l) => l.visible);
    if (hotels.length > 0 && !baseLinks.some((l) => l.href === '#hotels')) {
      const result = [...baseLinks];
      const roomsIdx = result.findIndex((l) => l.href === '#rooms');
      if (roomsIdx !== -1) {
        result[roomsIdx] = { label: 'Hotels & Rooms', href: '#hotels', visible: true };
      } else {
        result.splice(1, 0, { label: 'Hotels', href: '#hotels', visible: true });
      }
      return result;
    }
    return baseLinks;
  }, [navigation.header_links, hotels.length]);

  const enabledSections = [...homepage.sections]
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  // ============================================================================
  // SHARED LIGHTBOX & ROOM MODAL RENDERERS (WITH MOBILE TOUCH SWIPE)
  // ============================================================================
  const renderRoomDetailModal = (targetHotelFallback?: PublicSnapshotHotel | null) => {
    if (!activeRoomModal) return null;
    const rm = activeRoomModal.room;
    const modalHotel = activeRoomModal.hotel || targetHotelFallback || null;
    const rmPhotos = Array.from(
      new Set([rm.featured_image_url, ...(rm.gallery_images || [])].filter(Boolean))
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

    return (
      <div
        className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4"
        onClick={() => setActiveRoomModal(null)}
      >
        <div
          className="bg-white rounded-t-2xl sm:rounded-2xl max-w-4xl w-full max-h-[94vh] overflow-y-auto border border-stone-200 shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sticky Top Bar for Mobile Convenience */}
          <div className="sticky top-0 z-20 bg-slate-950 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
            <div className="min-w-0 pr-3">
              {modalHotel && (
                <span className="text-[11px] uppercase tracking-wider text-amber-400 font-semibold block truncate">
                  {modalHotel.name}
                </span>
              )}
              <h3 className="text-sm sm:text-base font-serif font-bold truncate">{rm.name}</h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveRoomModal(null)}
              className="p-2 rounded-full bg-slate-800 text-white hover:bg-slate-700 cursor-pointer shrink-0"
              aria-label="Close room gallery"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Large Swipeable Room Image Viewer */}
          {curPhoto && (
            <div
              className="relative aspect-[4/3] sm:aspect-[16/9] bg-slate-950 overflow-hidden select-none"
              onTouchStart={handleTouchStart}
              onTouchEnd={(e) => handleTouchEnd(e, goNext, goPrev)}
            >
              <img
                src={curPhoto}
                alt={`${rm.name} photo ${activeIdx + 1}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />

              {rmPhotos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900/85 text-white flex items-center justify-center hover:bg-slate-900 shadow-lg cursor-pointer"
                    aria-label="Previous room photo"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-slate-900/85 text-white flex items-center justify-center hover:bg-slate-900 shadow-lg cursor-pointer"
                    aria-label="Next room photo"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-slate-900/85 text-white text-xs font-mono">
                    {activeIdx + 1} / {rmPhotos.length}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Room Photo Thumbnail Strip */}
          {rmPhotos.length > 1 && (
            <div className="p-3 bg-stone-950 flex items-center gap-2 overflow-x-auto">
              {rmPhotos.map((u, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() =>
                    setActiveRoomModal({ ...activeRoomModal, activePhotoIdx: idx })
                  }
                  className={`w-16 h-12 sm:w-20 sm:h-14 rounded-lg overflow-hidden shrink-0 border-2 transition cursor-pointer ${
                    activeIdx === idx
                      ? 'border-amber-400 opacity-100 scale-105'
                      : 'border-transparent opacity-60 hover:opacity-90'
                  }`}
                >
                  <img
                    src={u}
                    alt={`${rm.name} thumb ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Room Details & Instant WhatsApp Booking Footer */}
          <div className="p-5 sm:p-7 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h4 className="text-xl sm:text-2xl font-serif font-bold text-slate-900">
                  {rm.name}
                </h4>
                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600 mt-1.5">
                  {rm.capacity && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-100 font-medium">
                      <Users className="w-3.5 h-3.5 text-amber-700" />
                      {rm.capacity}
                    </span>
                  )}
                  {rm.bed_type && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-100 font-medium">
                      <BedDouble className="w-3.5 h-3.5 text-amber-700" />
                      {rm.bed_type}
                    </span>
                  )}
                  {rm.room_size && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-100 font-medium">
                      <Maximize2 className="w-3.5 h-3.5 text-amber-700" />
                      {rm.room_size}
                    </span>
                  )}
                </div>
              </div>

              {rm.optional_price !== null && (
                <div className="text-left sm:text-right bg-stone-50 px-3.5 py-2.5 rounded-xl border border-stone-200">
                  <span className="text-xl sm:text-2xl font-serif font-bold text-slate-900 font-mono">
                    {rm.currency} {rm.optional_price}
                  </span>
                  <span className="text-xs text-stone-500"> / night</span>
                  <span className="block text-xs font-semibold text-emerald-700">
                    {stayNights}N Est: {rm.currency}{' '}
                    {(rm.optional_price * stayNights * roomsCount).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {(rm.full_description || rm.short_description) && (
              <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-line">
                {rm.full_description || rm.short_description}
              </p>
            )}

            {rm.amenities && rm.amenities.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-stone-200">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400 block">
                  Room Features & Amenities
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {rm.amenities.map((am, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-slate-700">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{am}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveRoomModal(null)}
                className="px-4 py-3 rounded-xl border border-stone-300 text-xs font-semibold text-slate-700 hover:bg-stone-100 cursor-pointer"
              >
                Close Preview
              </button>
              <a
                href={buildWhatsAppBookingUrl({
                  targetHotel: modalHotel,
                  targetRoom: rm,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold shadow-sm"
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
        className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-xs flex flex-col justify-between p-3 sm:p-6"
        onClick={() => setLightboxImage(null)}
      >
        <div
          className="max-w-5xl w-full mx-auto flex items-center justify-between text-white gap-3 pt-1"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="min-w-0">
            <span className="text-xs sm:text-sm font-semibold text-white block truncate">
              {lightboxImage.caption || lightboxImage.title}
            </span>
            {hasList && (
              <span className="text-[11px] font-mono text-amber-400">
                Photo {lightboxImage.index! + 1} of {lightboxImage.list!.length} (Swipe left/right)
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="p-2 rounded-full bg-slate-800/90 text-white hover:bg-slate-700 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          className="relative max-w-5xl w-full mx-auto my-auto flex items-center justify-center select-none"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={handleTouchStart}
          onTouchEnd={(e) => handleTouchEnd(e, goNext, goPrev)}
        >
          <img
            src={lightboxImage.url}
            alt={lightboxImage.title}
            referrerPolicy="no-referrer"
            className="w-full max-h-[70vh] sm:max-h-[76vh] object-contain rounded-xl bg-slate-900"
          />

          {hasList && (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-900/85 text-white flex items-center justify-center hover:bg-slate-900 shadow-lg cursor-pointer"
                aria-label="Previous photo"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-900/85 text-white flex items-center justify-center hover:bg-slate-900 shadow-lg cursor-pointer"
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
            <div className="flex items-center gap-2 overflow-x-auto py-1.5 px-1">
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
                      ? 'border-amber-400 opacity-100 scale-105'
                      : 'border-transparent opacity-50 hover:opacity-80'
                  }`}
                >
                  <img
                    src={item.url}
                    alt={item.caption}
                    referrerPolicy="no-referrer"
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
    const hotelPhotos = collectHotelPhotos(activeHotel, activeHotelRooms);
    const safeMobileIdx = Math.min(mobileHeroPhotoIdx, Math.max(0, hotelPhotos.length - 1));
    const currentMobileHeroPhoto = hotelPhotos[safeMobileIdx] || hotelPhotos[0];

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
      selectedBookingRoom?.currency || activeHotel.currency || 'USD';

    const roomsToCompare =
      compareRoomIds.length > 0
        ? activeHotelRooms.filter((r) => compareRoomIds.includes(r.id))
        : activeHotelRooms;

    return (
      <div className="min-h-screen bg-[#FAF8F5] text-slate-900 font-sans selection:bg-amber-900 selection:text-white pb-24 lg:pb-0">
        {/* Preview Top Bar */}
        {isPreview && (
          <div className="sticky top-0 z-50 bg-amber-950 text-amber-50 px-3 sm:px-4 py-2 text-xs flex items-center justify-between gap-2 border-b border-amber-800">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold uppercase tracking-wider text-amber-300 shrink-0">
                Preview
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-amber-100/90 truncate">
                Hotel Page: <strong>{activeHotel.name}</strong>
              </span>
            </div>
            {onExitPreview && (
              <button
                onClick={onExitPreview}
                className="px-2.5 py-1 rounded bg-white text-slate-900 font-semibold hover:bg-amber-100 transition cursor-pointer shrink-0"
              >
                Exit Preview
              </button>
            )}
          </div>
        )}

        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-40 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-stone-200/80">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
              <button
                onClick={() => navigateToHotelPage(null)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-xs font-semibold text-slate-800 transition cursor-pointer shrink-0 shadow-2xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>All Hotels ({hotels.length})</span>
              </button>
              <div className="hidden sm:block h-6 w-px bg-stone-300" />
              <div className="truncate">
                <span className="text-[11px] text-stone-500 block truncate">{hotel.name}</span>
                <span className="text-xs sm:text-sm font-serif font-bold text-slate-900 truncate block">
                  {activeHotel.name}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleShareHotelPage(activeHotel)}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-stone-300 rounded-xl hover:bg-stone-100 transition cursor-pointer"
                title="Copy direct link to this hotel page"
              >
                {copiedShareLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copied</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5 text-stone-500" />
                    <span className="hidden sm:inline">Share</span>
                  </>
                )}
              </button>

              <a
                href={buildWhatsAppBookingUrl({
                  targetHotel: activeHotel,
                  targetRoom: selectedBookingRoom,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition shadow-xs"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp</span>
                <span className="hidden md:inline">Booking Enquiry</span>
              </a>
            </div>
          </div>
        </header>

        {/* Hotel Header Title Bar + Mobile Swipeable Gallery + Desktop Bento 5-Photo Mosaic */}
        <section className="bg-white border-b border-stone-200/80 pt-4 sm:pt-6 pb-6 sm:pb-8">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
            {/* Title, Stars & Location Row */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-amber-800 font-semibold uppercase tracking-widest">
                  {activeHotel.star_rating > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-amber-500">
                      {Array.from({ length: Math.min(5, Math.max(1, activeHotel.star_rating)) }).map(
                        (_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-amber-400 text-amber-400" />
                        )
                      )}
                    </span>
                  )}
                  {activeHotel.city && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        {[activeHotel.city, activeHotel.country].filter(Boolean).join(', ')}
                      </span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>{activeHotelRooms.length} Room Categories</span>
                </div>

                <h1 className="text-2xl sm:text-4xl lg:text-5xl font-serif font-semibold text-slate-900 tracking-tight leading-tight">
                  {activeHotel.name}
                </h1>

                {activeHotel.address && (
                  <p className="text-xs sm:text-sm text-stone-600 flex flex-wrap items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>{activeHotel.address}</span>
                    {hotelMapsUrl && (
                      <a
                        href={hotelMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-amber-800 hover:underline inline-flex items-center gap-1 ml-1"
                      >
                        <span>View on Map</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </p>
                )}
              </div>

              {/* Starting Price Callout */}
              {selectedUnitPrice !== null && (
                <div className="flex items-center justify-between lg:items-baseline gap-3 lg:text-right bg-stone-50 px-4 py-3 rounded-xl border border-stone-200/80 shrink-0">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-stone-500 block">
                      Indicative Rate From
                    </span>
                    <div className="text-xl sm:text-2xl font-serif font-bold text-slate-900 font-mono tabular-nums">
                      {selectedCurrency} {selectedUnitPrice}
                      <span className="text-xs font-sans font-normal text-stone-500"> / night</span>
                    </div>
                    <span className="text-[11px] text-emerald-700 font-medium block">
                      {stayNights} night{stayNights === 1 ? '' : 's'} est. {selectedCurrency}{' '}
                      {(selectedUnitPrice * stayNights * roomsCount).toLocaleString()}
                    </span>
                  </div>
                  <a
                    href="#hotel-rooms"
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
                  >
                    Select Room
                  </a>
                </div>
              )}
            </div>

            {/* PHOTO SHOWCASE: MOBILE SWIPEABLE GALLERY + FILMSTRIP (< md) AND BENTO 5-PHOTO MOSAIC (md+) */}
            {hotelPhotos.length > 0 ? (
              <div className="space-y-2.5">
                {/* 1. MOBILE INTERACTIVE SWIPE GALLERY + THUMBNAIL STRIP (< md) */}
                <div className="md:hidden space-y-2">
                  <div
                    className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-slate-950 border border-stone-200 select-none"
                    onTouchStart={handleTouchStart}
                    onTouchEnd={(e) =>
                      handleTouchEnd(
                        e,
                        () => setMobileHeroPhotoIdx((safeMobileIdx + 1) % hotelPhotos.length),
                        () =>
                          setMobileHeroPhotoIdx(
                            (safeMobileIdx - 1 + hotelPhotos.length) % hotelPhotos.length
                          )
                      )
                    }
                  >
                    <img
                      src={currentMobileHeroPhoto.url}
                      alt={currentMobileHeroPhoto.caption}
                      referrerPolicy="no-referrer"
                      onClick={() =>
                        setLightboxImage({
                          url: currentMobileHeroPhoto.url,
                          title: activeHotel.name,
                          caption: currentMobileHeroPhoto.caption,
                          list: hotelPhotos,
                          index: safeMobileIdx,
                        })
                      }
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-slate-950/25 pointer-events-none" />

                    {/* Top Badge: Category / Room Label + Counter */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                      <span className="px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-xs text-amber-300 text-[11px] font-semibold truncate max-w-[70%]">
                        {currentMobileHeroPhoto.roomName
                          ? `Room: ${currentMobileHeroPhoto.roomName}`
                          : currentMobileHeroPhoto.caption}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-slate-950/80 text-white text-[11px] font-mono">
                        {safeMobileIdx + 1} / {hotelPhotos.length}
                      </span>
                    </div>

                    {/* Always-Visible Mobile Touch Arrows */}
                    {hotelPhotos.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMobileHeroPhotoIdx(
                              (safeMobileIdx - 1 + hotelPhotos.length) % hotelPhotos.length
                            );
                          }}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-950/75 text-white flex items-center justify-center shadow-md active:scale-95"
                          aria-label="Previous photo"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMobileHeroPhotoIdx((safeMobileIdx + 1) % hotelPhotos.length);
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-950/75 text-white flex items-center justify-center shadow-md active:scale-95"
                          aria-label="Next photo"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </>
                    )}

                    {/* Bottom Fullscreen Button */}
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxImage({
                          url: currentMobileHeroPhoto.url,
                          title: activeHotel.name,
                          caption: currentMobileHeroPhoto.caption,
                          list: hotelPhotos,
                          index: safeMobileIdx,
                        })
                      }
                      className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 text-slate-900 text-xs font-semibold shadow-md"
                    >
                      <Camera className="w-3.5 h-3.5 text-amber-700" />
                      <span>All {hotelPhotos.length} Photos</span>
                    </button>
                  </div>

                  {/* Mobile Horizontal Scrollable Photo Filmstrip */}
                  {hotelPhotos.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
                      {hotelPhotos.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setMobileHeroPhotoIdx(idx)}
                          className={`relative w-16 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition ${
                            safeMobileIdx === idx
                              ? 'border-amber-600 ring-2 ring-amber-500/30 opacity-100'
                              : 'border-stone-200 opacity-65'
                          }`}
                        >
                          <img
                            src={p.url}
                            alt={p.caption}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          {p.roomName && (
                            <span className="absolute bottom-0 inset-x-0 bg-slate-950/80 text-[8px] text-amber-300 font-medium truncate px-1">
                              Room
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. DESKTOP BENTO-STYLE 5-PHOTO GALLERY HEADER (md+) */}
                <div className="hidden md:block relative rounded-2xl overflow-hidden border border-stone-200 bg-slate-900">
                  {hotelPhotos.length === 1 ? (
                    <div
                      onClick={() =>
                        setLightboxImage({
                          url: hotelPhotos[0].url,
                          title: activeHotel.name,
                          caption: hotelPhotos[0].caption,
                          list: hotelPhotos,
                          index: 0,
                        })
                      }
                      className="aspect-[21/9] max-h-[460px] w-full overflow-hidden cursor-pointer group"
                    >
                      <img
                        src={hotelPhotos[0].url}
                        alt={activeHotel.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[440px]">
                      {/* Main Left Hero Photo (2 cols x 2 rows) */}
                      <div
                        onClick={() =>
                          setLightboxImage({
                            url: hotelPhotos[0].url,
                            title: activeHotel.name,
                            caption: hotelPhotos[0].caption,
                            list: hotelPhotos,
                            index: 0,
                          })
                        }
                        className="col-span-2 row-span-2 relative overflow-hidden cursor-pointer group bg-slate-900"
                      >
                        <img
                          src={hotelPhotos[0].url}
                          alt={hotelPhotos[0].caption}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
                        <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-md bg-slate-950/75 text-white text-xs font-medium">
                          {hotelPhotos[0].caption}
                        </span>
                      </div>

                      {/* Up to 4 Right Bento Mosaic Photos */}
                      {[1, 2, 3, 4].map((slotIdx) => {
                        const item =
                          hotelPhotos[slotIdx] || hotelPhotos[slotIdx % hotelPhotos.length];
                        const realIdx = hotelPhotos[slotIdx]
                          ? slotIdx
                          : slotIdx % hotelPhotos.length;
                        return (
                          <div
                            key={slotIdx}
                            onClick={() =>
                              setLightboxImage({
                                url: item.url,
                                title: activeHotel.name,
                                caption: item.caption,
                                list: hotelPhotos,
                                index: realIdx,
                              })
                            }
                            className="relative overflow-hidden cursor-pointer group bg-slate-900"
                          >
                            <img
                              src={item.url}
                              alt={item.caption}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition" />
                            <span className="absolute bottom-2.5 left-2.5 right-2.5 text-white text-[11px] font-medium truncate">
                              {item.roomName ? `Room: ${item.roomName}` : item.caption}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Floating "View All Photos" Button */}
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxImage({
                        url: hotelPhotos[0].url,
                        title: activeHotel.name,
                        caption: hotelPhotos[0].caption,
                        list: hotelPhotos,
                        index: 0,
                      })
                    }
                    className="absolute bottom-4 right-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/95 hover:bg-white text-slate-900 text-xs font-semibold shadow-lg border border-stone-200 transition cursor-pointer"
                  >
                    <Grid className="w-4 h-4 text-amber-700" />
                    <span>View All {hotelPhotos.length} Hotel & Room Photos</span>
                  </button>
                </div>
              </div>
            ) : null}

            {/* VISUAL ROOM PHOTO QUICK-EXPLORER BAR (HIGHLIGHTS ALL ROOM PICTURES IMMEDIATELY) */}
            {activeHotelRooms.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Quick Room Photo Explorer — Tap Any Room to See Pictures</span>
                  </span>
                  <span className="text-[11px] text-stone-500 hidden sm:inline">
                    {activeHotelRooms.length} Room Types Available
                  </span>
                </div>

                <div className="flex items-stretch gap-3 overflow-x-auto pb-2">
                  {activeHotelRooms.map((rm) => {
                    const rmPhotos = Array.from(
                      new Set([rm.featured_image_url, ...(rm.gallery_images || [])].filter(Boolean))
                    );
                    const thumb = rmPhotos[0] || activeHotel.featured_image_url;
                    return (
                      <div
                        key={rm.id}
                        onClick={() =>
                          setActiveRoomModal({
                            room: rm,
                            hotel: activeHotel,
                            activePhotoIdx: 0,
                          })
                        }
                        className="group w-44 sm:w-56 shrink-0 bg-stone-50 hover:bg-amber-50/50 rounded-xl border border-stone-200/90 hover:border-amber-600/50 overflow-hidden cursor-pointer transition flex flex-col justify-between shadow-2xs"
                      >
                        <div className="aspect-[16/10] bg-stone-900 relative overflow-hidden">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={rm.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-500">
                              <BedDouble className="w-6 h-6" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-slate-950/80 text-white text-[10px] font-mono inline-flex items-center gap-1">
                            <Camera className="w-2.5 h-2.5 text-amber-400" />
                            {rmPhotos.length}
                          </span>
                          {rm.optional_price !== null && (
                            <span className="absolute bottom-2 left-2.5 text-white text-xs font-mono font-bold">
                              {rm.currency} {rm.optional_price}
                              <span className="text-[10px] font-normal text-stone-200">/night</span>
                            </span>
                          )}
                        </div>
                        <div className="p-2.5 flex items-center justify-between gap-1">
                          <div className="min-w-0">
                            <h3 className="text-xs font-serif font-bold text-slate-900 truncate">
                              {rm.name}
                            </h3>
                            <span className="text-[10px] text-amber-800 font-semibold block">
                              Tap to view room photos →
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Main Content Grid: Room Types & Room Comparison (Left 8 cols) + Instant WhatsApp Booking Calculator & Hotel Info (Right 4 cols) */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* LEFT 8 COLUMNS: ROOM TYPES, ROOM PHOTOS & SIDE-BY-SIDE ROOM COMPARISON */}
            <div id="hotel-rooms" className="lg:col-span-8 space-y-6 sm:space-y-8">
              {/* Room Section Header + Compare Mode Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-amber-800 block">
                    Accommodations & Room Pictures
                  </span>
                  <h2 className="text-xl sm:text-2xl font-serif font-semibold text-slate-900 mt-0.5">
                    Available Room Types at {activeHotel.name} ({activeHotelRooms.length})
                  </h2>
                </div>

                {activeHotelRooms.length > 1 && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowComparisonMatrix((prev) => !prev)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        showComparisonMatrix
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-800 border-stone-300 hover:bg-stone-100'
                      }`}
                    >
                      <Columns className="w-4 h-4" />
                      <span>
                        {showComparisonMatrix
                          ? 'Hide Room Comparison'
                          : compareRoomIds.length > 0
                          ? `Compare Selected Rooms (${compareRoomIds.length})`
                          : `Compare All ${activeHotelRooms.length} Rooms`}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* SIDE-BY-SIDE ROOM COMPARISON MATRIX */}
              {showComparisonMatrix && activeHotelRooms.length > 1 && (
                <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
                  <div className="p-4 bg-stone-100/80 border-b border-stone-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Side-by-Side Room Type Comparison — {activeHotel.name}
                      </h3>
                      <p className="text-xs text-stone-500">
                        Comparing {roomsToCompare.length} room categor{roomsToCompare.length === 1 ? 'y' : 'ies'} for {stayNights} night{stayNights === 1 ? '' : 's'} ({checkInDate} to {checkOutDate})
                      </p>
                    </div>
                    {compareRoomIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCompareRoomIds([])}
                        className="text-xs font-semibold text-amber-800 hover:underline cursor-pointer"
                      >
                        Show All Rooms
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-stone-200 bg-stone-50/60">
                          <th className="p-4 font-semibold text-stone-500 w-36">Room Feature</th>
                          {roomsToCompare.map((rm) => {
                            const rmImg = rm.featured_image_url || rm.gallery_images?.[0];
                            return (
                              <th key={rm.id} className="p-4 min-w-[210px] align-top border-l border-stone-200/70">
                                {rmImg && (
                                  <div className="aspect-[16/10] rounded-lg overflow-hidden bg-stone-200 mb-2.5">
                                    <img
                                      src={rmImg}
                                      alt={rm.name}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )}
                                <div className="text-sm font-serif font-bold text-slate-900">
                                  {rm.name}
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200/80">
                        <tr>
                          <td className="p-4 font-semibold text-stone-600 bg-stone-50/40">Nightly Rate</td>
                          {roomsToCompare.map((rm) => (
                            <td key={rm.id} className="p-4 border-l border-stone-200/70 font-mono font-bold text-slate-900 text-sm">
                              {rm.optional_price !== null
                                ? `${rm.currency} ${rm.optional_price} / night`
                                : 'Rate on enquiry'}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-4 font-semibold text-stone-600 bg-stone-50/40">
                            Est. Total ({stayNights}N × {roomsCount}R)
                          </td>
                          {roomsToCompare.map((rm) => (
                            <td key={rm.id} className="p-4 border-l border-stone-200/70 font-mono font-semibold text-emerald-800">
                              {rm.optional_price !== null
                                ? `${rm.currency} ${(rm.optional_price * stayNights * roomsCount).toLocaleString()}`
                                : 'Contact for quote'}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-4 font-semibold text-stone-600 bg-stone-50/40">Guest Capacity</td>
                          {roomsToCompare.map((rm) => (
                            <td key={rm.id} className="p-4 border-l border-stone-200/70 text-slate-700">
                              {rm.capacity || 'Standard Occupancy'}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-4 font-semibold text-stone-600 bg-stone-50/40">Bed Configuration</td>
                          {roomsToCompare.map((rm) => (
                            <td key={rm.id} className="p-4 border-l border-stone-200/70 text-slate-700">
                              {rm.bed_type || 'King / Twin Available'}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-4 font-semibold text-stone-600 bg-stone-50/40">Room Size</td>
                          {roomsToCompare.map((rm) => (
                            <td key={rm.id} className="p-4 border-l border-stone-200/70 text-slate-700">
                              {rm.room_size || 'Spacious Layout'}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-4 font-semibold text-stone-600 bg-stone-50/40">Room Amenities</td>
                          {roomsToCompare.map((rm) => (
                            <td key={rm.id} className="p-4 border-l border-stone-200/70 text-stone-600">
                              {rm.amenities && rm.amenities.length > 0 ? (
                                <ul className="space-y-1">
                                  {rm.amenities.map((am, i) => (
                                    <li key={i} className="flex items-center gap-1.5">
                                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span>{am}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span>Standard Hotel Amenities</span>
                              )}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="p-4 font-semibold text-stone-600 bg-stone-50/40">Direct Booking</td>
                          {roomsToCompare.map((rm) => (
                            <td key={rm.id} className="p-4 border-l border-stone-200/70">
                              <a
                                href={buildWhatsAppBookingUrl({
                                  targetHotel: activeHotel,
                                  targetRoom: rm,
                                })}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold transition"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>Book via WhatsApp</span>
                              </a>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* DETAILED ROOM CARDS LIST WITH PROMINENT PHOTO GALLERIES */}
              {activeHotelRooms.length === 0 ? (
                <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-3">
                  <BedDouble className="w-8 h-8 text-stone-400 mx-auto" />
                  <h3 className="text-base font-serif font-semibold text-slate-900">
                    Room Categories Available on Request
                  </h3>
                  <p className="text-xs text-stone-500 max-w-md mx-auto">
                    Contact our reservations desk via WhatsApp or phone for current room availability and group rates at {activeHotel.name}.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {activeHotelRooms.map((room) => {
                    const roomPhotos = Array.from(
                      new Set([room.featured_image_url, ...(room.gallery_images || [])].filter(Boolean))
                    );
                    const currentPhotoIdx = roomPhotoIndices[room.id] || 0;
                    const displayedPhoto = roomPhotos[currentPhotoIdx] || roomPhotos[0] || '';
                    const isComparing = compareRoomIds.includes(room.id);

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
                        [room.id]: (currentPhotoIdx - 1 + roomPhotos.length) % roomPhotos.length,
                      }));
                    };

                    return (
                      <article
                        id={`room-card-${room.id}`}
                        key={room.id}
                        className="bg-white rounded-2xl border border-stone-200/90 overflow-hidden shadow-xs hover:shadow-md transition"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-12">
                          {/* Room Photo Carousel & Interactive Thumbnail Strip (6 cols on desktop for bigger room pictures!) */}
                          <div className="md:col-span-6 bg-stone-950 flex flex-col justify-between relative">
                            {displayedPhoto ? (
                              <div
                                className="relative aspect-[4/3] w-full overflow-hidden group select-none"
                                onTouchStart={handleTouchStart}
                                onTouchEnd={(e) =>
                                  handleTouchEnd(e, nextRoomPhoto, prevRoomPhoto)
                                }
                              >
                                <img
                                  src={displayedPhoto}
                                  alt={room.name}
                                  referrerPolicy="no-referrer"
                                  onClick={() =>
                                    setActiveRoomModal({
                                      room,
                                      hotel: activeHotel,
                                      activePhotoIdx: currentPhotoIdx,
                                    })
                                  }
                                  className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition duration-500"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-slate-950/20 pointer-events-none" />

                                {/* Top Photo Badge */}
                                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-slate-950/80 text-amber-300 text-[11px] font-semibold inline-flex items-center gap-1.5 pointer-events-none">
                                  <Camera className="w-3.5 h-3.5" />
                                  <span>
                                    {roomPhotos.length > 1
                                      ? `Room Photo ${currentPhotoIdx + 1} of ${roomPhotos.length}`
                                      : 'Room Photo'}
                                  </span>
                                </span>

                                {roomPhotos.length > 1 && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        prevRoomPhoto();
                                      }}
                                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-950/80 text-white flex items-center justify-center hover:bg-slate-950 shadow-md cursor-pointer"
                                      aria-label="Previous room photo"
                                    >
                                      <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        nextRoomPhoto();
                                      }}
                                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-950/80 text-white flex items-center justify-center hover:bg-slate-950 shadow-md cursor-pointer"
                                      aria-label="Next room photo"
                                    >
                                      <ChevronRight className="w-5 h-5" />
                                    </button>
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
                                  className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 text-slate-900 text-xs font-semibold shadow-md hover:bg-white transition cursor-pointer"
                                >
                                  <Maximize2 className="w-3.5 h-3.5 text-amber-700" />
                                  <span>Enlarge Room Photos ({roomPhotos.length})</span>
                                </button>
                              </div>
                            ) : (
                              <div className="aspect-[4/3] w-full flex flex-col items-center justify-center text-stone-500 p-6 text-center">
                                <BedDouble className="w-8 h-8 mb-2 opacity-60" />
                                <span className="text-xs">{room.name}</span>
                              </div>
                            )}

                            {/* Prominent Interactive Room Photo Thumbnails */}
                            {roomPhotos.length > 1 && (
                              <div className="p-2.5 bg-stone-950 flex items-center gap-2 overflow-x-auto border-t border-stone-800">
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
                                    className={`w-16 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition cursor-pointer ${
                                      currentPhotoIdx === pIdx
                                        ? 'border-amber-400 opacity-100 scale-105'
                                        : 'border-transparent opacity-60 hover:opacity-95'
                                    }`}
                                  >
                                    <img
                                      src={pUrl}
                                      alt={`${room.name} thumbnail ${pIdx + 1}`}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Room Specs, Description, Compare Checkbox & WhatsApp Booking CTA (6 cols) */}
                          <div className="md:col-span-6 p-5 sm:p-6 flex flex-col justify-between gap-4">
                            <div className="space-y-3.5">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <h3 className="text-xl font-serif font-semibold text-slate-900">
                                    {room.name}
                                  </h3>
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-700 mt-2">
                                    {room.capacity && (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-100 font-medium">
                                        <Users className="w-3.5 h-3.5 text-amber-700" />
                                        {room.capacity}
                                      </span>
                                    )}
                                    {room.bed_type && (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-100 font-medium">
                                        <BedDouble className="w-3.5 h-3.5 text-amber-700" />
                                        {room.bed_type}
                                      </span>
                                    )}
                                    {room.room_size && (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-stone-100 font-medium">
                                        <Maximize2 className="w-3.5 h-3.5 text-amber-700" />
                                        {room.room_size}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="text-left sm:text-right bg-stone-50 px-3 py-2 rounded-xl border border-stone-200/80">
                                  {room.optional_price !== null ? (
                                    <div>
                                      <span className="text-xl font-serif font-bold text-slate-900 font-mono tabular-nums">
                                        {room.currency} {room.optional_price}
                                      </span>
                                      <span className="text-xs text-stone-500"> / night</span>
                                      {room.price_note && (
                                        <span className="block text-[11px] text-stone-500">
                                          {room.price_note}
                                        </span>
                                      )}
                                      <span className="block text-[11px] font-semibold text-emerald-700 mt-0.5">
                                        {stayNights} night{stayNights === 1 ? '' : 's'}:{' '}
                                        {room.currency}{' '}
                                        {(
                                          room.optional_price *
                                          stayNights *
                                          roomsCount
                                        ).toLocaleString()}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-xs font-semibold text-amber-800">
                                      Rate on Enquiry
                                    </span>
                                  )}
                                </div>
                              </div>

                              {(room.full_description || room.short_description) && (
                                <p className="text-sm text-stone-600 leading-relaxed">
                                  {room.full_description || room.short_description}
                                </p>
                              )}

                              {room.amenities && room.amenities.length > 0 && (
                                <div className="pt-1">
                                  <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block mb-1.5">
                                    Room Highlights
                                  </span>
                                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-700">
                                    {room.amenities.map((am, idx) => (
                                      <span
                                        key={idx}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-100 text-stone-700"
                                      >
                                        <Check className="w-3 h-3 text-emerald-600" />
                                        <span>{am}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="pt-4 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center justify-between sm:justify-start gap-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveRoomModal({
                                      room,
                                      hotel: activeHotel,
                                      activePhotoIdx: currentPhotoIdx,
                                    })
                                  }
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-900 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View All {roomPhotos.length} Room Photos</span>
                                </button>

                                {activeHotelRooms.length > 1 && (
                                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 cursor-pointer select-none bg-stone-100 px-2.5 py-1 rounded-lg">
                                    <input
                                      type="checkbox"
                                      checked={isComparing}
                                      onChange={() => {
                                        toggleRoomCompare(room.id);
                                        setShowComparisonMatrix(true);
                                      }}
                                      className="rounded border-stone-300 text-amber-700"
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
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition shadow-xs"
                              >
                                <MessageCircle className="w-4 h-4" />
                                <span>Book This Room on WhatsApp</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {/* About This Hotel & Property Amenities */}
              <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-8 space-y-6">
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-amber-800 block">
                    Property Overview
                  </span>
                  <h3 className="text-xl font-serif font-semibold text-slate-900">
                    About {activeHotel.name}
                  </h3>
                </div>
                <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-line">
                  {activeHotel.full_description ||
                    activeHotel.short_description ||
                    `Welcome to ${activeHotel.name}${
                      activeHotel.city ? ` in ${activeHotel.city}` : ''
                    }. Browse our room types above or send a pre-filled WhatsApp enquiry for immediate reservation confirmation.`}
                </p>

                {activeHotel.amenities && activeHotel.amenities.length > 0 && (
                  <div className="pt-4 border-t border-stone-100 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                      Hotel Facilities & Services
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {activeHotel.amenities.map((am, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-slate-700">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{am}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT 4 COLUMNS: STICKY INSTANT WHATSAPP BOOKING CALCULATOR & LOCATION CARD */}
            <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
              {/* Pre-Filled WhatsApp Booking Enquiry Calculator Card */}
              <div className="bg-white rounded-2xl border-2 border-stone-900/10 shadow-md p-5 sm:p-6 space-y-5">
                <div className="border-b border-stone-200 pb-3.5">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-700 block">
                    Fast Reservation Enquiry
                  </span>
                  <h3 className="text-lg font-serif font-bold text-slate-900 mt-0.5">
                    Book or Enquire via WhatsApp
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Select your room and dates below to send a pre-filled reservation request directly to our team.
                  </p>
                </div>

                <div className="space-y-3.5">
                  {/* Room Type Selector */}
                  {activeHotelRooms.length > 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Select Room Type
                      </label>
                      <select
                        value={selectedBookingRoom?.id ?? ''}
                        onChange={(e) => setBookingRoomId(Number(e.target.value))}
                        className="w-full px-3 py-2.5 text-xs font-medium bg-stone-50 border border-stone-300 rounded-xl text-slate-900"
                      >
                        {activeHotelRooms.map((rm) => (
                          <option key={rm.id} value={rm.id}>
                            {rm.name}{' '}
                            {rm.optional_price !== null
                              ? `(${rm.currency} ${rm.optional_price}/night)`
                              : '(Rate on enquiry)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Check-in & Check-out Dates */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Check-In Date
                      </label>
                      <input
                        type="date"
                        value={checkInDate}
                        onChange={(e) => setCheckInDate(e.target.value)}
                        className="w-full px-2.5 py-2.5 text-xs bg-stone-50 border border-stone-300 rounded-xl text-slate-900 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Check-Out Date
                      </label>
                      <input
                        type="date"
                        value={checkOutDate}
                        min={checkInDate}
                        onChange={(e) => setCheckOutDate(e.target.value)}
                        className="w-full px-2.5 py-2.5 text-xs bg-stone-50 border border-stone-300 rounded-xl text-slate-900 font-mono"
                      />
                    </div>
                  </div>

                  {/* Rooms & Guests */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Rooms
                      </label>
                      <select
                        value={roomsCount}
                        onChange={(e) => setRoomsCount(Number(e.target.value))}
                        className="w-full px-3 py-2.5 text-xs bg-stone-50 border border-stone-300 rounded-xl text-slate-900"
                      >
                        {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                          <option key={n} value={n}>
                            {n} Room{n === 1 ? '' : 's'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Guests
                      </label>
                      <select
                        value={guestsCount}
                        onChange={(e) => setGuestsCount(Number(e.target.value))}
                        className="w-full px-3 py-2.5 text-xs bg-stone-50 border border-stone-300 rounded-xl text-slate-900"
                      >
                        {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                          <option key={n} value={n}>
                            {n} Guest{n === 1 ? '' : 's'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Special Requests */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Special Requests (Optional)
                    </label>
                    <input
                      type="text"
                      value={specialRequests}
                      onChange={(e) => setSpecialRequests(e.target.value)}
                      placeholder="e.g., Airport pickup, Twin beds, Early check-in..."
                      className="w-full px-3 py-2.5 text-xs bg-stone-50 border border-stone-300 rounded-xl text-slate-900"
                    />
                  </div>

                  {/* Price Calculation Summary Box */}
                  <div className="p-3.5 rounded-xl bg-stone-100/90 border border-stone-200/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-stone-600">
                      <span>Duration</span>
                      <span className="font-mono font-semibold text-slate-900">
                        {stayNights} Night{stayNights === 1 ? '' : 's'} · {roomsCount} Room
                        {roomsCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    {selectedUnitPrice !== null && (
                      <div className="flex items-center justify-between pt-1.5 border-t border-stone-200/80">
                        <span className="font-semibold text-slate-800">Estimated Total</span>
                        <span className="text-base font-serif font-bold text-emerald-800 font-mono tabular-nums">
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
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold shadow-sm transition"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Send Booking Enquiry on WhatsApp</span>
                  </a>
                </div>

                {/* Direct Contact Numbers */}
                <div className="pt-3 border-t border-stone-200/80 space-y-2 text-xs text-stone-600">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-700" />
                      Check-In / Out
                    </span>
                    <span className="font-mono font-semibold text-slate-800">
                      {hotelCheckIn} / {hotelCheckOut}
                    </span>
                  </div>
                  {hotelPhone && (
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-amber-700" />
                        Direct Phone
                      </span>
                      <a href={`tel:${hotelPhone}`} className="font-mono font-semibold text-slate-900 hover:underline">
                        {hotelPhone}
                      </a>
                    </div>
                  )}
                  {hotelEmail && (
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-amber-700" />
                        Email
                      </span>
                      <a href={`mailto:${hotelEmail}`} className="font-semibold text-slate-900 hover:underline truncate max-w-[180px]">
                        {hotelEmail}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Location & Map Card */}
              {(activeHotel.address || hotelMapsUrl || hotelMapsEmbed) && (
                <div className="bg-white rounded-2xl border border-stone-200 p-5 sm:p-6 space-y-4">
                  <h3 className="text-base font-serif font-semibold text-slate-900">
                    Location & Map
                  </h3>
                  {activeHotel.address && (
                    <p className="text-xs text-stone-600 leading-relaxed">
                      {activeHotel.address}
                      {activeHotel.city ? `, ${activeHotel.city}` : ''}
                      {activeHotel.country ? `, ${activeHotel.country}` : ''}
                    </p>
                  )}
                  {hotelMapsEmbed && (
                    <div className="aspect-[4/3] w-full rounded-xl overflow-hidden border border-stone-200 bg-stone-100">
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
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-900"
                    >
                      <span>Open in Google Maps</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}
            </aside>
          </div>
        </div>

        {/* Mobile Sticky Bottom Quick-Book & Room Photos Bar */}
        <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white/95 backdrop-blur-md border-t border-stone-200 px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-lg">
          <div className="min-w-0">
            <span className="text-[10px] text-stone-500 block truncate">
              {selectedBookingRoom ? selectedBookingRoom.name : activeHotel.name}
            </span>
            <span className="text-sm font-serif font-bold text-slate-900 font-mono">
              {selectedUnitPrice !== null
                ? `${selectedCurrency} ${selectedUnitPrice}/night`
                : 'Rates on Request'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hotelPhotos.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setLightboxImage({
                    url: hotelPhotos[0].url,
                    title: activeHotel.name,
                    caption: hotelPhotos[0].caption,
                    list: hotelPhotos,
                    index: 0,
                  })
                }
                className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl border border-stone-300 bg-stone-50 text-slate-800 text-xs font-semibold"
              >
                <Camera className="w-3.5 h-3.5 text-amber-700" />
                <span>Photos ({hotelPhotos.length})</span>
              </button>
            )}
            <a
              href={buildWhatsAppBookingUrl({
                targetHotel: activeHotel,
                targetRoom: selectedBookingRoom,
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-semibold shadow-xs"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Book Now</span>
            </a>
          </div>
        </div>

        {renderRoomDetailModal(activeHotel)}
        {renderFullLightboxModal()}
      </div>
    );
  }

  // ============================================================================
  // MAIN DIRECTORY & HOMEPAGE VIEW
  // ============================================================================
  const renderSection = (sectionId: string) => {
    switch (sectionId) {
      case 'hero': {
        const heroHeading = homepage.hero_heading || hotel.name;
        const heroSubtitle = homepage.hero_subtitle || hotel.tagline || hotel.short_description;
        return (
          <section
            id="home"
            key="hero"
            className="relative bg-slate-900 text-white overflow-hidden"
          >
            {homepage.hero_image_url ? (
              <div className="absolute inset-0">
                <img
                  src={homepage.hero_image_url}
                  alt={heroHeading}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-50"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/30" />
              </div>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-stone-900" />
            )}

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-10 sm:pt-16 sm:pb-14 lg:pt-24 lg:pb-20 space-y-6 sm:space-y-10">
              <div className="max-w-3xl space-y-3 sm:space-y-5">
                {hotel.tagline && (
                  <p className="text-[11px] sm:text-sm uppercase tracking-[0.2em] text-amber-400 font-semibold">
                    {hotel.tagline}
                  </p>
                )}
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-serif font-semibold tracking-tight leading-[1.1] text-white">
                  {heroHeading}
                </h1>
                {heroSubtitle && (
                  <p className="text-sm sm:text-lg text-slate-200 leading-relaxed max-w-2xl">
                    {heroSubtitle}
                  </p>
                )}
              </div>

              {/* MOBILE-FRIENDLY INTERACTIVE BOOKING.COM / AGODA / TRIP.COM STYLE HERO SEARCH BAR */}
              {hotels.length > 0 && (
                <div className="bg-white/95 backdrop-blur-md text-slate-900 rounded-2xl p-3.5 sm:p-5 shadow-2xl border border-white/20">
                  <div className="grid grid-cols-2 lg:grid-cols-12 gap-2.5 sm:gap-3 items-end">
                    {/* Destination / City + Keyword (Full width on mobile) */}
                    <div className="col-span-2 lg:col-span-3">
                      <label className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                        Destination / City
                      </label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-amber-700 absolute left-3 top-1/2 -translate-y-1/2" />
                        <select
                          value={selectedCityFilter}
                          onChange={(e) => setSelectedCityFilter(e.target.value)}
                          className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm font-semibold bg-stone-50 border border-stone-300 rounded-xl text-slate-900 focus:outline-none focus:border-amber-700"
                        >
                          {hotelCities.map((c) => (
                            <option key={c} value={c}>
                              {c === 'All' ? `All Cities (${hotels.length} Hotels)` : c}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Check-In Date (Half width on mobile) */}
                    <div className="col-span-1 lg:col-span-2">
                      <label className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                        Check-In
                      </label>
                      <input
                        type="date"
                        value={checkInDate}
                        onChange={(e) => setCheckInDate(e.target.value)}
                        className="w-full px-2.5 sm:px-3 py-2.5 text-xs sm:text-sm font-mono bg-stone-50 border border-stone-300 rounded-xl text-slate-900 focus:outline-none focus:border-amber-700"
                      />
                    </div>

                    {/* Check-Out Date (Half width on mobile) */}
                    <div className="col-span-1 lg:col-span-2">
                      <label className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                        Check-Out ({stayNights}N)
                      </label>
                      <input
                        type="date"
                        value={checkOutDate}
                        min={checkInDate}
                        onChange={(e) => setCheckOutDate(e.target.value)}
                        className="w-full px-2.5 sm:px-3 py-2.5 text-xs sm:text-sm font-mono bg-stone-50 border border-stone-300 rounded-xl text-slate-900 focus:outline-none focus:border-amber-700"
                      />
                    </div>

                    {/* Budget / Price Range (Half width on mobile) */}
                    <div className="col-span-1 lg:col-span-2">
                      <label className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                        Nightly Budget
                      </label>
                      <select
                        value={selectedBudgetFilter}
                        onChange={(e) => setSelectedBudgetFilter(e.target.value as any)}
                        className="w-full px-2.5 sm:px-3 py-2.5 text-xs sm:text-sm font-medium bg-stone-50 border border-stone-300 rounded-xl text-slate-900 focus:outline-none focus:border-amber-700"
                      >
                        <option value="all">Any Budget</option>
                        <option value="under_60">Under $60 / night</option>
                        <option value="60_120">$60 – $120 / night</option>
                        <option value="120_200">$120 – $200 / night</option>
                        <option value="over_200">$200+ / night</option>
                      </select>
                    </div>

                    {/* Star Rating (Half width on mobile) */}
                    <div className="col-span-1 lg:col-span-1">
                      <label className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                        Stars
                      </label>
                      <select
                        value={selectedStarFilter}
                        onChange={(e) =>
                          setSelectedStarFilter(
                            e.target.value === 'All' ? 'All' : Number(e.target.value)
                          )
                        }
                        className="w-full px-2.5 py-2.5 text-xs sm:text-sm font-medium bg-stone-50 border border-stone-300 rounded-xl text-slate-900 focus:outline-none focus:border-amber-700"
                      >
                        <option value="All">Any Stars</option>
                        <option value={5}>5★ Only</option>
                        <option value={4}>4★ & Up</option>
                        <option value={3}>3★ & Up</option>
                      </select>
                    </div>

                    {/* Search CTA (Full width on mobile) */}
                    <div className="col-span-2 lg:col-span-2 pt-0.5 sm:pt-0">
                      <a
                        href="#hotels"
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-xl bg-amber-700 hover:bg-amber-600 text-white text-xs sm:text-sm font-semibold transition shadow-sm"
                      >
                        <Search className="w-4 h-4" />
                        <span>Show Hotels ({filteredHotels.length})</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        );
      }

      case 'welcome': {
        if (!homepage.welcome_heading && !homepage.welcome_body && !hotel.short_description) {
          return null;
        }
        return (
          <section key="welcome" className="py-10 sm:py-14 bg-[#FAF8F5] border-b border-stone-200/70">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-3 sm:space-y-4">
              {homepage.welcome_heading && (
                <h2 className="text-xl sm:text-3xl font-serif font-semibold text-slate-900 tracking-tight">
                  {homepage.welcome_heading}
                </h2>
              )}
              <p className="text-sm sm:text-base text-stone-600 leading-relaxed whitespace-pre-line">
                {homepage.welcome_body || hotel.short_description}
              </p>
            </div>
          </section>
        );
      }

      case 'featured_rooms': {
        // Multi-Hotel Catalog with City/Budget/Star Filters, Touch-Swipe Carousels & Instant Room Photo Strip
        if (hotels.length > 0) {
          return (
            <section id="hotels" key="featured_rooms" className="py-10 sm:py-16 lg:py-20 bg-white">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
                {/* Directory Header + Search & Sort Controls */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 sm:gap-6">
                  <div className="space-y-1.5 sm:space-y-2 max-w-2xl">
                    <span className="text-[11px] sm:text-xs uppercase tracking-widest text-amber-800 font-semibold">
                      Partner Hotels & Room Photo Showcases
                    </span>
                    <h2 className="text-2xl sm:text-4xl font-serif font-semibold text-slate-900 tracking-tight">
                      Explore Our Hotels ({filteredHotels.length})
                    </h2>
                    <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                      Swipe through hotel & room photos below, tap any room thumbnail for a fullscreen room view, or open the hotel page to compare rooms.
                    </p>
                  </div>

                  {/* Keyword Search & Sort By */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
                    <div className="relative flex-1 sm:w-64">
                      <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={hotelSearchQuery}
                        onChange={(e) => setHotelSearchQuery(e.target.value)}
                        placeholder="Search hotel, city, room..."
                        className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:bg-white focus:border-amber-700"
                      />
                    </div>

                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="px-3 py-2.5 text-xs sm:text-sm bg-stone-50 border border-stone-300 rounded-xl text-slate-700 font-medium"
                    >
                      <option value="featured">Sort: Featured First</option>
                      <option value="price_asc">Price: Low to High</option>
                      <option value="price_desc">Price: High to Low</option>
                      <option value="stars_desc">Star Rating: High to Low</option>
                    </select>
                  </div>
                </div>

                {/* Mobile-Swipeable Horizontal Filter Bar: Cities */}
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-stone-200/80">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
                    {hotelCities.map((city) => (
                      <button
                        key={city}
                        type="button"
                        onClick={() => setSelectedCityFilter(city)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                          selectedCityFilter === city
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                        }`}
                      >
                        {city === 'All' ? `All Cities (${hotels.length})` : city}
                      </button>
                    ))}
                  </div>

                  {/* Active Filters Reset */}
                  {(selectedCityFilter !== 'All' ||
                    selectedStarFilter !== 'All' ||
                    selectedBudgetFilter !== 'all' ||
                    hotelSearchQuery.trim() !== '') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCityFilter('All');
                        setSelectedStarFilter('All');
                        setSelectedBudgetFilter('all');
                        setHotelSearchQuery('');
                      }}
                      className="text-xs font-semibold text-amber-800 hover:underline cursor-pointer shrink-0"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>

                {/* Hotels Directory Grid with Interactive Photo Carousels & Room Photo Strips */}
                {filteredHotels.length === 0 ? (
                  <div className="p-10 sm:p-12 text-center bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
                    <Building2 className="w-8 h-8 text-stone-400 mx-auto" />
                    <p className="text-sm font-semibold text-slate-800">
                      No hotels match your current city, budget, or star filter.
                    </p>
                    <button
                      onClick={() => {
                        setSelectedCityFilter('All');
                        setSelectedStarFilter('All');
                        setSelectedBudgetFilter('all');
                        setHotelSearchQuery('');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                    >
                      Show All Hotels
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                    {filteredHotels.map((h) => {
                      const hRooms = rooms.filter((r) => r.hotel_id === h.id);
                      const cardPhotos = collectHotelPhotos(h, hRooms);
                      const curCardIdx = cardPhotoIndices[h.id] || 0;
                      const currentCardPhotoObj = cardPhotos[curCardIdx] || cardPhotos[0];
                      const currentCardPhoto = currentCardPhotoObj?.url || '';
                      const { price: startingPrice, currency: priceCurrency } =
                        getHotelStartingPrice(h);

                      return (
                        <article
                          key={h.id}
                          onClick={() => navigateToHotelPage(h.slug)}
                          className="group bg-[#FAF8F5] rounded-2xl border border-stone-200/90 overflow-hidden flex flex-col justify-between transition hover:shadow-xl hover:border-amber-700/40 cursor-pointer shadow-xs"
                        >
                          <div>
                            {/* RICH HOTEL CARD PHOTO CAROUSEL WITH TOUCH-SWIPE */}
                            <div
                              className="aspect-[16/11] bg-stone-900 overflow-hidden relative select-none"
                              onTouchStart={handleTouchStart}
                              onTouchEnd={(e) => {
                                e.stopPropagation();
                                handleTouchEnd(
                                  e,
                                  () =>
                                    setCardPhotoIndices((prev) => ({
                                      ...prev,
                                      [h.id]: (curCardIdx + 1) % Math.max(1, cardPhotos.length),
                                    })),
                                  () =>
                                    setCardPhotoIndices((prev) => ({
                                      ...prev,
                                      [h.id]:
                                        (curCardIdx - 1 + Math.max(1, cardPhotos.length)) %
                                        Math.max(1, cardPhotos.length),
                                    }))
                                );
                              }}
                            >
                              {currentCardPhoto ? (
                                <img
                                  src={currentCardPhoto}
                                  alt={currentCardPhotoObj?.caption || h.name}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-stone-500 p-6 text-center">
                                  <Building2 className="w-10 h-10 mb-2 opacity-50" />
                                  <span className="text-xs text-stone-400">{h.name}</span>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />

                              {/* Top Left Live Photo Label Badge (Highlights Room Name if viewing room photo) */}
                              {currentCardPhotoObj?.roomName ? (
                                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-amber-600/95 backdrop-blur-xs text-white text-[10px] font-semibold flex items-center gap-1 shadow-sm max-w-[70%] truncate">
                                  <BedDouble className="w-3 h-3 shrink-0" />
                                  <span className="truncate">Room: {currentCardPhotoObj.roomName}</span>
                                </span>
                              ) : (
                                cardPhotos.length > 0 && (
                                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-slate-950/75 backdrop-blur-xs text-stone-200 text-[10px] font-medium flex items-center gap-1">
                                    <Camera className="w-3 h-3 text-amber-400 shrink-0" />
                                    <span>Swipe Photos</span>
                                  </span>
                                )
                              )}

                              {/* Carousel Prev / Next Arrows (Always visible on mobile!) */}
                              {cardPhotos.length > 1 && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCardPhotoIndices((prev) => ({
                                        ...prev,
                                        [h.id]:
                                          (curCardIdx - 1 + cardPhotos.length) % cardPhotos.length,
                                      }));
                                    }}
                                    className="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-950/80 text-white flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-slate-950 transition cursor-pointer shadow-md"
                                    aria-label="Previous hotel photo"
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
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-950/80 text-white flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-slate-950 transition cursor-pointer shadow-md"
                                    aria-label="Next hotel photo"
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                  <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-xs text-white text-[11px] font-mono">
                                    {curCardIdx + 1} / {cardPhotos.length}
                                  </span>
                                </>
                              )}

                              {/* Bottom Overlay: Stars & City */}
                              <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between text-white">
                                <div>
                                  {h.star_rating > 0 && (
                                    <div className="flex items-center gap-0.5 text-amber-400 mb-1">
                                      {Array.from({
                                        length: Math.min(5, Math.max(1, h.star_rating)),
                                      }).map((_, i) => (
                                        <Star
                                          key={i}
                                          className="w-3.5 h-3.5 fill-amber-400 text-amber-400"
                                        />
                                      ))}
                                    </div>
                                  )}
                                  {h.city && (
                                    <span className="text-xs font-medium text-stone-200 flex items-center gap-1">
                                      <MapPin className="w-3 h-3 text-amber-400" />
                                      {[h.city, h.country].filter(Boolean).join(', ')}
                                    </span>
                                  )}
                                </div>
                                <span className="px-2.5 py-1 rounded-lg bg-slate-950/80 text-amber-300 text-[11px] font-semibold">
                                  {hRooms.length} {hRooms.length === 1 ? 'Room Type' : 'Room Types'}
                                </span>
                              </div>
                            </div>

                            {/* Hotel Card Body */}
                            <div className="p-4 sm:p-6 space-y-3.5">
                              <div>
                                <h3 className="text-lg sm:text-xl font-serif font-semibold text-slate-900 group-hover:text-amber-800 transition">
                                  {h.name}
                                </h3>
                                {h.address && (
                                  <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">
                                    {h.address}
                                  </p>
                                )}
                              </div>

                              {h.short_description && (
                                <p className="text-xs sm:text-sm text-stone-600 leading-relaxed line-clamp-2">
                                  {h.short_description}
                                </p>
                              )}

                              {/* INSTANT ROOM PHOTO FILMSTRIP RIGHT ON THE HOTEL CARD */}
                              {hRooms.length > 0 && (
                                <div className="pt-2 border-t border-stone-200/80 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                                      <BedDouble className="w-3 h-3" />
                                      <span>Tap Any Room to See Room Pictures ({hRooms.length})</span>
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                                    {hRooms.map((r) => {
                                      const rThumb =
                                        r.featured_image_url ||
                                        (Array.isArray(r.gallery_images) && r.gallery_images[0]) ||
                                        currentCardPhoto;
                                      const rPhotoCount = Array.from(
                                        new Set([
                                          ...(r.featured_image_url ? [r.featured_image_url] : []),
                                          ...(Array.isArray(r.gallery_images)
                                            ? r.gallery_images
                                            : []),
                                        ])
                                      ).length;
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
                                          className="group/room flex items-center gap-2 p-1.5 pr-2.5 rounded-xl bg-white hover:bg-amber-50/70 border border-stone-200 hover:border-amber-400 transition shrink-0 text-left cursor-pointer shadow-2xs"
                                        >
                                          <div className="w-12 h-10 rounded-lg overflow-hidden bg-stone-900 relative shrink-0">
                                            {rThumb ? (
                                              <img
                                                src={rThumb}
                                                alt={r.name}
                                                referrerPolicy="no-referrer"
                                                className="w-full h-full object-cover"
                                              />
                                            ) : (
                                              <div className="w-full h-full flex items-center justify-center text-stone-400">
                                                <BedDouble className="w-4 h-4" />
                                              </div>
                                            )}
                                            {rPhotoCount > 0 && (
                                              <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-slate-950/80 text-white text-[8px] font-mono">
                                                {rPhotoCount}p
                                              </span>
                                            )}
                                          </div>
                                          <div className="min-w-0 max-w-[110px]">
                                            <span className="text-[11px] font-semibold text-slate-900 group-hover/room:text-amber-800 block truncate">
                                              {r.name}
                                            </span>
                                            {r.optional_price !== null && r.optional_price > 0 ? (
                                              <span className="text-[10px] font-mono text-amber-800 font-semibold block">
                                                {r.currency || 'USD'} {r.optional_price}/n
                                              </span>
                                            ) : (
                                              <span className="text-[10px] text-stone-500 block">
                                                View Photos
                                              </span>
                                            )}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Card Footer: Starting Price, Total Stay Estimate & Actions */}
                          <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-t border-stone-200/80 bg-white flex items-center justify-between gap-2">
                            <div>
                              {startingPrice !== null && startingPrice > 0 ? (
                                <div>
                                  <span className="text-[11px] text-stone-500 block">
                                    From{' '}
                                    <strong className="text-base font-serif font-bold text-slate-900 font-mono">
                                      {priceCurrency} {startingPrice}
                                    </strong>{' '}
                                    / night
                                  </span>
                                  <span className="text-[11px] text-emerald-700 font-medium block">
                                    {stayNights}N total: {priceCurrency}{' '}
                                    {(startingPrice * stayNights * roomsCount).toLocaleString()}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs font-medium text-stone-600">
                                  View Rooms & Rates
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <a
                                href={buildWhatsAppBookingUrl({
                                  targetHotel: h,
                                  targetRoom: hRooms[0] || null,
                                })}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition"
                                title="Quick WhatsApp Enquiry"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </a>
                              <span className="inline-flex items-center gap-1 px-3.5 py-2.5 rounded-xl bg-slate-900 group-hover:bg-amber-800 text-white text-xs font-semibold transition">
                                <span>See Rooms</span>
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
          );
        }

        return null;
      }

      case 'facilities': {
        if (facilities.length === 0) return null;
        const facPage = getPage('facilities');
        return (
          <section
            id="facilities"
            key="facilities"
            className="py-12 sm:py-16 lg:py-20 bg-[#FAF8F5] border-t border-stone-200/70"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10">
              <div className="max-w-2xl space-y-2">
                <span className="text-xs uppercase tracking-widest text-amber-800 font-semibold">
                  Amenities & Services
                </span>
                <h2 className="text-2xl sm:text-4xl font-serif font-semibold text-slate-900 tracking-tight">
                  {facPage?.heading || 'Facilities & Guest Services'}
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {facilities.map((fac) => (
                  <div
                    key={fac.id}
                    className="p-5 sm:p-6 rounded-2xl bg-white border border-stone-200/80 space-y-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-900/10 text-amber-800 flex items-center justify-center">
                      {renderFacilityIcon(fac.icon_name)}
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] uppercase tracking-wider text-stone-400 font-medium">
                        {fac.category}
                      </span>
                      <h3 className="text-lg font-serif font-semibold text-slate-900">
                        {fac.name}
                      </h3>
                    </div>
                    {fac.description && (
                      <p className="text-sm text-stone-600 leading-relaxed">{fac.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      }

      case 'gallery': {
        if (gallery.length === 0) return null;
        const galPage = getPage('gallery');
        return (
          <section id="gallery" key="gallery" className="py-12 sm:py-16 lg:py-20 bg-white border-t border-stone-200/70">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-2">
                  <span className="text-xs uppercase tracking-widest text-amber-800 font-semibold">
                    Visual Tour
                  </span>
                  <h2 className="text-2xl sm:text-4xl font-serif font-semibold text-slate-900 tracking-tight">
                    {galPage?.heading || 'Photo Gallery'}
                  </h2>
                </div>

                {galleryCategories.length > 2 && (
                  <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl overflow-x-auto">
                    {galleryCategories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveGalleryCategory(cat)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer shrink-0 ${
                          activeGalleryCategory === cat
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-stone-600 hover:text-slate-900'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
                {filteredGallery.map((item) => (
                  <div
                    key={item.id}
                    onClick={() =>
                      setLightboxImage({
                        url: item.image_url,
                        title: item.title || item.alt_text,
                        caption: item.caption,
                      })
                    }
                    className="group cursor-pointer rounded-xl overflow-hidden bg-stone-900 border border-stone-200/80 aspect-[4/3] relative"
                  >
                    <img
                      src={item.image_url}
                      alt={item.alt_text || item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </div>
          </section>
        );
      }

      case 'about': {
        const aboutPage = getPage('about');
        const aboutHeading = hotel.about_title || aboutPage?.heading || `About ${hotel.name}`;
        const aboutBody = hotel.about_content || aboutPage?.content_body || hotel.short_description;
        if (!aboutBody && !hotel.check_in_time && !hotel.check_out_time) return null;

        return (
          <section id="about" key="about" className="py-12 sm:py-16 lg:py-20 bg-[#FAF8F5] border-t border-stone-200/70">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 items-start">
                <div className="lg:col-span-7 space-y-4">
                  <span className="text-xs uppercase tracking-widest text-amber-800 font-semibold">
                    Our Story & Hospitality
                  </span>
                  <h2 className="text-2xl sm:text-4xl font-serif font-semibold text-slate-900 tracking-tight">
                    {aboutHeading}
                  </h2>
                  {aboutBody && (
                    <div className="text-stone-600 text-sm sm:text-base leading-relaxed whitespace-pre-line">
                      {aboutBody}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-5 bg-white rounded-2xl border border-stone-200/90 p-5 sm:p-8 space-y-5">
                  <h3 className="text-lg font-serif font-semibold text-slate-900">
                    Booking & Stay Policies
                  </h3>
                  {(hotel.check_in_time || hotel.check_out_time) && (
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-stone-100">
                      {hotel.check_in_time && (
                        <div>
                          <span className="text-xs text-stone-400 block">Standard Check-In</span>
                          <span className="text-sm font-semibold text-slate-900 font-mono">
                            {hotel.check_in_time}
                          </span>
                        </div>
                      )}
                      {hotel.check_out_time && (
                        <div>
                          <span className="text-xs text-stone-400 block">Standard Check-Out</span>
                          <span className="text-sm font-semibold text-slate-900 font-mono">
                            {hotel.check_out_time}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {hotel.cancellation_policy && (
                    <div className="pt-3 border-t border-stone-100 space-y-1">
                      <span className="text-xs font-semibold text-slate-800 block">
                        Cancellation Policy
                      </span>
                      <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-line">
                        {hotel.cancellation_policy}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        );
      }

      case 'faq': {
        if (faqs.length === 0) return null;
        const faqPage = getPage('faq');
        return (
          <section id="faq" key="faq" className="py-12 sm:py-16 lg:py-20 bg-white border-t border-stone-200/70">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
              <div className="text-center space-y-2">
                <span className="text-xs uppercase tracking-widest text-amber-800 font-semibold">
                  Guest Information
                </span>
                <h2 className="text-2xl sm:text-4xl font-serif font-semibold text-slate-900 tracking-tight">
                  {faqPage?.heading || 'Frequently Asked Questions'}
                </h2>
              </div>

              <div className="divide-y divide-stone-200 border-y border-stone-200">
                {faqs.map((faq, idx) => {
                  const isOpen = openFaqIndex === idx;
                  return (
                    <div key={faq.id} className="py-4">
                      <button
                        onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                        className="w-full flex items-center justify-between text-left gap-4 py-2 cursor-pointer"
                      >
                        <span className="text-sm sm:text-base font-medium text-slate-900">
                          {faq.question}
                        </span>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-stone-500 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-stone-500 shrink-0" />
                        )}
                      </button>
                      {isOpen && (
                        <div className="pt-2 pb-3 text-sm text-stone-600 leading-relaxed whitespace-pre-line">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );
      }

      case 'contact': {
        const contactPage = getPage('contact');
        const hasContact = hotel.contact_phone || hotel.contact_email || hotel.whatsapp_number;
        if (!hasContact) return null;

        return (
          <section id="contact" key="contact" className="py-12 sm:py-16 lg:py-20 bg-slate-900 text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 items-center">
                <div className="lg:col-span-7 space-y-3">
                  <span className="text-xs uppercase tracking-widest text-amber-400 font-semibold">
                    Direct Reservations & Support
                  </span>
                  <h2 className="text-2xl sm:text-4xl font-serif font-semibold tracking-tight">
                    {contactPage?.heading || 'Contact & Booking Enquiries'}
                  </h2>
                  <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
                    Reach our reservations team directly via WhatsApp, phone, or email for instant room confirmation and group rates.
                  </p>
                </div>

                <div className="lg:col-span-5 bg-slate-800/90 border border-slate-700 rounded-2xl p-5 sm:p-8 space-y-4">
                  {hotel.contact_phone && (
                    <a
                      href={`tel:${hotel.contact_phone}`}
                      className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-900/70 hover:bg-slate-900 border border-slate-700/80 transition"
                    >
                      <Phone className="w-5 h-5 text-amber-400 shrink-0" />
                      <div>
                        <span className="text-xs text-slate-400 block">Telephone</span>
                        <span className="text-sm font-semibold font-mono text-white">
                          {hotel.contact_phone}
                        </span>
                      </div>
                    </a>
                  )}

                  {hotel.whatsapp_number && (
                    <a
                      href={buildWhatsAppBookingUrl({})}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3.5 p-3.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-950 border border-emerald-700/60 transition"
                    >
                      <MessageCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <span className="text-xs text-emerald-300 block">WhatsApp Reservations</span>
                        <span className="text-sm font-semibold font-mono text-white">
                          {hotel.whatsapp_number}
                        </span>
                      </div>
                    </a>
                  )}

                  {hotel.contact_email && (
                    <a
                      href={`mailto:${hotel.contact_email}`}
                      className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-900/70 hover:bg-slate-900 border border-slate-700/80 transition"
                    >
                      <Mail className="w-5 h-5 text-amber-400 shrink-0" />
                      <div>
                        <span className="text-xs text-slate-400 block">Email</span>
                        <span className="text-sm font-semibold text-white">
                          {hotel.contact_email}
                        </span>
                      </div>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-900 font-sans selection:bg-amber-900 selection:text-white pb-20 md:pb-0">
      {/* Preview Mode Banner */}
      {isPreview && (
        <div className="sticky top-0 z-50 bg-amber-950 text-amber-50 px-4 py-2.5 text-xs flex items-center justify-between border-b border-amber-800">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold uppercase tracking-wider text-amber-300 shrink-0">
              Draft Preview Mode
            </span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span className="text-amber-100/90 truncate hidden sm:inline">
              Tap any room thumbnail or hotel card below to test the mobile room photo showcase & comparison.
            </span>
          </div>
          {onExitPreview && (
            <button
              onClick={onExitPreview}
              className="px-3 py-1 rounded bg-white text-slate-900 font-semibold hover:bg-amber-100 transition cursor-pointer shrink-0"
            >
              Return to CMS Editor
            </button>
          )}
        </div>
      )}

      {/* Main Header Navigation */}
      <header className="sticky top-0 z-40 bg-[#FAF8F5]/95 backdrop-blur-md border-b border-stone-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
          <a
            href="#home"
            onClick={() => navigateToHotelPage(null)}
            className="flex items-center gap-2.5 sm:gap-3 min-w-0"
          >
            {hotel.logo_url ? (
              <img
                src={hotel.logo_url}
                alt={hotel.name}
                referrerPolicy="no-referrer"
                className="h-9 sm:h-10 w-auto object-contain"
              />
            ) : (
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center font-serif font-bold text-base sm:text-lg shrink-0">
                {hotel.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="truncate">
              <span className="font-serif font-semibold text-base sm:text-xl tracking-tight text-slate-900 block truncate">
                {hotel.name}
              </span>
              {hotels.length > 0 && (
                <span className="text-[10px] sm:text-[11px] text-stone-500 block truncate">
                  {hotels.length} Partner {hotels.length === 1 ? 'Hotel' : 'Hotels'} Directory
                </span>
              )}
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-7">
            {visibleHeaderLinks.map((link, idx) => (
              <a
                key={idx}
                href={link.href}
                className="text-sm font-medium text-stone-700 hover:text-slate-950 transition"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3 shrink-0">
            <a
              href={buildWhatsAppBookingUrl({})}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>{hotel.reservation_button_text || 'WhatsApp Enquiry'}</span>
            </a>
          </div>

          <div className="flex md:hidden items-center gap-2">
            <a
              href={buildWhatsAppBookingUrl({})}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-700 text-white text-[11px] font-semibold"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-700 hover:text-slate-950"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-stone-200 px-4 pt-3 pb-6 space-y-2 shadow-lg">
            {visibleHeaderLinks.map((link, idx) => (
              <a
                key={idx}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2.5 text-sm font-medium text-slate-800 border-b border-stone-100"
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
      </header>

      {/* Main Ordered Sections */}
      <main>{enabledSections.map((sec) => renderSection(sec.id))}</main>

      {/* SHARED FULLSCREEN ROOM PHOTO SHOWCASE & LIGHTBOX MODALS (Accessible directly from Homepage Room Filmstrips) */}
      {renderRoomDetailModal()}
      {renderFullLightboxModal()}

      {/* MOBILE STICKY BOTTOM BAR ON DIRECTORY HOMEPAGE */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-stone-300 px-4 py-2.5 shadow-2xl flex items-center justify-between gap-2">
        <a
          href="#hotels"
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold"
        >
          <BedDouble className="w-3.5 h-3.5 text-amber-400" />
          <span>Browse Hotels ({filteredHotels.length})</span>
        </a>
        <a
          href={buildWhatsAppBookingUrl({})}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-semibold shadow-sm"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span>WhatsApp Us</span>
        </a>
      </div>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-800/80 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-5 space-y-2">
              <span className="font-serif font-semibold text-base text-white block">
                {hotel.name}
              </span>
              {(hotel.footer_text || hotel.short_description) && (
                <p className="text-slate-400 leading-relaxed max-w-sm">
                  {hotel.footer_text || hotel.short_description}
                </p>
              )}
            </div>

            {hotels.length > 0 && (
              <div className="md:col-span-4 space-y-2">
                <span className="text-white font-semibold uppercase tracking-wider block">
                  Our Hotels
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  {hotels.slice(0, 6).map((h) => (
                    <button
                      key={h.id}
                      onClick={() => navigateToHotelPage(h.slug)}
                      className="text-left text-slate-400 hover:text-amber-300 transition cursor-pointer truncate"
                    >
                      {h.name} {h.city ? `(${h.city})` : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="md:col-span-3 space-y-2">
              <span className="text-white font-semibold uppercase tracking-wider block">
                Quick Links
              </span>
              <div className="flex flex-col gap-1.5">
                {navigation.footer_links
                  .filter((l) => l.visible)
                  .map((link, idx) => (
                    <a
                      key={idx}
                      href={link.href}
                      className="hover:text-white transition"
                    >
                      {link.label}
                    </a>
                  ))}
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>
              {hotel.copyright_text ||
                `© ${new Date().getFullYear()} ${hotel.name}. All rights reserved.`}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
