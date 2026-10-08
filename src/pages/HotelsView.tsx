import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  Filter,
  Calendar,
  User,
  BedDouble,
  Clock,
  Sparkles,
  CheckCircle2,
  FileText,
  MapPin,
  ChevronRight,
  Eye,
  Settings,
  LayoutGrid,
  List,
  RefreshCw,
} from 'lucide-react';
import { HotelBooking, HotelBookingStatus, Client, Hotel } from '../types';
import { ClientAvatar } from '../components/ClientAvatar';
import { api } from '../services/api';
import { NewHotelBookingModal } from '../components/NewHotelBookingModal';
import { HotelBookingDetailModal } from '../components/HotelBookingDetailModal';

interface HotelsViewProps {
  clients: Client[];
  hotels: Hotel[];
  onOpenClient: (clientId: number) => void;
  onOpenSettingsHotels?: () => void;
  searchFilter?: string;
  onRefreshData?: () => void;
}

export const HotelsView: React.FC<HotelsViewProps> = ({
  clients = [],
  hotels = [],
  onOpenClient,
  onOpenSettingsHotels,
  searchFilter = '',
  onRefreshData,
}) => {
  const [bookings, setBookings] = useState<HotelBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchFilter);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'active' | 'upcoming_checkout' | 'today'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modals
  const [newBookingModalOpen, setNewBookingModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<HotelBooking | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchBookings = async (silent: boolean = false) => {
    try {
      if (!silent && bookings.length === 0) {
        setLoading(true);
      }
      const data = await api.getHotelBookings();
      setBookings(data);
    } catch (err) {
      console.error('Failed to load hotel bookings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings(false);
  }, []);

  useEffect(() => {
    if (searchFilter) {
      setSearchTerm(searchFilter);
    }
  }, [searchFilter]);

  // Filtered Bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesClient = (b.client_name || '').toLowerCase().includes(q);
        const matchesPassport = (b.passport_number || '').toLowerCase().includes(q);
        const matchesHotel = (b.hotel_name || '').toLowerCase().includes(q);
        const matchesRef = b.booking_reference.toLowerCase().includes(q);
        const matchesComment = (b.comment || '').toLowerCase().includes(q);
        const matchesRoom = (b.room_type_name || '').toLowerCase().includes(q);
        if (!matchesClient && !matchesPassport && !matchesHotel && !matchesRef && !matchesComment && !matchesRoom) {
          return false;
        }
      }

      // Status
      if (statusFilter !== 'all' && b.status !== statusFilter) {
        return false;
      }

      // Date quick filter
      const inDate = b.check_in_date ? String(b.check_in_date).slice(0, 10) : '';
      const outDate = b.check_out_date ? String(b.check_out_date).slice(0, 10) : '';

      if (dateFilter === 'active') {
        // Stays covering today
        if (inDate > todayStr || outDate < todayStr || b.status === 'Cancelled' || b.status === 'Checked Out') {
          return false;
        }
      } else if (dateFilter === 'upcoming_checkout') {
        if (outDate < todayStr || b.status === 'Checked Out' || b.status === 'Cancelled') {
          return false;
        }
      } else if (dateFilter === 'today') {
        if (inDate !== todayStr && outDate !== todayStr) {
          return false;
        }
      }

      return true;
    });
  }, [bookings, searchTerm, statusFilter, dateFilter, todayStr]);

  // Metrics
  const activeStaysCount = useMemo(() => {
    return bookings.filter(
      (b) => {
        const inDate = b.check_in_date ? String(b.check_in_date).slice(0, 10) : '';
        const outDate = b.check_out_date ? String(b.check_out_date).slice(0, 10) : '';
        return inDate <= todayStr && outDate >= todayStr && b.status !== 'Cancelled' && b.status !== 'Checked Out';
      }
    ).length;
  }, [bookings, todayStr]);

  const upcomingCheckoutsCount = useMemo(() => {
    return bookings.filter(
      (b) => {
        const outDate = b.check_out_date ? String(b.check_out_date).slice(0, 10) : '';
        return outDate >= todayStr && b.status !== 'Cancelled' && b.status !== 'Checked Out';
      }
    ).length;
  }, [bookings, todayStr]);

  const todayCheckoutsCount = useMemo(() => {
    return bookings.filter(
      (b) => b.check_out_date === todayStr && b.status !== 'Cancelled' && b.status !== 'Checked Out'
    ).length;
  }, [bookings, todayStr]);

  const handleOpenDetail = (booking: HotelBooking) => {
    setSelectedBooking(booking);
    setDetailModalOpen(true);
  };

  const getStatusBadge = (status: HotelBookingStatus) => {
    switch (status) {
      case 'Confirmed':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Checked In':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Checked Out':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'Cancelled':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const calculateNights = (checkIn: string, checkOut: string) => {
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    const days = Math.round(diff / (1000 * 60 * 60 * 24));
    return days >= 0 ? days : 0;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner / Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Hotel Booking & Customer Assignments
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Assign partner hotels to clients with automatic Calendar & Task checkout synchronization.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {onOpenSettingsHotels && (
            <button
              onClick={onOpenSettingsHotels}
              title="Manage Hotel Partners & Room Types in Settings"
              className="px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:text-teal-800 hover:border-teal-400 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-2 shadow-2xs cursor-pointer"
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Hotel & Room Settings</span>
            </button>
          )}

          <button
            onClick={() => setNewBookingModalOpen(true)}
            className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm hover:shadow transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Assign Hotel</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Stays</span>
            <span className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <BedDouble className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{activeStaysCount}</div>
          <span className="text-[11px] text-teal-700 font-medium">Currently in hotel</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Check-outs</span>
            <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{todayCheckoutsCount}</div>
          <span className="text-[11px] text-amber-700 font-medium">Scheduled for today</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Upcoming Check-outs</span>
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{upcomingCheckoutsCount}</div>
          <span className="text-[11px] text-emerald-700 font-medium">Synced with Calendar</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Partner Hotels</span>
            <span className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{hotels.length}</div>
          <span className="text-[11px] text-sky-700 font-medium">Configured in Settings</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by client, passport, hotel, comments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
          />
        </div>

        {/* Quick Date Filters */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setDateFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              dateFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Bookings ({bookings.length})
          </button>
          <button
            onClick={() => setDateFilter('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              dateFilter === 'active' ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Active Stays ({activeStaysCount})
          </button>
          <button
            onClick={() => setDateFilter('upcoming_checkout')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              dateFilter === 'upcoming_checkout' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Upcoming Check-outs ({upcomingCheckoutsCount})
          </button>
          <button
            onClick={() => setDateFilter('today')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              dateFilter === 'today' ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Today ({todayCheckoutsCount})
          </button>
        </div>

        {/* Status Dropdown & View Mode */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">All Statuses</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Checked In">Checked In</option>
            <option value="Checked Out">Checked Out</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              title="Grid View"
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid' ? 'bg-white text-teal-800 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              title="Table View"
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'table' ? 'bg-white text-teal-800 shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bookings Display */}
      {loading && bookings.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <div className="inline-block animate-spin w-6 h-6 border-2 border-teal-700 border-t-transparent rounded-full mb-2"></div>
          <p className="text-xs text-slate-500">Loading hotel reservations...</p>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 text-base">No Hotel Bookings Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'all' || dateFilter !== 'all'
              ? 'No reservations matched your active filters. Try clearing your search.'
              : 'Assign a hotel to one of your customers. Their check-out date will automatically appear on the Calendar and create a staff task.'}
          </p>
          <button
            onClick={() => setNewBookingModalOpen(true)}
            className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold shadow-sm inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Assign First Hotel</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBookings.map((b) => {
            const nights = calculateNights(b.check_in_date, b.check_out_date);
            const isCheckoutToday = b.check_out_date === todayStr;
            const isOverdue = b.check_out_date < todayStr && b.status !== 'Checked Out' && b.status !== 'Cancelled';

            return (
              <div
                key={b.id}
                onClick={() => handleOpenDetail(b)}
                className="bg-white rounded-2xl border border-slate-200 hover:border-teal-400 p-5 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  {/* Top Header: Hotel Name + Status */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-teal-700 shrink-0" />
                        <h3 className="font-bold text-slate-900 text-sm group-hover:text-teal-900 transition">
                          {b.hotel_name}
                        </h3>
                      </div>
                      {b.hotel_city && (
                        <p className="text-[11px] text-slate-500 ml-5.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {b.hotel_city}
                        </p>
                      )}
                    </div>

                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(b.status)}`}>
                      {b.status}
                    </span>
                  </div>

                  {/* Customer Card */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 mb-3 flex items-center gap-3">
                    <ClientAvatar
                      fullName={b.client_name || 'Client'}
                      photoUrl={b.client_photo_url}
                      size="md"
                      className="ring-1 ring-slate-300"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-slate-900 truncate">{b.client_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
                        <span>{b.passport_number || b.client_code}</span>
                      </div>
                    </div>
                  </div>

                  {/* Dates & Room Info */}
                  <div className="space-y-1.5 text-xs mb-3">
                    <div className="flex items-center justify-between text-slate-600 bg-teal-50/50 p-2 rounded-lg border border-teal-100/60">
                      <span className="flex items-center gap-1 font-medium text-teal-950">
                        <Calendar className="w-3.5 h-3.5 text-teal-700" />
                        {b.check_in_date} → {b.check_out_date}
                      </span>
                      <span className="font-bold text-teal-800 bg-white px-2 py-0.5 rounded border border-teal-200 text-[11px]">
                        {nights} {nights === 1 ? 'Night' : 'Nights'}
                      </span>
                    </div>

                    {b.room_type_name && (
                      <div className="flex items-center justify-between text-[11px] text-slate-600 px-1">
                        <span className="flex items-center gap-1">
                          <BedDouble className="w-3.5 h-3.5 text-slate-400" />
                          Room:
                        </span>
                        <span className="font-semibold text-slate-800 truncate max-w-[150px]">{b.room_type_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Comment / Special Request Preview */}
                  {b.comment && (
                    <div className="p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-950 line-clamp-2 leading-relaxed mb-3 flex items-start gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-700 mt-0.5 shrink-0" />
                      <span className="italic">{b.comment}</span>
                    </div>
                  )}
                </div>

                {/* Footer Sync & Status */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1 text-slate-500">
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    <span>Check-out on Calendar & Tasks</span>
                  </span>

                  {isCheckoutToday ? (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-bold rounded-md animate-pulse">
                      Checkout Today
                    </span>
                  ) : isOverdue ? (
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded-md">Past Checkout</span>
                  ) : (
                    <span className="text-teal-700 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition">
                      <span>View</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">Ref / Hotel</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Check-in</th>
                  <th className="py-3 px-4">Check-out</th>
                  <th className="py-3 px-4">Room Type</th>
                  <th className="py-3 px-4">Comment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBookings.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => handleOpenDetail(b)}
                    className="hover:bg-teal-50/40 transition cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{b.hotel_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{b.booking_reference}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <ClientAvatar
                          fullName={b.client_name || 'Client'}
                          photoUrl={b.client_photo_url}
                          size="sm"
                        />
                        <div>
                          <div className="font-semibold text-slate-800">{b.client_name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{b.passport_number}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-medium text-slate-700">{b.check_in_date}</td>

                    <td className="py-3 px-4 font-bold text-emerald-800">
                      <div>{b.check_out_date}</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        {calculateNights(b.check_in_date, b.check_out_date)} nights
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-700">{b.room_type_name || 'Standard'}</td>

                    <td className="py-3 px-4 max-w-xs truncate text-slate-500 italic">{b.comment || '—'}</td>

                    <td className="py-3 px-4">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(b.status)}`}>
                        {b.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetail(b);
                        }}
                        className="p-1 text-slate-400 hover:text-teal-700 rounded-lg hover:bg-slate-100 transition"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <NewHotelBookingModal
        isOpen={newBookingModalOpen}
        onClose={() => setNewBookingModalOpen(false)}
        clients={clients}
        hotels={hotels}
        onBookingCreated={() => {
          fetchBookings(true);
          if (onRefreshData) onRefreshData();
        }}
        onOpenSettingsHotels={onOpenSettingsHotels}
      />

      <HotelBookingDetailModal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedBooking(null);
        }}
        booking={selectedBooking}
        onUpdated={() => {
          fetchBookings(true);
          if (onRefreshData) onRefreshData();
        }}
        onOpenClient={onOpenClient}
      />
    </div>
  );
};
