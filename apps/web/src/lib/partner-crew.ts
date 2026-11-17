// Small pure helpers for the link a partner sends to a person on their team. Tested; the pages and routes use them.

/** The number a WhatsApp link needs: 10 digits are taken as an Indian mobile number (country code 91 added); anything with more digits is used as given. */
export function whatsappNumber(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
}

/** The message that goes with a shared link. */
export function crewShareMessage(name: string, link: string): string {
  const first = name.trim().split(/\s+/)[0];
  return `Hi${first ? ` ${first}` : ""}, please add your documents for WayTara here: ${link}`;
}
