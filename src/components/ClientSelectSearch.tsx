import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, User, Check, X, ChevronDown } from 'lucide-react';
import { Client } from '../types';
import { ClientAvatar } from './ClientAvatar';

interface ClientSelectSearchProps {
  clients: Client[];
  selectedClientId: number | '';
  onSelectClient: (clientId: number | '') => void;
  required?: boolean;
  label?: string;
  placeholder?: string;
  allowClear?: boolean;
}

export const ClientSelectSearch: React.FC<ClientSelectSearchProps> = ({
  clients,
  selectedClientId,
  onSelectClient,
  required = false,
  label = 'Select Client',
  placeholder = 'Type name, passport number, or CL-ID to search...',
  allowClear = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const selectedClient = useMemo(() => {
    return clients.find((c) => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  // Filter clients by passport number, name, ID, or country
  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) {
      return clients;
    }
    const q = searchTerm.toLowerCase().trim();
    return clients.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.passport_number.toLowerCase().includes(q) ||
        c.client_id.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q)
    );
  }, [clients, searchTerm]);

  const handleOpenDropdown = () => {
    setIsOpen(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const handleSelect = (clientId: number) => {
    onSelectClient(clientId);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectClient('');
    setSearchTerm('');
  };

  return (
    <div className="space-y-1 relative" ref={containerRef}>
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <span className="text-[11px] text-slate-400">Search by Passport or Name</span>
      </div>

      {/* Selected Client Display or Trigger Button */}
      {selectedClient ? (
        <div className="p-2.5 bg-slate-50 border border-slate-300 hover:border-sky-500 rounded-xl flex items-center justify-between transition cursor-pointer group shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0" onClick={handleOpenDropdown}>
            <ClientAvatar
              name={selectedClient.full_name}
              photoUrl={selectedClient.photo_url}
              size="sm"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-900 truncate">
                  {selectedClient.full_name}
                </span>
                <span className="font-mono text-[11px] bg-white px-1.5 py-0.2 rounded border border-slate-200 text-slate-600">
                  {selectedClient.client_id}
                </span>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <span>Passport:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {selectedClient.passport_number}
                </span>
                <span>•</span>
                <span>{selectedClient.country}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              type="button"
              onClick={handleOpenDropdown}
              className="text-xs text-sky-700 hover:text-sky-900 font-medium px-2 py-1 hover:bg-sky-50 rounded"
            >
              Change
            </button>
            {allowClear && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1 text-slate-400 hover:text-red-600 rounded"
                title="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleOpenDropdown}
          className="w-full text-left px-3.5 py-2.5 bg-white border border-slate-300 hover:border-sky-500 rounded-xl text-sm text-slate-500 flex items-center justify-between shadow-2xs transition"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <span>Search & select client by passport or name...</span>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </button>
      )}

      {/* Dropdown Menu with Search Input & Filtered Client List */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Field */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/80">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-1.5 px-1 flex items-center justify-between">
              <span>Matching {filteredClients.length} of {clients.length} clients</span>
              <span>Search: passport, full name, country</span>
            </div>
          </div>

          {/* Client List */}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
            {allowClear && (
              <button
                type="button"
                onClick={() => {
                  onSelectClient('');
                  setIsOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 text-xs text-slate-500 hover:bg-slate-50 transition"
              >
                -- None (General / Unassigned) --
              </button>
            )}

            {filteredClients.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                No clients found with passport or name "{searchTerm}"
              </div>
            ) : (
              filteredClients.map((client) => {
                const isSelected = client.id === selectedClientId;

                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleSelect(client.id)}
                    className={`w-full text-left p-2.5 transition flex items-center justify-between group ${
                      isSelected
                        ? 'bg-sky-50/80 text-sky-900 font-semibold'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ClientAvatar
                        name={client.full_name}
                        photoUrl={client.photo_url}
                        size="xs"
                        className="w-7 h-7 rounded-lg text-xs"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-900 truncate">
                            {client.full_name}
                          </span>
                          <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded">
                            {client.client_id}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span>Passport:</span>
                          <span className="font-mono font-bold text-slate-700 bg-amber-50 text-amber-900 px-1 py-0.2 rounded border border-amber-200/60">
                            {client.passport_number}
                          </span>
                          <span>•</span>
                          <span>{client.country}</span>
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-sky-700 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
