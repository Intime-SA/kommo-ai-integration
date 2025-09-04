import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Bot, Activity, Settings } from "lucide-react"

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Kommo AI Integration</h1>
            <p className="text-muted-foreground">Procesamiento automático de mensajes con IA</p>
          </div>
          <Badge variant="outline" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Sistema Activo
          </Badge>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mensajes Procesados</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,234</div>
              <p className="text-xs text-muted-foreground">+20.1% desde ayer</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cambios de Status</CardTitle>
              <Bot className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">89</div>
              <p className="text-xs text-muted-foreground">+12% desde ayer</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Precisión IA</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">94.2%</div>
              <p className="text-xs text-muted-foreground">+2.1% desde ayer</p>
            </CardContent>
          </Card>
        </div>

        {/* Status Categories */}
        <Card>
          <CardHeader>
            <CardTitle>Estados de Lead Disponibles</CardTitle>
            <CardDescription>Categorías que la IA puede asignar automáticamente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Badge variant="secondary">Revisar</Badge>
                <span className="text-sm text-muted-foreground">Dudas fuera del menú</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="default">Pidió Usuario</Badge>
                <span className="text-sm text-muted-foreground">Solicita credenciales</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">Pidió CBU/Alias</Badge>
                <span className="text-sm text-muted-foreground">Solicita datos bancarios</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className="bg-green-500">Cargó $</Badge>
                <span className="text-sm text-muted-foreground">Primera carga exitosa</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="destructive">No Cargó</Badge>
                <span className="text-sm text-muted-foreground">Sin actividad de carga</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className="bg-gray-500">No Atender</Badge>
                <span className="text-sm text-muted-foreground">Cliente problemático</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Actividad Reciente</CardTitle>
            <CardDescription>Últimos mensajes procesados por la IA</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div>
                    <p className="font-medium">Ramiro Arce</p>
                    <p className="text-sm text-muted-foreground">"Necesito el usuario para ingresar"</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="default">Pidió Usuario</Badge>
                  <p className="text-xs text-muted-foreground mt-1">hace 2 min</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div>
                    <p className="font-medium">María González</p>
                    <p className="text-sm text-muted-foreground">"¿Cuál es el CBU para transferir?"</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline">Pidió CBU/Alias</Badge>
                  <p className="text-xs text-muted-foreground mt-1">hace 5 min</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
