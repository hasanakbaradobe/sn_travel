/**
 * SN Travels Agency — Visa Status & Badge Helpers
 */

import { ApplicationStatus, TaskPriority } from '../types';

export interface StatusConfig {
  label: ApplicationStatus;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotClass: string;
  description: string;
}

export const STATUS_CONFIG: Record<ApplicationStatus, StatusConfig> = {
  Upcoming: {
    label: 'Upcoming',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-700',
    borderClass: 'border-slate-300',
    dotClass: 'bg-slate-400',
    description: 'Case registered, client files pending submission.',
  },
  'File Missing': {
    label: 'File Missing',
    bgClass: 'bg-rose-50',
    textClass: 'text-rose-700',
    borderClass: 'border-rose-200',
    dotClass: 'bg-rose-500',
    description: 'Mandatory documents (photos, bank statement, invitation) missing.',
  },
  'Need to Prepare': {
    label: 'Need to Prepare',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-800',
    borderClass: 'border-amber-200',
    dotClass: 'bg-amber-500',
    description: 'Documents received, staff drafting application & form COVA.',
  },
  Prepared: {
    label: 'Prepared',
    bgClass: 'bg-sky-50',
    textClass: 'text-sky-700',
    borderClass: 'border-sky-200',
    dotClass: 'bg-sky-500',
    description: 'Application package fully assembled and verified.',
  },
  'Under Review': {
    label: 'Under Review',
    bgClass: 'bg-indigo-50',
    textClass: 'text-indigo-700',
    borderClass: 'border-indigo-200',
    dotClass: 'bg-indigo-500',
    description: 'Submitted to Chinese Visa Application Center (CVASC) / Embassy.',
  },
  'Online Review Completed': {
    label: 'Online Review Completed',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-800',
    borderClass: 'border-emerald-300',
    dotClass: 'bg-emerald-500',
    description: 'Online verification passed. Target delivery date scheduled.',
  },
  Modify: {
    label: 'Modify',
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-700',
    borderClass: 'border-orange-200',
    dotClass: 'bg-orange-500',
    description: 'Consulate or client requested revisions/corrections.',
  },
  'Pending Collection': {
    label: 'Pending Collection',
    bgClass: 'bg-teal-50',
    textClass: 'text-teal-800',
    borderClass: 'border-teal-300',
    dotClass: 'bg-teal-500',
    description: 'Visa stamped. Ready for pickup or courier delivery.',
  },
  Rejected: {
    label: 'Rejected',
    bgClass: 'bg-red-100',
    textClass: 'text-red-800',
    borderClass: 'border-red-300',
    dotClass: 'bg-red-600',
    description: 'Visa refused by Chinese consular authority.',
  },
  Returned: {
    label: 'Returned',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-800',
    borderClass: 'border-emerald-300',
    dotClass: 'bg-emerald-600',
    description: 'Application completed and returned to client. Archived from active queue.',
  },
};

export function getPriorityBadge(priority: TaskPriority) {
  switch (priority) {
    case 'Urgent':
      return {
        bg: 'bg-red-50 text-red-700 border-red-200',
        dot: 'bg-red-500',
      };
    case 'High':
      return {
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
      };
    case 'Normal':
      return {
        bg: 'bg-blue-50 text-blue-700 border-blue-200',
        dot: 'bg-blue-500',
      };
    case 'Low':
      return {
        bg: 'bg-slate-50 text-slate-600 border-slate-200',
        dot: 'bg-slate-400',
      };
  }
}
