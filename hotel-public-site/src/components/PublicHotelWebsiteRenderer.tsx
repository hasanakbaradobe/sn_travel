import React, { useState, useMemo } from 'react';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  MessageCircle,
  ChevronDown,
  ChevronUp,
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
} from 'lucide-react';
import { PublicWebsiteSnapshot } from '../types';

interface PublicHotelWebsiteRendererProps {
  snapshot: PublicWebsiteSnapshot | null;
  isPreview?: boolean;
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

export const PublicHotelWebsiteRenderer: React.FC<PublicHotelWebsiteRendererProps> = ({
  snapshot,
  isPreview = false,
  onExitPreview,
}) => {
  const [activePage, setActivePage] = useState<string>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaqId, setOpenFaqId] = useState<number | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<PublicWebsiteSnapshot['rooms'][0] | null>(null);
  const [lightboxImage, setLightboxImage] = useState<PublicWebsiteSnapshot['gallery'][0] | null>(null);
  const [galleryCategory, setGalleryCategory] = useState<string>('All');

  const [enquiryName, setEnquiryName] = useState('');
  const [enquiryEmail, setEnquiryEmail] = useState('');
  const [enquiryDates, setEnquiryDates] = useState('');
  const [enquiryMessage, setEnquiryMessage] = useState('');
  const [enquiryFeedback, setEnquiryFeedback] = useState<string | null>(null);

  const visiblePagesMap = useMemo(() => {
    const map = new Map<string, PublicWebsiteSnapshot['pages'][0]>();
    if (snapshot?.pages) {
      snapshot.pages.forEach((p) => map.set(p.slug, p));
    }
    return map;
  }, [snapshot]);

  const galleryCategories = useMemo(() => {
    if (!snapshot?.gallery) return ['All'];
    const cats = new Set<string>(['All']);
    snapshot.gallery.forEach((g) => {
      if (g.category && g.category.trim()) cats.add(g.category.trim());
    });
    return Array.from(cats);
  }, [snapshot]);

