type ScheduleDoctor = {
  availability?: string | null;
};

type ScheduleAppointment = {
  id: string;
  scheduledAt: Date | string;
  duration?: number | null;
  status: string;
};

type AvailabilityWindow = {
  days: number[];
  startMinutes: number;
  endMinutes: number;
};

const DAY_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const DEFAULT_DURATION_MINUTES = 30;

function parseTimeToMinutes(value: string) {
  const match = value.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (!match) {
    return null;
  }

  let hour = Number(match[1]);
  const minutes = Number(match[2] || "0");
  const meridiem = match[3];

  if (hour === 12) {
    hour = 0;
  }

  if (meridiem === "pm") {
    hour += 12;
  }

  return hour * 60 + minutes;
}

function expandDays(startDay: number, endDay: number) {
  const days: number[] = [];
  let current = startDay;

  while (true) {
    days.push(current);
    if (current === endDay) {
      break;
    }
    current = (current + 1) % 7;
  }

  return days;
}

export function parseAvailability(availability?: string | null): AvailabilityWindow | null {
  if (!availability) {
    return null;
  }

  const match = availability
    .replace(/\s+/g, " ")
    .trim()
    .match(/^([A-Za-z]{3})\s*(?:-\s*([A-Za-z]{3}))?,\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))$/i);

  if (!match) {
    return null;
  }

  const startDay = DAY_INDEX[match[1].toLowerCase()];
  const endDay = DAY_INDEX[(match[2] || match[1]).toLowerCase()];
  const startMinutes = parseTimeToMinutes(match[3]);
  const endMinutes = parseTimeToMinutes(match[4]);

  if (
    startDay === undefined ||
    endDay === undefined ||
    startMinutes === null ||
    endMinutes === null ||
    startMinutes >= endMinutes
  ) {
    return null;
  }

  return {
    days: expandDays(startDay, endDay),
    startMinutes,
    endMinutes,
  };
}

function getLocalDayAndMinutes(date: Date, timeZone = "Asia/Manila") {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(date);

    let dayStr = "";
    let hour = 0;
    let minute = 0;

    for (const p of parts) {
      if (p.type === "weekday") dayStr = p.value.toLowerCase();
      else if (p.type === "hour") hour = Number(p.value);
      else if (p.type === "minute") minute = Number(p.value);
    }

    const dayIndex = DAY_INDEX[dayStr] ?? date.getDay();
    return {
      day: dayIndex,
      minutes: hour * 60 + minute,
    };
  } catch {
    return {
      day: date.getDay(),
      minutes: date.getHours() * 60 + date.getMinutes(),
    };
  }
}

export const DEFAULT_AVAILABILITY_STRING = "Mon - Fri, 09:00 AM - 05:00 PM";

export const DEFAULT_AVAILABILITY_WINDOW: AvailabilityWindow = {
  days: [1, 2, 3, 4, 5], // Monday - Friday
  startMinutes: 9 * 60,   // 9:00 AM
  endMinutes: 17 * 60,   // 5:00 PM
};

export function getEffectiveAvailabilityWindow(availability?: string | null): AvailabilityWindow {
  return parseAvailability(availability) ?? DEFAULT_AVAILABILITY_WINDOW;
}

export function isWithinDoctorAvailability(
  scheduledAt: Date,
  durationMinutes: number,
  doctor: ScheduleDoctor,
  timeZone = "Asia/Manila"
) {
  const window = getEffectiveAvailabilityWindow(doctor.availability);

  const { day, minutes: startMinutes } = getLocalDayAndMinutes(scheduledAt, timeZone);
  const endMinutes = startMinutes + durationMinutes;

  return (
    window.days.includes(day) &&
    startMinutes >= window.startMinutes &&
    endMinutes <= window.endMinutes
  );
}

export function getScheduleConflict(
  appointments: ScheduleAppointment[],
  scheduledAt: Date,
  durationMinutes = DEFAULT_DURATION_MINUTES,
  excludeAppointmentId?: string,
  allowedStatuses: string[] = ["CONFIRMED"]
) {
  const requestedStart = scheduledAt.getTime();
  const requestedEnd = requestedStart + durationMinutes * 60 * 1000;

  return appointments.find((appointment) => {
    if (appointment.id === excludeAppointmentId || !allowedStatuses.includes(appointment.status)) {
      return false;
    }

    const appointmentStart = new Date(appointment.scheduledAt).getTime();
    const appointmentDuration = appointment.duration || DEFAULT_DURATION_MINUTES;
    const appointmentEnd = appointmentStart + appointmentDuration * 60 * 1000;

    return requestedStart < appointmentEnd && requestedEnd > appointmentStart;
  });
}

export function getFullyBookedMessage() {
  return "This schedule is already fully booked. Please choose another available time slot.";
}

export function getOutsideAvailabilityMessage(availability?: string | null) {
  const display = availability && availability.toLowerCase() !== "available" ? availability : DEFAULT_AVAILABILITY_STRING;
  return `This consultation time is outside the doctor's available schedule (${display}). Please choose another available time slot.`;
}

export { DEFAULT_DURATION_MINUTES };

