import { getDoctorDashboardData } from "@/lib/dal/doctor";
import DoctorDashboardClient from "./DoctorDashboardClient";

export default async function DoctorDashboardPage() {
  const { doctor } = await getDoctorDashboardData();

  // Serialize models correctly for client component boundary
  const serializedDoctor = {
    ...doctor,
    bookings: doctor.bookings
      .filter((booking) => booking.patient !== null && booking.patient !== undefined)
      .map((booking) => ({
        ...booking,
        scheduledAt: new Date(booking.scheduledAt),
        createdAt: new Date(booking.createdAt),
        patient: {
          id: booking.patient!.id,
          firstName: booking.patient!.firstName,
          lastName: booking.patient!.lastName,
          email: booking.patient!.email,
          phone: booking.patient!.phone,
          dob: booking.patient!.dob,
          gender: booking.patient!.gender,
          emailVerified: booking.patient!.emailVerified,
        },
      })),
  };

  return <DoctorDashboardClient doctor={serializedDoctor} />;
}
