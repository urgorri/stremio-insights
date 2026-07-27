/**
 * Formats a date using America/Argentina/Buenos_Aires timezone
 * and the specific format: DD-MM-YYYY HH:mm
 */
export function formatBuenosAiresDate(dateInput: string | Date | number): string {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";

  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

    const parts = dtf.formatToParts(date);
    const partMap = parts.reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {} as Record<string, string>);

    const day = partMap.day || "01";
    const month = partMap.month || "01";
    const year = partMap.year || "2026";
    const hour = partMap.hour || "00";
    const minute = partMap.minute || "00";

    return `${day}-${month}-${year} ${hour}:${minute}`;
  } catch (error) {
    // Fallback if Intl fails
    const pad = (n: number) => n.toString().padStart(2, "0");
    const d = new Date(dateInput);
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
