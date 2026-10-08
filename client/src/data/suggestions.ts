/** Common industries for the Company Finder autocomplete */
export const INDUSTRY_SUGGESTIONS = [
  "Dentist",
  "Healthcare",
  "Doctor",
  "Clinic",
  "Hospital",
  "Pharmacy",
  "Veterinary",
  "Gym",
  "Fitness Center",
  "Yoga Studio",
  "Salon",
  "Spa",
  "Restaurant",
  "Cafe",
  "Bakery",
  "Hotel",
  "Real Estate",
  "Lawyer",
  "Accountant",
  "Insurance Agency",
  "Plumbing",
  "Electrician",
  "HVAC",
  "Auto Repair",
  "Car Dealership",
  "Retail Store",
  "Software Company",
  "Marketing Agency",
  "Construction",
  "School",
  "Daycare",
  "Photography",
  "Wedding Services",
  "Pet Grooming",
];

/** What *you* sell — optional seller offer for scoring / pitch bias */
export const PRODUCT_SUGGESTIONS = [
  "Website development",
  "Website redesign",
  "Online booking",
  "Appointment scheduling",
  "SEO",
  "Digital marketing",
  "Google Ads",
  "Social media marketing",
  "CRM software",
  "Email marketing",
  "Chatbot",
  "E-commerce store",
  "Mobile app",
  "POS system",
  "Payment processing",
];

/** Common locations for the Company Finder autocomplete */
export const LOCATION_SUGGESTIONS = [
  "Indore",
  "Indore, MP",
  "Mumbai",
  "Mumbai, MH",
  "Delhi",
  "New Delhi",
  "Bangalore",
  "Bengaluru, KA",
  "Hyderabad",
  "Chennai",
  "Pune",
  "Ahmedabad",
  "Jaipur",
  "Kolkata",
  "Chandigarh",
  "Austin, TX",
  "California City, CA",
  "Los Angeles, CA",
  "San Francisco, CA",
  "San Diego, CA",
  "New York, NY",
  "Chicago, IL",
  "Houston, TX",
  "Phoenix, AZ",
  "Seattle, WA",
  "Denver, CO",
  "Miami, FL",
  "Boston, MA",
  "Atlanta, GA",
  "Dallas, TX",
  "London, UK",
  "Toronto, ON",
  "Dubai, UAE",
  "Singapore",
];

export function filterSuggestions(
  list: string[],
  query: string,
  limit = 8
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return list.slice(0, limit);

  const starts: string[] = [];
  const contains: string[] = [];

  for (const item of list) {
    const lower = item.toLowerCase();
    if (lower.startsWith(q)) starts.push(item);
    else if (lower.includes(q)) contains.push(item);
  }

  return [...starts, ...contains].slice(0, limit);
}
