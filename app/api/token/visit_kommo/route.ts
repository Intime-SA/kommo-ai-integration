import { NextRequest, NextResponse } from "next/server";
import { createTokenVisit } from "@/lib/mongodb-services";
import { nanoid } from "nanoid";

// Función para generar un token aleatorio usando nanoid
function generateShortToken(): string {
  // Genera un token único de 8 caracteres usando nanoid
  return nanoid(8);
}

export async function POST(request: NextRequest) {
  try {
    // Parsear el body del request
    const body = await request.json();

    // Extraer los datos del payload
    const { lead } = body;

    // Validar que el lead esté presente
    if (!lead) {
      return NextResponse.json(
        {
          success: false,
          error: "El campo 'lead' es requerido",
        },
        { status: 400 }
      );
    }

    // Generar token aleatorio
    const token = generateShortToken();

    // Guardar en la base de datos
    const tokenVisitDocument = await createTokenVisit({
      token,
      lead,
    });

    console.log("Token visit document:", tokenVisitDocument);

    // Retornar el token con status 200
    return NextResponse.json({
      success: true,
      token: token,
      redirectNumber: tokenVisitDocument.redirectNumber,
      message: tokenVisitDocument.message,
      successMessage: "Token generado correctamente",
    });
  } catch (error) {
    console.error("Error en endpoint /api/token/visit_kommo:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Endpoint de token visit activo",
    timestamp: new Date().toISOString(),
    status: "healthy",
  });
}
