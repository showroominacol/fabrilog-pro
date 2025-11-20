import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Factory, Package, Users, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface DetalleProducto {
  id: string;
  producto_id: string;
  produccion_real: number;
  observaciones: string | null;
  porcentaje_cumplimiento: number;
  producto: {
    nombre: string;
    tope: number | null;
    tope_jornada_8h: number | null;
    tope_jornada_10h: number | null;
  };
}

interface RegistroData {
  id: string;
  fecha: string;
  turno: string;
  maquina_id: string;
  operario_id: string;
  es_asistente: boolean;
  maquina: {
    nombre: string;
    categoria: string | null;
  };
  operario: {
    nombre: string;
    cedula: string;
  };
  detalles: DetalleProducto[];
}

export default function AdminEditarRegistro() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [registro, setRegistro] = useState<RegistroData | null>(null);

  // Datos para edición
  const [fecha, setFecha] = useState<string>("");
  const [operarioId, setOperarioId] = useState<string>("");
  const [turno, setTurno] = useState<string>("");
  const [detalles, setDetalles] = useState<DetalleProducto[]>([]);
  const [operarios, setOperarios] = useState<{ id: string; nombre: string; cedula: string }[]>([]);
  const [asistentes, setAsistentes] = useState<string[]>([]);

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
    if (id) {
      loadRegistro();
      loadOperarios();
    }
  }, [id]);

  const loadOperarios = async () => {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, nombre, cedula")
      .eq("activo", true)
      .eq("tipo_usuario", "operario")
      .order("nombre");

    if (!error && data) {
      setOperarios(data);
    }
  };

  const loadRegistro = async () => {
    try {
      setLoading(true);

      // Cargar registro con relaciones
      const { data: registroData, error: registroError } = await supabase
        .from("registros_produccion")
        .select(`
          id,
          fecha,
          turno,
          maquina_id,
          operario_id,
          es_asistente,
          maquinas!registros_produccion_maquina_id_fkey (
            nombre,
            categoria
          ),
          usuarios!registros_produccion_operario_id_fkey (
            nombre,
            cedula
          )
        `)
        .eq("id", id)
        .single();

      if (registroError) throw registroError;

      // Cargar detalles de producción
      const { data: detallesData, error: detallesError } = await supabase
        .from("detalle_produccion")
        .select(`
          id,
          producto_id,
          produccion_real,
          observaciones,
          porcentaje_cumplimiento,
          productos!detalle_produccion_producto_id_fkey (
            nombre,
            tope,
            tope_jornada_8h,
            tope_jornada_10h
          )
        `)
        .eq("registro_id", id);

      if (detallesError) throw detallesError;

      // Cargar asistentes
      const { data: asistentesData, error: asistentesError } = await supabase
        .from("registro_asistentes")
        .select("asistente_id")
        .eq("registro_id", id);

      if (asistentesError) throw asistentesError;

      const registroCompleto: RegistroData = {
        id: registroData.id,
        fecha: registroData.fecha,
        turno: registroData.turno,
        maquina_id: registroData.maquina_id,
        operario_id: registroData.operario_id,
        es_asistente: registroData.es_asistente,
        maquina: {
          nombre: registroData.maquinas?.nombre || "N/A",
          categoria: registroData.maquinas?.categoria || null,
        },
        operario: {
          nombre: registroData.usuarios?.nombre || "N/A",
          cedula: registroData.usuarios?.cedula || "N/A",
        },
        detalles: detallesData.map(d => ({
          id: d.id,
          producto_id: d.producto_id,
          produccion_real: d.produccion_real,
          observaciones: d.observaciones,
          porcentaje_cumplimiento: d.porcentaje_cumplimiento,
          producto: {
            nombre: d.productos?.nombre || "N/A",
            tope: d.productos?.tope || null,
            tope_jornada_8h: d.productos?.tope_jornada_8h || null,
            tope_jornada_10h: d.productos?.tope_jornada_10h || null,
          }
        }))
      };

      setRegistro(registroCompleto);
      setFecha(registroCompleto.fecha);
      setOperarioId(registroCompleto.operario_id);
      setTurno(registroCompleto.turno);
      setDetalles(registroCompleto.detalles);
      setAsistentes(asistentesData?.map(a => a.asistente_id) || []);

    } catch (error) {
      console.error("Error al cargar registro:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar el registro",
        variant: "destructive",
      });
      navigate("/admin/registros-maquinas");
    } finally {
      setLoading(false);
    }
  };

  const calcularPorcentaje = (produccion: number, tope: number | null, turnoActual: string) => {
    if (!tope) return 0;
    
    // Determinar el tope correcto según el turno
    let topeAplicable = tope;
    if (turnoActual === "7:00am - 5:00pm") {
      // Turno de 10 horas
      topeAplicable = tope * 1.25; // 10/8 = 1.25
    }
    
    return (produccion / topeAplicable) * 100;
  };

  const handleProduccionChange = (detalleId: string, value: string) => {
    const produccion = parseInt(value) || 0;
    setDetalles(detalles.map(d => {
      if (d.id === detalleId) {
        const tope = d.producto.tope_jornada_8h || d.producto.tope;
        const porcentaje = calcularPorcentaje(produccion, tope, turno);
        return {
          ...d,
          produccion_real: produccion,
          porcentaje_cumplimiento: porcentaje
        };
      }
      return d;
    }));
  };

  const handleObservacionChange = (detalleId: string, value: string) => {
    setDetalles(detalles.map(d => 
      d.id === detalleId ? { ...d, observaciones: value } : d
    ));
  };

  const handleTurnoChange = (newTurno: string) => {
    setTurno(newTurno);
    // Recalcular porcentajes con el nuevo turno
    setDetalles(detalles.map(d => {
      const tope = d.producto.tope_jornada_8h || d.producto.tope;
      const porcentaje = calcularPorcentaje(d.produccion_real, tope, newTurno);
      return {
        ...d,
        porcentaje_cumplimiento: porcentaje
      };
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Validaciones
      if (!turno) {
        toast({
          title: "Error",
          description: "Debe seleccionar un turno",
          variant: "destructive",
        });
        return;
      }

      if (!operarioId) {
        toast({
          title: "Error",
          description: "Debe seleccionar un operario",
          variant: "destructive",
        });
        return;
      }

      if (!fecha) {
        toast({
          title: "Error",
          description: "Debe seleccionar una fecha",
          variant: "destructive",
        });
        return;
      }

      // Actualizar registro de producción
      const { error: registroError } = await supabase
        .from("registros_produccion")
        .update({ 
          turno: turno as any,
          operario_id: operarioId,
          fecha: fecha
        })
        .eq("id", id);

      if (registroError) throw registroError;

      // Actualizar detalles de producción
      for (const detalle of detalles) {
        const { error: detalleError } = await supabase
          .from("detalle_produccion")
          .update({
            produccion_real: detalle.produccion_real,
            observaciones: detalle.observaciones,
            porcentaje_cumplimiento: detalle.porcentaje_cumplimiento
          })
          .eq("id", detalle.id);

        if (detalleError) throw detalleError;
      }

      // Actualizar asistentes: eliminar los existentes y agregar los nuevos
      const { error: deleteAsistentesError } = await supabase
        .from("registro_asistentes")
        .delete()
        .eq("registro_id", id);

      if (deleteAsistentesError) throw deleteAsistentesError;

      // Insertar nuevos asistentes
      if (asistentes.length > 0) {
        const { error: insertAsistentesError } = await supabase
          .from("registro_asistentes")
          .insert(
            asistentes.map(asistenteId => ({
              registro_id: id,
              asistente_id: asistenteId
            }))
          );

        if (insertAsistentesError) throw insertAsistentesError;
      }

      toast({
        title: "Éxito",
        description: "Registro actualizado correctamente",
      });

      navigate("/admin/registros-maquinas");

    } catch (error) {
      console.error("Error al guardar:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar el registro",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!registro) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No se encontró el registro</p>
      </div>
    );
  }

  const porcentajePromedio = detalles.length > 0
    ? detalles.reduce((sum, d) => sum + d.porcentaje_cumplimiento, 0) / detalles.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate("/admin/registros-maquinas")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Registros
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Editar Registro</h1>
          <p className="text-muted-foreground mt-1">
            Modificar datos del registro de producción
          </p>
        </div>
        <Badge variant={porcentajePromedio >= 80 ? "default" : porcentajePromedio >= 60 ? "secondary" : "destructive"}>
          Cumplimiento: {porcentajePromedio.toFixed(1)}%
        </Badge>
      </div>

      {/* Información del Registro */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" />
            Información del Registro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha *</Label>
              <Input
                id="fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="operario">Operario *</Label>
              <Select value={operarioId} onValueChange={setOperarioId}>
                <SelectTrigger id="operario">
                  <SelectValue placeholder="Seleccionar operario" />
                </SelectTrigger>
                <SelectContent>
                  {operarios.map(op => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.nombre} - {op.cedula}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Máquina</Label>
              <p className="font-medium mt-1">{registro.maquina.nombre}</p>
              {registro.maquina.categoria && (
                <Badge variant="outline" className="mt-1">{registro.maquina.categoria}</Badge>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="turno">Turno *</Label>
              <Select value={turno} onValueChange={handleTurnoChange}>
                <SelectTrigger id="turno">
                  <SelectValue placeholder="Seleccionar turno" />
                </SelectTrigger>
                <SelectContent>
                  {turnos.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Asistentes</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {operarios.filter(op => op.id !== operarioId).map(op => (
                <label key={op.id} className="flex items-center space-x-2 cursor-pointer p-2 rounded border hover:bg-accent">
                  <input
                    type="checkbox"
                    checked={asistentes.includes(op.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAsistentes([...asistentes, op.id]);
                      } else {
                        setAsistentes(asistentes.filter(id => id !== op.id));
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">{op.nombre}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detalles de Producción */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Producción por Producto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {detalles.map((detalle, index) => (
            <div key={detalle.id} className="p-4 border rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{detalle.producto.nombre}</h3>
                <Badge variant={detalle.porcentaje_cumplimiento >= 80 ? "default" : detalle.porcentaje_cumplimiento >= 60 ? "secondary" : "destructive"}>
                  {detalle.porcentaje_cumplimiento.toFixed(1)}%
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`produccion-${detalle.id}`}>Producción Real *</Label>
                  <Input
                    id={`produccion-${detalle.id}`}
                    type="number"
                    min="0"
                    value={detalle.produccion_real}
                    onChange={(e) => handleProduccionChange(detalle.id, e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Tope: {detalle.producto.tope_jornada_8h || detalle.producto.tope || "N/A"}
                    {turno === "7:00am - 5:00pm" && " (ajustado a 10h)"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`observaciones-${detalle.id}`}>Observaciones</Label>
                  <Textarea
                    id={`observaciones-${detalle.id}`}
                    value={detalle.observaciones || ""}
                    onChange={(e) => handleObservacionChange(detalle.id, e.target.value)}
                    placeholder="Comentarios adicionales..."
                    rows={3}
                  />
                </div>
              </div>

              {index < detalles.length - 1 && <Separator className="mt-4" />}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Botones de acción */}
      <div className="flex gap-4 justify-end">
        <Button
          variant="outline"
          onClick={() => navigate("/admin/registros-maquinas")}
          disabled={saving}
        >
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Guardar Cambios
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