  if (!snapshot || !snapshot.is_configured) {
    return (
      <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col">
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-stone-200 rounded-xl p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center mx-auto">
              <Building2 className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-semibold text-stone-900 tracking-tight" style={{ textWrap: 'balance' }}>
              Hotel Information Website Coming Soon
            </h1>
            <p className="text-sm text-stone-600 leading-relaxed">
              Our official hotel website is currently being prepared. Please check back shortly for published room types, facilities, and contact information.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const { hotel, homepage, navigation, rooms, facilities, gallery, faqs } = snapshot;

  const handleNavClick = (href: string) => {
    setMobileMenuOpen(false);
    const clean = href.replace(/^#/, '').replace(/^\//, '').toLowerCase();
    if (['home', 'about', 'rooms', 'facilities', 'gallery', 'location', 'faq', 'contact'].includes(clean)) {
      setActivePage(clean);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (href.startsWith('http://') || href.startsWith('https://')) {
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      setActivePage('home');
    }
  };

  const handleEnquirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enquiryName.trim() || !enquiryEmail.trim()) {
      setEnquiryFeedback('Please enter your name and email address.');
      return;
    }

    const subject = encodeURIComponent(`Accommodation Enquiry — ${hotel.name || 'Hotel'}`);
    const body = encodeURIComponent(
      `Name: ${enquiryName.trim()}\nEmail: ${enquiryEmail.trim()}\nPreferred Dates: ${enquiryDates.trim() || 'Flexible'}\n\nMessage:\n${enquiryMessage.trim()}`
    );

    if (hotel.contact_email) {
      window.location.href = `mailto:${hotel.contact_email}?subject=${subject}&body=${body}`;
      setEnquiryFeedback('Your email client has been opened with your enquiry details.');
    } else if (hotel.whatsapp_number) {
      const digits = hotel.whatsapp_number.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${digits}?text=${body}`, '_blank', 'noopener,noreferrer');
      setEnquiryFeedback('WhatsApp has been opened with your enquiry details.');
    } else if (hotel.reservation_url) {
      window.open(hotel.reservation_url, '_blank', 'noopener,noreferrer');
      setEnquiryFeedback('Opened reservation page.');
    } else {
      setEnquiryFeedback('Thank you. Please contact our reception directly using the details listed.');
    }
  };

  const renderRoomsSection = (limit?: number, pageHeading?: string, pageSubheading?: string) => {
    const displayedRooms = limit ? rooms.slice(0, limit) : rooms;
    const roomsPage = visiblePagesMap.get('rooms');
    const disclaimer =
      roomsPage?.structured_data?.disclaimer ||
      'Displayed rates are optional and indicative only. Contact the hotel directly to confirm availability.';

    return (
      <section id="rooms" className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 border-b border-stone-200 pb-6">
          <div>
            <p className="text-xs font-medium text-amber-800 mb-1">Accommodation</p>
            <h2
              className="text-2xl sm:text-3xl font-semibold text-stone-900 tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              {pageHeading || roomsPage?.heading || 'Rooms & Suites'}
            </h2>
            {(pageSubheading || roomsPage?.subheading) && (
              <p className="text-sm text-stone-600 mt-2 max-w-2xl">
                {pageSubheading || roomsPage?.subheading}
              </p>
            )}
          </div>
          {limit && rooms.length > limit && (
            <button
              onClick={() => handleNavClick('#rooms')}
              className="text-sm font-medium text-stone-900 hover:text-amber-800 transition cursor-pointer whitespace-nowrap shrink-0 underline underline-offset-4"
            >
              View All {rooms.length} Room Types
            </button>
          )}
        </div>

        {displayedRooms.length === 0 ? (
          <div className="border border-stone-200 rounded-xl p-8 text-center bg-white">
            <p className="text-sm text-stone-600">
              Room types have not been published yet. Please contact us directly for accommodation details.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {displayedRooms.map((room) => {
                const metaParts = [
                  room.capacity,
                  room.bed_type,
                  room.room_size,
                ].filter((m) => m && m.trim().length > 0);

                return (
                  <article
                    key={room.id}
                    className="bg-white border border-stone-200 rounded-xl overflow-hidden flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5"
                  >
                    <div>
                      <div className="aspect-[4/3] w-full overflow-hidden bg-stone-900">
                        <SafeImage
                          src={room.featured_image_url}
                          alt={room.name}
                          fallbackLabel={room.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-6">
                        {metaParts.length > 0 && (
                          <div className="text-xs text-stone-500 mb-2 flex flex-wrap items-center gap-1.5">
                            {metaParts.map((part, idx) => (
                              <React.Fragment key={idx}>
                                {idx > 0 && <span aria-hidden="true">·</span>}
                                <span>{part}</span>
                              </React.Fragment>
                            ))}
                          </div>
                        )}
                        <h3 className="text-lg font-semibold text-stone-900 tracking-tight">
                          {room.name}
                        </h3>
                        {room.short_description && (
                          <p className="text-sm text-stone-600 mt-2 line-clamp-3 leading-relaxed">
                            {room.short_description}
                          </p>
                        )}

                        {room.amenities && room.amenities.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-stone-100 text-xs text-stone-600">
                            {room.amenities.slice(0, 5).join(' · ')}
                            {room.amenities.length > 5 && ` · +${room.amenities.length - 5} more`}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="px-6 pb-6 pt-3 border-t border-stone-100 flex items-center justify-between gap-4">
                      <div>
                        {room.optional_price !== null && room.optional_price !== undefined ? (
                          <div>
                            <span className="text-base font-semibold text-stone-900 font-mono tabular-nums">
                              {room.currency} {Number(room.optional_price).toLocaleString()}
                            </span>
                            {room.price_note && (
                              <span className="block text-[11px] text-stone-500">
                                {room.price_note}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-stone-500">Rate on enquiry</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedRoom(room)}
                          className="px-3 py-2 text-xs font-medium text-stone-700 hover:text-stone-900 border border-stone-200 rounded-lg hover:bg-stone-50 transition cursor-pointer whitespace-nowrap shrink-0"
                        >
                          Details
                        </button>
                        {(room.enquiry_url || hotel.reservation_url || hotel.contact_email || hotel.whatsapp_number) && (
                          <button
                            onClick={() => {
                              if (room.enquiry_url) {
                                window.open(room.enquiry_url, '_blank', 'noopener,noreferrer');
                              } else if (hotel.reservation_url) {
                                window.open(hotel.reservation_url, '_blank', 'noopener,noreferrer');
                              } else {
                                handleNavClick('#contact');
                              }
                            }}
                            className="px-3.5 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition cursor-pointer whitespace-nowrap shrink-0"
                          >
                            Enquire
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="text-xs text-stone-500 mt-6">{disclaimer}</p>
          </>
        )}
      </section>
    );
  };

  const renderFacilitiesSection = () => {
    const facPage = visiblePagesMap.get('facilities');
    return (
      <section id="facilities" className="py-16 sm:py-20 bg-stone-100/70 border-y border-stone-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <p className="text-xs font-medium text-amber-800 mb-1">Guest Services & Amenities</p>
            <h2
              className="text-2xl sm:text-3xl font-semibold text-stone-900 tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              {facPage?.heading || 'Hotel Facilities'}
            </h2>
            {facPage?.subheading && (
              <p className="text-sm text-stone-600 mt-2">{facPage.subheading}</p>
            )}
          </div>

          {facilities.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-xl p-8 text-center">
              <p className="text-sm text-stone-600">Facility details have not been published yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {facilities.map((fac) => (
                <div
                  key={fac.id}
                  className="bg-white border border-stone-200 rounded-xl p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <span className="text-xs text-stone-500">{fac.category || 'Amenity'}</span>
                      <span className="text-amber-800">
                        {FACILITY_ICONS[fac.icon_name] || <Sparkles className="w-5 h-5" />}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-stone-900">{fac.name}</h3>
                    {fac.description && (
                      <p className="text-sm text-stone-600 mt-2 leading-relaxed">{fac.description}</p>
                    )}
                  </div>
                  {fac.image_url && (
                    <div className="mt-4 aspect-[16/9] rounded-lg overflow-hidden">
                      <SafeImage src={fac.image_url} alt={fac.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  };

  const renderGallerySection = (limit?: number) => {
    const galPage = visiblePagesMap.get('gallery');
    const filtered =
      galleryCategory === 'All' ? gallery : gallery.filter((g) => g.category === galleryCategory);
    const items = limit ? filtered.slice(0, limit) : filtered;

    return (
      <section id="gallery" className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 border-b border-stone-200 pb-6">
          <div>
            <p className="text-xs font-medium text-amber-800 mb-1">Visual Tour</p>
            <h2
              className="text-2xl sm:text-3xl font-semibold text-stone-900 tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              {galPage?.heading || 'Photo Gallery'}
            </h2>
            {galPage?.subheading && (
              <p className="text-sm text-stone-600 mt-2 max-w-2xl">{galPage.subheading}</p>
            )}
          </div>

          {galleryCategories.length > 2 && (
            <div className="flex flex-wrap items-center gap-1 p-1 bg-stone-100 rounded-lg">
              {galleryCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setGalleryCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer whitespace-nowrap shrink-0 ${
                    galleryCategory === cat
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-xl p-8 text-center">
            <p className="text-sm text-stone-600">No gallery photographs have been published yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((img) => (
              <figure
                key={img.id}
                onClick={() => setLightboxImage(img)}
                className="group relative bg-stone-900 rounded-xl overflow-hidden border border-stone-200 cursor-pointer aspect-[4/3]"
              >
                <SafeImage
                  src={img.image_url}
                  alt={img.alt_text || img.title || 'Hotel photograph'}
                  fallbackLabel={img.title || img.alt_text}
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 text-white flex items-end justify-between">
                  <div>
                    {img.category && (
                      <span className="text-[11px] text-stone-300 block">{img.category}</span>
                    )}
                    <span className="text-sm font-medium">{img.title || img.alt_text}</span>
                    {img.caption && (
                      <p className="text-xs text-stone-200 mt-0.5 line-clamp-1">{img.caption}</p>
                    )}
                  </div>
                  <Maximize2 className="w-4 h-4 text-stone-200 opacity-80 shrink-0" />
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
    );
  };

  const renderAboutSection = () => {
    const aboutPage = visiblePagesMap.get('about');
    const title = hotel.about_title || aboutPage?.heading || `About ${hotel.name || 'Our Hotel'}`;
    const body = hotel.about_content || aboutPage?.content_body || hotel.short_description;

    return (
      <section id="about" className="py-16 sm:py-20 bg-white border-y border-stone-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7 space-y-4">
            <p className="text-xs font-medium text-amber-800">Overview & Policies</p>
            <h2
              className="text-2xl sm:text-3xl font-semibold text-stone-900 tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              {title}
            </h2>
            {body ? (
              <div className="text-base text-stone-700 leading-relaxed whitespace-pre-line space-y-4">
                {body}
              </div>
            ) : (
              <p className="text-sm text-stone-500">
                Detailed hotel information will appear here once published.
              </p>
            )}
          </div>

          <div className="lg:col-span-5 bg-stone-50 border border-stone-200 rounded-xl p-6 space-y-5">
            <h3 className="text-base font-semibold text-stone-900 border-b border-stone-200 pb-3">
              Check-In & Guest Policies
            </h3>

            {(hotel.check_in_time || hotel.check_out_time) && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                {hotel.check_in_time && (
                  <div>
                    <span className="text-xs text-stone-500 block">Check-in Time</span>
                    <span className="font-medium text-stone-900 font-mono tabular-nums">
                      {hotel.check_in_time}
                    </span>
                  </div>
                )}
                {hotel.check_out_time && (
                  <div>
                    <span className="text-xs text-stone-500 block">Check-out Time</span>
                    <span className="font-medium text-stone-900 font-mono tabular-nums">
                      {hotel.check_out_time}
                    </span>
                  </div>
                )}
              </div>
            )}

            {hotel.cancellation_policy && (
              <div>
                <h4 className="text-xs font-semibold text-stone-700 mb-1">Cancellation Policy</h4>
                <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-line">
                  {hotel.cancellation_policy}
                </p>
              </div>
            )}

            {hotel.general_policies && (
              <div>
                <h4 className="text-xs font-semibold text-stone-700 mb-1">House Rules & Policies</h4>
                <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-line">
                  {hotel.general_policies}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  };

  const renderLocationSection = () => {
    const locPage = visiblePagesMap.get('location');
    const fullAddress = [hotel.address_line, hotel.city, hotel.postal_code, hotel.country]
      .filter((part) => part && part.trim())
      .join(', ');

    return (
      <section id="location" className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-5 flex flex-col justify-between bg-white border border-stone-200 rounded-xl p-6 sm:p-8">
            <div className="space-y-4">
              <p className="text-xs font-medium text-amber-800">Address & Directions</p>
              <h2
                className="text-2xl font-semibold text-stone-900 tracking-tight"
                style={{ textWrap: 'balance' }}
              >
                {locPage?.heading || 'Location & Getting Here'}
              </h2>
              {fullAddress ? (
                <div className="flex items-start gap-3 text-sm text-stone-700 pt-2">
                  <MapPin className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
                  <span>{fullAddress}</span>
                </div>
              ) : (
                <p className="text-sm text-stone-500">Address details have not been published yet.</p>
              )}

              {locPage?.content_body && (
                <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-line pt-2">
                  {locPage.content_body}
                </p>
              )}
            </div>

            {hotel.google_maps_url && (
              <div className="pt-6 mt-6 border-t border-stone-100">
                <a
                  href={hotel.google_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition whitespace-nowrap"
                >
                  <span>Open in Google Maps</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>

          <div className="lg:col-span-7 bg-stone-100 border border-stone-200 rounded-xl overflow-hidden min-h-[320px] flex items-center justify-center">
            {hotel.google_maps_embed_url && hotel.google_maps_embed_url.startsWith('https://') ? (
              <iframe
                src={hotel.google_maps_embed_url}
                title={`Map for ${hotel.name || 'Hotel'}`}
                className="w-full h-full min-h-[320px] border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="p-8 text-center space-y-2 max-w-md">
                <MapPin className="w-8 h-8 text-stone-400 mx-auto" />
                <p className="text-sm font-medium text-stone-700">{fullAddress || 'Location Map'}</p>
                {hotel.google_maps_url && (
                  <a
                    href={hotel.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 hover:underline"
                  >
                    <span>View interactive map on Google Maps</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  };

  const renderFaqSection = () => {
    const faqPage = visiblePagesMap.get('faq');
    if (faqs.length === 0 && activePage !== 'faq') return null;

    return (
      <section id="faq" className="py-16 sm:py-20 bg-stone-100/60 border-t border-stone-200/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <p className="text-xs font-medium text-amber-800 mb-1">Guest Information</p>
            <h2
              className="text-2xl sm:text-3xl font-semibold text-stone-900 tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              {faqPage?.heading || 'Frequently Asked Questions'}
            </h2>
            {faqPage?.subheading && (
              <p className="text-sm text-stone-600 mt-2">{faqPage.subheading}</p>
            )}
          </div>

          {faqs.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-xl p-8 text-center">
              <p className="text-sm text-stone-600">No FAQs have been published yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {faqs.map((faq) => {
                const isOpen = openFaqId === faq.id;
                return (
                  <div
                    key={faq.id}
                    className="bg-white border border-stone-200 rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                      className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-stone-50 transition cursor-pointer"
                      aria-expanded={isOpen}
                    >
                      <span className="text-sm sm:text-base font-medium text-stone-900">
                        {faq.question}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-stone-500 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-stone-500 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-5 pt-1 text-sm text-stone-600 leading-relaxed whitespace-pre-line border-t border-stone-100">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    );
  };

  const renderContactSection = () => {
    const contactPage = visiblePagesMap.get('contact');
    const fullAddress = [hotel.address_line, hotel.city, hotel.postal_code, hotel.country]
      .filter((part) => part && part.trim())
      .join(', ');

    return (
      <section id="contact" className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-5 space-y-6">
            <div>
              <p className="text-xs font-medium text-amber-800 mb-1">Direct Reservations & Support</p>
              <h2
                className="text-2xl sm:text-3xl font-semibold text-stone-900 tracking-tight"
                style={{ textWrap: 'balance' }}
              >
                {contactPage?.heading || 'Contact & Enquiries'}
              </h2>
              <p className="text-sm text-stone-600 mt-2 leading-relaxed">
                {contactPage?.subheading ||
                  contactPage?.content_body ||
                  'Reach out to our front desk for room availability, group enquiries, or special guest requests.'}
              </p>
            </div>

            <div className="space-y-4 text-sm">
              {hotel.contact_phone && (
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-amber-800 shrink-0 mt-1" />
                  <div>
                    <span className="text-xs text-stone-500 block">Telephone</span>
                    <a
                      href={`tel:${hotel.contact_phone}`}
                      className="font-medium text-stone-900 hover:text-amber-800 font-mono tabular-nums"
                    >
                      {hotel.contact_phone}
                    </a>
                  </div>
                </div>
              )}

              {hotel.whatsapp_number && (
                <div className="flex items-start gap-3">
                  <MessageCircle className="w-4 h-4 text-amber-800 shrink-0 mt-1" />
                  <div>
                    <span className="text-xs text-stone-500 block">WhatsApp</span>
                    <a
                      href={`https://wa.me/${hotel.whatsapp_number.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-stone-900 hover:text-amber-800 font-mono tabular-nums"
                    >
                      {hotel.whatsapp_number}
                    </a>
                  </div>
                </div>
              )}

              {hotel.contact_email && (
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-amber-800 shrink-0 mt-1" />
                  <div>
                    <span className="text-xs text-stone-500 block">Email</span>
                    <a
                      href={`mailto:${hotel.contact_email}`}
                      className="font-medium text-stone-900 hover:text-amber-800"
                    >
                      {hotel.contact_email}
                    </a>
                  </div>
                </div>
              )}

              {fullAddress && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-amber-800 shrink-0 mt-1" />
                  <div>
                    <span className="text-xs text-stone-500 block">Address</span>
                    <span className="text-stone-800">{fullAddress}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-7 bg-white border border-stone-200 rounded-xl p-6 sm:p-8">
            <h3 className="text-lg font-semibold text-stone-900 mb-1">Send an Enquiry</h3>
            <p className="text-xs text-stone-500 mb-6">
              Submit your preferred dates and requirements to contact our reservation team directly.
            </p>

            <form onSubmit={handleEnquirySubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={enquiryName}
                    onChange={(e) => setEnquiryName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={enquiryEmail}
                    onChange={(e) => setEnquiryEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Preferred Stay Dates & Guests
                </label>
                <input
                  type="text"
                  value={enquiryDates}
                  onChange={(e) => setEnquiryDates(e.target.value)}
                  placeholder="e.g., 15 Nov – 18 Nov, 2 Adults"
                  className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Enquiry Message</label>
                <textarea
                  rows={3}
                  value={enquiryMessage}
                  onChange={(e) => setEnquiryMessage(e.target.value)}
                  placeholder="Room preference or questions..."
                  className="w-full px-3.5 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>

              {enquiryFeedback && (
                <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {enquiryFeedback}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  {hotel.reservation_button_text || 'Send Enquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <button
            onClick={() => handleNavClick('#home')}
            className="flex items-center gap-2.5 text-left cursor-pointer whitespace-nowrap shrink-0 focus:outline-none"
          >
            {hotel.logo_url ? (
              <img
                src={hotel.logo_url}
                alt={hotel.name || 'Hotel Logo'}
                referrerPolicy="no-referrer"
                className="h-8 w-auto object-contain"
              />
            ) : null}
            <span className="text-lg font-bold tracking-tight text-stone-900 whitespace-nowrap shrink-0">
              {hotel.name || 'Hotel Website'}
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
            {navigation.header_links.slice(0, 6).map((link, i) => (
              <button
                key={i}
                onClick={() => handleNavClick(link.href)}
                className="hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1"
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                if (hotel.reservation_url) {
                  window.open(hotel.reservation_url, '_blank', 'noopener,noreferrer');
                } else {
                  handleNavClick('#contact');
                }
              }}
              className="px-4 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {hotel.reservation_button_text || 'Enquire Now'}
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-stone-600 hover:text-stone-900 rounded-lg"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-stone-200 bg-white px-4 py-3 space-y-1">
            {navigation.header_links.map((link, i) => (
              <button
                key={i}
                onClick={() => handleNavClick(link.href)}
                className="block w-full text-left px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 rounded-lg"
              >
                {link.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1">
        {activePage === 'home' ? (
          <>
            {(homepage.sections || []).map((section) => {
              if (!section.enabled) return null;

              switch (section.id) {
                case 'hero':
                  return (
                    <section
                      key="hero"
                      className="relative bg-stone-900 text-white overflow-hidden min-h-[480px] lg:min-h-[560px] flex items-center"
                    >
                      {homepage.hero_image_url && (
                        <div className="absolute inset-0">
                          <SafeImage
                            src={homepage.hero_image_url}
                            alt={homepage.hero_heading || hotel.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/30" />
                        </div>
                      )}
                      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 w-full">
                        <div className="max-w-2xl space-y-5">
                          {(hotel.tagline || hotel.city) && (
                            <p className="text-xs sm:text-sm font-medium text-amber-300 tracking-wide">
                              {[hotel.tagline, [hotel.city, hotel.country].filter(Boolean).join(', ')]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          )}
                          <h1
                            className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-[1.12]"
                            style={{ textWrap: 'balance' }}
                          >
                            {homepage.hero_heading || hotel.name}
                          </h1>
                          {(homepage.hero_subtitle || hotel.short_description) && (
                            <p className="text-base sm:text-lg text-stone-200 leading-relaxed max-w-xl">
                              {homepage.hero_subtitle || hotel.short_description}
                            </p>
                          )}
                          <div className="pt-2 flex flex-wrap items-center gap-3">
                            {homepage.hero_cta_text && (
                              <button
                                onClick={() => handleNavClick(homepage.hero_cta_link || '#rooms')}
                                className="px-5 py-2.5 text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition cursor-pointer whitespace-nowrap shrink-0"
                              >
                                {homepage.hero_cta_text}
                              </button>
                            )}
                            {homepage.hero_secondary_cta_text && (
                              <button
                                onClick={() => handleNavClick(homepage.hero_secondary_cta_link || '#contact')}
                                className="px-5 py-2.5 text-sm font-medium bg-white/10 hover:bg-white/20 text-white border border-white/25 rounded-lg transition cursor-pointer whitespace-nowrap shrink-0"
                              >
                                {homepage.hero_secondary_cta_text}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </section>
                  );

                case 'welcome':
                  if (!homepage.welcome_heading && !homepage.welcome_body && !hotel.short_description) {
                    return null;
                  }
                  return (
                    <section key="welcome" className="py-14 sm:py-16 bg-white border-b border-stone-200">
                      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
                        {homepage.welcome_heading && (
                          <h2
                            className="text-2xl sm:text-3xl font-semibold text-stone-900 tracking-tight"
                            style={{ textWrap: 'balance' }}
                          >
                            {homepage.welcome_heading}
                          </h2>
                        )}
                        <p className="text-base text-stone-600 leading-relaxed whitespace-pre-line">
                          {homepage.welcome_body || hotel.short_description}
                        </p>
                      </div>
                    </section>
                  );

                case 'featured_rooms':
                  return <React.Fragment key="featured_rooms">{renderRoomsSection(6)}</React.Fragment>;

                case 'facilities':
                  return <React.Fragment key="facilities">{renderFacilitiesSection()}</React.Fragment>;

                case 'gallery':
                  return <React.Fragment key="gallery">{renderGallerySection(6)}</React.Fragment>;

                case 'about':
                  return <React.Fragment key="about">{renderAboutSection()}</React.Fragment>;

                case 'location':
                  return <React.Fragment key="location">{renderLocationSection()}</React.Fragment>;

                case 'faq':
                  return <React.Fragment key="faq">{renderFaqSection()}</React.Fragment>;

                case 'contact':
                  return <React.Fragment key="contact">{renderContactSection()}</React.Fragment>;

                default:
                  return null;
              }
            })}
          </>
        ) : (
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-2">
              <button
                onClick={() => setActivePage('home')}
                className="text-xs font-medium text-stone-500 hover:text-stone-900 cursor-pointer"
              >
                ← Back to Homepage
              </button>
            </div>
            {activePage === 'rooms' && renderRoomsSection()}
            {activePage === 'facilities' && renderFacilitiesSection()}
            {activePage === 'gallery' && renderGallerySection()}
            {activePage === 'about' && renderAboutSection()}
            {activePage === 'location' && renderLocationSection()}
            {activePage === 'faq' && renderFaqSection()}
            {activePage === 'contact' && renderContactSection()}
          </div>
        )}
      </main>

      <footer className="bg-stone-900 text-stone-300 border-t border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-5 space-y-3">
            <span className="text-lg font-bold text-white tracking-tight block">
              {hotel.name || 'Hotel'}
            </span>
            {hotel.footer_text ? (
              <p className="text-xs text-stone-400 leading-relaxed max-w-sm">{hotel.footer_text}</p>
            ) : hotel.tagline ? (
              <p className="text-xs text-stone-400">{hotel.tagline}</p>
            ) : null}
          </div>

          <div className="md:col-span-4 space-y-2">
            <span className="text-xs font-semibold text-white block">Navigation</span>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-stone-400">
              {navigation.footer_links.map((link, idx) => (
                <button
                  key={idx}
                  onClick={() => handleNavClick(link.href)}
                  className="hover:text-white transition cursor-pointer whitespace-nowrap"
                >
                  {link.label}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-3 space-y-2 text-xs text-stone-400">
            <span className="text-xs font-semibold text-white block">Contact</span>
            {hotel.contact_phone && <p className="font-mono tabular-nums">{hotel.contact_phone}</p>}
            {hotel.contact_email && <p>{hotel.contact_email}</p>}
            {(hotel.city || hotel.country) && (
              <p>{[hotel.city, hotel.country].filter(Boolean).join(', ')}</p>
            )}
          </div>
        </div>

        <div className="border-t border-stone-800/80 py-5 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <span>
            {hotel.copyright_text || `© ${new Date().getFullYear()} ${hotel.name || 'Hotel'}. All rights reserved.`}
          </span>
        </div>
      </footer>

      {selectedRoom && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setSelectedRoom(null)}
        >
          <div
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-stone-200 p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-stone-900">{selectedRoom.name}</h3>
                <div className="text-xs text-stone-500 mt-1 flex items-center gap-2">
                  {[selectedRoom.capacity, selectedRoom.bed_type, selectedRoom.room_size]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              <button
                onClick={() => setSelectedRoom(null)}
                className="p-1.5 text-stone-400 hover:text-stone-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedRoom.featured_image_url && (
              <div className="aspect-[16/9] rounded-lg overflow-hidden bg-stone-900">
                <SafeImage
                  src={selectedRoom.featured_image_url}
                  alt={selectedRoom.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">
              {selectedRoom.full_description || selectedRoom.short_description || 'Contact our team for full room specifications.'}
            </p>

            {selectedRoom.amenities && selectedRoom.amenities.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-stone-900 mb-2">Room Amenities</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-stone-600">
                  {selectedRoom.amenities.map((am, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-amber-800 shrink-0" />
                      <span>{am}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="max-w-4xl w-full bg-stone-950 border border-stone-800 rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800 text-stone-200">
              <span className="text-sm font-medium">{lightboxImage.title || lightboxImage.alt_text}</span>
              <button
                onClick={() => setLightboxImage(null)}
                className="p-1 text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[75vh] flex items-center justify-center bg-black">
              <SafeImage
                src={lightboxImage.image_url}
                alt={lightboxImage.alt_text || lightboxImage.title}
                className="max-h-[75vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
