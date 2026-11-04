export const runtime = 'nodejs';

/** Fonctions dépendant d'une clé ou d'une option : le client les désactive proprement. */
export async function GET() {
  return Response.json({
    arcgis: !!process.env.ARCGIS_API_KEY,
    ors: !!process.env.ORS_API_KEY,
    noncommercial: process.env.ENABLE_NONCOMMERCIAL_SOURCES === 'true',
    contact: !!(process.env.CHUILACARTE_CONTACT || process.env.CONTACT_EMAIL),
  });
}
