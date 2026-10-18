import React, { useEffect } from 'react';
import publishedData from './generated/published-site-data.json';
import { PublicWebsiteSnapshot } from './types';
import { PublicHotelWebsiteRenderer } from './components/PublicHotelWebsiteRenderer';

export default function App() {
  const snapshot = publishedData as unknown as PublicWebsiteSnapshot;

  // Dynamically apply published SEO metadata, favicon, and canonical link
  useEffect(() => {
    if (!snapshot) return;

    const title = snapshot.seo?.title || snapshot.hotel?.name || 'Official Hotel Website';
    document.title = title;

    const setMeta = (selector: string, attr: string, content: string) => {
      if (!content) return;
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        if (selector.includes('property=')) {
          el.setAttribute('property', selector.match(/property="([^"]+)"/)?.[1] || '');
        } else {
          el.setAttribute('name', selector.match(/name="([^"]+)"/)?.[1] || '');
        }
        document.head.appendChild(el);
      }
      el.setAttribute(attr, content);
    };

    setMeta('meta[name="description"]', 'content', snapshot.seo?.description || snapshot.hotel?.short_description || '');
    setMeta('meta[name="robots"]', 'content', snapshot.seo?.robots_indexing || 'index,follow');
    setMeta('meta[property="og:title"]', 'content', snapshot.seo?.og_title || title);
    setMeta('meta[property="og:description"]', 'content', snapshot.seo?.og_description || snapshot.seo?.description || '');
    if (snapshot.seo?.og_image_url) {
      setMeta('meta[property="og:image"]', 'content', snapshot.seo.og_image_url);
    }

    if (snapshot.hotel?.favicon_url) {
      let link: HTMLLinkElement | null = document.querySelector('link[rel="icon"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = snapshot.hotel.favicon_url;
    }

    if (snapshot.seo?.canonical_domain) {
      let canonical: HTMLLinkElement | null = document.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = snapshot.seo.canonical_domain;
    }
  }, [snapshot]);

  return <PublicHotelWebsiteRenderer snapshot={snapshot} isPreview={false} />;
}
