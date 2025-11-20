import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Factory, Search, Calendar, Edit, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface RegistroProduccion {
  id: string;
  fecha: string;
  turno: string;
  maquina: {
    nombre: string;
    categoria: string | null;
  };
  operario: {
    nombre: string;
    cedula: string;
  };
  asistentes: {
    nombre: string;
    cedula: string;
  }[];
  porcentaje_cumplimiento: number;
  produccion_total: number;
}

export default function AdminRegistrosMaquinas() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [registros, setRegistros] = useState<RegistroProduccion[]>([]);
  const [filteredRegistros, setFilteredRegistros] = useState<RegistroProduccion[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [maquinas, setMaquinas] = useState<{ id: string; nombre: string }[]>([]);
  const [operarios, setOperarios] = useState<{ id: string; nombre: string }[]>([]);
  const [filtroMaquina, setFiltroMaquina] = useState("");
  const [filtroOperario, setFiltroOperario] = useState("");
  const [filtroTurno, setFiltroTurno] = useState("all");
  const [filtroFechaInicio, setFiltroFechaInicio] = useState("");
  const [filtroFechaFin, setFiltroFechaFin] = useState("");
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  const turnos = [
    "6:00am - 2:00pm",
    "2:00pm - 10:00pm",
    "10:00pm - 6:00am",
    "7:00am - 5:00pm",
    "7:00am - 3:00pm",
    "7:00am - 3:30pm",
    "12:00pm - 6:00pm",
    "2:00pm - 5:00pm",
  ];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [registros, filtroMaquina, filtroOperario, filtroTurno, filtroFechaInicio, filtroFechaFin]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Cargar solo registros principales (no asistentes)
      const { data: registrosData, error: registrosError } = await supabase
        .from("registros_produccion")
        .select(`
          id,
          fecha,
          turno,
          maquina_id,
          operario_id,
          maquinas!registros_produccion_maquina_id_fkey (
            nombre,
            categoria
          ),
          usuarios!registros_produccion_operario_id_fkey (
            nombre,
            cedula
          )
        `)
        .eq("es_asistente", false)
        .order("fecha", { ascending: false })
        .order("turno", { ascending: false });

      if (registrosError) throw registrosError;

      // Cargar asistentes
      const registroIds = registrosData?.map(r => r.id) || [];
      const { data: asistentesData, error: asistentesError } = await supabase
        .from("registro_asistentes")
        .select(`
          registro_id,
          usuarios!registro_asistentes_asistente_id_fkey (
            nombre,
            cedula
          )
        `)
        .in("registro_id", registroIds);

      if (asistentesError) throw asistentesError;

      // Cargar detalles de producción para calcular porcentajes
      const { data: detallesData, error: detallesError } = await supabase
        .from("detalle_produccion")
        .select("registro_id, produccion_real, porcentaje_cumplimiento")
        .in("registro_id", registroIds);

      if (detallesError) throw detallesError;

      // Agrupar detalles por registro
      const detallesPorRegistro = detallesData?.reduce((acc, detalle) => {
        if (!acc[detalle.registro_id]) {
          acc[detalle.registro_id] = [];
        }
        acc[detalle.registro_id].push(detalle);
        return acc;
      }, {} as Record<string, typeof detallesData>);

      // Agrupar asistentes por registro
      const asistentesPorRegistro = asistentesData?.reduce((acc, item) => {
        if (!acc[item.registro_id]) {
          acc[item.registro_id] = [];
        }
        acc[item.registro_id].push({
          nombre: item.usuarios?.nombre || "N/A",
          cedula: item.usuarios?.cedula || "N/A",
        });
        return acc;
      }, {} as Record<string, { nombre: string; cedula: string }[]>);

      // Procesar registros
      const registrosProcesados = registrosData?.map(registro => {
        const detalles = detallesPorRegistro[registro.id] || [];
        const produccionTotal = detalles.reduce((sum, d) => sum + (d.produccion_real || 0), 0);
        const porcentajePromedio = detalles.length > 0
          ? detalles.reduce((sum, d) => sum + (d.porcentaje_cumplimiento || 0), 0) / detalles.length
          : 0;

        return {
          id: registro.id,
          fecha: registro.fecha,
          turno: registro.turno,
          maquina: {
            nombre: registro.maquinas?.nombre || "N/A",
            categoria: registro.maquinas?.categoria || null,
          },
          operario: {
            nombre: registro.usuarios?.nombre || "N/A",
            cedula: registro.usuarios?.cedula || "N/A",
          },
          asistentes: asistentesPorRegistro?.[registro.id] || [],
          porcentaje_cumplimiento: porcentajePromedio,
          produccion_total: produccionTotal,
        };
      }) || [];

      setRegistros(registrosProcesados);

      // Cargar opciones para filtros
      const { data: maquinasData } = await supabase
        .from("maquinas")
        .select("id, nombre")
        .eq("activa", true)
        .order("nombre");
      
      const { data: operariosData } = await supabase
        .from("usuarios")
        .select("id, nombre")
        .eq("activo", true)
        .eq("tipo_usuario", "operario")
        .order("nombre");

      setMaquinas(maquinasData || []);
      setOperarios(operariosData || []);
      
    } catch (error) {
      console.error("Error al cargar registros:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los registros",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...registros];

    if (filtroMaquina) {
      filtered = filtered.filter(r => r.maquina.nombre.toLowerCase().includes(filtroMaquina.toLowerCase()));
    }

    if (filtroOperario) {
      filtered = filtered.filter(r => 
        r.operario.nombre.toLowerCase().includes(filtroOperario.toLowerCase()) ||
        r.operario.cedula.includes(filtroOperario)
      );
    }

    if (filtroTurno && filtroTurno !== "all") {
      filtered = filtered.filter(r => r.turno === filtroTurno);
    }

    if (filtroFechaInicio) {
      filtered = filtered.filter(r => r.fecha >= filtroFechaInicio);
    }

    if (filtroFechaFin) {
      filtered = filtered.filter(r => r.fecha <= filtroFechaFin);
    }

    setFilteredRegistros(filtered);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFiltroMaquina("");
    setFiltroOperario("");
    setFiltroTurno("all");
    setFiltroFechaInicio("");
    setFiltroFechaFin("");
  };

  const getBadgeVariant = (porcentaje: number) => {
    if (porcentaje >= 80) return "default";
    if (porcentaje >= 60) return "secondary";
    return "destructive";
  };

  // Paginación
  const totalPages = Math.ceil(filteredRegistros.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentRegistros = filteredRegistros.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Factory className="h-8 w-8 text-primary" />
            Registros por Máquina
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona y edita los registros de producción por máquina
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filtros de Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Máquina</Label>
              <Input
                placeholder="Buscar por nombre de máquina"
                value={filtroMaquina}
                onChange={(e) => setFiltroMaquina(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Operario</Label>
              <Input
                placeholder="Buscar por nombre o cédula"
                value={filtroOperario}
                onChange={(e) => setFiltroOperario(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Turno</Label>
              <Select value={filtroTurno} onValueChange={setFiltroTurno}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los turnos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los turnos</SelectItem>
                  {turnos.map(turno => (
                    <SelectItem key={turno} value={turno}>{turno}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fecha Inicio</Label>
              <Input
                type="date"
                value={filtroFechaInicio}
                onChange={(e) => setFiltroFechaInicio(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Fecha Fin</Label>
              <Input
                type="date"
                value={filtroFechaFin}
                onChange={(e) => setFiltroFechaFin(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={clearFilters} className="w-full">
                Limpiar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de registros */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : currentRegistros.length === 0 ? (
            <div className="text-center py-12">
              <Factory className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No se encontraron registros</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Máquina</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Turno</TableHead>
                      <TableHead>Operario / Asistentes</TableHead>
                      <TableHead>Producción</TableHead>
                      <TableHead>Cumplimiento</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentRegistros.map((registro) => (
                      <TableRow key={registro.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {registro.id.substring(0, 8)}...
                        </TableCell>
                        <TableCell className="font-medium">
                          {format(new Date(registro.fecha), "dd MMM yyyy", { locale: es })}
                        </TableCell>
                        <TableCell>{registro.maquina.nombre}</TableCell>
                        <TableCell>
                          {registro.maquina.categoria ? (
                            <Badge variant="outline">{registro.maquina.categoria}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{registro.turno}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{registro.operario.nombre}</div>
                            {registro.asistentes.length > 0 && (
                              <div className="text-xs text-muted-foreground">
                                Asist: {registro.asistentes.map(a => a.nombre).join(", ")}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{registro.produccion_total.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={getBadgeVariant(registro.porcentaje_cumplimiento)}>
                            {registro.porcentaje_cumplimiento.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/admin/registros-maquinas/${registro.id}`)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {startIndex + 1} - {Math.min(endIndex, filteredRegistros.length)} de {filteredRegistros.length} registros
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
