import React, { useState, useEffect } from 'react';
import { Eye, X, Image as ImageIcon, ExternalLink, AlertTriangle } from 'lucide-react';
import { getGoogleDriveCandidateUrls, isGoogleDriveLink, extractGoogleDriveFileId } from '../utils/image';

interface ClientAvatarProps {
  name?: string;
  fullName?: string;
  photoUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'table' | 'lg' | 'xl';
  allowPreview?: boolean;
  className?: string;
  showStatusBadge?: boolean;
}

const sizeClasses = {
  xs: 'w-7 h-7 text-[10px] rounded-lg',
  sm: 'w-10 h-10 text-xs rounded-xl',
  md: 'w-12 h-12 text-sm rounded-xl',
  table: 'w-14 h-14 sm:w-16 sm:h-16 text-base rounded-2xl shadow-xs ring-2 ring-slate-100',
  lg: 'w-18 h-18 text-xl rounded-2xl ring-2 ring-slate-200',
  xl: 'w-24 h-24 sm:w-28 sm:h-28 text-2xl rounded-2xl ring-4 ring-white shadow-md',
};

export const ClientAvatar: React.FC<ClientAvatarProps> = ({
  name,
  fullName,
  photoUrl,
  size = 'md',
  allowPreview = true,
  className = '',
  showStatusBadge = false,
}) => {
  const effectiveName = fullName || name || 'Client';
  const candidates = getGoogleDriveCandidateUrls(photoUrl);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showLightbox) {
        setShowLightbox(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLightbox]);

  useEffect(() => {
    setCandidateIndex(0);
    setAllFailed(candidates.length === 0);
  }, [photoUrl]);

  const currentSrc = !allFailed && candidates.length > 0 ? candidates[candidateIndex] : null;
  const initial = effectiveName ? effectiveName.trim().charAt(0).toUpperCase() : '?';
  const isDrive = isGoogleDriveLink(photoUrl);
  const fileId = extractGoogleDriveFileId(photoUrl);

  const handleImageError = () => {
    if (candidateIndex + 1 < candidates.length) {
      // Try next CDN format
      setCandidateIndex((prev) => prev + 1);
    } else {
      // All candidate URLs failed to load
      setAllFailed(true);
    }
  };

  return (
    <>
      <div
        className={`relative shrink-0 overflow-hidden font-bold flex items-center justify-center select-none bg-slate-100 ${sizeClasses[size]} ${
          allowPreview && currentSrc ? 'cursor-pointer group' : ''
        } ${className}`}
        onClick={(e) => {
          if (allowPreview && currentSrc) {
            e.stopPropagation();
            setShowLightbox(true);
          }
        }}
        title={allFailed && photoUrl ? 'Photo link could not be loaded. If using Google Drive, make sure link sharing is set to "Anyone with the link".' : name}
      >
        {currentSrc ? (
          <>
            <img
              src={currentSrc}
              alt={name}
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              className="w-full h-full object-cover object-center transition duration-200 group-hover:scale-105"
              onError={handleImageError}
              loading="lazy"
            />
            {allowPreview && (
              <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <Eye className="w-5 h-5 drop-shadow" />
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-tr from-slate-900 via-sky-900 to-slate-800 text-white flex flex-col items-center justify-center shadow-xs">
            <span>{initial}</span>
            {photoUrl && allFailed && (
              <span className="text-[9px] font-normal text-amber-300 opacity-90 leading-none">!</span>
            )}
          </div>
        )}
      </div>

      {/* Lightbox Modal for Enlarge View */}
      {showLightbox && currentSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150 cursor-pointer"
          onClick={() => setShowLightbox(false)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl border border-slate-700 max-w-lg w-full overflow-hidden p-4 space-y-3 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-sky-600" />
                <span className="font-bold text-sm text-slate-900">{name} — Profile Photo</span>
              </div>
              <button
                onClick={() => setShowLightbox(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-xl overflow-hidden bg-slate-100 max-h-[70vh] flex items-center justify-center p-2 border border-slate-200">
              <img
                src={currentSrc}
                alt={name}
                referrerPolicy="no-referrer"
                className="w-full h-auto max-h-[65vh] object-contain rounded-lg shadow-xs"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>China Visa Client Identification Photo</span>
              {photoUrl && (
                <a
                  href={photoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-700 hover:text-sky-900 font-semibold flex items-center gap-1 underline"
                >
                  <span>Open Original in Drive</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
