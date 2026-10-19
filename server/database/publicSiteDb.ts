/**
 * Public Hotel Website CMS — Database & Snapshot Service
 * Uses the existing AlwaysData MySQL connection pool (getMySQLPool) + local JSON persistence.
 * Completely isolated from private CRM tables (clients, passports, bookings, invoices, tasks).
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getMySQLPool, dbService } from './db.ts';

export type PublicSiteDeploymentStatus =
  | 'Draft'
  | 'Unpublished'
  | 'Deployment Requested'
  | 'Building'
  | 'Published'
  | 'Deployment Failed';

export interface HomepageSectionConfig {
  id: 'hero' | 'welcome' | 'featured_rooms' | 'facilities' | 'gallery' | 'about' | 'faq' | 'location' | 'contact';
  label: string;
  enabled: boolean;
  order: number;
}

export interface NavLinkItem {
  label: string;
  href: string;
  visible: boolean;
}

export interface SocialLinksConfig {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
  tiktok?: string;
  wechat?: string;
  tripadvisor?: string;
}

export interface PublicSiteSettings {
  id: number;
  site_status: PublicSiteDeploymentStatus;
  has_unpublished_changes: number;
  hotel_name: string;
  tagline: string;
  short_description: string;
  about_title: string;
  about_content: string;
  logo_url: string;
  favicon_url: string;
  primary_color: string;
  accent_color: string;
  contact_phone: string;
  whatsapp_number: string;
  contact_email: string;
  address_line: string;
  city: string;
  country: string;
  postal_code: string;
  google_maps_url: string;
  google_maps_embed_url: string;
  social_links: SocialLinksConfig;
  reservation_url: string;
  reservation_button_text: string;
  check_in_time: string;
  check_out_time: string;
  cancellation_policy: string;
  general_policies: string;
  footer_text: string;
  copyright_text: string;
  hero_heading: string;
  hero_subtitle: string;
  hero_image_url: string;
  hero_cta_text: string;
  hero_cta_link: string;
  hero_secondary_cta_text: string;
  hero_secondary_cta_link: string;
  welcome_heading: string;
  welcome_body: string;
  homepage_sections: HomepageSectionConfig[];
  nav_links: NavLinkItem[];
  footer_links: NavLinkItem[];
  seo_title: string;
  seo_description: string;
  og_title: string;
  og_description: string;
  og_image_url: string;
  canonical_domain: string;
  robots_indexing: string;
  sitemap_enabled: number;
  public_site_url: string;
  last_edited_by: number | null;
  last_edited_at: string;
  last_published_at: string | null;
  last_published_version: number | null;
  updated_at: string;
}

export interface PublicSitePage {
  id: number;
  slug: 'home' | 'about' | 'rooms' | 'facilities' | 'gallery' | 'location' | 'contact' | 'faq';
  title: string;
  heading: string;
  subheading: string;
  hero_image_url: string;
  content_body: string;
  structured_data: Record<string, any>;
  seo_title: string;
  seo_description: string;
  is_visible: number;
  show_in_nav: number;
  show_in_footer: number;
  display_order: number;
  updated_at: string;
}

export interface PublicSiteHotel {
  id: number;
  crm_hotel_id: number | null;
  name: string;
  slug: string;
  city: string;
  country: string;
  address: string;
  star_rating: number;
  short_description: string;
  full_description: string;
  featured_image_url: string;
  gallery_images: string[];
  amenities: string[];
  check_in_time: string;
  check_out_time: string;
  cancellation_policy: string;
  contact_phone: string;
  whatsapp_number: string;
  contact_email: string;
  google_maps_url: string;
  google_maps_embed_url: string;
  starting_price: number | null;
  currency: string;
  is_featured: number;
  is_visible: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PublicSiteRoom {
  id: number;
  hotel_id: number;
  crm_room_id?: number | null;
  name: string;
  slug: string;
  short_description: string;
  full_description: string;
  featured_image_url: string;
  gallery_images: string[];
  capacity: string;
  bed_type: string;
  room_size: string;
  amenities: string[];
  optional_price: number | null;
  currency: string;
  price_note: string;
  enquiry_url: string;
  is_featured: number;
  is_visible: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PublicSiteFacility {
  id: number;
  name: string;
  category: string;
  description: string;
  icon_name: string;
  image_url: string;
  is_featured: number;
  is_visible: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PublicSiteGalleryItem {
  id: number;
  title: string;
  caption: string;
  alt_text: string;
  category: string;
  image_url: string;
  is_featured: number;
  is_visible: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PublicSiteFaq {
  id: number;
  question: string;
  answer: string;
  category: string;
  is_visible: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PublicWebsiteSnapshot {
  schema_version: '1.0';
  published_version: number;
  published_at: string;
  is_configured: boolean;
  hotel: {
    name: string;
    tagline: string;
    short_description: string;
    about_title: string;
    about_content: string;
    logo_url: string;
    favicon_url: string;
    primary_color: string;
    accent_color: string;
    contact_phone: string;
    whatsapp_number: string;
    contact_email: string;
    address_line: string;
    city: string;
    country: string;
    postal_code: string;
    google_maps_url: string;
    google_maps_embed_url: string;
    social_links: SocialLinksConfig;
    reservation_url: string;
    reservation_button_text: string;
    check_in_time: string;
    check_out_time: string;
    cancellation_policy: string;
    general_policies: string;
    footer_text: string;
    copyright_text: string;
  };
  homepage: {
    hero_heading: string;
    hero_subtitle: string;
    hero_image_url: string;
    hero_cta_text: string;
    hero_cta_link: string;
    hero_secondary_cta_text: string;
    hero_secondary_cta_link: string;
    welcome_heading: string;
    welcome_body: string;
    sections: HomepageSectionConfig[];
  };
  navigation: {
    header_links: NavLinkItem[];
    footer_links: NavLinkItem[];
  };
  seo: {
    title: string;
    description: string;
    og_title: string;
    og_description: string;
    og_image_url: string;
    canonical_domain: string;
    robots_indexing: string;
    sitemap_enabled: boolean;
  };
  pages: Array<{
    slug: string;
    title: string;
    heading: string;
    subheading: string;
    hero_image_url: string;
    content_body: string;
    structured_data: Record<string, any>;
    seo_title: string;
    seo_description: string;
    show_in_nav: boolean;
    show_in_footer: boolean;
    display_order: number;
  }>;
  hotels: Array<{
    id: number;
    name: string;
    slug: string;
    city: string;
    country: string;
    address: string;
    star_rating: number;
    short_description: string;
    full_description: string;
    featured_image_url: string;
    gallery_images: string[];
    amenities: string[];
    check_in_time: string;
    check_out_time: string;
    cancellation_policy: string;
    contact_phone: string;
    whatsapp_number: string;
    contact_email: string;
    google_maps_url: string;
    google_maps_embed_url: string;
    starting_price: number | null;
    currency: string;
    is_featured: boolean;
    display_order: number;
    rooms: Array<{
      id: number;
      hotel_id: number;
      hotel_name?: string;
      hotel_slug?: string;
      name: string;
      slug: string;
      short_description: string;
      full_description: string;
      featured_image_url: string;
      gallery_images: string[];
      capacity: string;
      bed_type: string;
      room_size: string;
      amenities: string[];
      optional_price: number | null;
      currency: string;
      price_note: string;
      enquiry_url: string;
      is_featured: boolean;
      display_order: number;
    }>;
  }>;
  rooms: Array<{
    id: number;
    hotel_id: number;
    hotel_name?: string;
    hotel_slug?: string;
    name: string;
    slug: string;
    short_description: string;
    full_description: string;
    featured_image_url: string;
    gallery_images: string[];
    capacity: string;
    bed_type: string;
    room_size: string;
    amenities: string[];
    optional_price: number | null;
    currency: string;
    price_note: string;
    enquiry_url: string;
    is_featured: boolean;
    display_order: number;
  }>;
  facilities: Array<{
    id: number;
    name: string;
    category: string;
    description: string;
    icon_name: string;
    image_url: string;
    is_featured: boolean;
    display_order: number;
  }>;
  gallery: Array<{
    id: number;
    title: string;
    caption: string;
    alt_text: string;
    category: string;
    image_url: string;
    is_featured: boolean;
    display_order: number;
  }>;
  faqs: Array<{
    id: number;
    question: string;
    answer: string;
    category: string;
    display_order: number;
  }>;
}

export interface PublicSiteSnapshotRecord {
  id: number;
  version_number: number;
  snapshot_hash: string;
  snapshot_json: string;
  published_by_user_id: number | null;
  published_by_name: string;
  notes: string;
  created_at: string;
}

export interface PublicSitePublicationLog {
  id: number;
  version_number: number;
  snapshot_id: number;
  initiated_by_user_id: number | null;
  initiated_by_name: string;
  deployment_status: PublicSiteDeploymentStatus;
  build_hook_configured: number;
  build_hook_triggered: number;
  build_hook_http_status: number | null;
  netlify_deploy_id: string | null;
  netlify_deploy_state: string | null;
  netlify_deploy_url: string | null;
  verified_at: string | null;
  error_message: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface PublicSiteStore {
  settings: PublicSiteSettings;
  pages: PublicSitePage[];
  hotels: PublicSiteHotel[];
  rooms: PublicSiteRoom[];
  facilities: PublicSiteFacility[];
  gallery: PublicSiteGalleryItem[];
  faqs: PublicSiteFaq[];
  snapshots: PublicSiteSnapshotRecord[];
  publications: PublicSitePublicationLog[];
  nextIds: {
    hotels: number;
    rooms: number;
    facilities: number;
    gallery: number;
    faqs: number;
    snapshots: number;
    publications: number;
  };
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'public-site-store.json');

// --------------------------------------------------------------------------
// URL & Text Sanitization Helpers (Prevent XSS & Unsafe Schemes)
// --------------------------------------------------------------------------
export function sanitizePublicUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  // Reject dangerous executable URI schemes
  const lower = trimmed.toLowerCase().replace(/\s+/g, '');
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:text/html') ||
    lower.startsWith('data:application/')
  ) {
    return '';
  }

  // Reject overly large inline Base64 data URLs to prevent DB bloat
  if (lower.startsWith('data:image/') && trimmed.length > 250000) {
    throw new Error('Large Base64 image strings are not permitted in MySQL. Please use a hosted image URL (e.g., Cloudinary, S3, or CDN URL).');
  }

  return trimmed;
}

export function sanitizeText(value: unknown, maxLen = 20000): string {
  if (typeof value !== 'string') return '';
  // Remove <script> tags and inline event handlers
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .trim()
    .slice(0, maxLen);
}

function getDefaultHomepageSections(): HomepageSectionConfig[] {
  return [
    { id: 'hero', label: 'Hero Banner', enabled: true, order: 1 },
    { id: 'welcome', label: 'Welcome Introduction', enabled: true, order: 2 },
    { id: 'featured_rooms', label: 'Rooms & Accommodation', enabled: true, order: 3 },
    { id: 'facilities', label: 'Highlighted Facilities', enabled: true, order: 4 },
    { id: 'gallery', label: 'Photo Gallery Preview', enabled: true, order: 5 },
    { id: 'about', label: 'About the Hotel', enabled: true, order: 6 },
    { id: 'location', label: 'Location & Directions', enabled: true, order: 7 },
    { id: 'faq', label: 'Frequently Asked Questions', enabled: true, order: 8 },
    { id: 'contact', label: 'Contact & Enquiry', enabled: true, order: 9 },
  ];
}

function getDefaultNavLinks(): NavLinkItem[] {
  return [
    { label: 'Home', href: '#home', visible: true },
    { label: 'Rooms', href: '#rooms', visible: true },
    { label: 'Facilities', href: '#facilities', visible: true },
    { label: 'Gallery', href: '#gallery', visible: true },
    { label: 'Location', href: '#location', visible: true },
    { label: 'FAQ', href: '#faq', visible: true },
    { label: 'Contact', href: '#contact', visible: true },
  ];
}

function getDefaultPages(now: string): PublicSitePage[] {
  return [
    {
      id: 1,
      slug: 'home',
      title: 'Home',
      heading: '',
      subheading: '',
      hero_image_url: '',
      content_body: '',
      structured_data: {},
      seo_title: '',
      seo_description: '',
      is_visible: 1,
      show_in_nav: 1,
      show_in_footer: 1,
      display_order: 1,
      updated_at: now,
    },
    {
      id: 2,
      slug: 'about',
      title: 'About',
      heading: 'About Our Hotel',
      subheading: '',
      hero_image_url: '',
      content_body: '',
      structured_data: { highlights: [] },
      seo_title: '',
      seo_description: '',
      is_visible: 1,
      show_in_nav: 1,
      show_in_footer: 1,
      display_order: 2,
      updated_at: now,
    },
    {
      id: 3,
      slug: 'rooms',
      title: 'Rooms & Suites',
      heading: 'Rooms & Accommodation',
      subheading: '',
      hero_image_url: '',
      content_body: '',
      structured_data: { disclaimer: 'Displayed room rates are optional and indicative only. Contact us directly to confirm availability.' },
      seo_title: '',
      seo_description: '',
      is_visible: 1,
      show_in_nav: 1,
      show_in_footer: 1,
      display_order: 3,
      updated_at: now,
    },
    {
      id: 4,
      slug: 'facilities',
      title: 'Facilities',
      heading: 'Facilities & Guest Services',
      subheading: '',
      hero_image_url: '',
      content_body: '',
      structured_data: {},
      seo_title: '',
      seo_description: '',
      is_visible: 1,
      show_in_nav: 1,
      show_in_footer: 1,
      display_order: 4,
      updated_at: now,
    },
    {
      id: 5,
      slug: 'gallery',
      title: 'Gallery',
      heading: 'Photo Gallery',
      subheading: '',
      hero_image_url: '',
      content_body: '',
      structured_data: {},
      seo_title: '',
      seo_description: '',
      is_visible: 1,
      show_in_nav: 1,
      show_in_footer: 1,
      display_order: 5,
      updated_at: now,
    },
    {
      id: 6,
      slug: 'location',
      title: 'Location',
      heading: 'Location & Getting Here',
      subheading: '',
      hero_image_url: '',
      content_body: '',
      structured_data: { directions_note: '' },
      seo_title: '',
      seo_description: '',
      is_visible: 1,
      show_in_nav: 1,
      show_in_footer: 1,
      display_order: 6,
      updated_at: now,
    },
    {
      id: 7,
      slug: 'contact',
      title: 'Contact',
      heading: 'Contact & Enquiries',
      subheading: '',
      hero_image_url: '',
      content_body: '',
      structured_data: { reception_hours: '' },
      seo_title: '',
      seo_description: '',
      is_visible: 1,
      show_in_nav: 1,
      show_in_footer: 1,
      display_order: 7,
      updated_at: now,
    },
    {
      id: 8,
      slug: 'faq',
      title: 'FAQ',
      heading: 'Frequently Asked Questions',
      subheading: '',
      hero_image_url: '',
      content_body: '',
      structured_data: {},
      seo_title: '',
      seo_description: '',
      is_visible: 1,
      show_in_nav: 1,
      show_in_footer: 1,
      display_order: 8,
      updated_at: now,
    },
  ];
}

function getInitialKualaLumpurPublicHotels(now: string): PublicSiteHotel[] {
  return [
    {
      id: 1,
      crm_hotel_id: 1,
      name: 'Axon BukitBintang with pavilion by AQSA',
      slug: 'axon-bukitbintang-with-pavilion-by-aqsa',
      city: 'Kuala Lumpur',
      country: 'Malaysia',
      address: 'Axon residence, 5 jalan walter granier, Bukit Bintang, Kuala Lumpur, Malaysia',
      star_rating: 3,
      short_description:
        'Opened in 2026 · 8.3 Very good ("Great location", "Clean and tidy"). 280m to Bukit Bintang Metro Station, 800m to Pavilion Kuala Lumpur, 1.8 km to Petronas Twin Towers.',
      full_description:
        'Axon BukitBintang with pavilion by AQSA is a modern 3-star residence opened in 2026 in the heart of Bukit Bintang, Kuala Lumpur (5 Jalan Walter Granier). Rated 8.3 Very good for its clean, tidy rooms and prime location just 280m from Bukit Bintang Metro Station, 800m from Pavilion Kuala Lumpur, and 1.8 km from Petronas Twin Towers. Highlights include an indoor rooftop pool, free gym, garden, free sauna, and private parking.',
      featured_image_url: '',
      gallery_images: [],
      amenities: [
        'Indoor Rooftop Pool',
        'Free Gym',
        'Garden',
        'Free Sauna',
        'Private Parking',
        'Free High-Speed Wi-Fi',
      ],
      check_in_time: '14:00',
      check_out_time: '12:00',
      cancellation_policy: 'Contact reservations for flexible booking and cancellation terms.',
      contact_phone: '',
      whatsapp_number: '',
      contact_email: '',
      google_maps_url: '',
      google_maps_embed_url: '',
      starting_price: 101,
      currency: 'MYR',
      is_featured: 1,
      is_visible: 1,
      display_order: 1,
      created_at: now,
      updated_at: now,
    },
    {
      id: 2,
      crm_hotel_id: 2,
      name: 'Empire Bukit Bintang',
      slug: 'empire-bukit-bintang',
      city: 'Kuala Lumpur',
      country: 'Malaysia',
      address: 'Bukit Bintang, Kuala Lumpur, Malaysia (190m · Near Petronas Twin Towers)',
      star_rating: 3,
      short_description:
        '9.1 Great (39 reviews) · 190m straight-line distance · Near Petronas Twin Towers · Free Cancellation & Excellent service.',
      full_description:
        'Empire Bukit Bintang is a highly rated 3-star hotel (9.1 Great) ideally situated in Bukit Bintang, Kuala Lumpur, near the iconic Petronas Twin Towers. Known for its excellent guest service and convenient city-center access.',
      featured_image_url: '',
      gallery_images: [],
      amenities: [
        'Free Cancellation',
        'Excellent Service',
        '24-Hour Front Desk',
        'Free High-Speed Wi-Fi',
        'Air Conditioning',
      ],
      check_in_time: '14:00',
      check_out_time: '12:00',
      cancellation_policy: 'Free cancellation available on eligible room rates.',
      contact_phone: '',
      whatsapp_number: '',
      contact_email: '',
      google_maps_url: '',
      google_maps_embed_url: '',
      starting_price: 94,
      currency: 'MYR',
      is_featured: 1,
      is_visible: 1,
      display_order: 2,
      created_at: now,
      updated_at: now,
    },
    {
      id: 3,
      crm_hotel_id: 3,
      name: 'Star Mews Hotel Changkat Bukit Bintang',
      slug: 'star-mews-hotel-changkat-bukit-bintang',
      city: 'Kuala Lumpur',
      country: 'Malaysia',
      address: 'Changkat Bukit Bintang, Kuala Lumpur, Malaysia (240m · Near Petronas Twin Towers)',
      star_rating: 3,
      short_description:
        '8.1 Very good (55 reviews) · 240m straight-line distance · Near Petronas Twin Towers · On-site Bar.',
      full_description:
        'Star Mews Hotel Changkat Bukit Bintang is a stylish 3-star boutique hotel located in vibrant Changkat Bukit Bintang, Kuala Lumpur, near the Petronas Twin Towers. Rated 8.1 Very good by guests.',
      featured_image_url: '',
      gallery_images: [],
      amenities: ['Bar', 'Free High-Speed Wi-Fi', 'Air Conditioning', '24-Hour Front Desk'],
      check_in_time: '14:00',
      check_out_time: '12:00',
      cancellation_policy: 'Contact reservations for booking and cancellation details.',
      contact_phone: '',
      whatsapp_number: '',
      contact_email: '',
      google_maps_url: '',
      google_maps_embed_url: '',
      starting_price: 109,
      currency: 'MYR',
      is_featured: 1,
      is_visible: 1,
      display_order: 3,
      created_at: now,
      updated_at: now,
    },
    {
      id: 4,
      crm_hotel_id: 4,
      name: 'Swing & Pillows @ ICC Pudu Kuala Lumpur',
      slug: 'swing-pillows-icc-pudu-kuala-lumpur',
      city: 'Kuala Lumpur',
      country: 'Malaysia',
      address: 'ICC Pudu, Kuala Lumpur, Malaysia (740m · Near Bukit Bintang Metro Station)',
      star_rating: 2,
      short_description:
        '8.7 Very good (289 reviews) · 740m straight-line distance · Near Bukit Bintang Metro Station · Excellent service.',
      full_description:
        'Swing & Pillows @ ICC Pudu Kuala Lumpur offers comfortable, value-friendly accommodation near Bukit Bintang Metro Station (740m). Rated 8.7 Very good across 289 guest reviews for its excellent service and clean rooms.',
      featured_image_url: '',
      gallery_images: [],
      amenities: ['Excellent Service', 'Free High-Speed Wi-Fi', 'Air Conditioning', 'Daily Housekeeping'],
      check_in_time: '14:00',
      check_out_time: '12:00',
      cancellation_policy: 'Contact reservations for booking and cancellation details.',
      contact_phone: '',
      whatsapp_number: '',
      contact_email: '',
      google_maps_url: '',
      google_maps_embed_url: '',
      starting_price: 68,
      currency: 'MYR',
      is_featured: 1,
      is_visible: 1,
      display_order: 4,
      created_at: now,
      updated_at: now,
    },
    {
      id: 5,
      crm_hotel_id: 5,
      name: 'Kingston Hotel 4 @ Hulo Bukit Bintang',
      slug: 'kingston-hotel-4-hulo-bukit-bintang',
      city: 'Kuala Lumpur',
      country: 'Malaysia',
      address: 'Hulo Bukit Bintang, Kuala Lumpur, Malaysia (810m · Near Zepp Kuala Lumpur)',
      star_rating: 3,
      short_description:
        '8.4 Very good (440 reviews) · 810m straight-line distance · Near Zepp Kuala Lumpur · Ideal location.',
      full_description:
        'Kingston Hotel 4 @ Hulo Bukit Bintang is a 3-star boutique hotel in Bukit Bintang near Zepp Kuala Lumpur. Rated 8.4 Very good across 440 reviews for its architectural charm and ideal location.',
      featured_image_url: '',
      gallery_images: [],
      amenities: ['Ideal Location', 'Free High-Speed Wi-Fi', 'Air Conditioning', '24-Hour Front Desk'],
      check_in_time: '14:00',
      check_out_time: '12:00',
      cancellation_policy: 'Contact reservations for booking and cancellation details.',
      contact_phone: '',
      whatsapp_number: '',
      contact_email: '',
      google_maps_url: '',
      google_maps_embed_url: '',
      starting_price: 70,
      currency: 'MYR',
      is_featured: 1,
      is_visible: 1,
      display_order: 5,
      created_at: now,
      updated_at: now,
    },
    {
      id: 6,
      crm_hotel_id: 6,
      name: 'Prescott Hotel Bukit Bintang',
      slug: 'prescott-hotel-bukit-bintang',
      city: 'Kuala Lumpur',
      country: 'Malaysia',
      address: 'Bukit Bintang, Kuala Lumpur, Malaysia (610m · Near Bukit Bintang Metro Station)',
      star_rating: 3,
      short_description:
        '8.3 Very good (1,429 reviews) · 610m straight-line distance · Near Bukit Bintang Metro Station · Cafe.',
      full_description:
        'Prescott Hotel Bukit Bintang is a popular 3-star hotel in Kuala Lumpur near Bukit Bintang Metro Station (610m). Rated 8.3 Very good by over 1,429 guests and saved by over 8,200 travelers, featuring an on-site cafe and comfortable rooms.',
      featured_image_url: '',
      gallery_images: [],
      amenities: ['Cafe', 'Free High-Speed Wi-Fi', 'Air Conditioning', '24-Hour Front Desk'],
      check_in_time: '14:00',
      check_out_time: '12:00',
      cancellation_policy: 'Contact reservations for booking and cancellation details.',
      contact_phone: '',
      whatsapp_number: '',
      contact_email: '',
      google_maps_url: '',
      google_maps_embed_url: '',
      starting_price: 78,
      currency: 'MYR',
      is_featured: 1,
      is_visible: 1,
      display_order: 6,
      created_at: now,
      updated_at: now,
    },
    {
      id: 7,
      crm_hotel_id: 7,
      name: 'Dynasty Hotel by ibilik @ Kuala Lumpur',
      slug: 'dynasty-hotel-by-ibilik-kuala-lumpur',
      city: 'Kuala Lumpur',
      country: 'Malaysia',
      address: 'Titiwangsa, Kuala Lumpur, Malaysia (3.6 km · Near Titiwangsa)',
      star_rating: 4,
      short_description:
        '8.3 Very good (34 reviews) · 4-Star Hotel · 3.6 km straight-line distance · Near Titiwangsa · Ideal location.',
      full_description:
        'Dynasty Hotel by ibilik @ Kuala Lumpur is a 4-star high-rise hotel located near Titiwangsa in Kuala Lumpur. Rated 8.3 Very good for its spacious accommodation and ideal city connectivity.',
      featured_image_url: '',
      gallery_images: [],
      amenities: [
        'Ideal Location',
        'Swimming Pool',
        'Free High-Speed Wi-Fi',
        'Air Conditioning',
        '24-Hour Front Desk',
      ],
      check_in_time: '14:00',
      check_out_time: '12:00',
      cancellation_policy: 'Contact reservations for booking and cancellation details.',
      contact_phone: '',
      whatsapp_number: '',
      contact_email: '',
      google_maps_url: '',
      google_maps_embed_url: '',
      starting_price: 137,
      currency: 'MYR',
      is_featured: 1,
      is_visible: 1,
      display_order: 7,
      created_at: now,
      updated_at: now,
    },
    {
      id: 8,
      crm_hotel_id: 8,
      name: 'SS Grey Hotel',
      slug: 'ss-grey-hotel',
      city: 'Kuala Lumpur',
      country: 'Malaysia',
      address: 'Bukit Bintang, Kuala Lumpur, Malaysia (<100m · Near Petronas Twin Towers)',
      star_rating: 3,
      short_description:
        '8.5 Very good (278 reviews) · <100m from Bukit Bintang search center · Near Petronas Twin Towers · Ideal location.',
      full_description:
        'SS Grey Hotel is a 3-star hotel in the heart of Bukit Bintang, Kuala Lumpur (<100m from center, near Petronas Twin Towers). Rated 8.5 Very good across 278 reviews for its unbeatable central location and guest comfort.',
      featured_image_url: '',
      gallery_images: [],
      amenities: [
        'Ideal Location',
        'Lounge Area',
        'Free High-Speed Wi-Fi',
        'Air Conditioning',
        '24-Hour Front Desk',
      ],
      check_in_time: '14:00',
      check_out_time: '12:00',
      cancellation_policy: 'Contact reservations for booking and cancellation details.',
      contact_phone: '',
      whatsapp_number: '',
      contact_email: '',
      google_maps_url: '',
      google_maps_embed_url: '',
      starting_price: 93,
      currency: 'MYR',
      is_featured: 1,
      is_visible: 1,
      display_order: 8,
      created_at: now,
      updated_at: now,
    },
    {
      id: 9,
      crm_hotel_id: 9,
      name: 'Swing & Pillows @ Imbi Bukit Bintang',
      slug: 'swing-pillows-imbi-bukit-bintang',
      city: 'Kuala Lumpur',
      country: 'Malaysia',
      address: 'Imbi, Bukit Bintang, Kuala Lumpur, Malaysia (650m · Near Petronas Twin Towers)',
      star_rating: 2,
      short_description:
        '8.7 Very good (195 reviews) · 650m straight-line distance · Near Petronas Twin Towers · Excellent service.',
      full_description:
        'Swing & Pillows @ Imbi Bukit Bintang is a 2-star hotel in Imbi, Bukit Bintang, Kuala Lumpur (650m from center, near Petronas Twin Towers). Rated 8.7 Very good across 195 reviews and saved by 860 travelers for its excellent service and value.',
      featured_image_url: '',
      gallery_images: [],
      amenities: ['Excellent Service', 'Free High-Speed Wi-Fi', 'Air Conditioning', 'Daily Housekeeping'],
      check_in_time: '14:00',
      check_out_time: '12:00',
      cancellation_policy: 'Contact reservations for booking and cancellation details.',
      contact_phone: '',
      whatsapp_number: '',
      contact_email: '',
      google_maps_url: '',
      google_maps_embed_url: '',
      starting_price: 69,
      currency: 'MYR',
      is_featured: 1,
      is_visible: 1,
      display_order: 9,
      created_at: now,
      updated_at: now,
    },
  ];
}

function getInitialStore(): PublicSiteStore {
  const now = new Date().toISOString();
  return {
    settings: {
      id: 1,
      site_status: 'Unpublished',
      has_unpublished_changes: 1,
      hotel_name: '',
      tagline: '',
      short_description: '',
      about_title: '',
      about_content: '',
      logo_url: '',
      favicon_url: '',
      primary_color: '#0f172a',
      accent_color: '#b45309',
      contact_phone: '',
      whatsapp_number: '',
      contact_email: '',
      address_line: '',
      city: 'Kuala Lumpur',
      country: 'Malaysia',
      postal_code: '',
      google_maps_url: '',
      google_maps_embed_url: '',
      social_links: {},
      reservation_url: '',
      reservation_button_text: 'Enquire Now',
      check_in_time: '14:00',
      check_out_time: '12:00',
      cancellation_policy: '',
      general_policies: '',
      footer_text: '',
      copyright_text: '',
      hero_heading: '',
      hero_subtitle: '',
      hero_image_url: '',
      hero_cta_text: 'Explore Rooms',
      hero_cta_link: '#rooms',
      hero_secondary_cta_text: 'Contact Us',
      hero_secondary_cta_link: '#contact',
      welcome_heading: '',
      welcome_body: '',
      homepage_sections: getDefaultHomepageSections(),
      nav_links: getDefaultNavLinks(),
      footer_links: getDefaultNavLinks(),
      seo_title: '',
      seo_description: '',
      og_title: '',
      og_description: '',
      og_image_url: '',
      canonical_domain: '',
      robots_indexing: 'index,follow',
      sitemap_enabled: 1,
      public_site_url: '',
      last_edited_by: null,
      last_edited_at: now,
      last_published_at: null,
      last_published_version: null,
      updated_at: now,
    },
    pages: getDefaultPages(now),
    hotels: getInitialKualaLumpurPublicHotels(now),
    rooms: [],
    facilities: [],
    gallery: [],
    faqs: [],
    snapshots: [],
    publications: [],
    nextIds: {
      hotels: 10,
      rooms: 1,
      facilities: 1,
      gallery: 1,
      faqs: 1,
      snapshots: 1,
      publications: 1,
    },
  };
}

function loadStore(): PublicSiteStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      const initial = getInitialStore();
      const loaded: PublicSiteStore & { kl_9_hotels_migrated_v1?: boolean } = {
        ...initial,
        ...parsed,
        settings: { ...initial.settings, ...(parsed.settings || {}) },
        pages: Array.isArray(parsed.pages) && parsed.pages.length > 0 ? parsed.pages : initial.pages,
        hotels: Array.isArray(parsed.hotels) ? parsed.hotels : [],
        rooms: Array.isArray(parsed.rooms)
          ? parsed.rooms.map((r: any) => ({ ...r, hotel_id: Number(r.hotel_id || 0), crm_room_id: r.crm_room_id ?? null }))
          : [],
        facilities: Array.isArray(parsed.facilities) ? parsed.facilities : [],
        gallery: Array.isArray(parsed.gallery) ? parsed.gallery : [],
        faqs: Array.isArray(parsed.faqs) ? parsed.faqs : [],
        snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
        publications: Array.isArray(parsed.publications) ? parsed.publications : [],
        nextIds: { ...initial.nextIds, ...(parsed.nextIds || {}) },
      };

      if (!parsed.kl_9_hotels_migrated_v1) {
        loaded.hotels = getInitialKualaLumpurPublicHotels(new Date().toISOString());
        loaded.rooms = [];
        loaded.nextIds.hotels = 10;
        loaded.nextIds.rooms = 1;
        loaded.kl_9_hotels_migrated_v1 = true;
        saveStore(loaded);
      }
      return loaded;
    }
  } catch (err) {
    console.warn('[PublicSiteCMS] Failed to read local store, initializing clean store:', err);
  }
  const fresh = getInitialStore() as PublicSiteStore & { kl_9_hotels_migrated_v1?: boolean };
  fresh.kl_9_hotels_migrated_v1 = true;
  saveStore(fresh);
  return fresh;
}

function saveStore(data: PublicSiteStore) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[PublicSiteCMS] Failed to write local store:', err);
  }
}

let store: PublicSiteStore = loadStore();
let tablesInitialized = false;
let initPromise: Promise<void> | null = null;

async function ensureMySQLTablesAndSync(): Promise<void> {
  const { pool, isConnected } = getMySQLPool();
  if (!pool || !isConnected) return;
  if (tablesInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const conn = await pool.getConnection();
      try {
        await Promise.all([
          conn.query(`
            CREATE TABLE IF NOT EXISTS public_site_settings (
              id INT AUTO_INCREMENT PRIMARY KEY,
              site_status VARCHAR(40) NOT NULL DEFAULT 'Unpublished',
              has_unpublished_changes TINYINT(1) NOT NULL DEFAULT 1,
              hotel_name VARCHAR(255) NOT NULL DEFAULT '',
              tagline VARCHAR(255) DEFAULT '',
              short_description TEXT DEFAULT NULL,
              about_title VARCHAR(255) DEFAULT '',
              about_content LONGTEXT DEFAULT NULL,
              logo_url TEXT DEFAULT NULL,
              favicon_url TEXT DEFAULT NULL,
              primary_color VARCHAR(30) DEFAULT '#0f172a',
              accent_color VARCHAR(30) DEFAULT '#b45309',
              contact_phone VARCHAR(100) DEFAULT '',
              whatsapp_number VARCHAR(100) DEFAULT '',
              contact_email VARCHAR(255) DEFAULT '',
              address_line TEXT DEFAULT NULL,
              city VARCHAR(120) DEFAULT '',
              country VARCHAR(120) DEFAULT '',
              postal_code VARCHAR(40) DEFAULT '',
              google_maps_url TEXT DEFAULT NULL,
              google_maps_embed_url TEXT DEFAULT NULL,
              social_links_json LONGTEXT DEFAULT NULL,
              reservation_url TEXT DEFAULT NULL,
              reservation_button_text VARCHAR(100) DEFAULT 'Enquire Now',
              check_in_time VARCHAR(100) DEFAULT '',
              check_out_time VARCHAR(100) DEFAULT '',
              cancellation_policy TEXT DEFAULT NULL,
              general_policies LONGTEXT DEFAULT NULL,
              footer_text TEXT DEFAULT NULL,
              copyright_text VARCHAR(255) DEFAULT '',
              hero_heading VARCHAR(255) DEFAULT '',
              hero_subtitle TEXT DEFAULT NULL,
              hero_image_url TEXT DEFAULT NULL,
              hero_cta_text VARCHAR(100) DEFAULT 'Explore Rooms',
              hero_cta_link VARCHAR(255) DEFAULT '#rooms',
              hero_secondary_cta_text VARCHAR(100) DEFAULT 'Contact Us',
              hero_secondary_cta_link VARCHAR(255) DEFAULT '#contact',
              welcome_heading VARCHAR(255) DEFAULT '',
              welcome_body LONGTEXT DEFAULT NULL,
              homepage_sections_json LONGTEXT DEFAULT NULL,
              nav_links_json LONGTEXT DEFAULT NULL,
              footer_links_json LONGTEXT DEFAULT NULL,
              seo_title VARCHAR(255) DEFAULT '',
              seo_description TEXT DEFAULT NULL,
              og_title VARCHAR(255) DEFAULT '',
              og_description TEXT DEFAULT NULL,
              og_image_url TEXT DEFAULT NULL,
              canonical_domain VARCHAR(255) DEFAULT '',
              robots_indexing VARCHAR(50) DEFAULT 'index,follow',
              sitemap_enabled TINYINT(1) NOT NULL DEFAULT 1,
              public_site_url VARCHAR(255) DEFAULT '',
              last_edited_by INT DEFAULT NULL,
              last_edited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              last_published_at DATETIME DEFAULT NULL,
              last_published_version INT DEFAULT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
          `),
          conn.query(`
            CREATE TABLE IF NOT EXISTS public_site_pages (
              id INT AUTO_INCREMENT PRIMARY KEY,
              slug VARCHAR(64) NOT NULL UNIQUE,
              title VARCHAR(255) NOT NULL,
              heading VARCHAR(255) NOT NULL DEFAULT '',
              subheading TEXT DEFAULT NULL,
              hero_image_url TEXT DEFAULT NULL,
              content_body LONGTEXT DEFAULT NULL,
              structured_data_json LONGTEXT DEFAULT NULL,
              seo_title VARCHAR(255) DEFAULT '',
              seo_description TEXT DEFAULT NULL,
              is_visible TINYINT(1) NOT NULL DEFAULT 1,
              show_in_nav TINYINT(1) NOT NULL DEFAULT 1,
              show_in_footer TINYINT(1) NOT NULL DEFAULT 1,
              display_order INT NOT NULL DEFAULT 1,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
          `),
          conn.query(`
            CREATE TABLE IF NOT EXISTS public_site_hotels (
              id INT AUTO_INCREMENT PRIMARY KEY,
              crm_hotel_id INT DEFAULT NULL,
              name VARCHAR(255) NOT NULL,
              slug VARCHAR(255) NOT NULL,
              city VARCHAR(120) DEFAULT '',
              country VARCHAR(120) DEFAULT '',
              address TEXT DEFAULT NULL,
              star_rating INT NOT NULL DEFAULT 5,
              short_description TEXT DEFAULT NULL,
              full_description LONGTEXT DEFAULT NULL,
              featured_image_url TEXT DEFAULT NULL,
              gallery_images_json LONGTEXT DEFAULT NULL,
              amenities_json LONGTEXT DEFAULT NULL,
              check_in_time VARCHAR(100) DEFAULT '14:00',
              check_out_time VARCHAR(100) DEFAULT '12:00',
              cancellation_policy TEXT DEFAULT NULL,
              contact_phone VARCHAR(100) DEFAULT '',
              whatsapp_number VARCHAR(100) DEFAULT '',
              contact_email VARCHAR(255) DEFAULT '',
              google_maps_url TEXT DEFAULT NULL,
              google_maps_embed_url TEXT DEFAULT NULL,
              starting_price DECIMAL(10, 2) DEFAULT NULL,
              currency VARCHAR(16) DEFAULT 'USD',
              is_featured TINYINT(1) NOT NULL DEFAULT 1,
              is_visible TINYINT(1) NOT NULL DEFAULT 1,
              display_order INT NOT NULL DEFAULT 1,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
          `),
          conn.query(`
            CREATE TABLE IF NOT EXISTS public_site_rooms (
              id INT AUTO_INCREMENT PRIMARY KEY,
              hotel_id INT NOT NULL DEFAULT 0,
              crm_room_id INT DEFAULT NULL,
              name VARCHAR(255) NOT NULL,
              slug VARCHAR(255) DEFAULT '',
              short_description TEXT DEFAULT NULL,
              full_description LONGTEXT DEFAULT NULL,
              featured_image_url TEXT DEFAULT NULL,
              gallery_images_json LONGTEXT DEFAULT NULL,
              capacity VARCHAR(120) DEFAULT '',
              bed_type VARCHAR(120) DEFAULT '',
              room_size VARCHAR(80) DEFAULT '',
              amenities_json LONGTEXT DEFAULT NULL,
              optional_price DECIMAL(10, 2) DEFAULT NULL,
              currency VARCHAR(16) DEFAULT 'USD',
              price_note VARCHAR(120) DEFAULT 'per night (indicative)',
              enquiry_url TEXT DEFAULT NULL,
              is_featured TINYINT(1) NOT NULL DEFAULT 0,
              is_visible TINYINT(1) NOT NULL DEFAULT 1,
              display_order INT NOT NULL DEFAULT 1,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
          `),
          conn.query(`
            CREATE TABLE IF NOT EXISTS public_site_facilities (
              id INT AUTO_INCREMENT PRIMARY KEY,
              name VARCHAR(255) NOT NULL,
              category VARCHAR(100) DEFAULT 'General',
              description TEXT DEFAULT NULL,
              icon_name VARCHAR(80) DEFAULT 'Sparkles',
              image_url TEXT DEFAULT NULL,
              is_featured TINYINT(1) NOT NULL DEFAULT 1,
              is_visible TINYINT(1) NOT NULL DEFAULT 1,
              display_order INT NOT NULL DEFAULT 1,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
          `),
          conn.query(`
            CREATE TABLE IF NOT EXISTS public_site_gallery (
              id INT AUTO_INCREMENT PRIMARY KEY,
              title VARCHAR(255) DEFAULT '',
              caption TEXT DEFAULT NULL,
              alt_text VARCHAR(255) NOT NULL DEFAULT '',
              category VARCHAR(100) DEFAULT 'Hotel',
              image_url TEXT NOT NULL,
              is_featured TINYINT(1) NOT NULL DEFAULT 0,
              is_visible TINYINT(1) NOT NULL DEFAULT 1,
              display_order INT NOT NULL DEFAULT 1,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
          `),
          conn.query(`
            CREATE TABLE IF NOT EXISTS public_site_faqs (
              id INT AUTO_INCREMENT PRIMARY KEY,
              question VARCHAR(500) NOT NULL,
              answer LONGTEXT NOT NULL,
              category VARCHAR(100) DEFAULT 'General',
              is_visible TINYINT(1) NOT NULL DEFAULT 1,
              display_order INT NOT NULL DEFAULT 1,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
          `),
          conn.query(`
            CREATE TABLE IF NOT EXISTS public_site_snapshots (
              id INT AUTO_INCREMENT PRIMARY KEY,
              version_number INT NOT NULL UNIQUE,
              snapshot_hash VARCHAR(64) NOT NULL,
              snapshot_json LONGTEXT NOT NULL,
              published_by_user_id INT DEFAULT NULL,
              published_by_name VARCHAR(255) DEFAULT 'Administrator',
              notes TEXT DEFAULT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
          `),
          conn.query(`
            CREATE TABLE IF NOT EXISTS public_site_publications (
              id INT AUTO_INCREMENT PRIMARY KEY,
              version_number INT NOT NULL,
              snapshot_id INT NOT NULL,
              initiated_by_user_id INT DEFAULT NULL,
              initiated_by_name VARCHAR(255) DEFAULT 'Administrator',
              deployment_status VARCHAR(50) NOT NULL DEFAULT 'Deployment Requested',
              build_hook_configured TINYINT(1) NOT NULL DEFAULT 0,
              build_hook_triggered TINYINT(1) NOT NULL DEFAULT 0,
              build_hook_http_status INT DEFAULT NULL,
              netlify_deploy_id VARCHAR(120) DEFAULT NULL,
              netlify_deploy_state VARCHAR(80) DEFAULT NULL,
              netlify_deploy_url TEXT DEFAULT NULL,
              verified_at DATETIME DEFAULT NULL,
              error_message TEXT DEFAULT NULL,
              notes TEXT DEFAULT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
          `),
        ]);

        // Hydrate from MySQL if rows exist
        const [settingsRows]: any = await conn.query('SELECT * FROM public_site_settings WHERE id = 1 LIMIT 1');
        if (Array.isArray(settingsRows) && settingsRows.length > 0) {
          const row = settingsRows[0];
          store.settings = {
            ...store.settings,
            ...row,
            social_links: safeJsonParse(row.social_links_json, store.settings.social_links),
            homepage_sections: safeJsonParse(row.homepage_sections_json, store.settings.homepage_sections),
            nav_links: safeJsonParse(row.nav_links_json, store.settings.nav_links),
            footer_links: safeJsonParse(row.footer_links_json, store.settings.footer_links),
          };
        } else {
          // Insert initial settings row into MySQL
          const s = store.settings;
          await conn.query(
            `INSERT IGNORE INTO public_site_settings (
              id, site_status, has_unpublished_changes, hotel_name, tagline, short_description,
              about_title, about_content, logo_url, favicon_url, primary_color, accent_color,
              contact_phone, whatsapp_number, contact_email, address_line, city, country, postal_code,
              google_maps_url, google_maps_embed_url, social_links_json, reservation_url, reservation_button_text,
              check_in_time, check_out_time, cancellation_policy, general_policies, footer_text, copyright_text,
              hero_heading, hero_subtitle, hero_image_url, hero_cta_text, hero_cta_link,
              hero_secondary_cta_text, hero_secondary_cta_link, welcome_heading, welcome_body,
              homepage_sections_json, nav_links_json, footer_links_json,
              seo_title, seo_description, og_title, og_description, og_image_url,
              canonical_domain, robots_indexing, sitemap_enabled, public_site_url
            ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              s.site_status, s.has_unpublished_changes, s.hotel_name, s.tagline, s.short_description,
              s.about_title, s.about_content, s.logo_url, s.favicon_url, s.primary_color, s.accent_color,
              s.contact_phone, s.whatsapp_number, s.contact_email, s.address_line, s.city, s.country, s.postal_code,
              s.google_maps_url, s.google_maps_embed_url, JSON.stringify(s.social_links || {}),
              s.reservation_url, s.reservation_button_text, s.check_in_time, s.check_out_time,
              s.cancellation_policy, s.general_policies, s.footer_text, s.copyright_text,
              s.hero_heading, s.hero_subtitle, s.hero_image_url, s.hero_cta_text, s.hero_cta_link,
              s.hero_secondary_cta_text, s.hero_secondary_cta_link, s.welcome_heading, s.welcome_body,
              JSON.stringify(s.homepage_sections || []), JSON.stringify(s.nav_links || []), JSON.stringify(s.footer_links || []),
              s.seo_title, s.seo_description, s.og_title, s.og_description, s.og_image_url,
              s.canonical_domain, s.robots_indexing, s.sitemap_enabled, s.public_site_url,
            ]
          );
        }

        // Ensure additive columns on public_site_rooms exist for older installations
        await conn.query('ALTER TABLE public_site_rooms ADD COLUMN hotel_id INT NOT NULL DEFAULT 0 AFTER id').catch(() => {});
        await conn.query('ALTER TABLE public_site_rooms ADD COLUMN crm_room_id INT DEFAULT NULL AFTER hotel_id').catch(() => {});

        const [
          [pageRows],
          [hotelRows],
          [roomRows],
          [facilityRows],
          [galleryRows],
          [faqRows],
          [snapshotRows],
          [pubRows],
        ]: any = await Promise.all([
          conn.query('SELECT * FROM public_site_pages ORDER BY display_order ASC'),
          conn.query('SELECT * FROM public_site_hotels ORDER BY display_order ASC, id ASC'),
          conn.query('SELECT * FROM public_site_rooms ORDER BY display_order ASC, id ASC'),
          conn.query('SELECT * FROM public_site_facilities ORDER BY display_order ASC, id ASC'),
          conn.query('SELECT * FROM public_site_gallery ORDER BY display_order ASC, id ASC'),
          conn.query('SELECT * FROM public_site_faqs ORDER BY display_order ASC, id ASC'),
          conn.query('SELECT * FROM public_site_snapshots ORDER BY version_number DESC LIMIT 25'),
          conn.query('SELECT * FROM public_site_publications ORDER BY id DESC LIMIT 50'),
        ]);

        if (Array.isArray(pageRows) && pageRows.length > 0) {
          store.pages = pageRows.map((p: any) => ({
            id: Number(p.id),
            slug: p.slug,
            title: p.title || '',
            heading: p.heading || '',
            subheading: p.subheading || '',
            hero_image_url: p.hero_image_url || p.Hero_image_url || '',
            content_body: p.content_body || '',
            structured_data: safeJsonParse(p.structured_data_json, {}),
            seo_title: p.seo_title || '',
            seo_description: p.seo_description || '',
            is_visible: Number(p.is_visible ?? 1),
            show_in_nav: Number(p.show_in_nav ?? 1),
            show_in_footer: Number(p.show_in_footer ?? 1),
            display_order: Number(p.display_order || 1),
            updated_at: p.updated_at ? new Date(p.updated_at).toISOString() : new Date().toISOString(),
          }));
        } else {
          for (const page of store.pages) {
            await conn.query(
              `INSERT IGNORE INTO public_site_pages (
                id, slug, title, heading, subheading, hero_image_url, content_body,
                structured_data_json, seo_title, seo_description, is_visible, show_in_nav, show_in_footer, display_order
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                page.id, page.slug, page.title, page.heading, page.subheading, page.hero_image_url,
                page.content_body, JSON.stringify(page.structured_data || {}), page.seo_title,
                page.seo_description, page.is_visible, page.show_in_nav, page.show_in_footer, page.display_order,
              ]
            );
          }
        }

        // One-time MySQL migration for public_site_hotels & public_site_rooms to replace old hotels with the 9 KL hotels
        const [pubKlMigRows]: any = await conn
          .query("SELECT setting_value FROM settings WHERE setting_key = 'public_kl_9_hotels_migrated_v1' LIMIT 1")
          .catch(() => [[]]);
        const needsPubKlMigration = !Array.isArray(pubKlMigRows) || pubKlMigRows.length === 0;

        if (needsPubKlMigration) {
          const klPubHotels = getInitialKualaLumpurPublicHotels(new Date().toISOString());
          await conn.query('DELETE FROM public_site_rooms').catch(() => {});
          await conn.query('DELETE FROM public_site_hotels').catch(() => {});
          for (const h of klPubHotels) {
            await conn
              .query(
                `INSERT INTO public_site_hotels (
                  id, crm_hotel_id, name, slug, city, country, address, star_rating,
                  short_description, full_description, featured_image_url, gallery_images_json,
                  amenities_json, check_in_time, check_out_time, cancellation_policy,
                  contact_phone, whatsapp_number, contact_email, google_maps_url, google_maps_embed_url,
                  starting_price, currency, is_featured, is_visible, display_order
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  h.id, h.crm_hotel_id, h.name, h.slug, h.city, h.country, h.address, h.star_rating,
                  h.short_description, h.full_description, h.featured_image_url,
                  JSON.stringify(h.gallery_images), JSON.stringify(h.amenities),
                  h.check_in_time, h.check_out_time, h.cancellation_policy,
                  h.contact_phone, h.whatsapp_number, h.contact_email,
                  h.google_maps_url, h.google_maps_embed_url,
                  h.starting_price, h.currency, h.is_featured, h.is_visible, h.display_order,
                ]
              )
              .catch(() => {});
          }
          await conn
            .query("INSERT INTO settings (setting_key, setting_value) VALUES ('public_kl_9_hotels_migrated_v1', '1') ON DUPLICATE KEY UPDATE setting_value = '1'")
            .catch(() => {});
          store.hotels = klPubHotels;
          store.rooms = [];
          store.nextIds.hotels = 10;
          store.nextIds.rooms = 1;
          (store as any).kl_9_hotels_migrated_v1 = true;
          saveStore(store);
        } else {
          if (Array.isArray(hotelRows) && hotelRows.length > 0) {
            store.hotels = hotelRows.map((h: any) => ({
              id: Number(h.id),
              crm_hotel_id: h.crm_hotel_id !== null && h.crm_hotel_id !== undefined ? Number(h.crm_hotel_id) : null,
              name: h.name || '',
              slug: h.slug || '',
              city: h.city || '',
              country: h.country || '',
              address: h.address || '',
              star_rating: Number(h.star_rating ?? 5),
              short_description: h.short_description || '',
              full_description: h.full_description || '',
              featured_image_url: h.featured_image_url || '',
              gallery_images: safeJsonParse(h.gallery_images_json, []),
              amenities: safeJsonParse(h.amenities_json, []),
              check_in_time: h.check_in_time || '14:00',
              check_out_time: h.check_out_time || '12:00',
              cancellation_policy: h.cancellation_policy || '',
              contact_phone: h.contact_phone || '',
              whatsapp_number: h.whatsapp_number || '',
              contact_email: h.contact_email || '',
              google_maps_url: h.google_maps_url || '',
              google_maps_embed_url: h.google_maps_embed_url || '',
              starting_price: h.starting_price !== null && h.starting_price !== undefined ? Number(h.starting_price) : null,
              currency: h.currency || 'USD',
              is_featured: Number(h.is_featured ?? 1),
              is_visible: Number(h.is_visible ?? 1),
              display_order: Number(h.display_order || 1),
              created_at: h.created_at ? new Date(h.created_at).toISOString() : new Date().toISOString(),
              updated_at: h.updated_at ? new Date(h.updated_at).toISOString() : new Date().toISOString(),
            }));
            store.nextIds.hotels = Math.max(store.nextIds.hotels, ...store.hotels.map(h => h.id + 1));
          }

          if (Array.isArray(roomRows)) {
            store.rooms = roomRows.map((r: any) => ({
              id: Number(r.id),
              hotel_id: Number(r.hotel_id ?? 0),
              crm_room_id: r.crm_room_id !== null && r.crm_room_id !== undefined ? Number(r.crm_room_id) : null,
              name: r.name || '',
              slug: r.slug || '',
              short_description: r.short_description || '',
              full_description: r.full_description || '',
              featured_image_url: r.featured_image_url || '',
              gallery_images: safeJsonParse(r.gallery_images_json, []),
              capacity: r.capacity || '',
              bed_type: r.bed_type || '',
              room_size: r.room_size || '',
              amenities: safeJsonParse(r.amenities_json, []),
              optional_price: r.optional_price !== null && r.optional_price !== undefined ? Number(r.optional_price) : null,
              currency: r.currency || 'USD',
              price_note: r.price_note || 'per night (indicative)',
              enquiry_url: r.enquiry_url || '',
              is_featured: Number(r.is_featured ?? 0),
              is_visible: Number(r.is_visible ?? 1),
              display_order: Number(r.display_order || 1),
              created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
              updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
            }));
            if (store.rooms.length > 0) {
              store.nextIds.rooms = Math.max(store.nextIds.rooms, ...store.rooms.map(r => r.id + 1));
            }
          }
        }

        if (Array.isArray(facilityRows) && facilityRows.length > 0) {
          store.facilities = facilityRows.map((f: any) => ({
            id: Number(f.id),
            name: f.name || '',
            category: f.category || 'General',
            description: f.description || '',
            icon_name: f.icon_name || 'Sparkles',
            image_url: f.image_url || '',
            is_featured: Number(f.is_featured ?? 1),
            is_visible: Number(f.is_visible ?? 1),
            display_order: Number(f.display_order || 1),
            created_at: f.created_at ? new Date(f.created_at).toISOString() : new Date().toISOString(),
            updated_at: f.updated_at ? new Date(f.updated_at).toISOString() : new Date().toISOString(),
          }));
          store.nextIds.facilities = Math.max(store.nextIds.facilities, ...store.facilities.map(f => f.id + 1));
        }

        if (Array.isArray(galleryRows) && galleryRows.length > 0) {
          store.gallery = galleryRows.map((g: any) => ({
            id: Number(g.id),
            title: g.title || '',
            caption: g.caption || '',
            alt_text: g.alt_text || '',
            category: g.category || 'Hotel',
            image_url: g.image_url || '',
            is_featured: Number(g.is_featured ?? 0),
            is_visible: Number(g.is_visible ?? 1),
            display_order: Number(g.display_order || 1),
            created_at: g.created_at ? new Date(g.created_at).toISOString() : new Date().toISOString(),
            updated_at: g.updated_at ? new Date(g.updated_at).toISOString() : new Date().toISOString(),
          }));
          store.nextIds.gallery = Math.max(store.nextIds.gallery, ...store.gallery.map(g => g.id + 1));
        }

        if (Array.isArray(faqRows) && faqRows.length > 0) {
          store.faqs = faqRows.map((q: any) => ({
            id: Number(q.id),
            question: q.question || '',
            answer: q.answer || '',
            category: q.category || 'General',
            is_visible: Number(q.is_visible ?? 1),
            display_order: Number(q.display_order || 1),
            created_at: q.created_at ? new Date(q.created_at).toISOString() : new Date().toISOString(),
            updated_at: q.updated_at ? new Date(q.updated_at).toISOString() : new Date().toISOString(),
          }));
          store.nextIds.faqs = Math.max(store.nextIds.faqs, ...store.faqs.map(q => q.id + 1));
        }

        if (Array.isArray(snapshotRows) && snapshotRows.length > 0) {
          store.snapshots = snapshotRows.map((sn: any) => ({
            id: Number(sn.id),
            version_number: Number(sn.version_number),
            snapshot_hash: sn.snapshot_hash || '',
            snapshot_json: sn.snapshot_json || '{}',
            published_by_user_id: sn.published_by_user_id ? Number(sn.published_by_user_id) : null,
            published_by_name: sn.published_by_name || 'Administrator',
            notes: sn.notes || '',
            created_at: sn.created_at ? new Date(sn.created_at).toISOString() : new Date().toISOString(),
          }));
          store.nextIds.snapshots = Math.max(store.nextIds.snapshots, ...store.snapshots.map(s => s.id + 1));
        }

        if (Array.isArray(pubRows) && pubRows.length > 0) {
          store.publications = pubRows.map((p: any) => ({
            id: Number(p.id),
            version_number: Number(p.version_number),
            snapshot_id: Number(p.snapshot_id),
            initiated_by_user_id: p.initiated_by_user_id ? Number(p.initiated_by_user_id) : null,
            initiated_by_name: p.initiated_by_name || 'Administrator',
            deployment_status: p.deployment_status || 'Deployment Requested',
            build_hook_configured: Number(p.build_hook_configured ?? 0),
            build_hook_triggered: Number(p.build_hook_triggered ?? 0),
            build_hook_http_status: p.build_hook_http_status !== null ? Number(p.build_hook_http_status) : null,
            netlify_deploy_id: p.netlify_deploy_id || null,
            netlify_deploy_state: p.netlify_deploy_state || null,
            netlify_deploy_url: p.netlify_deploy_url || null,
            verified_at: p.verified_at ? new Date(p.verified_at).toISOString() : null,
            error_message: p.error_message || null,
            notes: p.notes || null,
            created_at: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString(),
            updated_at: p.updated_at ? new Date(p.updated_at).toISOString() : new Date().toISOString(),
          }));
          store.nextIds.publications = Math.max(store.nextIds.publications, ...store.publications.map(p => p.id + 1));
        }

        saveStore(store);
        tablesInitialized = true;
      } finally {
        conn.release();
      }
    } catch (err: any) {
      console.warn('[PublicSiteCMS] MySQL table init/hydration warning:', err.message);
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

function safeJsonParse<T>(str: any, fallback: T): T {
  if (!str) return fallback;
  if (typeof str === 'object') return str as T;
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

// --------------------------------------------------------------------------
// Strict Allowlist Snapshot Builder
// Ensures ZERO private CRM fields ever enter the public website snapshot
// --------------------------------------------------------------------------
export function buildAllowlistedPublicSnapshot(
  versionNumber: number,
  publishedAt: string
): PublicWebsiteSnapshot {
  const s = store.settings;
  const visiblePages = [...store.pages]
    .filter(p => p.is_visible === 1)
    .sort((a, b) => a.display_order - b.display_order);

  const visibleHotels = [...(store.hotels || [])]
    .filter(h => h.is_visible === 1)
    .sort((a, b) => a.display_order - b.display_order);

  const visibleRooms = [...store.rooms]
    .filter(r => r.is_visible === 1)
    .sort((a, b) => a.display_order - b.display_order);

  const visibleFacilities = [...store.facilities]
    .filter(f => f.is_visible === 1)
    .sort((a, b) => a.display_order - b.display_order);

  const visibleGallery = [...store.gallery]
    .filter(g => g.is_visible === 1)
    .sort((a, b) => a.display_order - b.display_order);

  const visibleFaqs = [...store.faqs]
    .filter(q => q.is_visible === 1)
    .sort((a, b) => a.display_order - b.display_order);

  const isConfigured = Boolean(
    s.hotel_name.trim() ||
    s.hero_heading.trim() ||
    visibleHotels.length > 0 ||
    visibleRooms.length > 0 ||
    visibleFacilities.length > 0
  );

  const mapSnapshotRoom = (r: PublicSiteRoom, parentHotel?: PublicSiteHotel) => ({
    id: r.id,
    hotel_id: Number(r.hotel_id || parentHotel?.id || 0),
    hotel_name: parentHotel ? sanitizeText(parentHotel.name, 255) : undefined,
    hotel_slug: parentHotel ? sanitizeText(parentHotel.slug, 255) : undefined,
    name: sanitizeText(r.name, 255),
    slug: sanitizeText(r.slug, 255),
    short_description: sanitizeText(r.short_description, 1000),
    full_description: sanitizeText(r.full_description, 8000),
    featured_image_url: sanitizePublicUrl(r.featured_image_url),
    gallery_images: (Array.isArray(r.gallery_images) ? r.gallery_images : [])
      .map(u => sanitizePublicUrl(u))
      .filter(Boolean),
    capacity: sanitizeText(r.capacity, 120),
    bed_type: sanitizeText(r.bed_type, 120),
    room_size: sanitizeText(r.room_size, 80),
    amenities: (Array.isArray(r.amenities) ? r.amenities : [])
      .map(a => sanitizeText(a, 120))
      .filter(Boolean),
    optional_price: r.optional_price !== null && r.optional_price !== undefined && !isNaN(Number(r.optional_price))
      ? Number(r.optional_price)
      : null,
    currency: sanitizeText(r.currency, 16) || 'USD',
    price_note: sanitizeText(r.price_note, 120) || 'per night (indicative)',
    enquiry_url: sanitizePublicUrl(r.enquiry_url),
    is_featured: r.is_featured === 1,
    display_order: Number(r.display_order || 1),
  });

  const hotelById = new Map<number, PublicSiteHotel>();
  visibleHotels.forEach(h => hotelById.set(h.id, h));

  const snapshotHotels = visibleHotels.map(h => {
    const hotelRooms = visibleRooms
      .filter(r => Number(r.hotel_id) === Number(h.id))
      .map(r => mapSnapshotRoom(r, h));

    // Calculate starting price from room types if not explicitly set on hotel
    let startingPrice: number | null =
      h.starting_price !== null && h.starting_price !== undefined && !isNaN(Number(h.starting_price))
        ? Number(h.starting_price)
        : null;
    if (startingPrice === null && hotelRooms.length > 0) {
      const prices = hotelRooms
        .map(rm => rm.optional_price)
        .filter((p): p is number => p !== null && p > 0);
      if (prices.length > 0) {
        startingPrice = Math.min(...prices);
      }
    }

    return {
      id: h.id,
      name: sanitizeText(h.name, 255),
      slug: sanitizeText(h.slug || h.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), 255),
      city: sanitizeText(h.city, 120),
      country: sanitizeText(h.country, 120),
      address: sanitizeText(h.address, 500),
      star_rating: Math.min(5, Math.max(1, Number(h.star_rating || 5))),
      short_description: sanitizeText(h.short_description, 1000),
      full_description: sanitizeText(h.full_description, 12000),
      featured_image_url: sanitizePublicUrl(h.featured_image_url),
      gallery_images: (Array.isArray(h.gallery_images) ? h.gallery_images : [])
        .map(u => sanitizePublicUrl(u))
        .filter(Boolean),
      amenities: (Array.isArray(h.amenities) ? h.amenities : [])
        .map(a => sanitizeText(a, 120))
        .filter(Boolean),
      check_in_time: sanitizeText(h.check_in_time, 100) || '14:00',
      check_out_time: sanitizeText(h.check_out_time, 100) || '12:00',
      cancellation_policy: sanitizeText(h.cancellation_policy, 3000),
      contact_phone: sanitizeText(h.contact_phone || s.contact_phone, 100),
      whatsapp_number: sanitizeText(h.whatsapp_number || s.whatsapp_number, 100),
      contact_email: sanitizeText(h.contact_email || s.contact_email, 255),
      google_maps_url: sanitizePublicUrl(h.google_maps_url),
      google_maps_embed_url: sanitizePublicUrl(h.google_maps_embed_url),
      starting_price: startingPrice,
      currency: sanitizeText(h.currency, 16) || 'USD',
      is_featured: h.is_featured === 1,
      display_order: Number(h.display_order || 1),
      rooms: hotelRooms,
    };
  });

  return {
    schema_version: '1.0',
    published_version: versionNumber,
    published_at: publishedAt,
    is_configured: isConfigured,
    hotel: {
      name: sanitizeText(s.hotel_name || 'Partner Hotel Collection', 255),
      tagline: sanitizeText(s.tagline, 255),
      short_description: sanitizeText(s.short_description, 2000),
      about_title: sanitizeText(s.about_title, 255),
      about_content: sanitizeText(s.about_content, 15000),
      logo_url: sanitizePublicUrl(s.logo_url),
      favicon_url: sanitizePublicUrl(s.favicon_url),
      primary_color: sanitizeText(s.primary_color, 30) || '#0f172a',
      accent_color: sanitizeText(s.accent_color, 30) || '#b45309',
      contact_phone: sanitizeText(s.contact_phone, 100),
      whatsapp_number: sanitizeText(s.whatsapp_number, 100),
      contact_email: sanitizeText(s.contact_email, 255),
      address_line: sanitizeText(s.address_line, 500),
      city: sanitizeText(s.city, 120),
      country: sanitizeText(s.country, 120),
      postal_code: sanitizeText(s.postal_code, 40),
      google_maps_url: sanitizePublicUrl(s.google_maps_url),
      google_maps_embed_url: sanitizePublicUrl(s.google_maps_embed_url),
      social_links: {
        facebook: sanitizePublicUrl(s.social_links?.facebook),
        instagram: sanitizePublicUrl(s.social_links?.instagram),
        twitter: sanitizePublicUrl(s.social_links?.twitter),
        linkedin: sanitizePublicUrl(s.social_links?.linkedin),
        youtube: sanitizePublicUrl(s.social_links?.youtube),
        tiktok: sanitizePublicUrl(s.social_links?.tiktok),
        wechat: sanitizeText(s.social_links?.wechat, 120),
        tripadvisor: sanitizePublicUrl(s.social_links?.tripadvisor),
      },
      reservation_url: sanitizePublicUrl(s.reservation_url),
      reservation_button_text: sanitizeText(s.reservation_button_text, 100) || 'Enquire Now',
      check_in_time: sanitizeText(s.check_in_time, 100),
      check_out_time: sanitizeText(s.check_out_time, 100),
      cancellation_policy: sanitizeText(s.cancellation_policy, 3000),
      general_policies: sanitizeText(s.general_policies, 8000),
      footer_text: sanitizeText(s.footer_text, 1000),
      copyright_text: sanitizeText(s.copyright_text, 255),
    },
    homepage: {
      hero_heading: sanitizeText(s.hero_heading, 255),
      hero_subtitle: sanitizeText(s.hero_subtitle, 1000),
      hero_image_url: sanitizePublicUrl(s.hero_image_url),
      hero_cta_text: sanitizeText(s.hero_cta_text, 100) || 'Explore Hotels',
      hero_cta_link: sanitizePublicUrl(s.hero_cta_link) || '#hotels',
      hero_secondary_cta_text: sanitizeText(s.hero_secondary_cta_text, 100) || 'Contact Us',
      hero_secondary_cta_link: sanitizePublicUrl(s.hero_secondary_cta_link) || '#contact',
      welcome_heading: sanitizeText(s.welcome_heading, 255),
      welcome_body: sanitizeText(s.welcome_body, 6000),
      sections: Array.isArray(s.homepage_sections)
        ? [...s.homepage_sections].sort((a, b) => a.order - b.order)
        : getDefaultHomepageSections(),
    },
    navigation: {
      header_links: (Array.isArray(s.nav_links) ? s.nav_links : getDefaultNavLinks())
        .filter(l => l.visible)
        .map(l => ({
          label: sanitizeText(l.label, 80),
          href: sanitizePublicUrl(l.href) || '#',
          visible: true,
        })),
      footer_links: (Array.isArray(s.footer_links) ? s.footer_links : getDefaultNavLinks())
        .filter(l => l.visible)
        .map(l => ({
          label: sanitizeText(l.label, 80),
          href: sanitizePublicUrl(l.href) || '#',
          visible: true,
        })),
    },
    seo: {
      title: sanitizeText(s.seo_title || s.hotel_name || 'Partner Hotel Directory', 255),
      description: sanitizeText(s.seo_description || s.short_description, 500),
      og_title: sanitizeText(s.og_title || s.seo_title || s.hotel_name, 255),
      og_description: sanitizeText(s.og_description || s.seo_description || s.short_description, 500),
      og_image_url: sanitizePublicUrl(s.og_image_url || s.hero_image_url),
      canonical_domain: sanitizePublicUrl(s.canonical_domain),
      robots_indexing: sanitizeText(s.robots_indexing, 50) || 'index,follow',
      sitemap_enabled: s.sitemap_enabled === 1,
    },
    pages: visiblePages.map(p => ({
      slug: p.slug,
      title: sanitizeText(p.title, 255),
      heading: sanitizeText(p.heading, 255),
      subheading: sanitizeText(p.subheading, 1000),
      hero_image_url: sanitizePublicUrl(p.hero_image_url),
      content_body: sanitizeText(p.content_body, 15000),
      structured_data: p.structured_data || {},
      seo_title: sanitizeText(p.seo_title, 255),
      seo_description: sanitizeText(p.seo_description, 500),
      show_in_nav: p.show_in_nav === 1,
      show_in_footer: p.show_in_footer === 1,
      display_order: Number(p.display_order || 1),
    })),
    hotels: snapshotHotels,
    rooms: visibleRooms.map(r => mapSnapshotRoom(r, hotelById.get(Number(r.hotel_id)))),
    facilities: visibleFacilities.map(f => ({
      id: f.id,
      name: sanitizeText(f.name, 255),
      category: sanitizeText(f.category, 100),
      description: sanitizeText(f.description, 1000),
      icon_name: sanitizeText(f.icon_name, 80) || 'Sparkles',
      image_url: sanitizePublicUrl(f.image_url),
      is_featured: f.is_featured === 1,
      display_order: Number(f.display_order || 1),
    })),
    gallery: visibleGallery.map(g => ({
      id: g.id,
      title: sanitizeText(g.title, 255),
      caption: sanitizeText(g.caption, 500),
      alt_text: sanitizeText(g.alt_text || g.title || 'Hotel gallery image', 255),
      category: sanitizeText(g.category, 100),
      image_url: sanitizePublicUrl(g.image_url),
      is_featured: g.is_featured === 1,
      display_order: Number(g.display_order || 1),
    })),
    faqs: visibleFaqs.map(q => ({
      id: q.id,
      question: sanitizeText(q.question, 500),
      answer: sanitizeText(q.answer, 5000),
      category: sanitizeText(q.category, 100),
      display_order: Number(q.display_order || 1),
    })),
  };
}

// --------------------------------------------------------------------------
// Public Site Database Service
// --------------------------------------------------------------------------
export const publicSiteDb = {
  async ensureInitialized() {
    await ensureMySQLTablesAndSync();
  },

  getEnvironmentConfigStatus() {
    const buildHookUrl = process.env.NETLIFY_BUILD_HOOK_URL || '';
    const exportToken = process.env.PUBLIC_SITE_EXPORT_TOKEN || '';
    const netlifySiteId = process.env.NETLIFY_SITE_ID || '';
    const netlifyApiToken = process.env.NETLIFY_API_TOKEN || '';

    return {
      netlify_build_hook_configured: Boolean(buildHookUrl.trim() && buildHookUrl.startsWith('https://')),
      export_token_configured: Boolean(exportToken.trim() && exportToken.trim().length >= 12),
      netlify_status_api_configured: Boolean(netlifySiteId.trim() && netlifyApiToken.trim()),
    };
  },

  getBootstrapData() {
    void ensureMySQLTablesAndSync();

    // Auto-sync from CRM partner hotels if no public hotels exist yet and CRM has hotels
    if (store.hotels.length === 0) {
      try {
        const crmHotels = dbService.getHotels(false) || [];
        if (crmHotels.length > 0) {
          void this.syncFromCrmHotels(1);
        }
      } catch {}
    }

    const latestPub = store.publications.length > 0 ? store.publications[0] : null;
    const latestSnapshot = store.snapshots.length > 0 ? store.snapshots[0] : null;
    let crmHotelsCount = 0;
    try {
      crmHotelsCount = (dbService.getHotels(false) || []).length;
    } catch {}

    return {
      settings: store.settings,
      pages: [...store.pages].sort((a, b) => a.display_order - b.display_order),
      hotels: [...(store.hotels || [])].sort((a, b) => a.display_order - b.display_order),
      rooms: [...store.rooms].sort((a, b) => a.display_order - b.display_order),
      facilities: [...store.facilities].sort((a, b) => a.display_order - b.display_order),
      gallery: [...store.gallery].sort((a, b) => a.display_order - b.display_order),
      faqs: [...store.faqs].sort((a, b) => a.display_order - b.display_order),
      publications: store.publications.slice(0, 30),
      latest_publication: latestPub,
      latest_snapshot_meta: latestSnapshot
        ? {
            id: latestSnapshot.id,
            version_number: latestSnapshot.version_number,
            snapshot_hash: latestSnapshot.snapshot_hash,
            published_by_name: latestSnapshot.published_by_name,
            created_at: latestSnapshot.created_at,
          }
        : null,
      env_status: this.getEnvironmentConfigStatus(),
      crm_hotels_count: crmHotelsCount,
    };
  },

  getDraftPreviewSnapshot(): PublicWebsiteSnapshot {
    void ensureMySQLTablesAndSync();
    const previewVersion = (store.settings.last_published_version || 0) + 1;
    return buildAllowlistedPublicSnapshot(previewVersion, new Date().toISOString());
  },

  getLatestPublishedSnapshot(): {
    snapshot: PublicWebsiteSnapshot | null;
    meta: Omit<PublicSiteSnapshotRecord, 'snapshot_json'> | null;
  } {
    void ensureMySQLTablesAndSync();
    if (!store.snapshots || store.snapshots.length === 0) {
      return { snapshot: null, meta: null };
    }
    const sorted = [...store.snapshots].sort((a, b) => b.version_number - a.version_number);
    const latest = sorted[0];
    const parsed = safeJsonParse<PublicWebsiteSnapshot | null>(latest.snapshot_json, null);
    const { snapshot_json, ...meta } = latest;
    return { snapshot: parsed, meta };
  },

  async updateSettings(data: Partial<PublicSiteSettings>, operatorId: number): Promise<PublicSiteSettings> {
    await ensureMySQLTablesAndSync();
    const now = new Date().toISOString();
    const s = store.settings;

    if (data.hotel_name !== undefined) s.hotel_name = sanitizeText(data.hotel_name, 255);
    if (data.tagline !== undefined) s.tagline = sanitizeText(data.tagline, 255);
    if (data.short_description !== undefined) s.short_description = sanitizeText(data.short_description, 2000);
    if (data.about_title !== undefined) s.about_title = sanitizeText(data.about_title, 255);
    if (data.about_content !== undefined) s.about_content = sanitizeText(data.about_content, 15000);
    if (data.logo_url !== undefined) s.logo_url = sanitizePublicUrl(data.logo_url);
    if (data.favicon_url !== undefined) s.favicon_url = sanitizePublicUrl(data.favicon_url);
    if (data.primary_color !== undefined) s.primary_color = sanitizeText(data.primary_color, 30);
    if (data.accent_color !== undefined) s.accent_color = sanitizeText(data.accent_color, 30);
    if (data.contact_phone !== undefined) s.contact_phone = sanitizeText(data.contact_phone, 100);
    if (data.whatsapp_number !== undefined) s.whatsapp_number = sanitizeText(data.whatsapp_number, 100);
    if (data.contact_email !== undefined) s.contact_email = sanitizeText(data.contact_email, 255);
    if (data.address_line !== undefined) s.address_line = sanitizeText(data.address_line, 500);
    if (data.city !== undefined) s.city = sanitizeText(data.city, 120);
    if (data.country !== undefined) s.country = sanitizeText(data.country, 120);
    if (data.postal_code !== undefined) s.postal_code = sanitizeText(data.postal_code, 40);
    if (data.google_maps_url !== undefined) s.google_maps_url = sanitizePublicUrl(data.google_maps_url);
    if (data.google_maps_embed_url !== undefined) s.google_maps_embed_url = sanitizePublicUrl(data.google_maps_embed_url);
    if (data.social_links !== undefined && typeof data.social_links === 'object') {
      s.social_links = {
        facebook: sanitizePublicUrl(data.social_links.facebook),
        instagram: sanitizePublicUrl(data.social_links.instagram),
        twitter: sanitizePublicUrl(data.social_links.twitter),
        linkedin: sanitizePublicUrl(data.social_links.linkedin),
        youtube: sanitizePublicUrl(data.social_links.youtube),
        tiktok: sanitizePublicUrl(data.social_links.tiktok),
        wechat: sanitizeText(data.social_links.wechat, 120),
        tripadvisor: sanitizePublicUrl(data.social_links.tripadvisor),
      };
    }
    if (data.reservation_url !== undefined) s.reservation_url = sanitizePublicUrl(data.reservation_url);
    if (data.reservation_button_text !== undefined) s.reservation_button_text = sanitizeText(data.reservation_button_text, 100);
    if (data.check_in_time !== undefined) s.check_in_time = sanitizeText(data.check_in_time, 100);
    if (data.check_out_time !== undefined) s.check_out_time = sanitizeText(data.check_out_time, 100);
    if (data.cancellation_policy !== undefined) s.cancellation_policy = sanitizeText(data.cancellation_policy, 3000);
    if (data.general_policies !== undefined) s.general_policies = sanitizeText(data.general_policies, 8000);
    if (data.footer_text !== undefined) s.footer_text = sanitizeText(data.footer_text, 1000);
    if (data.copyright_text !== undefined) s.copyright_text = sanitizeText(data.copyright_text, 255);
    if (data.hero_heading !== undefined) s.hero_heading = sanitizeText(data.hero_heading, 255);
    if (data.hero_subtitle !== undefined) s.hero_subtitle = sanitizeText(data.hero_subtitle, 1000);
    if (data.hero_image_url !== undefined) s.hero_image_url = sanitizePublicUrl(data.hero_image_url);
    if (data.hero_cta_text !== undefined) s.hero_cta_text = sanitizeText(data.hero_cta_text, 100);
    if (data.hero_cta_link !== undefined) s.hero_cta_link = sanitizePublicUrl(data.hero_cta_link);
    if (data.hero_secondary_cta_text !== undefined) s.hero_secondary_cta_text = sanitizeText(data.hero_secondary_cta_text, 100);
    if (data.hero_secondary_cta_link !== undefined) s.hero_secondary_cta_link = sanitizePublicUrl(data.hero_secondary_cta_link);
    if (data.welcome_heading !== undefined) s.welcome_heading = sanitizeText(data.welcome_heading, 255);
    if (data.welcome_body !== undefined) s.welcome_body = sanitizeText(data.welcome_body, 6000);
    if (Array.isArray(data.homepage_sections)) {
      s.homepage_sections = data.homepage_sections.map((sec, idx) => ({
        id: sec.id,
        label: sanitizeText(sec.label, 80),
        enabled: Boolean(sec.enabled),
        order: Number(sec.order ?? idx + 1),
      }));
    }
    if (Array.isArray(data.nav_links)) {
      s.nav_links = data.nav_links.map(l => ({
        label: sanitizeText(l.label, 80),
        href: sanitizePublicUrl(l.href) || '#',
        visible: Boolean(l.visible),
      }));
    }
    if (Array.isArray(data.footer_links)) {
      s.footer_links = data.footer_links.map(l => ({
        label: sanitizeText(l.label, 80),
        href: sanitizePublicUrl(l.href) || '#',
        visible: Boolean(l.visible),
      }));
    }
    if (data.seo_title !== undefined) s.seo_title = sanitizeText(data.seo_title, 255);
    if (data.seo_description !== undefined) s.seo_description = sanitizeText(data.seo_description, 500);
    if (data.og_title !== undefined) s.og_title = sanitizeText(data.og_title, 255);
    if (data.og_description !== undefined) s.og_description = sanitizeText(data.og_description, 500);
    if (data.og_image_url !== undefined) s.og_image_url = sanitizePublicUrl(data.og_image_url);
    if (data.canonical_domain !== undefined) s.canonical_domain = sanitizePublicUrl(data.canonical_domain);
    if (data.robots_indexing !== undefined) s.robots_indexing = sanitizeText(data.robots_indexing, 50);
    if (data.sitemap_enabled !== undefined) s.sitemap_enabled = data.sitemap_enabled ? 1 : 0;
    if (data.public_site_url !== undefined) s.public_site_url = sanitizePublicUrl(data.public_site_url);

    s.has_unpublished_changes = 1;
    if (s.site_status === 'Unpublished') {
      s.site_status = 'Draft';
    }
    s.last_edited_by = operatorId;
    s.last_edited_at = now;
    s.updated_at = now;

    saveStore(store);

    const { pool, isConnected } = getMySQLPool();
    if (pool && isConnected) {
      try {
        await pool.query(
          `UPDATE public_site_settings SET
            site_status = ?, has_unpublished_changes = ?, hotel_name = ?, tagline = ?,
            short_description = ?, about_title = ?, about_content = ?, logo_url = ?, favicon_url = ?,
            primary_color = ?, accent_color = ?, contact_phone = ?, whatsapp_number = ?, contact_email = ?,
            address_line = ?, city = ?, country = ?, postal_code = ?, google_maps_url = ?, google_maps_embed_url = ?,
            social_links_json = ?, reservation_url = ?, reservation_button_text = ?,
            check_in_time = ?, check_out_time = ?, cancellation_policy = ?, general_policies = ?,
            footer_text = ?, copyright_text = ?, hero_heading = ?, hero_subtitle = ?, hero_image_url = ?,
            hero_cta_text = ?, hero_cta_link = ?, hero_secondary_cta_text = ?, hero_secondary_cta_link = ?,
            welcome_heading = ?, welcome_body = ?, homepage_sections_json = ?, nav_links_json = ?, footer_links_json = ?,
            seo_title = ?, seo_description = ?, og_title = ?, og_description = ?, og_image_url = ?,
            canonical_domain = ?, robots_indexing = ?, sitemap_enabled = ?, public_site_url = ?,
            last_edited_by = ?, last_edited_at = NOW()
          WHERE id = 1`,
          [
            s.site_status, s.has_unpublished_changes, s.hotel_name, s.tagline,
            s.short_description, s.about_title, s.about_content, s.logo_url, s.favicon_url,
            s.primary_color, s.accent_color, s.contact_phone, s.whatsapp_number, s.contact_email,
            s.address_line, s.city, s.country, s.postal_code, s.google_maps_url, s.google_maps_embed_url,
            JSON.stringify(s.social_links || {}), s.reservation_url, s.reservation_button_text,
            s.check_in_time, s.check_out_time, s.cancellation_policy, s.general_policies,
            s.footer_text, s.copyright_text, s.hero_heading, s.hero_subtitle, s.hero_image_url,
            s.hero_cta_text, s.hero_cta_link, s.hero_secondary_cta_text, s.hero_secondary_cta_link,
            s.welcome_heading, s.welcome_body, JSON.stringify(s.homepage_sections || []),
            JSON.stringify(s.nav_links || []), JSON.stringify(s.footer_links || []),
            s.seo_title, s.seo_description, s.og_title, s.og_description, s.og_image_url,
            s.canonical_domain, s.robots_indexing, s.sitemap_enabled, s.public_site_url,
            operatorId,
          ]
        );
      } catch (err: any) {
        console.warn('[PublicSiteCMS] Failed to update settings in MySQL:', err.message);
      }
    }

    dbService.logActivity(operatorId, 'UPDATE', 'SETTINGS', 1, 'Updated Public Hotel Website draft settings');
    return s;
  },

  async markDraftChanged(operatorId: number) {
    const now = new Date().toISOString();
    store.settings.has_unpublished_changes = 1;
    if (store.settings.site_status === 'Unpublished') {
      store.settings.site_status = 'Draft';
    }
    store.settings.last_edited_by = operatorId;
    store.settings.last_edited_at = now;
    store.settings.updated_at = now;
    saveStore(store);

    const { pool, isConnected } = getMySQLPool();
    if (pool && isConnected) {
      await pool.query(
        'UPDATE public_site_settings SET has_unpublished_changes = 1, site_status = ?, last_edited_by = ?, last_edited_at = NOW() WHERE id = 1',
        [store.settings.site_status, operatorId]
      ).catch(() => {});
    }
  },

  // --------------------------------------------------------------------------
  // Website Pages Management
  // --------------------------------------------------------------------------
  async updatePage(slug: string, data: Partial<PublicSitePage>, operatorId: number): Promise<PublicSitePage | null> {
    await ensureMySQLTablesAndSync();
    const page = store.pages.find(p => p.slug === slug);
    if (!page) return null;

    const now = new Date().toISOString();
    if (data.title !== undefined) page.title = sanitizeText(data.title, 255);
    if (data.heading !== undefined) page.heading = sanitizeText(data.heading, 255);
    if (data.subheading !== undefined) page.subheading = sanitizeText(data.subheading, 1000);
    if (data.hero_image_url !== undefined) page.hero_image_url = sanitizePublicUrl(data.hero_image_url);
    if (data.content_body !== undefined) page.content_body = sanitizeText(data.content_body, 15000);
    if (data.structured_data !== undefined && typeof data.structured_data === 'object') {
      page.structured_data = data.structured_data;
    }
    if (data.seo_title !== undefined) page.seo_title = sanitizeText(data.seo_title, 255);
    if (data.seo_description !== undefined) page.seo_description = sanitizeText(data.seo_description, 500);
    if (data.is_visible !== undefined) page.is_visible = data.is_visible ? 1 : 0;
    if (data.show_in_nav !== undefined) page.show_in_nav = data.show_in_nav ? 1 : 0;
    if (data.show_in_footer !== undefined) page.show_in_footer = data.show_in_footer ? 1 : 0;
    if (data.display_order !== undefined) page.display_order = Number(data.display_order) || page.display_order;
    page.updated_at = now;

    await this.markDraftChanged(operatorId);

    const { pool, isConnected } = getMySQLPool();
    if (pool && isConnected) {
      await pool.query(
        `UPDATE public_site_pages SET
          title = ?, heading = ?, subheading = ?, hero_image_url = ?, content_body = ?,
          structured_data_json = ?, seo_title = ?, seo_description = ?,
          is_visible = ?, show_in_nav = ?, show_in_footer = ?, display_order = ?
        WHERE slug = ?`,
        [
          page.title, page.heading, page.subheading, page.hero_image_url, page.content_body,
          JSON.stringify(page.structured_data || {}), page.seo_title, page.seo_description,
          page.is_visible, page.show_in_nav, page.show_in_footer, page.display_order, page.slug,
        ]
      ).catch((e: any) => console.warn('[PublicSiteCMS] Failed to update page in MySQL:', e.message));
    }

    return page;
  },

  // --------------------------------------------------------------------------
  // Multi-Hotel Directory Management & CRM Partner Hotel Sync
  // --------------------------------------------------------------------------
  async createHotel(data: Partial<PublicSiteHotel>, operatorId: number): Promise<PublicSiteHotel> {
    await ensureMySQLTablesAndSync();
    if (!store.hotels) store.hotels = [];
    const now = new Date().toISOString();
    const maxId = store.hotels.reduce((m, h) => Math.max(m, h.id), 0);
    const id = Math.max(store.nextIds.hotels || 1, maxId + 1);
    store.nextIds.hotels = id + 1;

    const name = sanitizeText(data.name, 255);
    if (!name) throw new Error('Hotel name is required');

    let baseSlug = sanitizeText(
      data.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      255
    ) || `hotel-${id}`;
    // Ensure slug uniqueness
    if (store.hotels.some(h => h.slug === baseSlug)) {
      baseSlug = `${baseSlug}-${id}`;
    }

    const hotel: PublicSiteHotel = {
      id,
      crm_hotel_id: data.crm_hotel_id ? Number(data.crm_hotel_id) : null,
      name,
      slug: baseSlug,
      city: sanitizeText(data.city, 120),
      country: sanitizeText(data.country, 120),
      address: sanitizeText(data.address, 500),
      star_rating: Math.min(5, Math.max(1, Number(data.star_rating || 5))),
      short_description: sanitizeText(data.short_description, 1000),
      full_description: sanitizeText(data.full_description, 12000),
      featured_image_url: sanitizePublicUrl(data.featured_image_url),
      gallery_images: Array.isArray(data.gallery_images)
        ? data.gallery_images.map(u => sanitizePublicUrl(u)).filter(Boolean)
        : [],
      amenities: Array.isArray(data.amenities)
        ? data.amenities.map(a => sanitizeText(a, 120)).filter(Boolean)
        : ['Free High-Speed Wi-Fi', '24-Hour Front Desk', 'Air Conditioning', 'Daily Housekeeping'],
      check_in_time: sanitizeText(data.check_in_time, 100) || '14:00',
      check_out_time: sanitizeText(data.check_out_time, 100) || '12:00',
      cancellation_policy: sanitizeText(data.cancellation_policy, 3000),
      contact_phone: sanitizeText(data.contact_phone, 100),
      whatsapp_number: sanitizeText(data.whatsapp_number, 100),
      contact_email: sanitizeText(data.contact_email, 255),
      google_maps_url: sanitizePublicUrl(data.google_maps_url),
      google_maps_embed_url: sanitizePublicUrl(data.google_maps_embed_url),
      starting_price:
        data.starting_price !== undefined && data.starting_price !== null && String(data.starting_price).trim() !== ''
          ? Number(data.starting_price)
          : null,
      currency: sanitizeText(data.currency, 16) || 'USD',
      is_featured: data.is_featured !== undefined ? (data.is_featured ? 1 : 0) : 1,
      is_visible: data.is_visible !== undefined ? (data.is_visible ? 1 : 0) : 1,
      display_order: data.display_order !== undefined ? Number(data.display_order) : store.hotels.length + 1,
      created_at: now,
      updated_at: now,
    };

    store.hotels.push(hotel);
    await this.markDraftChanged(operatorId);

    const { pool, isConnected } = getMySQLPool();
    if (pool && isConnected) {
      await pool.query(
        `INSERT INTO public_site_hotels (
          id, crm_hotel_id, name, slug, city, country, address, star_rating,
          short_description, full_description, featured_image_url, gallery_images_json,
          amenities_json, check_in_time, check_out_time, cancellation_policy,
          contact_phone, whatsapp_number, contact_email, google_maps_url, google_maps_embed_url,
          starting_price, currency, is_featured, is_visible, display_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          hotel.id, hotel.crm_hotel_id, hotel.name, hotel.slug, hotel.city, hotel.country,
          hotel.address, hotel.star_rating, hotel.short_description, hotel.full_description,
          hotel.featured_image_url, JSON.stringify(hotel.gallery_images),
          JSON.stringify(hotel.amenities), hotel.check_in_time, hotel.check_out_time,
          hotel.cancellation_policy, hotel.contact_phone, hotel.whatsapp_number,
          hotel.contact_email, hotel.google_maps_url, hotel.google_maps_embed_url,
          hotel.starting_price, hotel.currency, hotel.is_featured, hotel.is_visible, hotel.display_order,
        ]
      ).catch((e: any) => console.warn('[PublicSiteCMS] Failed to insert hotel in MySQL:', e.message));
    }

    return hotel;
  },

  async updateHotel(id: number, data: Partial<PublicSiteHotel>, operatorId: number): Promise<PublicSiteHotel | null> {
    await ensureMySQLTablesAndSync();
    const hotel = (store.hotels || []).find(h => h.id === id);
    if (!hotel) return null;

    if (data.name !== undefined) hotel.name = sanitizeText(data.name, 255);
    if (data.slug !== undefined) {
      const cleanSlug = sanitizeText(
        data.slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        255
      );
      if (cleanSlug) hotel.slug = cleanSlug;
    }
    if (data.city !== undefined) hotel.city = sanitizeText(data.city, 120);
    if (data.country !== undefined) hotel.country = sanitizeText(data.country, 120);
    if (data.address !== undefined) hotel.address = sanitizeText(data.address, 500);
    if (data.star_rating !== undefined) hotel.star_rating = Math.min(5, Math.max(1, Number(data.star_rating || 5)));
    if (data.short_description !== undefined) hotel.short_description = sanitizeText(data.short_description, 1000);
    if (data.full_description !== undefined) hotel.full_description = sanitizeText(data.full_description, 12000);
    if (data.featured_image_url !== undefined) hotel.featured_image_url = sanitizePublicUrl(data.featured_image_url);
    if (Array.isArray(data.gallery_images)) {
      hotel.gallery_images = data.gallery_images.map(u => sanitizePublicUrl(u)).filter(Boolean);
    }
    if (Array.isArray(data.amenities)) {
      hotel.amenities = data.amenities.map(a => sanitizeText(a, 120)).filter(Boolean);
    }
    if (data.check_in_time !== undefined) hotel.check_in_time = sanitizeText(data.check_in_time, 100);
    if (data.check_out_time !== undefined) hotel.check_out_time = sanitizeText(data.check_out_time, 100);
    if (data.cancellation_policy !== undefined) hotel.cancellation_policy = sanitizeText(data.cancellation_policy, 3000);
    if (data.contact_phone !== undefined) hotel.contact_phone = sanitizeText(data.contact_phone, 100);
    if (data.whatsapp_number !== undefined) hotel.whatsapp_number = sanitizeText(data.whatsapp_number, 100);
    if (data.contact_email !== undefined) hotel.contact_email = sanitizeText(data.contact_email, 255);
    if (data.google_maps_url !== undefined) hotel.google_maps_url = sanitizePublicUrl(data.google_maps_url);
    if (data.google_maps_embed_url !== undefined) hotel.google_maps_embed_url = sanitizePublicUrl(data.google_maps_embed_url);
    if (data.starting_price !== undefined) {
      hotel.starting_price =
        data.starting_price !== null && String(data.starting_price).trim() !== ''
          ? Number(data.starting_price)
          : null;
    }
    if (data.currency !== undefined) hotel.currency = sanitizeText(data.currency, 16) || 'USD';
    if (data.is_featured !== undefined) hotel.is_featured = data.is_featured ? 1 : 0;
    if (data.is_visible !== undefined) hotel.is_visible = data.is_visible ? 1 : 0;
    if (data.display_order !== undefined) hotel.display_order = Number(data.display_order);
    hotel.updated_at = new Date().toISOString();

    await this.markDraftChanged(operatorId);

    const { pool, isConnected } = getMySQLPool();
    if (pool && isConnected) {
      await pool.query(
        `UPDATE public_site_hotels SET
          name = ?, slug = ?, city = ?, country = ?, address = ?, star_rating = ?,
          short_description = ?, full_description = ?, featured_image_url = ?,
          gallery_images_json = ?, amenities_json = ?, check_in_time = ?, check_out_time = ?,
          cancellation_policy = ?, contact_phone = ?, whatsapp_number = ?, contact_email = ?,
          google_maps_url = ?, google_maps_embed_url = ?, starting_price = ?, currency = ?,
          is_featured = ?, is_visible = ?, display_order = ?
        WHERE id = ?`,
        [
          hotel.name, hotel.slug, hotel.city, hotel.country, hotel.address, hotel.star_rating,
          hotel.short_description, hotel.full_description, hotel.featured_image_url,
          JSON.stringify(hotel.gallery_images), JSON.stringify(hotel.amenities),
          hotel.check_in_time, hotel.check_out_time, hotel.cancellation_policy,
          hotel.contact_phone, hotel.whatsapp_number, hotel.contact_email,
          hotel.google_maps_url, hotel.google_maps_embed_url,
          hotel.starting_price, hotel.currency, hotel.is_featured, hotel.is_visible,
          hotel.display_order, hotel.id,
        ]
      ).catch((e: any) => console.warn('[PublicSiteCMS] Failed to update hotel in MySQL:', e.message));
    }

    return hotel;
  },

  async reorderHotels(orderedIds: number[], operatorId: number): Promise<PublicSiteHotel[]> {
    await ensureMySQLTablesAndSync();
    orderedIds.forEach((id, idx) => {
      const h = (store.hotels || []).find(item => item.id === Number(id));
      if (h) h.display_order = idx + 1;
    });
    await this.markDraftChanged(operatorId);

    const { pool, isConnected } = getMySQLPool();
    if (pool && isConnected) {
      for (const h of store.hotels || []) {
        await pool.query('UPDATE public_site_hotels SET display_order = ? WHERE id = ?', [h.display_order, h.id]).catch(() => {});
      }
    }
    return [...(store.hotels || [])].sort((a, b) => a.display_order - b.display_order);
  },

  async deleteHotel(id: number, operatorId: number): Promise<boolean> {
    await ensureMySQLTablesAndSync();
    const idx = (store.hotels || []).findIndex(h => h.id === id);
    if (idx === -1) return false;
    store.hotels.splice(idx, 1);
    // Also remove rooms belonging to this hotel
    store.rooms = (store.rooms || []).filter(r => Number(r.hotel_id) !== Number(id));
    await this.markDraftChanged(operatorId);

    const { pool, isConnected } = getMySQLPool();
    if (pool && isConnected) {
      await pool.query('DELETE FROM public_site_rooms WHERE hotel_id = ?', [id]).catch(() => {});
      await pool.query('DELETE FROM public_site_hotels WHERE id = ?', [id]).catch(() => {});
    }
    return true;
  },

  /**
   * 1-Click Sync from CRM Partner Hotels (`hotels` and `hotel_rooms` tables)
   * Imports new hotels & rooms and updates blank metadata without overwriting custom photos/descriptions.
   */
  async syncFromCrmHotels(operatorId: number): Promise<{
    hotels_added: number;
    hotels_updated: number;
    rooms_added: number;
    total_public_hotels: number;
  }> {
    await ensureMySQLTablesAndSync();
    if (!store.hotels) store.hotels = [];
    if (!store.rooms) store.rooms = [];

    const crmHotels = dbService.getHotels(false) || [];
    let hotelsAdded = 0;
    let hotelsUpdated = 0;
    let roomsAdded = 0;

    for (const crmHotel of crmHotels) {
      let pubHotel = store.hotels.find(
        h =>
          (h.crm_hotel_id && Number(h.crm_hotel_id) === Number(crmHotel.id)) ||
          h.name.trim().toLowerCase() === crmHotel.name.trim().toLowerCase()
      );

      if (!pubHotel) {
        pubHotel = await this.createHotel(
          {
            crm_hotel_id: crmHotel.id,
            name: crmHotel.name,
            city: crmHotel.city || '',
            address: crmHotel.address || '',
            star_rating: crmHotel.star_rating || 5,
            short_description: crmHotel.notes || `${crmHotel.star_rating || 5}-Star partner hotel in ${crmHotel.city || 'prime city center'}.`,
            full_description:
              crmHotel.notes ||
              `${crmHotel.name} offers comfortable rooms, attentive guest service, and convenient access in ${crmHotel.city || 'the city'}. Browse our room types below and contact us directly for reservations.`,
            contact_phone: crmHotel.phone || store.settings.contact_phone || '',
            contact_email: crmHotel.email || store.settings.contact_email || '',
            whatsapp_number: store.settings.whatsapp_number || crmHotel.phone || '',
            is_visible: crmHotel.is_active === 1 ? 1 : 0,
            is_featured: 1,
          },
          operatorId
        );
        hotelsAdded++;
      } else {
        let changed = false;
        if (!pubHotel.crm_hotel_id) {
          pubHotel.crm_hotel_id = crmHotel.id;
          changed = true;
        }
        if (!pubHotel.city && crmHotel.city) {
          pubHotel.city = crmHotel.city;
          changed = true;
        }
        if (!pubHotel.address && crmHotel.address) {
          pubHotel.address = crmHotel.address;
          changed = true;
        }
        if (!pubHotel.contact_phone && crmHotel.phone) {
          pubHotel.contact_phone = crmHotel.phone;
          changed = true;
        }
        if (!pubHotel.contact_email && crmHotel.email) {
          pubHotel.contact_email = crmHotel.email;
          changed = true;
        }
        if (changed) {
          await this.updateHotel(pubHotel.id, pubHotel, operatorId);
          hotelsUpdated++;
        }
      }

      // Sync rooms for this hotel
      const crmRooms = dbService.getHotelRooms(crmHotel.id, false) || [];
      for (const crmRoom of crmRooms) {
        const existingRoom = store.rooms.find(
          r =>
            Number(r.hotel_id) === Number(pubHotel!.id) &&
            ((r.crm_room_id && Number(r.crm_room_id) === Number(crmRoom.id)) ||
              r.name.trim().toLowerCase() === crmRoom.name.trim().toLowerCase())
        );

        if (!existingRoom) {
          await this.createRoom(
            {
              hotel_id: pubHotel.id,
              crm_room_id: crmRoom.id,
              name: crmRoom.name,
              short_description: crmRoom.description || `Spacious ${crmRoom.name} at ${pubHotel.name}.`,
              full_description:
                crmRoom.description ||
                `Enjoy a relaxing stay in our ${crmRoom.name} at ${pubHotel.name}, featuring modern furnishings, comfortable bedding, and full guest amenities.`,
              capacity: `${crmRoom.capacity || 2} Guests`,
              bed_type: (crmRoom.capacity || 2) >= 2 ? 'King or Twin Beds' : '1 Queen Bed',
              room_size: '35 m²',
              amenities: ['Free Wi-Fi', 'Air Conditioning', 'En-Suite Bathroom', 'Flat-Screen TV', 'Work Desk'],
              optional_price: crmRoom.price_per_night ?? null,
              currency: crmRoom.currency || 'USD',
              price_note: 'per night',
              is_featured: 1,
              is_visible: crmRoom.is_active === 1 ? 1 : 0,
            },
            operatorId
          );
          roomsAdded++;
        }
      }
    }

    // Also attach any orphaned rooms (hotel_id === 0) to the first hotel if one exists
    if (store.hotels.length > 0) {
      const firstHotelId = store.hotels[0].id;
      for (const rm of store.rooms) {
        if (!rm.hotel_id || Number(rm.hotel_id) === 0) {
          await this.updateRoom(rm.id, { hotel_id: firstHotelId }, operatorId);
        }
      }
    }

    return {
      hotels_added: hotelsAdded,
      hotels_updated: hotelsUpdated,
      rooms_added: roomsAdded,
      total_public_hotels: store.hotels.length,
    };
  },

  // --------------------------------------------------------------------------
  // Rooms & Accommodation Management (Public Information Only)
  // --------------------------------------------------------------------------
  async createRoom(data: Partial<PublicSiteRoom>, operatorId: number): Promise<PublicSiteRoom> {
    await ensureMySQLTablesAndSync();
    const now = new Date().toISOString();
    const maxId = store.rooms.reduce((m, r) => Math.max(m, r.id), 0);
    const id = Math.max(store.nextIds.rooms, maxId + 1);
    store.nextIds.rooms = id + 1;

    const name = sanitizeText(data.name, 255);
    if (!name) throw new Error('Room name is required');

    const slug = sanitizeText(
      data.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      255
    );

    const defaultHotelId = store.hotels && store.hotels.length > 0 ? store.hotels[0].id : 0;
    const hotelId = data.hotel_id !== undefined && data.hotel_id !== null ? Number(data.hotel_id) : defaultHotelId;

    const room: PublicSiteRoom = {
      id,
      hotel_id: hotelId,
      crm_room_id: data.crm_room_id ? Number(data.crm_room_id) : null,
      name,
      slug,
      short_description: sanitizeText(data.short_description, 1000),
      full_description: sanitizeText(data.full_description, 8000),
      featured_image_url: sanitizePublicUrl(data.featured_image_url),
      gallery_images: Array.isArray(data.gallery_images)
        ? data.gallery_images.map(u => sanitizePublicUrl(u)).filter(Boolean)
        : [],
      capacity: sanitizeText(data.capacity, 120),
      bed_type: sanitizeText(data.bed_type, 120),
      room_size: sanitizeText(data.room_size, 80),
      amenities: Array.isArray(data.amenities)
        ? data.amenities.map(a => sanitizeText(a, 120)).filter(Boolean)
        : [],
      optional_price:
        data.optional_price !== undefined && data.optional_price !== null && String(data.optional_price).trim() !== ''
          ? Number(data.optional_price)
          : null,
      currency: sanitizeText(data.currency, 16) || 'USD',
      price_note: sanitizeText(data.price_note, 120) || 'per night (indicative)',
      enquiry_url: sanitizePublicUrl(data.enquiry_url),
      is_featured: data.is_featured ? 1 : 0,
      is_visible: data.is_visible !== undefined ? (data.is_visible ? 1 : 0) : 1,
      display_order: data.display_order !== undefined ? Number(data.display_order) : store.rooms.length + 1,
      created_at: now,
      updated_at: now,
    };

    store.rooms.push(room);
    await this.markDraftChanged(operatorId);

    const { pool, isConnected } = getMySQLPool();
    if (pool && isConnected) {
      await pool.query(
        `INSERT INTO public_site_rooms (
          id, hotel_id, crm_room_id, name, slug, short_description, full_description, featured_image_url,
          gallery_images_json, capacity, bed_type, room_size, amenities_json,
          optional_price, currency, price_note, enquiry_url, is_featured, is_visible, display_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          room.id, room.hotel_id, room.crm_room_id || null, room.name, room.slug, room.short_description, room.full_description,
          room.featured_image_url, JSON.stringify(room.gallery_images), room.capacity,
          room.bed_type, room.room_size, JSON.stringify(room.amenities),
          room.optional_price, room.currency, room.price_note, room.enquiry_url,
          room.is_featured, room.is_visible, room.display_order,
        ]
      ).catch((e: any) => console.warn('[PublicSiteCMS] Failed to insert room in MySQL:', e.message));
    }

    return room;
  },

  async updateRoom(id: number, data: Partial<PublicSiteRoom>, operatorId: number): Promise<PublicSiteRoom | null> {
    await ensureMySQLTablesAndSync();
    const room = store.rooms.find(r => r.id === id);
    if (!room) return null;

    if (data.hotel_id !== undefined) room.hotel_id = Number(data.hotel_id);
    if (data.name !== undefined) room.name = sanitizeText(data.name, 255);
    if (data.slug !== undefined) room.slug = sanitizeText(data.slug, 255);
    if (data.short_description !== undefined) room.short_description = sanitizeText(data.short_description, 1000);
    if (data.full_description !== undefined) room.full_description = sanitizeText(data.full_description, 8000);
    if (data.featured_image_url !== undefined) room.featured_image_url = sanitizePublicUrl(data.featured_image_url);
    if (Array.isArray(data.gallery_images)) {
      room.gallery_images = data.gallery_images.map(u => sanitizePublicUrl(u)).filter(Boolean);
    }
    if (data.capacity !== undefined) room.capacity = sanitizeText(data.capacity, 120);
    if (data.bed_type !== undefined) room.bed_type = sanitizeText(data.bed_type, 120);
    if (data.room_size !== undefined) room.room_size = sanitizeText(data.room_size, 80);
    if (Array.isArray(data.amenities)) {
      room.amenities = data.amenities.map(a => sanitizeText(a, 120)).filter(Boolean);
    }
    if (data.optional_price !== undefined) {
      room.optional_price =
        data.optional_price !== null && String(data.optional_price).trim() !== ''
          ? Number(data.optional_price)
          : null;
    }
    if (data.currency !== undefined) room.currency = sanitizeText(data.currency, 16) || 'USD';
    if (data.price_note !== undefined) room.price_note = sanitizeText(data.price_note, 120);
    if (data.enquiry_url !== undefined) room.enquiry_url = sanitizePublicUrl(data.enquiry_url);
    if (data.is_featured !== undefined) room.is_featured = data.is_featured ? 1 : 0;
    if (data.is_visible !== undefined) room.is_visible = data.is_visible ? 1 : 0;
    if (data.display_order !== undefined) room.display_order = Number(data.display_order);
    room.updated_at = new Date().toISOString();

    await this.markDraftChanged(operatorId);

    const { pool, isConnected } = getMySQLPool();
    if (pool && isConnected) {
      await pool.query(
        `UPDATE public_site_rooms SET
          hotel_id = ?, name = ?, slug = ?, short_description = ?, full_description = ?, featured_image_url = ?,
          gallery_images_json = ?, capacity = ?, bed_type = ?, room_size = ?, amenities_json = ?,
          optional_price = ?, currency = ?, price_note = ?, enquiry_url = ?,
          is_featured = ?, is_visible = ?, display_order = ?
        WHERE id = ?`,
        [
          room.hotel_id, room.name, room.slug, room.short_description, room.full_description, room.featured_image_url,
          JSON.stringify(room.gallery_images), room.capacity, room.bed_type, room.room_size,
          JSON.stringify(room.amenities), room.optional_price, room.currency, room.price_note,
          room.enquiry_url, room.is_featured, room.is_visible, room.display_order, room.id,
        ]
      ).catch((e: any) => console.warn('[PublicSiteCMS] Failed to update room in MySQL:', e.message));
    }

    return room;
  },

  async reorderRooms(orderedIds: number[], operatorId: number): Promise<PublicSiteRoom[]> {
    await ensureMySQLTablesAndSync();
    orderedIds.forEach((id, idx) => {
      const rm = store.rooms.find(r => r.id === Number(id));
      if (rm) rm.display_order = idx + 1;
    });
    await this.markDraftChanged(operatorId);

    const { pool, isConnected } = getMySQLPool();
    if (pool && isConnected) {
      for (const rm of store.rooms) {
        await pool.query('UPDATE public_site_rooms SET display_order = ? WHERE id = ?', [rm.display_order, rm.id]).catch(() => {});
      }
    }
    return [...store.rooms].sort((a, b) => a.display_order - b.display_order);
  },

  async deleteRoom(id: number, operatorId: number): Promise<boolean> {
    await ensureMySQLTablesAndSync();
    const idx = store.rooms.findIndex(r => r.id === id);
    if (idx === -1) return false;
    store.rooms.splice(idx, 1);
    await this.markDraftChanged(operatorId);

    const { pool, isConnected } = getMySQLPool();
    if (pool && isConnected) {
      await pool.query('DELETE FROM public_site_rooms WHERE id = ?', [id]).catch(() => {});
    }
    return true;
  },

  // --------------------------------------------------------------------------
  // Facilities & Amenities Management
  // --------------------------------------------------------------------------
  async createFacility(data: Partial<PublicSiteFacility>, operatorId: number): Promise<PublicSiteFacility> {
    await ensureMySQLTablesAndSync();
    const now = new Date().toISOString();
    const maxId = store.facilities.reduce((m, f) => Math.max(m, f.id), 0);
    const id = Math.max(store.nextIds.facilities, maxId + 1);
    store.nextIds.facilities = id + 1;

    const name = sanitizeText(data.name, 255);
    if (!name) throw new Error('Facility name is required');

    const facility: PublicSiteFacility = {
      id,
      name,
      category: sanitizeText(data.category, 100) || 'General',
      description: sanitizeText(data.description, 1000),
      icon_name: sanitizeText(data.icon_name, 80) || 'Sparkles',
      image_url: sanitizePublicUrl(data.image_url),
      is_featured: data.is_featured !== undefined ? (data.is_featured ? 1 : 0) : 1,
      is_visible: data.is_visible !== undefined ? (data.is_visible ? 1 : 0) : 1,
      display_order: data.display_order !== undefined ? Number(data.display_order) : store.facilities.length + 1,
      created_at: now,
      updated_at: now,
    };

    store.facilities.push(facility);
    await this.markDraftChanged(operatorId);

    const { pool, isConnected } = getMySQLPool();
    if (pool && isConnected) {
      await pool.query(
        `INSERT INTO public_site_facilities (id, name, category, description, icon_name, image_url, is_featured, is_visible, display_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          facility.id, facility.name, facility.category, facility.description,
          facility.icon_name, facility.image_url, facility.is_featured, facility.is_visible, facility.display_order,
        ]
      ).catch((e: any) => console.warn('[PublicSiteCMS] Failed to insert facility in MySQL:', e.message));
    }

    return facility;
  },

  async updateFacility(id: number, data: Partial<PublicSiteFacility>, operatorId: number): Promise<PublicSiteFacility | null> {
    await ensureMySQLTablesAndSync();
    const fac = store.facilities.find(f => f.id === id);
    if (!fac) return null;

    if (data.name !== undefined) fac.name = sanitizeText(data.name, 255);
    if (data.category !== undefined) fac.category = sanitizeText(data.category, 100);
    if (data.description !== undefined) fac.description = sanitizeText(data.description, 1000);
    if (data.icon_name !== undefined) fac.icon_name = sanitizeText(data.icon_name, 80);
    if (data.image_url !== undefined) fac.image_url = sanitizePublicUrl(data.image_url);
    if (data.is_featured !== undefined) fac.is_featured = data.is_featured ? 1 : 0;
    if (data.is_visible !== undefined) fac.is_visible = data.is_visible ? 1 : 0;
    if (data.display_order !== undefined) fac.display_order = Number(data.display_order);
    fac.updated_at = new Date().toISOString();

    await this.markDraftChanged(operatorId);

    const { pool, isConnected } = getMySQLPool();
    if (pool && isConnected) {
      await pool.query(
        `UPDATE public_site_facilities SET
          name = ?, category = ?, description = ?, icon_name = ?, image_url = ?,
          is_featured = ?, is_visible = ?, display_order = ?
         WHERE id = ?`,
        [
          fac.name, fac.category, fac.description, fac.icon_name, fac.image_url,
          fac.is_featured, fac.is_visible, fac.display_order, fac.id,
        ]
      ).catch(() => {});
    }

    return fac;
  },

  async reorderFacilities(orderedIds: number[], operatorId: number): Promise<PublicSiteFacility[]> {
    await ensureMySQLTablesAndSync();
    orderedIds.forEach((id, idx) => {
      const f = store.facilities.find(item => item.id === Number(id));
      if (f) f.display_order = idx + 1;
    });
    await this.markDraftChanged(operatorId);

    const { pool, isConnected } = getMySQLPool();
    if (pool && isConnected) {
      for (const f of store.facilities) {
        await pool.query('UPDATE public_site_facilities SET display_order = ? WHERE id = ?', [f.display_order, f.id]).catch(() => {});
      }
    }
    return [...store.facilities].sort((a, b) => a.display_order - b.display_order);
  },

  async deleteFacility(id: number, operatorId: number): Promise<boolean> {
    await ensureMySQLTablesAndSync();
    const idx = store.facilities.findIndex(f => f.id === id);
    if (idx === -1) return false;
    store.facilities.splice(idx, 1);
    await this.markDraftChanged(operatorId);

    const { pool, isConnected } = getMySQLPool();
    if (pool && isConnected) {
      await pool.query('DELETE FROM public_site_facilities WHERE id = ?', [id]).catch(() => {});
    }
    return true;
  },

  // --------------------------------------------------------------------------
  // Photo Gallery Management
  // --------------------------------------------------------------------------
  async createGalleryItem(data: Partial<PublicSiteGalleryItem>, operatorId: number): Promise<PublicSiteGalleryItem> {
    await ensureMySQLTablesAndSync();
    const now = new Date().toISOString();
    const maxId = store.gallery.reduce((m, g) => Math.max(m, g.id), 0);
    const id = Math.max(store.nextIds.gallery, maxId + 1);
    store.nextIds.gallery = id + 1;

    const imageUrl = sanitizePublicUrl(data.image_url);
    if (!imageUrl) throw new Error('Valid image URL is required');

    const item: PublicSiteGalleryItem = {
      id,
      title: sanitizeText(data.title, 255),
      caption: sanitizeText(data.caption, 500),
      alt_text: sanitizeText(data.alt_text || data.title || 'Hotel photo', 255),
      category: sanitizeText(data.category, 100) || 'Hotel',
      image_url: imageUrl,
      is_featured: data.is_featured ? 1 : 0,
      is_visible: data.is_visible !== undefined ? (data.is_visible ? 1 : 0) : 1,
      display_order: data.display_order !== undefined ? Number(data.display_order) : store.gallery.length + 1,
      created_at: now,
      updated_at: now,
    };

    store.gallery.push(item);
    await this.markDraftChanged(operatorId);

    const { pool, isConnected } = getMySQLPool();
    if (pool && isConnected) {
      await pool.query(
        `INSERT INTO public_site_gallery (id, title, caption, alt_text, category, image_url, is_featured, is_visible, display_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id, item.title, item.caption, item.alt_text, item.category,
          item.image_url, item.is_featured, item.is_visible, item.display_order,
        ]
      ).catch(() => {});
    }

    return item;
  },

  async updateGalleryItem(id: number, data: Partial<PublicSiteGalleryItem>, operatorId: number): Promise<PublicSiteGalleryItem | null> {
    await ensureMySQLTablesAndSync();
    const item = store.gallery.find(g => g.id === id);
    if (!item) return null;

    if (data.title !== undefined) item.title = sanitizeText(data.title, 255);
    if (data.caption !== undefined) item.caption = sanitizeText(data.caption, 500);
    if (data.alt_text !== undefined) item.alt_text = sanitizeText(data.alt_text, 255);
    if (data.category !== undefined) item.category = sanitizeText(data.category, 100);
    if (data.image_url !== undefined) {
      const cleanUrl = sanitizePublicUrl(data.image_url);
      if (!cleanUrl) throw new Error('Valid image URL is required');
      item.image_url = cleanUrl;
    }
    if (data.is_featured !== undefined) item.is_featured = data.is_featured ? 1 : 0;
    if (data.is_visible !== undefined) item.is_visible = data.is_visible ? 1 : 0;
    if (data.display_order !== undefined) item.display_order = Number(data.display_order);
    item.updated_at = new Date().toISOString();

    await this.markDraftChanged(operatorId);

    const { pool, isConnected } = getMySQLPool();
    if (pool && isConnected) {
      await pool.query(
        `UPDATE public_site_gallery SET
          title = ?, caption = ?, alt_text = ?, category = ?, image_url = ?,
          is_featured = ?, is_visible = ?, display_order = ?
         WHERE id = ?`,
        [
          item.title, item.caption, item.alt_text, item.category, item.image_url,
          item.is_featured, item.is_visible, item.display_order, item.id,
        ]
      ).catch(() => {});
    }

    return item;
  },

  async reorderGallery(orderedIds: number[], operatorId: number): Promise<PublicSiteGalleryItem[]> {
    await ensureMySQLTablesAndSync();
    orderedIds.forEach((id, idx) => {
      const g = store.gallery.find(item => item.id === Number(id));
      if (g) g.display_order = idx + 1;
    });
    await this.markDraftChanged(operatorId);

    const { pool, isConnected } = getMySQLPool();
    if (pool && isConnected) {
      for (const g of store.gallery) {
        await pool.query('UPDATE public_site_gallery SET display_order = ? WHERE id = ?', [g.display_order, g.id]).catch(() => {});
      }
    }
    return [...store.gallery].sort((a, b) => a.display_order - b.display_order);
  },

  async deleteGalleryItem(id: number, operatorId: number): Promise<boolean> {
    await ensureMySQLTablesAndSync();
    const idx = store.gallery.findIndex(g => g.id === id);
    if (idx === -1) return false;
    store.gallery.splice(idx, 1);
    await this.markDraftChanged(operatorId);

    const { pool, isConnected } = getMySQLPool();
    if (pool && isConnected) {
      await pool.query('DELETE FROM public_site_gallery WHERE id = ?', [id]).catch(() => {});
    }
    return true;
  },

  // --------------------------------------------------------------------------
  // FAQ Management
  // --------------------------------------------------------------------------
  async createFaq(data: Partial<PublicSiteFaq>, operatorId: number): Promise<PublicSiteFaq> {
    await ensureMySQLTablesAndSync();
    const now = new Date().toISOString();
    const maxId = store.faqs.reduce((m, q) => Math.max(m, q.id), 0);
    const id = Math.max(store.nextIds.faqs, maxId + 1);
    store.nextIds.faqs = id + 1;

    const question = sanitizeText(data.question, 500);
    const answer = sanitizeText(data.answer, 5000);
    if (!question || !answer) throw new Error('Question and answer are required');

    const faq: PublicSiteFaq = {
      id,
      question,
      answer,
      category: sanitizeText(data.category, 100) || 'General',
      is_visible: data.is_visible !== undefined ? (data.is_visible ? 1 : 0) : 1,
      display_order: data.display_order !== undefined ? Number(data.display_order) : store.faqs.length + 1,
      created_at: now,
      updated_at: now,
    };

    store.faqs.push(faq);
    await this.markDraftChanged(operatorId);

    const { pool, isConnected } = getMySQLPool();
    if (pool && isConnected) {
      await pool.query(
        `INSERT INTO public_site_faqs (id, question, answer, category, is_visible, display_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [faq.id, faq.question, faq.answer, faq.category, faq.is_visible, faq.display_order]
      ).catch(() => {});
    }

    return faq;
  },

  async updateFaq(id: number, data: Partial<PublicSiteFaq>, operatorId: number): Promise<PublicSiteFaq | null> {
    await ensureMySQLTablesAndSync();
    const faq = store.faqs.find(q => q.id === id);
    if (!faq) return null;

    if (data.question !== undefined) faq.question = sanitizeText(data.question, 500);
    if (data.answer !== undefined) faq.answer = sanitizeText(data.answer, 5000);
    if (data.category !== undefined) faq.category = sanitizeText(data.category, 100);
    if (data.is_visible !== undefined) faq.is_visible = data.is_visible ? 1 : 0;
    if (data.display_order !== undefined) faq.display_order = Number(data.display_order);
    faq.updated_at = new Date().toISOString();

    await this.markDraftChanged(operatorId);

    const { pool, isConnected } = getMySQLPool();
    if (pool && isConnected) {
      await pool.query(
        `UPDATE public_site_faqs SET question = ?, answer = ?, category = ?, is_visible = ?, display_order = ? WHERE id = ?`,
        [faq.question, faq.answer, faq.category, faq.is_visible, faq.display_order, faq.id]
      ).catch(() => {});
    }

    return faq;
  },

  async reorderFaqs(orderedIds: number[], operatorId: number): Promise<PublicSiteFaq[]> {
    await ensureMySQLTablesAndSync();
    orderedIds.forEach((id, idx) => {
      const q = store.faqs.find(item => item.id === Number(id));
      if (q) q.display_order = idx + 1;
    });
    await this.markDraftChanged(operatorId);

    const { pool, isConnected } = getMySQLPool();
    if (pool && isConnected) {
      for (const q of store.faqs) {
        await pool.query('UPDATE public_site_faqs SET display_order = ? WHERE id = ?', [q.display_order, q.id]).catch(() => {});
      }
    }
    return [...store.faqs].sort((a, b) => a.display_order - b.display_order);
  },

  async deleteFaq(id: number, operatorId: number): Promise<boolean> {
    await ensureMySQLTablesAndSync();
    const idx = store.faqs.findIndex(q => q.id === id);
    if (idx === -1) return false;
    store.faqs.splice(idx, 1);
    await this.markDraftChanged(operatorId);

    const { pool, isConnected } = getMySQLPool();
    if (pool && isConnected) {
      await pool.query('DELETE FROM public_site_faqs WHERE id = ?', [id]).catch(() => {});
    }
    return true;
  },

  // --------------------------------------------------------------------------
  // Publishing & Snapshot Workflow (Step 3, Step 5, Step 6)
  // --------------------------------------------------------------------------
  async publishWebsite(
    operator: { id: number; name: string },
    notes?: string
  ): Promise<{
    publication: PublicSitePublicationLog;
    snapshot: PublicWebsiteSnapshot;
    message: string;
  }> {
    await ensureMySQLTablesAndSync();

    // 1. Ensure portal brand name is populated (or default to Partner Hotel Collection)
    if (!store.settings.hotel_name || !store.settings.hotel_name.trim()) {
      if (store.hotels && store.hotels.length > 0) {
        store.settings.hotel_name = 'SN Travels — Partner Hotel Collection';
      } else {
        throw new Error('Please add at least one Hotel in "Hotels & Room Types" or set your Website Brand Name in General & Branding before publishing.');
      }
    }

    const now = new Date().toISOString();
    const maxVersion = store.snapshots.reduce((m, s) => Math.max(m, s.version_number), 0);
    const nextVersion = maxVersion + 1;

    // 2. Build strict allowlisted public snapshot
    const snapshotPayload = buildAllowlistedPublicSnapshot(nextVersion, now);
    const snapshotJson = JSON.stringify(snapshotPayload);
    const snapshotHash = crypto.createHash('sha256').update(snapshotJson).digest('hex');

    const maxSnapId = store.snapshots.reduce((m, s) => Math.max(m, s.id), 0);
    const snapshotId = Math.max(store.nextIds.snapshots, maxSnapId + 1);
    store.nextIds.snapshots = snapshotId + 1;

    const snapshotRecord: PublicSiteSnapshotRecord = {
      id: snapshotId,
      version_number: nextVersion,
      snapshot_hash: snapshotHash,
      snapshot_json: snapshotJson,
      published_by_user_id: operator.id,
      published_by_name: operator.name,
      notes: sanitizeText(notes, 500),
      created_at: now,
    };

    store.snapshots.unshift(snapshotRecord);

    // 3. Trigger Netlify Build Hook if configured
    const buildHookUrl = (process.env.NETLIFY_BUILD_HOOK_URL || '').trim();
    const buildHookConfigured = Boolean(buildHookUrl && buildHookUrl.startsWith('https://'));

    let buildHookTriggered = 0;
    let buildHookHttpStatus: number | null = null;
    let deploymentStatus: PublicSiteDeploymentStatus = 'Deployment Requested';
    let errorMessage: string | null = null;
    let statusMessage = '';

    if (buildHookConfigured) {
      try {
        const hookResponse = await fetch(buildHookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trigger_title: `Publish v${nextVersion} by ${operator.name}`,
          }),
          signal: AbortSignal.timeout(12000),
        });
        buildHookHttpStatus = hookResponse.status;
        if (hookResponse.ok) {
          buildHookTriggered = 1;
          deploymentStatus = 'Deployment Requested';
          statusMessage = `Snapshot v${nextVersion} saved and Netlify build hook triggered (HTTP ${hookResponse.status}). Deployment requested; completion has not yet been verified.`;
        } else {
          deploymentStatus = 'Deployment Failed';
          errorMessage = `Netlify Build Hook returned HTTP ${hookResponse.status} (${hookResponse.statusText || 'Error'}).`;
          statusMessage = `Snapshot v${nextVersion} saved in database, but Netlify build hook failed with HTTP ${hookResponse.status}. The previous live deployment remains intact.`;
        }
      } catch (hookErr: any) {
        deploymentStatus = 'Deployment Failed';
        errorMessage = `Network error triggering Netlify Build Hook: ${hookErr.message || 'Connection failed'}`;
        statusMessage = `Snapshot v${nextVersion} saved in database, but the Netlify build hook request failed. You can retry publication at any time.`;
      }
    } else {
      // Build hook not configured yet — be 100% truthful!
      deploymentStatus = 'Draft';
      errorMessage = 'NETLIFY_BUILD_HOOK_URL is not configured on the server. Snapshot v' + nextVersion + ' is saved and ready for export, but an automatic Netlify rebuild was not triggered.';
      statusMessage = `Snapshot v${nextVersion} generated and saved to MySQL. Note: NETLIFY_BUILD_HOOK_URL is not configured yet, so no automatic Netlify build was triggered.`;
    }

    const maxPubId = store.publications.reduce((m, p) => Math.max(m, p.id), 0);
    const pubId = Math.max(store.nextIds.publications, maxPubId + 1);
    store.nextIds.publications = pubId + 1;

    const pubRecord: PublicSitePublicationLog = {
      id: pubId,
      version_number: nextVersion,
      snapshot_id: snapshotId,
      initiated_by_user_id: operator.id,
      initiated_by_name: operator.name,
      deployment_status: deploymentStatus,
      build_hook_configured: buildHookConfigured ? 1 : 0,
      build_hook_triggered: buildHookTriggered,
      build_hook_http_status: buildHookHttpStatus,
      netlify_deploy_id: null,
      netlify_deploy_state: buildHookTriggered ? 'enqueued' : null,
      netlify_deploy_url: null,
      verified_at: null,
      error_message: errorMessage,
      notes: sanitizeText(notes, 500) || null,
      created_at: now,
      updated_at: now,
    };

    store.publications.unshift(pubRecord);

    // Update settings publication metadata
    store.settings.last_published_version = nextVersion;
    store.settings.last_published_at = now;
    store.settings.site_status = deploymentStatus;
    store.settings.has_unpublished_changes = 0;
    store.settings.updated_at = now;

    saveStore(store);

    // Also write the generated snapshot to hotel-public-site/src/generated/published-site-data.json
    // so local builds and previews always have the latest published snapshot artifact
    try {
      const localPublicArtifactDir = path.resolve(process.cwd(), 'hotel-public-site/src/generated');
      if (fs.existsSync(localPublicArtifactDir)) {
        fs.writeFileSync(
          path.join(localPublicArtifactDir, 'published-site-data.json'),
          JSON.stringify(snapshotPayload, null, 2),
          'utf-8'
        );
      }
    } catch {}

    const { pool, isConnected } = getMySQLPool();
    if (pool && isConnected) {
      try {
        await pool.query(
          `INSERT INTO public_site_snapshots (id, version_number, snapshot_hash, snapshot_json, published_by_user_id, published_by_name, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            snapshotRecord.id,
            snapshotRecord.version_number,
            snapshotRecord.snapshot_hash,
            snapshotRecord.snapshot_json,
            snapshotRecord.published_by_user_id,
            snapshotRecord.published_by_name,
            snapshotRecord.notes,
          ]
        );

        await pool.query(
          `INSERT INTO public_site_publications (
            id, version_number, snapshot_id, initiated_by_user_id, initiated_by_name,
            deployment_status, build_hook_configured, build_hook_triggered, build_hook_http_status,
            netlify_deploy_id, netlify_deploy_state, netlify_deploy_url, verified_at, error_message, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pubRecord.id,
            pubRecord.version_number,
            pubRecord.snapshot_id,
            pubRecord.initiated_by_user_id,
            pubRecord.initiated_by_name,
            pubRecord.deployment_status,
            pubRecord.build_hook_configured,
            pubRecord.build_hook_triggered,
            pubRecord.build_hook_http_status,
            pubRecord.netlify_deploy_id,
            pubRecord.netlify_deploy_state,
            pubRecord.netlify_deploy_url,
            pubRecord.verified_at,
            pubRecord.error_message,
            pubRecord.notes,
          ]
        );

        await pool.query(
          `UPDATE public_site_settings SET
            site_status = ?, has_unpublished_changes = 0, last_published_version = ?, last_published_at = NOW()
           WHERE id = 1`,
          [deploymentStatus, nextVersion]
        );
      } catch (err: any) {
        console.warn('[PublicSiteCMS] Failed to persist publication to MySQL:', err.message);
      }
    }

    dbService.logActivity(
      operator.id,
      'UPDATE',
      'SETTINGS',
      1,
      `Published Public Hotel Website Snapshot v${nextVersion} (Status: ${deploymentStatus})`
    );

    return {
      publication: pubRecord,
      snapshot: snapshotPayload,
      message: statusMessage,
    };
  },

  // --------------------------------------------------------------------------
  // Optional Real Netlify Deployment Verification (Step 5)
  // Queries Netlify API if NETLIFY_SITE_ID and NETLIFY_API_TOKEN are configured
  // --------------------------------------------------------------------------
  async verifyNetlifyDeployment(publicationId: number): Promise<{
    verified: boolean;
    publication: PublicSitePublicationLog | null;
    message: string;
  }> {
    await ensureMySQLTablesAndSync();
    const pub = store.publications.find(p => p.id === publicationId) || store.publications[0];
    if (!pub) {
      return { verified: false, publication: null, message: 'No publication record found to verify.' };
    }

    const siteId = (process.env.NETLIFY_SITE_ID || '').trim();
    const apiToken = (process.env.NETLIFY_API_TOKEN || '').trim();

    if (!siteId || !apiToken) {
      return {
        verified: false,
        publication: pub,
        message: 'Deployment status verification requires optional NETLIFY_SITE_ID and NETLIFY_API_TOKEN environment variables on the backend. Please check your Netlify dashboard directly to confirm build completion.',
      };
    }

    try {
      const res = await fetch(`https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}/deploys?per_page=5`, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        return {
          verified: false,
          publication: pub,
          message: `Netlify API returned HTTP ${res.status}. Could not verify deployment status automatically.`,
        };
      }

      const deploys: any[] = await res.json();
      if (!Array.isArray(deploys) || deploys.length === 0) {
        return {
          verified: false,
          publication: pub,
          message: 'No deployments returned from Netlify for this site ID.',
        };
      }

      const latestDeploy = deploys[0];
      const state = String(latestDeploy.state || '').toLowerCase();
      const now = new Date().toISOString();

      pub.netlify_deploy_id = latestDeploy.id ? String(latestDeploy.id) : null;
      pub.netlify_deploy_state = state;
      pub.netlify_deploy_url = latestDeploy.ssl_url || latestDeploy.deploy_ssl_url || latestDeploy.url || null;
      pub.verified_at = now;
      pub.updated_at = now;

      if (state === 'ready') {
        pub.deployment_status = 'Published';
        pub.error_message = null;
        store.settings.site_status = 'Published';
        if (!store.settings.public_site_url && pub.netlify_deploy_url) {
          store.settings.public_site_url = pub.netlify_deploy_url;
        }
      } else if (state === 'building' || state === 'enqueued' || state === 'uploading' || state === 'processing') {
        pub.deployment_status = 'Building';
        store.settings.site_status = 'Building';
      } else if (state === 'error') {
        pub.deployment_status = 'Deployment Failed';
        pub.error_message = latestDeploy.error_message || 'Netlify reported a build error.';
        store.settings.site_status = 'Deployment Failed';
      }

      saveStore(store);

      const { pool, isConnected } = getMySQLPool();
      if (pool && isConnected) {
        await pool.query(
          `UPDATE public_site_publications SET
            deployment_status = ?, netlify_deploy_id = ?, netlify_deploy_state = ?,
            netlify_deploy_url = ?, verified_at = NOW(), error_message = ?
           WHERE id = ?`,
          [
            pub.deployment_status,
            pub.netlify_deploy_id,
            pub.netlify_deploy_state,
            pub.netlify_deploy_url,
            pub.error_message,
            pub.id,
          ]
        ).catch(() => {});

        await pool.query(
          'UPDATE public_site_settings SET site_status = ?, public_site_url = ? WHERE id = 1',
          [store.settings.site_status, store.settings.public_site_url]
        ).catch(() => {});
      }

      return {
        verified: state === 'ready',
        publication: pub,
        message:
          state === 'ready'
            ? `Verified: Netlify deployment (${pub.netlify_deploy_id}) is live and Published.`
            : `Netlify deployment state is currently "${state}" (Status: ${pub.deployment_status}).`,
      };
    } catch (err: any) {
      return {
        verified: false,
        publication: pub,
        message: `Failed to contact Netlify API: ${err.message || 'Network error'}`,
      };
    }
  },
};
