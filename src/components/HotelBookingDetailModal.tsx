import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  Calendar,
  User,
  BedDouble,
  Clock,
  Printer,
  CheckCircle2,
  Trash2,
  AlertCircle,
  MapPin,
  Phone,
  Mail,
  Edit2,
  FileText,
  Sparkles,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { HotelBooking, HotelBookingStatus } from '../types';
import { ClientAvatar } from './ClientAvatar';
import { api } from '../services/api';

interface HotelBookingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: HotelBooking | null;
  onUpdated: () => void;
  onOpenClient?: (clientId: number) => void;
}

export const HotelBookingDetailModal: React.FC<HotelBookingDetailModalProps> = ({
  isOpen,
  onClose,
  booking,
  onUpdated,
  onOpenClient,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState<HotelBookingStatus>(booking?.status || 'Confirmed');
  const [comment, setComment] = useState(booking?.comment || '');
  const [checkInDate, setCheckInDate] = useState(booking?.check_in_date ? String(booking.check_in_date).slice(0, 10) : '');
  const [checkOutDate, setCheckOutDate] = useState(booking?.check_out_date ? String(booking.check_out_date).slice(0, 10) : '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (booking) {
      setStatus(booking.status);
      setComment(booking.comment || '');
      setCheckInDate(booking.check_in_date ? String(booking.check_in_date).slice(0, 10) : '');
      setCheckOutDate(booking.check_out_date ? String(booking.check_out_date).slice(0, 10) : '');
      setIsEditing(false);
      setDeleteConfirm(false);
      setErrorMsg(null);
    }
  }, [booking, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const nights = React.useMemo(() => {
    if (!checkInDate || !checkOutDate) return 0;
    const diff = new Date(checkOutDate).getTime() - new Date(checkInDate).getTime();
    const days = Math.round(diff / (1000 * 60 * 60 * 24));
    return days >= 0 ? days : 0;
  }, [checkInDate, checkOutDate]);

  if (!isOpen || !booking) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (checkOutDate < checkInDate) {
      setErrorMsg('Check-out date cannot be earlier than check-in date');
      return;
    }

    try {
      setSaving(true);
      await api.updateHotelBooking(booking.id, {
        status,
        comment: comment.trim() || null,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
      });
      setIsEditing(false);
      onUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update booking');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await api.deleteHotelBooking(booking.id);
      onUpdated();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete booking');
    } finally {
      setDeleting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (st: HotelBookingStatus) => {
    switch (st) {
      case 'Confirmed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Checked In':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Checked Out':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Cancelled':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200 cursor-pointer"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-800 to-emerald-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/20">
              <Building2 className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">{booking.hotel_name}</h2>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(booking.status)}`}>
                  {booking.status}
                </span>
              </div>
              <p className="text-xs text-teal-200 font-mono">Reference: {booking.booking_reference}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handlePrint}
              title="Print voucher"
              className="p-1.5 rounded-lg text-teal-200 hover:text-white hover:bg-white/10 transition"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-teal-200 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="m-5 mb-0 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isEditing ? (
          /* Edit Form */
          <form onSubmit={handleSave} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Check-in Date
                </label>
                <input
                  type="date"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Check-out Date (Syncs with Calendar & Tasks)
                </label>
                <input
                  type="date"
                  value={checkOutDate}
                  min={checkInDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-semibold text-emerald-900"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Booking Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              >
                <option value="Confirmed">Confirmed</option>
                <option value="Checked In">Checked In</option>
                <option value="Checked Out">Checked Out</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Comment & Instructions
              </label>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Leave a comment or special request note..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-sm font-semibold flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes & Resync
              </button>
            </div>
          </form>
        ) : (
          /* View Details */
          <div className="p-6 space-y-6">
            {/* Customer Info Card */}
            <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <ClientAvatar
                  fullName={booking.client_name || 'Customer'}
                  photoUrl={booking.client_photo_url}
                  size="lg"
                  className="ring-2 ring-teal-600/30 shadow-sm"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">{booking.client_name}</h3>
                    <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono font-medium">
                      {booking.client_code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Passport: <span className="font-semibold text-slate-800">{booking.passport_number || 'N/A'}</span>
                  </p>
                </div>
              </div>

              {onOpenClient && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenClient(booking.client_id);
                  }}
                  className="px-3 py-1.5 text-xs bg-white border border-slate-300 text-slate-700 hover:text-teal-800 hover:border-teal-500 rounded-xl font-medium transition flex items-center gap-1.5 shadow-2xs"
                >
                  <span>View Client</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Stay Information Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-teal-50/70 border border-teal-100 rounded-xl">
                <span className="text-[11px] font-semibold text-teal-800 uppercase tracking-wider block">Check-in</span>
                <span className="text-sm font-bold text-teal-950 block mt-1">{booking.check_in_date}</span>
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl">
                <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">Check-out</span>
                <span className="text-sm font-bold text-emerald-950 block mt-1">{booking.check_out_date}</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Duration</span>
                <span className="text-sm font-bold text-slate-800 block mt-1">
                  {nights} {nights === 1 ? 'Night' : 'Nights'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Room Type</span>
                <span className="text-sm font-bold text-slate-800 block mt-1 truncate" title={booking.room_type_name || ''}>
                  {booking.room_type_name || 'Standard'}
                </span>
              </div>
            </div>

            {/* Hotel Address / City */}
            {(booking.hotel_city || booking.hotel_address) && (
              <div className="text-xs text-slate-600 flex items-start gap-1.5 px-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <span>
                  {booking.hotel_address ? `${booking.hotel_address}, ` : ''}
                  {booking.hotel_city}
                </span>
              </div>
            )}

            {/* Comment Section */}
            {booking.comment && (
              <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl">
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-700" />
                  Staff Comment & Notes
                </h4>
                <p className="text-sm text-amber-950 leading-relaxed whitespace-pre-line">{booking.comment}</p>
              </div>
            )}

            {/* Calendar & Tasks Synchronization Status */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600 shrink-0" />
                <span>
                  Check-out is synced with <strong>Calendar</strong> & <strong>Tasks</strong> for{' '}
                  <span className="font-semibold text-teal-800">{booking.check_out_date}</span>
                </span>
              </span>
              <span className="text-[11px] bg-teal-100 text-teal-800 font-semibold px-2 py-0.5 rounded-full">
                Auto-Scheduled
              </span>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              {deleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-rose-600 font-medium">Delete booking?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
                  >
                    {deleting ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="px-2 py-1.5 text-slate-500 hover:text-slate-700 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(true)}
                  className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1.5 font-medium px-2 py-1 rounded-lg hover:bg-rose-50 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Booking</span>
                </button>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Dates / Status</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
