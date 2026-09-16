"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { prisma } from "@/lib/prisma";
import { getErrorMessage } from "@/lib/errors";

export interface PetProfileData {
  id?: string;
  name: string;
  species: string;
  breed: string;
  age: string;
  gender: string;
  weight: string;
  microchipId?: string;
  vaccinationStatus?: string;
  lastVaccinationDate?: string;
  rabiesTagNumber?: string;
  primaryVet?: string;
  clinicName?: string;
  clinicPhone?: string;
  allergies?: string;
  dietNotes?: string;
}

/**
 * Fetch pet profile for a patient from Supabase / Database.
 */
export async function getPetProfileByPatientId(patientId: string): Promise<{
  success: boolean;
  petProfile?: PetProfileData | null;
  error?: string;
}> {
  try {
    if (!patientId) {
      return { success: false, error: "Patient ID is required" };
    }

    // Try Prisma first
    try {
      if ((prisma as any).petProfile) {
        const doc = await (prisma as any).petProfile.findFirst({
          where: { patientId },
          orderBy: { updatedAt: "desc" },
        });

        if (doc) {
          return {
            success: true,
            petProfile: {
              id: doc.id,
              name: doc.name,
              species: doc.species,
              breed: doc.breed,
              age: doc.age,
              gender: doc.gender,
              weight: doc.weight,
              microchipId: doc.microchipId || "",
              vaccinationStatus: doc.vaccinationStatus || "",
              lastVaccinationDate: doc.lastVaccinationDate || "",
              rabiesTagNumber: doc.rabiesTagNumber || "",
              primaryVet: doc.primaryVet || "",
              clinicName: doc.clinicName || "",
              clinicPhone: doc.clinicPhone || "",
              allergies: doc.allergies || "",
              dietNotes: doc.dietNotes || "",
            },
          };
        }
      }
    } catch {
      // Fallback to Supabase direct client
    }

    // Supabase direct client
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("pet_profiles")
      .select("*")
      .eq("patient_id", patientId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      // If table does not exist or network issue, log and return empty
      console.warn("Supabase pet_profiles query note:", error.message);
      return { success: true, petProfile: null };
    }

    if (!data) {
      return { success: true, petProfile: null };
    }

    return {
      success: true,
      petProfile: {
        id: data.id,
        name: data.name,
        species: data.species || "Canine",
        breed: data.breed || "",
        age: data.age || "",
        gender: data.gender || "",
        weight: data.weight || "",
        microchipId: data.microchip_id || "",
        vaccinationStatus: data.vaccination_status || "",
        lastVaccinationDate: data.last_vaccination_date || "",
        rabiesTagNumber: data.rabies_tag_number || "",
        primaryVet: data.primary_vet || "",
        clinicName: data.clinic_name || "",
        clinicPhone: data.clinic_phone || "",
        allergies: data.allergies || "",
        dietNotes: data.diet_notes || "",
      },
    };
  } catch (error: unknown) {
    console.error("getPetProfileByPatientId error:", error);
    return {
      success: false,
      error: getErrorMessage(error, "Failed to retrieve pet profile"),
    };
  }
}

/**
 * Save or update pet profile for a patient in Supabase and Prisma.
 */
export async function savePetProfileToDatabase(
  patientId: string,
  pet: PetProfileData
): Promise<{
  success: boolean;
  petProfile?: PetProfileData;
  error?: string;
}> {
  try {
    if (!patientId) {
      return { success: false, error: "Patient ID is required" };
    }

    if (!pet.name || !pet.species || !pet.breed) {
      return { success: false, error: "Pet name, species, and breed are required" };
    }

    // 1. Save via Supabase Admin Client
    const supabase = createAdminClient();

    // Check if pet profile already exists for this patient
    const { data: existing } = await supabase
      .from("pet_profiles")
      .select("id")
      .eq("patient_id", patientId)
      .limit(1)
      .maybeSingle();

    const payload = {
      patient_id: patientId,
      name: pet.name.trim(),
      species: pet.species.trim(),
      breed: pet.breed.trim(),
      age: pet.age.trim(),
      gender: pet.gender.trim(),
      weight: pet.weight.trim(),
      microchip_id: pet.microchipId?.trim() || null,
      vaccination_status: pet.vaccinationStatus?.trim() || null,
      last_vaccination_date: pet.lastVaccinationDate?.trim() || null,
      rabies_tag_number: pet.rabiesTagNumber?.trim() || null,
      primary_vet: pet.primaryVet?.trim() || null,
      clinic_name: pet.clinicName?.trim() || null,
      clinic_phone: pet.clinicPhone?.trim() || null,
      allergies: pet.allergies?.trim() || null,
      diet_notes: pet.dietNotes?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let resultId = existing?.id;

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("pet_profiles")
        .update(payload)
        .eq("id", existing.id);

      if (updateError) {
        console.warn("Supabase pet_profiles update error:", updateError);
      }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("pet_profiles")
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertError) {
        console.warn("Supabase pet_profiles insert error:", insertError);
      } else {
        resultId = inserted?.id;
      }
    }

    // 2. Also attempt Prisma upsert if available
    try {
      if ((prisma as any).petProfile) {
        if (existing?.id) {
          await (prisma as any).petProfile.update({
            where: { id: existing.id },
            data: {
              name: payload.name,
              species: payload.species,
              breed: payload.breed,
              age: payload.age,
              gender: payload.gender,
              weight: payload.weight,
              microchipId: payload.microchip_id,
              vaccinationStatus: payload.vaccination_status,
              lastVaccinationDate: payload.last_vaccination_date,
              rabiesTagNumber: payload.rabies_tag_number,
              primaryVet: payload.primary_vet,
              clinicName: payload.clinic_name,
              clinicPhone: payload.clinic_phone,
              allergies: payload.allergies,
              dietNotes: payload.diet_notes,
            },
          });
        } else {
          const created = await (prisma as any).petProfile.create({
            data: {
              patientId,
              name: payload.name,
              species: payload.species,
              breed: payload.breed,
              age: payload.age,
              gender: payload.gender,
              weight: payload.weight,
              microchipId: payload.microchip_id,
              vaccinationStatus: payload.vaccination_status,
              lastVaccinationDate: payload.last_vaccination_date,
              rabiesTagNumber: payload.rabies_tag_number,
              primaryVet: payload.primary_vet,
              clinicName: payload.clinic_name,
              clinicPhone: payload.clinic_phone,
              allergies: payload.allergies,
              dietNotes: payload.diet_notes,
            },
          });
          resultId = resultId || created.id;
        }
      }
    } catch {
      // Prisma fallback ignored if direct Supabase client processed
    }

    return {
      success: true,
      petProfile: {
        ...pet,
        id: resultId,
      },
    };
  } catch (error: unknown) {
    console.error("savePetProfileToDatabase error:", error);
    return {
      success: false,
      error: getErrorMessage(error, "Failed to save pet profile to database"),
    };
  }
}
