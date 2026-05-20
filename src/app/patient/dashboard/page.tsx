import { getPatientDashboardData } from "@/lib/dal/patient";
import { getDoctorsList } from "@/app/actions/patient";
import PatientDashboardClient from "./PatientDashboardClient";

export default async function PatientDashboardPage() {
  const { patient } = await getPatientDashboardData();
  const doctorsRes = await getDoctorsList();
  
  const doctors = doctorsRes.success ? doctorsRes.doctors || [] : [];

  // Convert Date objects to serialized format for Client Component if needed,
  // next.js 16 handles Date objects in Server Actions/Props safely, but let's make sure types match.
  const serializedPatient = {
    ...patient,
    bookings: patient.bookings.map((booking) => ({
      ...booking,
      scheduledAt: new Date(booking.scheduledAt),
      createdAt: new Date(booking.createdAt),
    })),
  };

  const serializedDoctors = doctors.map((doc) => ({
    id: doc.id,
    name: doc.name,
    specialty: doc.specialty,
    availability: doc.availability,
    consultFee: doc.consultFee !== null ? Number(doc.consultFee) : null,
  }));

  return (
    <PatientDashboardClient
      patient={serializedPatient}
      doctors={serializedDoctors}
    />
  );
}
