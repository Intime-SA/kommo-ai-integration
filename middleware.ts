import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Lista de orígenes permitidos
const allowedOrigins = [

  // kommo.paybot.app
  'https://kommo.paybot.app',

  // backs
  'https://kommo-ai-dashboard.vercel.app',

  // redirects kommo
  'https://guba-redirect.vercel.app', // guba redirect
  'https://guba-redirect-777.vercel.app', // guba redirect
  'https://guba-redirect-888.vercel.app', // guba redirect

  // landings redirects token/campaigns
  'https://redirect-hernan-2.vercel.app',
  'https://redirect-tee-1.vercel.app',

/*   'http://localhost:3000',  // Frontend típico
  'http://127.0.0.1:3000', // Frontend alternativo
  'http://localhost:3001', // Si el backend está en 3001
  'http://127.0.0.1:3001',
  'http://localhost:3002', // Si el backend está en 3002
  'http://127.0.0.1:3002',
  'http://localhost:4000', // Otro puerto común
  'http://localhost:8080', // Otro puerto común */
];

export function middleware(request: NextRequest) {
  // Solo aplicar middleware a rutas de API
  if (!request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }
  // Obtener el origen de la request
  const origin = request.headers.get('origin') || '';
  const isAllowedOrigin = allowedOrigins.includes(origin) || origin === '';

  // Para requests no permitidas, devolver error
  if (!isAllowedOrigin && origin !== '') {
    return new NextResponse('CORS policy violation', { status: 403 });
  }

  // Manejar preflight requests (OPTIONS)
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400', // 24 horas
      },
    });
  }

  // Para otras requests, agregar headers CORS
  const response = NextResponse.next();

  // Solo agregar headers si no existen (por si ya están configurados en next.config.mjs)
  if (!response.headers.has('Access-Control-Allow-Origin')) {
    response.headers.set('Access-Control-Allow-Origin', origin || '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};

