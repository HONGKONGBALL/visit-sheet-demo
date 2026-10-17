'use strict';

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayISO(from = new Date()) {
  return toISODate(new Date(from.getFullYear(), from.getMonth(), from.getDate()));
}

function shiftDays(days, from = new Date()) {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  base.setDate(base.getDate() + days);
  return toISODate(base);
}

function daysBetween(fromISO, toISO) {
  const a = isoToLocal(fromISO);
  const b = isoToLocal(toISO);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function isoToLocal(value) {
  if (!isRealISODate(value)) return null;
  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(5, 7));
  const d = Number(value.slice(8, 10));
  return new Date(y, m - 1, d);
}

function isRealISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(5, 7));
  const d = Number(value.slice(8, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function dayLabel(days) {
  if (days === 0) return 'today';
  if (days === 1) return 'in 1 day';
  if (days > 1) return `in ${days} days`;
  if (days === -1) return '1 day ago';
  return `${Math.abs(days)} days ago`;
}

module.exports = {
  toISODate,
  todayISO,
  shiftDays,
  daysBetween,
  isRealISODate,
  dayLabel
};
