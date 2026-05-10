import { db, medicineCatalogTable, priceCatalogTable } from "@workspace/db";

const PRICE_SEED = [
  { category: "appointment", name: "Doctor appointment fee", amount: 500, description: "Default doctor appointment fee", requiredRank: null, isCustomLabelAllowed: false },
  { category: "medicine", name: "First Aid Kit", amount: 60, description: "Specialist", requiredRank: "Specialist", isCustomLabelAllowed: false },
  { category: "medicine", name: "Bandage", amount: 25, description: "Specialist medicine bandage", requiredRank: "Specialist", isCustomLabelAllowed: false },
  { category: "medicine", name: "Saline(IV)", amount: 50, description: "Specialist", requiredRank: "Specialist", isCustomLabelAllowed: false },
  { category: "medicine", name: "Generic Cream", amount: 150, description: "Custom name medicine", requiredRank: "Specialist", isCustomLabelAllowed: true },
  { category: "medicine", name: "Generic Pills", amount: 150, description: "Custom name medicine", requiredRank: "Specialist", isCustomLabelAllowed: true },
  { category: "medicine", name: "Burn Cream", amount: 150, description: "Specialist", requiredRank: "Specialist", isCustomLabelAllowed: false },
  { category: "medicine", name: "Amoxicillin", amount: 100, description: "Specialist", requiredRank: "Specialist", isCustomLabelAllowed: false },
  { category: "medicine", name: "Paracetamol", amount: 200, description: "Specialist", requiredRank: "Specialist", isCustomLabelAllowed: false },
  { category: "medicine", name: "Adrenaline", amount: 1000, description: "Only Sergeant", requiredRank: "Sergeant", isCustomLabelAllowed: false },
  { category: "medicine", name: "Painkiller", amount: 100, description: "Specialist", requiredRank: "Specialist", isCustomLabelAllowed: false },
  { category: "medicine", name: "Antibiotic", amount: 100, description: "Specialist", requiredRank: "Specialist", isCustomLabelAllowed: false },
  { category: "test", name: "Blood Test", amount: 200, description: "Specialist", requiredRank: "Specialist", isCustomLabelAllowed: false },
  { category: "test", name: "X-ray", amount: 800, description: "Specialist", requiredRank: "Specialist", isCustomLabelAllowed: false },
  { category: "test", name: "MRI", amount: 1500, description: "Specialist", requiredRank: "Specialist", isCustomLabelAllowed: false },
  { category: "test", name: "MFC", amount: 3000, description: "Specialist", requiredRank: "Specialist", isCustomLabelAllowed: false },
  { category: "treatment", name: "Bandage", amount: 200, description: "Paramedic", requiredRank: "Paramedic", isCustomLabelAllowed: false },
  { category: "treatment", name: "Plaster", amount: 500, description: "Paramedic", requiredRank: "Paramedic", isCustomLabelAllowed: false },
  { category: "treatment", name: "Wounds Dressing", amount: 100, description: "Paramedic", requiredRank: "Paramedic", isCustomLabelAllowed: false },
  { category: "surgery", name: "Laser Surgery (Full Body)", amount: 30000, description: "Sergeant and above", requiredRank: "Sergeant", isCustomLabelAllowed: false },
  { category: "surgery", name: "Laser Surgery (Head)", amount: 10000, description: "Sergeant and above", requiredRank: "Sergeant", isCustomLabelAllowed: false },
  { category: "surgery", name: "Laser Surgery (Each Hand)", amount: 5000, description: "Sergeant and above", requiredRank: "Sergeant", isCustomLabelAllowed: false },
  { category: "surgery", name: "Laser Surgery (Each Leg)", amount: 5000, description: "Sergeant and above", requiredRank: "Sergeant", isCustomLabelAllowed: false },
  { category: "surgery", name: "Laser Surgery (Body)", amount: 10000, description: "Sergeant and above", requiredRank: "Sergeant", isCustomLabelAllowed: false },
  { category: "surgery", name: "Plastic Surgery (In-city money)", amount: 150000, description: "Sergeant and above", requiredRank: "Sergeant", isCustomLabelAllowed: false },
  { category: "surgery", name: "Plastic Surgery (IRL 699Tk)", amount: 699, description: "Sergeant and above", requiredRank: "Sergeant", isCustomLabelAllowed: false },
] as const;

const MEDICINE_SEED = [
  { name: "First Aid Kit", category: "medicine", dosageForm: "kit", notes: "Specialist", requiredRank: "Specialist", defaultPrice: 60, isGenericTemplate: false },
  { name: "Bandage", category: "medicine", dosageForm: "consumable", notes: "Specialist", requiredRank: "Specialist", defaultPrice: 25, isGenericTemplate: false },
  { name: "Saline(IV)", category: "medicine", dosageForm: "iv", notes: "Specialist", requiredRank: "Specialist", defaultPrice: 50, isGenericTemplate: false },
  { name: "Generic Cream", category: "medicine", dosageForm: "cream", notes: "Custom name allowed", requiredRank: "Specialist", defaultPrice: 150, isGenericTemplate: true },
  { name: "Generic Pills", category: "medicine", dosageForm: "pill", notes: "Custom name allowed", requiredRank: "Specialist", defaultPrice: 150, isGenericTemplate: true },
  { name: "Burn Cream", category: "medicine", dosageForm: "cream", notes: "Specialist", requiredRank: "Specialist", defaultPrice: 150, isGenericTemplate: false },
  { name: "Amoxicillin", category: "medicine", dosageForm: "capsule", notes: "Specialist", requiredRank: "Specialist", defaultPrice: 100, isGenericTemplate: false },
  { name: "Paracetamol", category: "medicine", dosageForm: "pill", notes: "Specialist", requiredRank: "Specialist", defaultPrice: 200, isGenericTemplate: false },
  { name: "Adrenaline", category: "medicine", dosageForm: "injection", notes: "Only Sergeant", requiredRank: "Sergeant", defaultPrice: 1000, isGenericTemplate: false },
  { name: "Painkiller", category: "medicine", dosageForm: "pill", notes: "Specialist", requiredRank: "Specialist", defaultPrice: 100, isGenericTemplate: false },
  { name: "Antibiotic", category: "medicine", dosageForm: "pill", notes: "Specialist", requiredRank: "Specialist", defaultPrice: 100, isGenericTemplate: false },
] as const;

let seeded = false;

export async function ensureMedicalSeeds(): Promise<void> {
  if (seeded) return;

  let prices: Array<unknown> = [];
  let medicines: Array<unknown> = [];
  try {
    [prices, medicines] = await Promise.all([
      db.select().from(priceCatalogTable),
      db.select().from(medicineCatalogTable),
    ]);
  } catch (error) {
    if (isMissingMedicalConfigTableError(error)) {
      console.warn("[medical-seed] price/medicine catalog tables are missing; continuing with legacy defaults.");
      seeded = true;
      return;
    }
    throw error;
  }

  if (prices.length === 0) {
    await db.insert(priceCatalogTable).values(PRICE_SEED as any);
  }

  if (medicines.length === 0) {
    await db.insert(medicineCatalogTable).values(MEDICINE_SEED as any);
  }

  seeded = true;
}

function isMissingMedicalConfigTableError(error: unknown) {
  const code = typeof error === "object" && error !== null ? (error as { code?: string }).code : undefined;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return code === "ER_NO_SUCH_TABLE" || /price_catalog|medicine_catalog|doesn't exist/i.test(message);
}
