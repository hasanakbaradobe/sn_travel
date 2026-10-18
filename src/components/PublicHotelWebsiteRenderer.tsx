import React, { useState, useMemo, useEffect } from 'react';
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
  Sparkles,
  Dumbbell,
  Waves,
  Plane,
  Briefcase,
  Maximize2,
  Check,
  Search,
  Star,
  BedDouble,
  Users,
  ArrowLeft,
  Images,
  Filter,
} from 'lucide-react';
import { PublicWebsiteSnapshot, PublicSnapshotHotel, PublicSnapshotRoom } from '../types';

interface PublicHotelWebsiteRendererProps {
  snapshot: PublicWebsiteSnapshot | null;
  isPreview?: boolean;
  initialHotelSlug?: string | null;
  onExitPreview?: () => void;
}

const FACILITY_ICONS: Record<string, React.ReactNode> = {
  Wifi: <Wifi className="w-5 h-5" />,
  Car: <Car className="w-5 h-5" />,
  Utensils: <Utensils className="w-5 h-5" />,
  Coffee: <Coffee className="w-5 h-5" />,
  ShieldCheck: <ShieldCheck className="w-5 h-5" />,
  Sparkles: <Sparkles className="w-5 h-5" />,
  Dumbbell: <Dumbbell className="w-5 h-5" />,
  Waves: <Waves className="w-5 h-5" />,
  Plane: <Plane className="w-5 h-5" />,
  Briefcase: <Briefcase className="w-5 h-5" />,
  Building2: <Building2 className="w-5 h-5" />,
};

