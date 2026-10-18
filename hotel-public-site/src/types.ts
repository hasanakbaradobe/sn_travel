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
  rooms: Array<{
    id: number;
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
