import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatINR(n) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export const STATUS_LABEL = {
  pending: "Pending",
  confirmed: "Confirmed",
  in_service: "In service",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const STATUS_COLOR = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  in_service: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-[#F1EBE1] text-[#1E3F2D] border-[#E5DFD3]",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
};