const SafeImage: React.FC<{
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}> = ({ src, alt, className = '', fallbackLabel }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || !src.trim() || failed) {
    return (
      <div
        className={`bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 flex flex-col items-center justify-center text-stone-400 p-6 text-center select-none ${className}`}
        role="img"
        aria-label={alt}
      >
        <Building2 className="w-8 h-8 text-amber-500/70 mb-2 stroke-[1.5]" />
        <span className="text-xs font-medium tracking-wide text-stone-300 line-clamp-2 max-w-xs">
          {fallbackLabel || alt || 'Hotel Visual'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};

const RoomCardWithGallery: React.FC<{
  room: PublicSnapshotRoom;
  hotelName?: string;
  onSelectRoomDetail: (room: PublicSnapshotRoom, hotelName?: string) => void;
  onOpenLightbox: (images: Array<{ url: string; title: string; caption?: string }>, startIndex: number) => void;
  onEnquireRoom: (room: PublicSnapshotRoom, hotelName?: string) => void;
}> = ({ room, hotelName, onSelectRoomDetail, onOpenLightbox, onEnquireRoom }) => {
  const allPhotos = useMemo(() => {
    const list: string[] = [];
    if (room.featured_image_url && room.featured_image_url.trim()) {
      list.push(room.featured_image_url.trim());
    }
    if (Array.isArray(room.gallery_images)) {
      room.gallery_images.forEach((img) => {
        if (img && img.trim() && !list.includes(img.trim())) {
          list.push(img.trim());
        }
      });
    }
    return list;
  }, [room.featured_image_url, room.gallery_images]);

  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const currentPhoto = allPhotos[activePhotoIdx] || room.featured_image_url || '';

  return (
    <article className="bg-white border border-stone-200 rounded-2xl overflow-hidden flex flex-col shadow-xs hover:shadow-md hover:border-stone-300 transition group">
      {/* Main Room Image & Photo Controls */}
      <div className="relative aspect-16/10 bg-stone-900 overflow-hidden">
        <SafeImage
          src={currentPhoto}
          alt={room.name}
          fallbackLabel={room.name}
          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/20 pointer-events-none" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
          {room.is_featured && (
            <span className="px-2.5 py-1 rounded-md bg-amber-500 text-stone-950 text-[11px] font-bold uppercase tracking-wider shadow-xs">
              Featured Room
            </span>
          )}
          {hotelName && (
            <span className="px-2.5 py-1 rounded-md bg-stone-950/80 backdrop-blur-xs text-white text-[11px] font-medium">
              {hotelName}
            </span>
          )}
        </div>

        {/* Photo Counter / Lightbox Trigger */}
        {allPhotos.length > 0 && (
          <button
            type="button"
            onClick={() =>
              onOpenLightbox(
                allPhotos.map((u, idx) => ({
                  url: u,
                  title: `${room.name}${hotelName ? ` — ${hotelName}` : ''}`,
                  caption: `Room Photo ${idx + 1} of ${allPhotos.length}`,
                })),
                activePhotoIdx
              )
            }
            className="absolute top-3 right-3 px-2.5 py-1.5 rounded-lg bg-stone-950/75 hover:bg-stone-950 text-white text-xs font-medium flex items-center gap-1.5 backdrop-blur-xs transition cursor-pointer"
          >
            <Images className="w-3.5 h-3.5 text-amber-400" />
            <span>{allPhotos.length} {allPhotos.length === 1 ? 'Photo' : 'Photos'}</span>
          </button>
        )}

        {/* Prev / Next arrows if multiple room pictures */}
        {allPhotos.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActivePhotoIdx((prev) => (prev - 1 + allPhotos.length) % allPhotos.length);
              }}
              aria-label="Previous room photo"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-stone-950/60 hover:bg-stone-950/90 text-white flex items-center justify-center transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActivePhotoIdx((prev) => (prev + 1) % allPhotos.length);
              }}
              aria-label="Next room photo"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-stone-950/60 hover:bg-stone-950/90 text-white flex items-center justify-center transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Price Overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-white leading-snug drop-shadow-xs">{room.name}</h3>
          </div>
          {room.optional_price !== null && room.optional_price !== undefined ? (
            <div className="bg-stone-950/85 backdrop-blur-xs px-3 py-1.5 rounded-lg text-right border border-white/10 shrink-0">
              <div className="text-sm font-bold text-amber-400">
                {room.currency || 'USD'} {Number(room.optional_price).toLocaleString()}
              </div>
              <div className="text-[10px] text-stone-300">{room.price_note || 'per night'}</div>
            </div>
          ) : (
            <div className="bg-stone-950/80 backdrop-blur-xs px-2.5 py-1 rounded-md text-[11px] font-medium text-stone-200">
              Contact for Rate
            </div>
          )}
        </div>
      </div>

      {/* Room Thumbnail Strip (when multiple room pictures exist) */}
      {allPhotos.length > 1 && (
        <div className="px-4 pt-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {allPhotos.map((imgUrl, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActivePhotoIdx(idx)}
              className={`relative w-14 h-10 rounded-lg overflow-hidden shrink-0 border-2 transition cursor-pointer ${
                activePhotoIdx === idx ? 'border-amber-600 ring-1 ring-amber-600' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <SafeImage src={imgUrl} alt={`${room.name} thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Room Specs & Content */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-3">
          {/* Quick Specs Pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
            {room.capacity && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-100 font-medium text-stone-700">
                <Users className="w-3.5 h-3.5 text-stone-500" />
                {room.capacity}
              </span>
            )}
            {room.bed_type && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-100 font-medium text-stone-700">
                <BedDouble className="w-3.5 h-3.5 text-stone-500" />
                {room.bed_type}
              </span>
            )}
            {room.room_size && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-100 font-medium text-stone-700">
                <Maximize2 className="w-3.5 h-3.5 text-stone-500" />
                {room.room_size}
              </span>
            )}
          </div>

          {room.short_description && (
            <p className="text-sm text-stone-600 line-clamp-2 leading-relaxed">{room.short_description}</p>
          )}

          {/* Room Amenities */}
          {Array.isArray(room.amenities) && room.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {room.amenities.slice(0, 5).map((amenity, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-stone-50 border border-stone-200/80 text-stone-600"
                >
                  <Check className="w-3 h-3 text-amber-700" />
                  {amenity}
                </span>
              ))}
              {room.amenities.length > 5 && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-stone-100 text-stone-500 font-medium">
                  +{room.amenities.length - 5} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-stone-100 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onSelectRoomDetail(room, hotelName)}
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-stone-200 hover:border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-800 text-xs font-semibold transition cursor-pointer"
          >
            Room Details & Photos
          </button>
          <button
            type="button"
            onClick={() => onEnquireRoom(room, hotelName)}
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>Enquire Room</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
};

export const PublicHotelWebsiteRenderer: React.FC<PublicHotelWebsiteRendererProps> = ({
  snapshot,
  isPreview = false,
  initialHotelSlug = null,
  onExitPreview,
}) => {
  const [activePage, setActivePage] = useState<string>('home');
  const [activeHotelSlug, setActiveHotelSlug] = useState<string | null>(initialHotelSlug);
  const [hotelDropdownOpen, setHotelDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaqId, setOpenFaqId] = useState<number | null>(null);

  // Hotel Directory Search & Filters
  const [hotelSearch, setHotelSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [selectedMinStars, setSelectedMinStars] = useState<number>(0);

  // Room Detail & Lightbox Modals
  const [selectedRoomModal, setSelectedRoomModal] = useState<{
    room: PublicSnapshotRoom;
    hotelName?: string;
  } | null>(null);
  const [lightboxState, setLightboxState] = useState<{
    images: Array<{ url: string; title: string; caption?: string }>;
    index: number;
  } | null>(null);
  const [galleryCategory, setGalleryCategory] = useState<string>('All');

  // Enquiry state
  const [enquiryModalContext, setEnquiryModalContext] = useState<{
    hotelName?: string;
    roomName?: string;
  } | null>(null);
  const [enquiryName, setEnquiryName] = useState('');
  const [enquiryEmail, setEnquiryEmail] = useState('');
  const [enquiryDates, setEnquiryDates] = useState('');
  const [enquiryMessage, setEnquiryMessage] = useState('');
  const [enquiryFeedback, setEnquiryFeedback] = useState<string | null>(null);

  // Sync with prop `initialHotelSlug` when previewing a specific hotel in CRM
  useEffect(() => {
    if (initialHotelSlug !== undefined) {
      setActiveHotelSlug(initialHotelSlug);
    }
  }, [initialHotelSlug]);

  // URL hash routing for standalone public site (`#/hotel/slug` or `#/hotels`)
  useEffect(() => {
    if (isPreview) return;
    const syncFromUrl = () => {
      const hash = window.location.hash || '';
      const path = window.location.pathname || '';
      if (hash.startsWith('#/hotel/')) {
        const slug = decodeURIComponent(hash.replace('#/hotel/', '').split('?')[0]);
        if (slug) {
          setActiveHotelSlug(slug);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      } else if (path.startsWith('/hotel/')) {
        const slug = decodeURIComponent(path.replace('/hotel/', '').split('/')[0]);
        if (slug) {
          setActiveHotelSlug(slug);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      } else if (hash === '#hotels' || hash === '#/hotels' || hash === '#home' || hash === '') {
        setActiveHotelSlug(null);
      }
    };
    syncFromUrl();
    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, [isPreview]);

  // Normalize hotels list (supports multi-hotel snapshots + fallback if only rooms were configured)
  const hotelsList: PublicSnapshotHotel[] = useMemo(() => {
    if (!snapshot) return [];
    if (Array.isArray(snapshot.hotels) && snapshot.hotels.length > 0) {
      return snapshot.hotels;
    }
    // Fallback if legacy snapshot has rooms but no hotels array yet
    if (Array.isArray(snapshot.rooms) && snapshot.rooms.length > 0) {
      return [
        {
          id: 1,
          name: snapshot.hotel.name || 'Featured Partner Hotel',
          slug: 'featured-partner-hotel',
          city: snapshot.hotel.city || '',
          country: snapshot.hotel.country || '',
          address: snapshot.hotel.address_line || '',
          star_rating: 5,
          short_description: snapshot.hotel.short_description || '',
          full_description: snapshot.hotel.about_content || '',
          featured_image_url: snapshot.homepage.hero_image_url || '',
          gallery_images: (snapshot.gallery || []).map((g) => g.image_url),
          amenities: (snapshot.facilities || []).map((f) => f.name),
          check_in_time: snapshot.hotel.check_in_time || '14:00',
          check_out_time: snapshot.hotel.check_out_time || '12:00',
          cancellation_policy: snapshot.hotel.cancellation_policy || '',
          contact_phone: snapshot.hotel.contact_phone || '',
          whatsapp_number: snapshot.hotel.whatsapp_number || '',
          contact_email: snapshot.hotel.contact_email || '',
          google_maps_url: snapshot.hotel.google_maps_url || '',
          google_maps_embed_url: snapshot.hotel.google_maps_embed_url || '',
          starting_price: null,
          currency: 'USD',
          is_featured: true,
          display_order: 1,
          rooms: snapshot.rooms.map((r) => ({ ...r, hotel_id: 1 })),
        },
      ];
    }
    return [];
  }, [snapshot]);

  const activeHotel: PublicSnapshotHotel | null = useMemo(() => {
    if (!activeHotelSlug) return null;
    return (
      hotelsList.find(
        (h) =>
          h.slug.toLowerCase() === activeHotelSlug.toLowerCase() ||
          String(h.id) === String(activeHotelSlug)
      ) || null
    );
  }, [hotelsList, activeHotelSlug]);

  const availableCities = useMemo(() => {
    const set = new Set<string>(['All']);
    hotelsList.forEach((h) => {
      if (h.city && h.city.trim()) set.add(h.city.trim());
    });
    return Array.from(set);
  }, [hotelsList]);

  const filteredHotels = useMemo(() => {
    return hotelsList.filter((h) => {
      if (selectedCity !== 'All' && h.city.trim().toLowerCase() !== selectedCity.toLowerCase()) {
        return false;
      }
      if (selectedMinStars > 0 && (h.star_rating || 5) < selectedMinStars) {
        return false;
      }
      if (hotelSearch.trim()) {
        const q = hotelSearch.toLowerCase().trim();
        const matchName = h.name.toLowerCase().includes(q);
        const matchCity = (h.city || '').toLowerCase().includes(q);
        const matchAddress = (h.address || '').toLowerCase().includes(q);
        const matchDesc = (h.short_description || '').toLowerCase().includes(q);
        const matchRooms = (h.rooms || []).some((r) => r.name.toLowerCase().includes(q));
        if (!matchName && !matchCity && !matchAddress && !matchDesc && !matchRooms) {
          return false;
        }
      }
      return true;
    });
  }, [hotelsList, selectedCity, selectedMinStars, hotelSearch]);

  const allRoomsAcrossHotels: Array<{ room: PublicSnapshotRoom; hotel?: PublicSnapshotHotel }> = useMemo(() => {
    const list: Array<{ room: PublicSnapshotRoom; hotel?: PublicSnapshotHotel }> = [];
    hotelsList.forEach((h) => {
      (h.rooms || []).forEach((r) => {
        list.push({ room: r, hotel: h });
      });
    });
    if (list.length === 0 && Array.isArray(snapshot?.rooms)) {
      snapshot!.rooms.forEach((r) => list.push({ room: r }));
    }
    return list;
  }, [hotelsList, snapshot]);

  const galleryCategories = useMemo(() => {
    if (!snapshot?.gallery) return ['All'];
    const cats = new Set<string>(['All']);
    snapshot.gallery.forEach((g) => {
      if (g.category && g.category.trim()) cats.add(g.category.trim());
    });
    return Array.from(cats);
  }, [snapshot]);

  const openHotelPage = (slug: string) => {
    setActiveHotelSlug(slug);
    setHotelDropdownOpen(false);
    setMobileMenuOpen(false);
    if (!isPreview) {
      window.location.hash = `#/hotel/${encodeURIComponent(slug)}`;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeHotelPage = () => {
    setActiveHotelSlug(null);
    if (!isPreview) {
      window.location.hash = '#hotels';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openLightbox = (images: Array<{ url: string; title: string; caption?: string }>, startIndex = 0) => {
    if (!images || images.length === 0) return;
    setLightboxState({ images, index: startIndex });
  };

  const handleEnquireRoom = (room: PublicSnapshotRoom, hotelName?: string) => {
    const targetHotel = hotelName || room.hotel_name || activeHotel?.name || snapshot?.hotel.name || 'Partner Hotel';
    const whatsapp = (activeHotel?.whatsapp_number || snapshot?.hotel.whatsapp_number || '').replace(/[^0-9]/g, '');
    if (whatsapp) {
      const text = encodeURIComponent(
        `Hello! I would like to enquire about booking the "${room.name}" at ${targetHotel}. Please share availability and rates.`
      );
      window.open(`https://wa.me/${whatsapp}?text=${text}`, '_blank', 'noopener,noreferrer');
      return;
    }
    setEnquiryModalContext({ hotelName: targetHotel, roomName: room.name });
    setEnquiryMessage(`I would like to enquire about availability and rates for "${room.name}" at ${targetHotel}.`);
  };

  if (!snapshot || (!snapshot.is_configured && hotelsList.length === 0)) {
    return (
      <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col">
        {isPreview && (
          <div className="bg-amber-950 text-amber-100 px-4 py-2.5 text-xs flex items-center justify-between">
            <span>CRM Draft Preview Mode — Add hotels & rooms in Public Website Management to preview your site.</span>
            {onExitPreview && (
              <button
                onClick={onExitPreview}
                className="px-3 py-1 rounded bg-amber-800 hover:bg-amber-700 text-white font-semibold cursor-pointer"
              >
                Back to Editor
              </button>
            )}
          </div>
        )}
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-stone-200 rounded-2xl p-8 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
              <Building2 className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
              Partner Hotel Directory Coming Soon
            </h1>
            <p className="text-sm text-stone-600 leading-relaxed">
              Our curated partner hotel directory and room showcase is currently being prepared. Please check back shortly.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const { hotel, homepage, facilities, gallery, faqs } = snapshot;
  const brandTitle = hotel.name || 'SN Travels — Partner Hotel Collection';

  const handleNavSection = (sectionId: string) => {
    setActiveHotelSlug(null);
    setActivePage('home');
    setMobileMenuOpen(false);
    setHotelDropdownOpen(false);
    if (!isPreview && window.location.hash.startsWith('#/hotel/')) {
      window.location.hash = `#${sectionId}`;
    }
    setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  };

  const renderStars = (count: number) => {
    const n = Math.min(5, Math.max(1, Number(count || 5)));
    return (
      <span className="inline-flex items-center gap-0.5 text-amber-400" aria-label={`${n} Star Hotel`}>
        {Array.from({ length: n }).map((_, idx) => (
          <Star key={idx} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
        ))}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans selection:bg-amber-500 selection:text-stone-950">
      {/* Admin Draft Preview Banner */}
      {isPreview && (
        <div className="sticky top-0 z-50 bg-stone-900 text-stone-100 border-b border-stone-700 px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-semibold">CRM Live Draft Preview</span>
            <span className="text-stone-400 hidden sm:inline">
              • {hotelsList.length} {hotelsList.length === 1 ? 'Hotel' : 'Hotels'} & {allRoomsAcrossHotels.length} Room Types loaded
            </span>
          </div>
          <div className="flex items-center gap-2">
            {activeHotel && (
              <button
                type="button"
                onClick={closeHotelPage}
                className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium cursor-pointer"
              >
                ← View All Hotels Directory
              </button>
            )}
            {onExitPreview && (
              <button
                type="button"
                onClick={onExitPreview}
                className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold transition cursor-pointer"
              >
                Return to CMS Editor
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Brand Identity */}
          <button
            type="button"
            onClick={() => {
              closeHotelPage();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-3 text-left group cursor-pointer"
          >
            {hotel.logo_url ? (
              <img
                src={hotel.logo_url}
                alt={brandTitle}
                referrerPolicy="no-referrer"
                className="h-11 w-auto object-contain rounded-lg"
              />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-stone-900 text-amber-400 flex items-center justify-center shadow-xs group-hover:bg-stone-800 transition">
                <Building2 className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="text-base sm:text-lg font-bold text-stone-900 tracking-tight leading-tight">
                {brandTitle}
              </div>
              {hotel.tagline ? (
                <div className="text-xs text-stone-500 line-clamp-1">{hotel.tagline}</div>
              ) : (
                <div className="text-xs text-stone-500">
                  {hotelsList.length} Partner {hotelsList.length === 1 ? 'Hotel' : 'Hotels'} & Direct Room Booking
                </div>
              )}
            </div>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-stone-700">
            <button
              type="button"
              onClick={() => handleNavSection('hotels')}
              className={`hover:text-amber-700 transition cursor-pointer ${
                !activeHotel && activePage === 'home' ? 'text-amber-700 font-semibold' : ''
              }`}
            >
              Hotels Directory ({hotelsList.length})
            </button>

            {/* Quick Hotel Page Switcher Dropdown */}
            {hotelsList.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setHotelDropdownOpen((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                    activeHotel
                      ? 'border-amber-600/40 bg-amber-50/70 text-amber-900 font-semibold'
                      : 'border-stone-200 hover:border-stone-300 text-stone-700'
                  }`}
                >
                  <Building2 className="w-4 h-4 text-amber-700" />
                  <span>{activeHotel ? activeHotel.name : 'Select Hotel Page'}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {hotelDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-80 bg-white border border-stone-200 rounded-2xl shadow-xl py-2 z-50 max-h-96 overflow-y-auto">
                    <div className="px-3.5 py-2 border-b border-stone-100 text-[11px] font-bold uppercase tracking-wider text-stone-400">
                      Dedicated Hotel Pages ({hotelsList.length})
                    </div>
                    {hotelsList.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => openHotelPage(h.slug)}
                        className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 hover:bg-stone-50 transition cursor-pointer ${
                          activeHotel?.id === h.id ? 'bg-amber-50/60 font-semibold text-amber-900' : 'text-stone-800'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-sm truncate">{h.name}</div>
                          <div className="text-[11px] text-stone-500 flex items-center gap-1.5">
                            {h.city && <span>{h.city}</span>}
                            <span>• {(h.rooms || []).length} Room Types</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {allRoomsAcrossHotels.length > 0 && (
              <button
                type="button"
                onClick={() => handleNavSection('all-rooms')}
                className="hover:text-amber-700 transition cursor-pointer"
              >
                All Rooms
              </button>
            )}
            {facilities.length > 0 && (
              <button
                type="button"
                onClick={() => handleNavSection('facilities')}
                className="hover:text-amber-700 transition cursor-pointer"
              >
                Services
              </button>
            )}
            {faqs.length > 0 && (
              <button
                type="button"
                onClick={() => handleNavSection('faq')}
                className="hover:text-amber-700 transition cursor-pointer"
              >
                FAQ
              </button>
            )}
            <button
              type="button"
              onClick={() => handleNavSection('contact')}
              className="hover:text-amber-700 transition cursor-pointer"
            >
              Contact
            </button>
          </nav>

          {/* Primary CTA */}
          <div className="hidden sm:flex items-center gap-2.5">
            {hotel.whatsapp_number && (
              <a
                href={`https://wa.me/${hotel.whatsapp_number.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp Desk</span>
              </a>
            )}
            <button
              type="button"
              onClick={() =>
                setEnquiryModalContext({
                  hotelName: activeHotel?.name || brandTitle,
                })
              }
              className="px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition cursor-pointer"
            >
              {hotel.reservation_button_text || 'Enquire Now'}
            </button>
          </div>

          {/* Mobile Hamburger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden p-2 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-100"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-stone-200 px-4 py-4 space-y-3">
            <button
              type="button"
              onClick={() => handleNavSection('hotels')}
              className="block w-full text-left py-2 text-sm font-semibold text-stone-900"
            >
              Hotels Directory ({hotelsList.length})
            </button>
            {hotelsList.length > 0 && (
              <div className="pl-3 border-l-2 border-amber-500 space-y-1.5 py-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                  Hotel Pages
                </div>
                {hotelsList.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => openHotelPage(h.slug)}
                    className="block w-full text-left py-1.5 text-xs font-medium text-stone-700 hover:text-amber-700"
                  >
                    {h.name} {h.city ? `(${h.city})` : ''} — {(h.rooms || []).length} Rooms
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => handleNavSection('all-rooms')}
              className="block w-full text-left py-2 text-sm font-medium text-stone-700"
            >
              All Rooms
            </button>
            <button
              type="button"
              onClick={() => handleNavSection('contact')}
              className="block w-full text-left py-2 text-sm font-medium text-stone-700"
            >
              Contact & Reservations
            </button>
          </div>
        )}
      </header>

      {/* =====================================================================
          VIEW 1: AUTOMATIC DEDICATED PAGE FOR SELECTED HOTEL
         ===================================================================== */}
      {activeHotel ? (
        <main className="flex-1">
          {/* Sticky Hotel Sub-bar & Back Button */}
          <div className="bg-stone-900 text-stone-200 border-b border-stone-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <button
                  type="button"
                  onClick={closeHotelPage}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-white font-semibold transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 text-amber-400" />
                  <span>All Hotels</span>
                </button>
                <span className="text-stone-600">/</span>
                {activeHotel.city && (
                  <>
                    <span className="text-stone-400">{activeHotel.city}</span>
                    <span className="text-stone-600">/</span>
                  </>
                )}
                <span className="text-white font-semibold truncate max-w-xs sm:max-w-md">
                  {activeHotel.name}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <a href="#hotel-rooms" className="text-amber-400 hover:text-amber-300 font-semibold">
                  Room Types ({(activeHotel.rooms || []).length})
                </a>
                <a href="#hotel-overview" className="text-stone-300 hover:text-white">
                  Overview & Amenities
                </a>
                <a href="#hotel-location" className="text-stone-300 hover:text-white">
                  Location & Contact
                </a>
              </div>
            </div>
          </div>

          {/* Hotel Hero & Multi-Photo Bento Showcase */}
          <section className="bg-white border-b border-stone-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
              {/* Title & Quick Actions Row */}
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {renderStars(activeHotel.star_rating || 5)}
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200">
                      {activeHotel.star_rating || 5}-Star Partner Hotel
                    </span>
                    {activeHotel.city && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-600">
                        <MapPin className="w-3.5 h-3.5 text-amber-700" />
                        {activeHotel.city}
                        {activeHotel.country ? `, ${activeHotel.country}` : ''}
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl sm:text-4xl font-bold text-stone-900 tracking-tight">
                    {activeHotel.name}
                  </h1>
                  {activeHotel.address && (
                    <p className="text-sm text-stone-600 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-stone-400 shrink-0" />
                      <span>{activeHotel.address}</span>
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {activeHotel.starting_price !== null && activeHotel.starting_price !== undefined && (
                    <div className="px-4 py-2 rounded-xl bg-stone-100 border border-stone-200 text-right">
                      <div className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold">
                        Rooms Starting From
                      </div>
                      <div className="text-lg font-bold text-stone-900">
                        {activeHotel.currency || 'USD'} {Number(activeHotel.starting_price).toLocaleString()}
                        <span className="text-xs font-normal text-stone-500"> / night</span>
                      </div>
                    </div>
                  )}
                  <a
                    href="#hotel-rooms"
                    className="px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition shadow-xs"
                  >
                    View Room Types ({(activeHotel.rooms || []).length})
                  </a>
                </div>
              </div>

              {/* Hotel Photo Gallery Grid */}
              {(() => {
                const hotelPhotos: Array<{ url: string; title: string; caption?: string }> = [];
                if (activeHotel.featured_image_url) {
                  hotelPhotos.push({
                    url: activeHotel.featured_image_url,
                    title: activeHotel.name,
                    caption: 'Hotel Cover Photo',
                  });
                }
                (activeHotel.gallery_images || []).forEach((u, i) => {
                  if (u && !hotelPhotos.some((p) => p.url === u)) {
                    hotelPhotos.push({
                      url: u,
                      title: activeHotel.name,
                      caption: `Hotel Gallery Photo ${i + 1}`,
                    });
                  }
                });
                // Also pull room photos into the hotel's gallery preview if needed
                (activeHotel.rooms || []).forEach((rm) => {
                  if (rm.featured_image_url && !hotelPhotos.some((p) => p.url === rm.featured_image_url)) {
                    hotelPhotos.push({
                      url: rm.featured_image_url,
                      title: `${rm.name} — ${activeHotel.name}`,
                      caption: rm.short_description || rm.name,
                    });
                  }
                  (rm.gallery_images || []).forEach((u) => {
                    if (u && !hotelPhotos.some((p) => p.url === u)) {
                      hotelPhotos.push({
                        url: u,
                        title: `${rm.name} — ${activeHotel.name}`,
                        caption: rm.name,
                      });
                    }
                  });
                });

                if (hotelPhotos.length === 0) {
                  return (
                    <div className="h-64 sm:h-80 rounded-2xl overflow-hidden border border-stone-200">
                      <SafeImage
                        src=""
                        alt={activeHotel.name}
                        fallbackLabel={`${activeHotel.name} (${activeHotel.city || 'Partner Hotel'})`}
                        className="w-full h-full"
                      />
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 h-72 sm:h-96 rounded-2xl overflow-hidden">
                    <div
                      onClick={() => openLightbox(hotelPhotos, 0)}
                      className="md:col-span-2 h-full relative group cursor-pointer overflow-hidden bg-stone-900"
                    >
                      <SafeImage
                        src={hotelPhotos[0].url}
                        alt={activeHotel.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />
                      <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-stone-950/75 text-white text-xs font-medium backdrop-blur-xs">
                        Click to enlarge photos ({hotelPhotos.length})
                      </div>
                    </div>
                    <div className="hidden md:grid md:col-span-2 grid-cols-2 grid-rows-2 gap-3 h-full">
                      {[1, 2, 3, 4].map((idx) => {
                        const item = hotelPhotos[idx];
                        if (!item) {
                          return (
                            <div
                              key={idx}
                              className="bg-stone-100 border border-stone-200/60 flex items-center justify-center text-stone-400 text-xs"
                            >
                              <Building2 className="w-5 h-5 opacity-40" />
                            </div>
                          );
                        }
                        return (
                          <div
                            key={idx}
                            onClick={() => openLightbox(hotelPhotos, idx)}
                            className="relative group cursor-pointer overflow-hidden bg-stone-900"
                          >
                            <SafeImage
                              src={item.url}
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                            />
                            {idx === 4 && hotelPhotos.length > 5 && (
                              <div className="absolute inset-0 bg-stone-950/70 flex items-center justify-center text-white font-bold text-sm">
                                +{hotelPhotos.length - 5} More Photos
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </section>

          {/* Dedicated Hotel Page — Room Types & Room Pictures Section */}
          <section id="hotel-rooms" className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-stone-200 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-amber-700">
                  Accommodation & Room Categories
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1">
                  Room Types at {activeHotel.name}
                </h2>
                <p className="text-sm text-stone-600 mt-1">
                  Browse room pictures, bed configurations, capacities, and nightly rates below.
                </p>
              </div>
              <div className="text-xs font-semibold text-stone-500">
                Showing {(activeHotel.rooms || []).length} Room {(activeHotel.rooms || []).length === 1 ? 'Type' : 'Types'}
              </div>
            </div>

            {(activeHotel.rooms || []).length === 0 ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center space-y-3">
                <BedDouble className="w-8 h-8 text-stone-400 mx-auto" />
                <h3 className="text-base font-bold text-stone-900">Room Types Being Updated</h3>
                <p className="text-sm text-stone-600 max-w-md mx-auto">
                  Contact our reservation desk directly for current room categories and rates at {activeHotel.name}.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeHotel.rooms.map((rm) => (
                  <RoomCardWithGallery
                    key={rm.id}
                    room={rm}
                    hotelName={activeHotel.name}
                    onSelectRoomDetail={(r, hName) => setSelectedRoomModal({ room: r, hotelName: hName })}
                    onOpenLightbox={openLightbox}
                    onEnquireRoom={handleEnquireRoom}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Hotel Overview, Amenities, Policies & Contact */}
          <section id="hotel-overview" className="py-12 bg-white border-t border-stone-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <div className="space-y-3">
                  <h3 className="text-xl font-bold text-stone-900">About {activeHotel.name}</h3>
                  <p className="text-sm sm:text-base text-stone-600 leading-relaxed whitespace-pre-line">
                    {activeHotel.full_description ||
                      activeHotel.short_description ||
                      `${activeHotel.name} is a premier ${activeHotel.star_rating || 5}-star partner hotel in ${
                        activeHotel.city || 'the city'
                      }.`}
                  </p>
                </div>

                {/* Hotel Amenities */}
                {Array.isArray(activeHotel.amenities) && activeHotel.amenities.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-stone-900">Hotel Facilities & Guest Amenities</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {activeHotel.amenities.map((am, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2.5 p-3 rounded-xl bg-stone-50 border border-stone-200/80 text-sm font-medium text-stone-800"
                        >
                          <Check className="w-4 h-4 text-amber-700 shrink-0" />
                          <span>{am}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Check-in / Check-out & Policies */}
                <div className="p-6 rounded-2xl bg-stone-50 border border-stone-200 space-y-4">
                  <h3 className="text-base font-bold text-stone-900">Check-In, Check-Out & Stay Policies</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 rounded-xl bg-white border border-stone-200">
                      <div className="text-xs text-stone-500">Check-In Time</div>
                      <div className="text-sm font-bold text-stone-900 mt-0.5">
                        {activeHotel.check_in_time || '14:00'}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-white border border-stone-200">
                      <div className="text-xs text-stone-500">Check-Out Time</div>
                      <div className="text-sm font-bold text-stone-900 mt-0.5">
                        {activeHotel.check_out_time || '12:00'}
                      </div>
                    </div>
                  </div>
                  {activeHotel.cancellation_policy && (
                    <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-line">
                      {activeHotel.cancellation_policy}
                    </p>
                  )}
                </div>
              </div>

              {/* Direct Hotel Contact & Location Card */}
              <div id="hotel-location" className="space-y-4">
                <div className="p-6 rounded-2xl bg-stone-900 text-white space-y-5">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
                      Direct Reservation Desk
                    </span>
                    <h3 className="text-lg font-bold mt-1">{activeHotel.name}</h3>
                    {activeHotel.address && (
                      <p className="text-xs text-stone-300 mt-1">{activeHotel.address}</p>
                    )}
                  </div>

                  <div className="space-y-2.5 text-sm">
                    {(activeHotel.contact_phone || hotel.contact_phone) && (
                      <a
                        href={`tel:${activeHotel.contact_phone || hotel.contact_phone}`}
                        className="flex items-center gap-3 p-3 rounded-xl bg-stone-800 hover:bg-stone-700 transition"
                      >
                        <Phone className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{activeHotel.contact_phone || hotel.contact_phone}</span>
                      </a>
                    )}
                    {(activeHotel.whatsapp_number || hotel.whatsapp_number) && (
                      <a
                        href={`https://wa.me/${(activeHotel.whatsapp_number || hotel.whatsapp_number).replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 transition font-medium"
                      >
                        <MessageCircle className="w-4 h-4 text-white shrink-0" />
                        <span>Chat on WhatsApp</span>
                      </a>
                    )}
                    {(activeHotel.contact_email || hotel.contact_email) && (
                      <a
                        href={`mailto:${activeHotel.contact_email || hotel.contact_email}`}
                        className="flex items-center gap-3 p-3 rounded-xl bg-stone-800 hover:bg-stone-700 transition truncate"
                      >
                        <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="truncate">{activeHotel.contact_email || hotel.contact_email}</span>
                      </a>
                    )}
                  </div>

                  {activeHotel.google_maps_url && (
                    <a
                      href={activeHotel.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 rounded-xl border border-stone-700 hover:bg-stone-800 text-xs font-semibold flex items-center justify-center gap-2 transition"
                    >
                      <MapPin className="w-4 h-4 text-amber-400" />
                      <span>Open Location in Google Maps</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>
      ) : (
        /* =====================================================================
           VIEW 2: MULTI-HOTEL DIRECTORY HOMEPAGE
           ===================================================================== */
        <main className="flex-1">
          {/* Hero Banner with Search & Filter Bar */}
          <section className="relative bg-stone-900 text-white overflow-hidden">
            {homepage.hero_image_url && (
              <div className="absolute inset-0 opacity-35">
                <SafeImage
                  src={homepage.hero_image_url}
                  alt={brandTitle}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-stone-950/80 via-stone-900/75 to-stone-950/95" />

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 space-y-8">
              <div className="max-w-3xl space-y-4">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-semibold uppercase tracking-widest">
                  <Sparkles className="w-3.5 h-3.5" />
                  Official Partner Hotel Directory
                </span>
                <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
                  {homepage.hero_heading || `Explore Our Curated Partner Hotels & Suites`}
                </h1>
                <p className="text-base sm:text-lg text-stone-300 leading-relaxed max-w-2xl">
                  {homepage.hero_subtitle ||
                    hotel.short_description ||
                    `Browse ${hotelsList.length} verified partner hotels, compare room types and room photos, and connect with our reservation team for priority booking rates.`}
                </p>
              </div>

              {/* Interactive Multi-Hotel Search & Filter Bar */}
              <div className="bg-white/95 backdrop-blur-md p-3 sm:p-4 rounded-2xl shadow-xl border border-stone-200/80 text-stone-900 max-w-4xl">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-6 relative">
                    <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={hotelSearch}
                      onChange={(e) => setHotelSearch(e.target.value)}
                      placeholder="Search by hotel name, city, or room type..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-sm focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <select
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      aria-label="Filter by city"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-sm font-medium text-stone-700 focus:outline-none focus:border-amber-600"
                    >
                      {availableCities.map((c) => (
                        <option key={c} value={c}>
                          {c === 'All' ? 'All Cities' : c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <select
                      value={selectedMinStars}
                      onChange={(e) => setSelectedMinStars(Number(e.target.value))}
                      aria-label="Filter by star rating"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-sm font-medium text-stone-700 focus:outline-none focus:border-amber-600"
                    >
                      <option value={0}>All Star Ratings</option>
                      <option value={5}>5-Star Hotels Only</option>
                      <option value={4}>4+ Star Hotels</option>
                      <option value={3}>3+ Star Hotels</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Partner Hotels Directory Section */}
          <section id="hotels" className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-amber-700">
                  Partner Hotel Collection
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1">
                  Our Partner Hotels ({filteredHotels.length})
                </h2>
                <p className="text-sm text-stone-600 mt-1">
                  Select any hotel below to open its dedicated hotel page, inspect room photos, and view room types.
                </p>
              </div>

              {/* City Quick Pills */}
              {availableCities.length > 2 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {availableCities.map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => setSelectedCity(city)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        selectedCity === city
                          ? 'bg-stone-900 text-white'
                          : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {filteredHotels.length === 0 ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center space-y-3">
                <Filter className="w-8 h-8 text-stone-400 mx-auto" />
                <h3 className="text-base font-bold text-stone-900">No Matching Hotels Found</h3>
                <p className="text-sm text-stone-600">
                  Try clearing your search or selecting "All Cities".
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setHotelSearch('');
                    setSelectedCity('All');
                    setSelectedMinStars(0);
                  }}
                  className="px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-semibold cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                {filteredHotels.map((h) => {
                  const hotelCover =
                    h.featured_image_url ||
                    (h.gallery_images && h.gallery_images[0]) ||
                    (h.rooms && h.rooms[0]?.featured_image_url) ||
                    '';
                  const roomCount = (h.rooms || []).length;

                  return (
                    <article
                      key={h.id}
                      onClick={() => openHotelPage(h.slug)}
                      className="bg-white border border-stone-200 rounded-2xl overflow-hidden flex flex-col shadow-xs hover:shadow-xl hover:border-amber-600/40 transition duration-300 group cursor-pointer"
                    >
                      {/* Hotel Card Image */}
                      <div className="relative aspect-16/10 bg-stone-900 overflow-hidden">
                        <SafeImage
                          src={hotelCover}
                          alt={h.name}
                          fallbackLabel={h.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />

                        <div className="absolute top-3 left-3 flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-md bg-stone-950/80 backdrop-blur-xs text-amber-400 text-xs font-bold flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            {h.star_rating || 5}.0
                          </span>
                          {h.city && (
                            <span className="px-2.5 py-1 rounded-md bg-white/95 text-stone-900 text-xs font-semibold flex items-center gap-1 shadow-2xs">
                              <MapPin className="w-3 h-3 text-amber-700" />
                              {h.city}
                            </span>
                          )}
                        </div>

                        <div className="absolute top-3 right-3">
                          <span className="px-2.5 py-1 rounded-md bg-amber-500 text-stone-950 text-[11px] font-bold">
                            {roomCount} {roomCount === 1 ? 'Room Type' : 'Room Types'}
                          </span>
                        </div>

                        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                          <div>
                            <h3 className="text-xl font-bold text-white leading-snug group-hover:text-amber-300 transition">
                              {h.name}
                            </h3>
                            {h.address && (
                              <p className="text-xs text-stone-300 line-clamp-1 mt-0.5">{h.address}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Hotel Card Body */}
                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-3">
                          {h.short_description && (
                            <p className="text-sm text-stone-600 line-clamp-2 leading-relaxed">
                              {h.short_description}
                            </p>
                          )}

                          {/* Room Types Preview Box inside Hotel Card */}
                          {roomCount > 0 && (
                            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1.5">
                              <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 flex items-center justify-between">
                                <span>Available Room Types</span>
                                <span>Rate / Night</span>
                              </div>
                              {h.rooms.slice(0, 3).map((rm) => (
                                <div key={rm.id} className="flex items-center justify-between text-xs">
                                  <span className="font-medium text-stone-800 truncate pr-2 flex items-center gap-1.5">
                                    <BedDouble className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                    <span className="truncate">{rm.name}</span>
                                  </span>
                                  <span className="font-bold text-stone-900 shrink-0">
                                    {rm.optional_price !== null && rm.optional_price !== undefined
                                      ? `${rm.currency || 'USD'} ${Number(rm.optional_price).toLocaleString()}`
                                      : 'Enquire'}
                                  </span>
                                </div>
                              ))}
                              {roomCount > 3 && (
                                <div className="text-[11px] text-amber-700 font-semibold pt-0.5">
                                  +{roomCount - 3} more room {roomCount - 3 === 1 ? 'type' : 'types'} →
                                </div>
                              )}
                            </div>
                          )}

                          {/* Hotel Amenities Pills */}
                          {Array.isArray(h.amenities) && h.amenities.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {h.amenities.slice(0, 4).map((am, idx) => (
                                <span
                                  key={idx}
                                  className="text-[11px] px-2 py-0.5 rounded bg-stone-100 text-stone-600"
                                >
                                  {am}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Card Footer */}
                        <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-3">
                          <div>
                            {h.starting_price !== null && h.starting_price !== undefined ? (
                              <div>
                                <span className="text-[11px] text-stone-500 block">Starting from</span>
                                <span className="text-base font-bold text-stone-900">
                                  {h.currency || 'USD'} {Number(h.starting_price).toLocaleString()}
                                </span>
                                <span className="text-xs text-stone-500"> / night</span>
                              </div>
                            ) : (
                              <span className="text-xs font-medium text-stone-500">
                                Direct Partner Rates
                              </span>
                            )}
                          </div>

                          <span className="px-4 py-2.5 rounded-xl bg-stone-900 group-hover:bg-amber-600 text-white text-xs font-semibold transition flex items-center gap-1.5">
                            <span>View Hotel & Rooms</span>
                            <ChevronRight className="w-4 h-4" />
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* All Featured Rooms Showcase Across Hotels */}
          {allRoomsAcrossHotels.length > 0 && (
            <section id="all-rooms" className="py-14 bg-white border-t border-stone-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-amber-700">
                      Room Types & Room Pictures
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1">
                      Featured Rooms & Suites Across Our Hotels
                    </h2>
                    <p className="text-sm text-stone-600 mt-1">
                      Compare room pictures, capacities, and nightly rates across our partner properties.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {allRoomsAcrossHotels.slice(0, 9).map(({ room, hotel: parentHotel }) => (
                    <RoomCardWithGallery
                      key={`${parentHotel?.id || 0}-${room.id}`}
                      room={room}
                      hotelName={parentHotel?.name || room.hotel_name}
                      onSelectRoomDetail={(r, hName) => setSelectedRoomModal({ room: r, hotelName: hName })}
                      onOpenLightbox={openLightbox}
                      onEnquireRoom={handleEnquireRoom}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Highlighted Services / Facilities */}
          {facilities.length > 0 && (
            <section id="facilities" className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-amber-700">
                  Guest Services
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1">
                  Hospitality & Booking Advantages
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {facilities.map((fac) => (
                  <div
                    key={fac.id}
                    className="p-5 rounded-2xl bg-white border border-stone-200 space-y-2.5"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                      {FACILITY_ICONS[fac.icon_name] || <Sparkles className="w-5 h-5" />}
                    </div>
                    <h3 className="text-base font-bold text-stone-900">{fac.name}</h3>
                    {fac.description && (
                      <p className="text-xs text-stone-600 leading-relaxed">{fac.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Photo Gallery Section */}
          {gallery.length > 0 && (
            <section id="gallery" className="py-14 bg-white border-t border-stone-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-amber-700">
                      Visual Tour
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-bold text-stone-900 mt-1">
                      Photo Gallery
                    </h2>
                  </div>
                  {galleryCategories.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {galleryCategories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setGalleryCategory(cat)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                            galleryCategory === cat
                              ? 'bg-stone-900 text-white'
                              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {gallery
                    .filter((g) => galleryCategory === 'All' || g.category === galleryCategory)
                    .map((g, idx, arr) => (
                      <div
                        key={g.id}
                        onClick={() =>
                          openLightbox(
                            arr.map((item) => ({
                              url: item.image_url,
                              title: item.title || 'Gallery Photo',
                              caption: item.caption,
                            })),
                            idx
                          )
                        }
                        className="group relative aspect-4/3 rounded-xl overflow-hidden bg-stone-900 cursor-pointer"
                      >
                        <SafeImage
                          src={g.image_url}
                          alt={g.alt_text || g.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />
                      </div>
                    ))}
                </div>
              </div>
            </section>
          )}

          {/* FAQ Section */}
          {faqs.length > 0 && (
            <section id="faq" className="py-14 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
              <div className="text-center space-y-2">
                <span className="text-xs font-bold uppercase tracking-widest text-amber-700">
                  Helpful Information
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-stone-900">
                  Frequently Asked Questions
                </h2>
              </div>
              <div className="space-y-3">
                {faqs.map((f) => {
                  const isOpen = openFaqId === f.id;
                  return (
                    <div
                      key={f.id}
                      className="bg-white border border-stone-200 rounded-2xl overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaqId(isOpen ? null : f.id)}
                        className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 font-semibold text-sm text-stone-900 cursor-pointer"
                      >
                        <span>{f.question}</span>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-stone-500 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-stone-500 shrink-0" />
                        )}
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-4 text-sm text-stone-600 leading-relaxed border-t border-stone-100 pt-3">
                          {f.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Contact & Direct Reservation Section */}
          <section id="contact" className="py-14 bg-stone-900 text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div className="space-y-4">
                <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
                  Reservations & Support
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold">
                  Need Help Choosing a Hotel or Room?
                </h2>
                <p className="text-sm text-stone-300 leading-relaxed">
                  Contact our travel & hotel reservation team directly via WhatsApp, phone, or email for instant room availability and corporate/group rates.
                </p>
                <div className="space-y-2.5 pt-2 text-sm">
                  {hotel.contact_phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-amber-400" />
                      <span>{hotel.contact_phone}</span>
                    </div>
                  )}
                  {hotel.whatsapp_number && (
                    <div className="flex items-center gap-3">
                      <MessageCircle className="w-4 h-4 text-emerald-400" />
                      <span>WhatsApp: {hotel.whatsapp_number}</span>
                    </div>
                  )}
                  {hotel.contact_email && (
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-amber-400" />
                      <span>{hotel.contact_email}</span>
                    </div>
                  )}
                  {hotel.address_line && (
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-amber-400" />
                      <span>{hotel.address_line}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white text-stone-900 p-6 rounded-2xl space-y-4">
                <h3 className="text-lg font-bold">Send a Quick Hotel Enquiry</h3>
                {enquiryFeedback && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
                    {enquiryFeedback}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={enquiryName}
                    onChange={(e) => setEnquiryName(e.target.value)}
                    placeholder="Your Full Name"
                    className="px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm"
                  />
                  <input
                    type="email"
                    value={enquiryEmail}
                    onChange={(e) => setEnquiryEmail(e.target.value)}
                    placeholder="Email or Phone / WhatsApp"
                    className="px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm"
                  />
                </div>
                <input
                  type="text"
                  value={enquiryDates}
                  onChange={(e) => setEnquiryDates(e.target.value)}
                  placeholder="Preferred Hotel, Room Type & Check-in / Check-out Dates"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm"
                />
                <textarea
                  rows={3}
                  value={enquiryMessage}
                  onChange={(e) => setEnquiryMessage(e.target.value)}
                  placeholder="Your message or special requests..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    const wa = (hotel.whatsapp_number || '').replace(/[^0-9]/g, '');
                    if (wa) {
                      const msg = encodeURIComponent(
                        `Name: ${enquiryName}\nContact: ${enquiryEmail}\nDates/Hotel: ${enquiryDates}\nMessage: ${enquiryMessage}`
                      );
                      window.open(`https://wa.me/${wa}?text=${msg}`, '_blank', 'noopener,noreferrer');
                    } else if (hotel.contact_email) {
                      window.location.href = `mailto:${hotel.contact_email}?subject=${encodeURIComponent(
                        `Hotel Reservation Enquiry — ${enquiryDates || brandTitle}`
                      )}&body=${encodeURIComponent(
                        `Name: ${enquiryName}\nContact: ${enquiryEmail}\nDetails: ${enquiryDates}\n\n${enquiryMessage}`
                      )}`;
                    }
                    setEnquiryFeedback('Thank you! Your enquiry details have been prepared for our reservation team.');
                  }}
                  className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm transition cursor-pointer"
                >
                  Send Reservation Enquiry
                </button>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* Footer */}
      <footer className="bg-stone-950 text-stone-400 border-t border-stone-800 py-10 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-bold text-white">{brandTitle}</span>
            <p className="mt-1">
              {hotel.copyright_text || `© ${new Date().getFullYear()} ${brandTitle}. All rights reserved.`}
            </p>
          </div>
          {hotelsList.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {hotelsList.slice(0, 6).map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => openHotelPage(h.slug)}
                  className="hover:text-white transition cursor-pointer"
                >
                  {h.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </footer>

      {/* Room Detail Modal */}
      {selectedRoomModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedRoomModal(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl border border-stone-200 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-stone-200 flex items-center justify-between gap-4">
              <div>
                {selectedRoomModal.hotelName && (
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-700">
                    {selectedRoomModal.hotelName}
                  </div>
                )}
                <h3 className="text-xl font-bold text-stone-900">{selectedRoomModal.room.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRoomModal(null)}
                className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* All Room Pictures Grid */}
              {(() => {
                const rm = selectedRoomModal.room;
                const pics = [
                  ...(rm.featured_image_url ? [rm.featured_image_url] : []),
                  ...(Array.isArray(rm.gallery_images) ? rm.gallery_images : []),
                ].filter((v, i, a) => v && a.indexOf(v) === i);

                if (pics.length === 0) return null;
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {pics.map((img, i) => (
                      <div
                        key={i}
                        onClick={() =>
                          openLightbox(
                            pics.map((u, idx) => ({
                              url: u,
                              title: rm.name,
                              caption: `Photo ${idx + 1}`,
                            })),
                            i
                          )
                        }
                        className="aspect-16/10 rounded-xl overflow-hidden bg-stone-900 cursor-pointer"
                      >
                        <SafeImage src={img} alt={`${rm.name} ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                );
              })()}

              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-stone-50 border border-stone-200">
                <div className="flex flex-wrap gap-4 text-xs font-semibold text-stone-700">
                  {selectedRoomModal.room.capacity && <span>Capacity: {selectedRoomModal.room.capacity}</span>}
                  {selectedRoomModal.room.bed_type && <span>Bed: {selectedRoomModal.room.bed_type}</span>}
                  {selectedRoomModal.room.room_size && <span>Size: {selectedRoomModal.room.room_size}</span>}
                </div>
                {selectedRoomModal.room.optional_price !== null &&
                  selectedRoomModal.room.optional_price !== undefined && (
                    <div className="text-lg font-bold text-amber-700">
                      {selectedRoomModal.room.currency || 'USD'}{' '}
                      {Number(selectedRoomModal.room.optional_price).toLocaleString()}{' '}
                      <span className="text-xs font-normal text-stone-500">
                        / {selectedRoomModal.room.price_note || 'night'}
                      </span>
                    </div>
                  )}
              </div>

              <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">
                {selectedRoomModal.room.full_description || selectedRoomModal.room.short_description}
              </p>

              {Array.isArray(selectedRoomModal.room.amenities) && selectedRoomModal.room.amenities.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                    Room Amenities
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedRoomModal.room.amenities.map((am, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-stone-100 text-xs font-medium text-stone-800"
                      >
                        <Check className="w-3.5 h-3.5 text-amber-700" />
                        {am}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-stone-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedRoomModal(null)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const { room, hotelName } = selectedRoomModal;
                    setSelectedRoomModal(null);
                    handleEnquireRoom(room, hotelName);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold cursor-pointer"
                >
                  Enquire About This Room
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Enquiry Modal */}
      {enquiryModalContext && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setEnquiryModalContext(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                  Direct Room Enquiry
                </span>
                <h3 className="text-lg font-bold text-stone-900">
                  {enquiryModalContext.roomName
                    ? `${enquiryModalContext.roomName} — ${enquiryModalContext.hotelName}`
                    : enquiryModalContext.hotelName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEnquiryModalContext(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              value={enquiryName}
              onChange={(e) => setEnquiryName(e.target.value)}
              placeholder="Your Name"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm"
            />
            <input
              type="text"
              value={enquiryEmail}
              onChange={(e) => setEnquiryEmail(e.target.value)}
              placeholder="Your WhatsApp / Phone or Email"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm"
            />
            <input
              type="text"
              value={enquiryDates}
              onChange={(e) => setEnquiryDates(e.target.value)}
              placeholder="Check-in & Check-out Dates"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm"
            />
            <textarea
              rows={3}
              value={enquiryMessage}
              onChange={(e) => setEnquiryMessage(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEnquiryModalContext(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const wa = (activeHotel?.whatsapp_number || hotel.whatsapp_number || '').replace(/[^0-9]/g, '');
                  if (wa) {
                    const text = encodeURIComponent(
                      `Hotel: ${enquiryModalContext.hotelName || ''}\nRoom: ${
                        enquiryModalContext.roomName || 'Any'
                      }\nName: ${enquiryName}\nContact: ${enquiryEmail}\nDates: ${enquiryDates}\nMessage: ${enquiryMessage}`
                    );
                    window.open(`https://wa.me/${wa}?text=${text}`, '_blank', 'noopener,noreferrer');
                  } else if (activeHotel?.contact_email || hotel.contact_email) {
                    window.location.href = `mailto:${
                      activeHotel?.contact_email || hotel.contact_email
                    }?subject=${encodeURIComponent(
                      `Room Enquiry: ${enquiryModalContext.hotelName}`
                    )}&body=${encodeURIComponent(enquiryMessage)}`;
                  }
                  setEnquiryModalContext(null);
                }}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold cursor-pointer"
              >
                Send Enquiry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Photo Lightbox */}
      {lightboxState && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxState(null)}
        >
          <div className="max-w-5xl w-full flex items-center justify-between text-white mb-3 px-2">
            <div>
              <div className="text-sm font-bold">{lightboxState.images[lightboxState.index]?.title}</div>
              <div className="text-xs text-stone-400">
                {lightboxState.images[lightboxState.index]?.caption ||
                  `Photo ${lightboxState.index + 1} of ${lightboxState.images.length}`}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLightboxState(null)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div
            className="relative max-w-5xl w-full max-h-[78vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <SafeImage
              src={lightboxState.images[lightboxState.index]?.url}
              alt={lightboxState.images[lightboxState.index]?.title || 'Photo'}
              className="max-h-[75vh] w-auto object-contain rounded-xl"
            />
            {lightboxState.images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setLightboxState((prev) =>
                      prev
                        ? {
                            ...prev,
                            index: (prev.index - 1 + prev.images.length) % prev.images.length,
                          }
                        : null
                    )
                  }
                  className="absolute left-3 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setLightboxState((prev) =>
                      prev
                        ? {
                            ...prev,
                            index: (prev.index + 1) % prev.images.length,
                          }
                        : null
                    )
                  }
                  className="absolute right-3 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
