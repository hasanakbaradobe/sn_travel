import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  Calendar,
  User,
  BedDouble,
  DollarSign,
  FileText,
  Clock,
  Sparkles,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { Client, Hotel, HotelRoom } from '../types';
import { api } from '../services/api';
import { ClientSelectSearch } from './ClientSelectSearch';

interface NewHotelBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId?: number;
  clientName?: string;
  clients: Client[];
  hotels: Hotel[];
  onBookingCreated: () => void;
  onOpenSettingsHotels?: () => void;
}

export const NewHotelBookingModal: React.FC<NewHotelBookingModalProps> = ({
  isOpen,
  onClose,
  clientId,
  clientName,
  clients,
  hotels,
  onBookingCreated,
  onOpenSettingsHotels,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const defaultCheckoutStr = new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];

  const [selectedClientId, setSelectedClientId] = useState<number | null>(clientId || null);
  const [selectedHotelId, setSelectedHotelId] = useState<number | null>(hotels[0]?.id || null);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<number | null>(null);
  const [customRoomName, setCustomRoomName] = useState('');
  const [useCustomRoom, setUseCustomRoom] = useState(false);
  const [checkInDate, setCheckInDate] = useState(todayStr);
  const [checkOutDate, setCheckOutDate] = useState(defaultCheckoutStr);
  const [guestCount, setGuestCount] = useState(1);
  const [roomCount, setRoomCount] = useState(1);
  const [status, setStatus] = useState<'Confirmed' | 'Checked In' | 'Checked Out' | 'Cancelled'>('Confirmed');
  const [totalPrice, setTotalPrice] = useState<string>('');
  const [currency, setCurrency] = useState('USD');
  const [comment, setComment] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');

  const [hotelRooms, setHotelRooms] = useState<HotelRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  // Sync incoming props and reset on open
  useEffect(() => {
    if (isOpen) {
      setSelectedClientId(clientId || null);
      if (hotels.length > 0 && !selectedHotelId) {
        setSelectedHotelId(hotels[0].id);
      }
      setCheckInDate(todayStr);
      setCheckOutDate(defaultCheckoutStr);
      setComment('');
      setSpecialRequests('');
      setTotalPrice('');
      setErrorMsg(null);
    }
  }, [isOpen, clientId, hotels, selectedHotelId]);

  // Load room types whenever hotel changes
  useEffect(() => {
    if (!selectedHotelId) {
      setHotelRooms([]);
      return;
    }
    const currentHotel = hotels.find((h) => h.id === selectedHotelId);
    if (currentHotel?.rooms && currentHotel.rooms.length > 0) {
      setHotelRooms(currentHotel.rooms);
      setSelectedRoomTypeId(currentHotel.rooms[0].id);
      if (currentHotel.rooms[0].price_per_night) {
        setTotalPrice(String(currentHotel.rooms[0].price_per_night * 3));
      }
    } else {
      setLoadingRooms(true);
      api
        .getHotelRooms(selectedHotelId, true)
        .then((rooms) => {
          setHotelRooms(rooms);
          if (rooms.length > 0) {
            setSelectedRoomTypeId(rooms[0].id);
            if (rooms[0].price_per_night) {
              setTotalPrice(String(rooms[0].price_per_night * 3));
            }
          } else {
            setSelectedRoomTypeId(null);
            setUseCustomRoom(true);
          }
        })
        .catch((err) => {
          console.error(err);
          setHotelRooms([]);
        })
        .finally(() => setLoadingRooms(false));
    }
  }, [selectedHotelId]);

  // Calculate nights
  const nights = React.useMemo(() => {
    if (!checkInDate || !checkOutDate) return 0;
    const diff = new Date(checkOutDate).getTime() - new Date(checkInDate).getTime();
    const days = Math.round(diff / (1000 * 60 * 60 * 24));
    return days >= 0 ? days : 0;
  }, [checkInDate, checkOutDate]);

  // Auto-update price when room type or nights change
  const handleRoomSelect = (roomId: number) => {
    setSelectedRoomTypeId(roomId);
    setUseCustomRoom(false);
    const room = hotelRooms.find((r) => r.id === roomId);
    if (room?.price_per_night && nights > 0) {
      setTotalPrice(String(room.price_per_night * nights * roomCount));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedClientId) {
      setErrorMsg('Please select a customer.');
      return;
    }
    if (!selectedHotelId) {
      setErrorMsg('Please select a hotel partner.');
      return;
    }
    if (!checkInDate || !checkOutDate) {
      setErrorMsg('Both check-in and check-out dates are required.');
      return;
    }
    if (checkOutDate < checkInDate) {
      setErrorMsg('Check-out date must be on or after check-in date.');
      return;
    }

    let roomTypeName: string | undefined = undefined;
    let roomTypeId: number | null = null;

    if (useCustomRoom || !selectedRoomTypeId) {
      roomTypeName = customRoomName.trim() || 'Standard Room';
    } else {
      roomTypeId = selectedRoomTypeId;
      const room = hotelRooms.find((r) => r.id === selectedRoomTypeId);
      roomTypeName = room ? room.name : undefined;
    }

    try {
      setSubmitting(true);
      await api.createHotelBooking({
        client_id: selectedClientId,
        hotel_id: selectedHotelId,
        room_type_id: roomTypeId,
        room_type_name: roomTypeName,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        guest_count: guestCount,
        room_count: roomCount,
        status,
        comment: comment.trim() || null,
        special_requests: specialRequests.trim() || null,
        total_price: totalPrice ? parseFloat(totalPrice) : null,
        currency,
      });

      onBookingCreated();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to assign hotel to customer');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentHotel = hotels.find((h) => h.id === selectedHotelId);

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
        <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white backdrop-blur-sm border border-white/20">
              <Building2 className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Assign Hotel to Customer</h2>
              <p className="text-xs text-teal-200">
                {clientName ? `Booking for: ${clientName}` : 'Create a hotel reservation & automated checkout task'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-teal-200 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Automation Notification Banner */}
          <div className="p-3.5 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200/80 rounded-xl flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-teal-700 mt-0.5 shrink-0" />
            <div className="text-xs text-teal-900 leading-relaxed">
              <span className="font-semibold text-teal-950">Automated Calendar & Task Integration:</span> The check-out
              date will be automatically scheduled on the Agency Calendar and a high-priority checkout task will be
              created for visa & travel operations staff.
            </div>
          </div>

          {/* Customer Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-teal-700" />
              Customer / Client <span className="text-rose-500">*</span>
            </label>
            <ClientSelectSearch
              clients={clients}
              selectedClientId={selectedClientId}
              onSelectClient={(cid) => setSelectedClientId(cid ? Number(cid) : null)}
              placeholder="Search customer by name, passport number, or CL-ID..."
              required
            />
          </div>

          {/* Hotel Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-teal-700" />
                  Select Hotel <span className="text-rose-500">*</span>
                </label>
                {onOpenSettingsHotels && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSettingsHotels();
                    }}
                    className="text-[11px] text-teal-700 hover:text-teal-900 font-medium hover:underline"
                  >
                    + Manage Hotels
                  </button>
                )}
              </div>
              <select
                value={selectedHotelId || ''}
                onChange={(e) => setSelectedHotelId(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              >
                {hotels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} {h.city ? `(${h.city})` : ''} {h.star_rating ? `• ${h.star_rating}★` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Room Type */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <BedDouble className="w-3.5 h-3.5 text-teal-700" />
                  Room Type <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setUseCustomRoom(!useCustomRoom)}
                  className="text-[11px] text-slate-500 hover:text-teal-700 underline"
                >
                  {useCustomRoom ? 'Pick from list' : 'Custom type'}
                </button>
              </div>

              {useCustomRoom ? (
                <input
                  type="text"
                  value={customRoomName}
                  onChange={(e) => setCustomRoomName(e.target.value)}
                  placeholder="e.g. Deluxe Twin Bed, Executive Suite"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              ) : (
                <select
                  value={selectedRoomTypeId || ''}
                  onChange={(e) => handleRoomSelect(Number(e.target.value))}
                  disabled={loadingRooms || hotelRooms.length === 0}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-100"
                >
                  {hotelRooms.length === 0 ? (
                    <option value="">No pre-set rooms (click custom type)</option>
                  ) : (
                    hotelRooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.price_per_night ? `— $${r.price_per_night}/night` : ''} (Cap: {r.capacity || 2})
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>
          </div>

          {/* Dates & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-700" />
                Check-in Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                Check-out Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={checkOutDate}
                min={checkInDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium text-emerald-900"
                required
              />
            </div>

            <div className="flex flex-col justify-end">
              <div className="px-3 py-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Duration:
                </span>
                <span className="text-sm font-bold text-teal-800">
                  {nights} {nights === 1 ? 'Night' : 'Nights'}
                </span>
              </div>
            </div>
          </div>

          {/* Occupancy & Status & Price */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Guests</label>
              <input
                type="number"
                min="1"
                max="20"
                value={guestCount}
                onChange={(e) => setGuestCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Rooms</label>
              <input
                type="number"
                min="1"
                max="10"
                value={roomCount}
                onChange={(e) => setRoomCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              >
                <option value="Confirmed">Confirmed</option>
                <option value="Checked In">Checked In</option>
                <option value="Checked Out">Checked Out</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Total ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Optional"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Comments & Special Instructions */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-teal-700" />
              Comment & Special Requests
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Leave a comment for customer, flight transfer details, late arrival note, bed preferences, luggage handling instructions..."
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder:text-slate-400"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-sm font-semibold shadow-sm hover:shadow transition flex items-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Assigning Hotel...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Assign Hotel & Schedule Checkout</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
